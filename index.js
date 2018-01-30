'use strict';

const db = require('./models');
const rp = require('request-promise');
const async = require('async');
const createLogger = require('logging');

const SYNC_BASE_URL = process.env.SYNC_BASE_URL || exitWithError('SYNC_BASE_URL');
const USER_AGENT = 'radiobrowsersync/0.0.1';
const SYNC_INTERVAL = parseInt(process.env.SYNC_INTERVAL) || exitWithError('SYNC_INTERVAL');
const SYNC_INTERVAL_MSEC = SYNC_INTERVAL * 1000;

const logger = createLogger.default('SYNC');

function retryPromise(times, interval, cb_p){
  return new Promise((resolve,reject)=>{
    async.retry({times,interval}, (cb)=>{
      let p = cb_p();
      p.then((result)=>{
        cb(null, result);
      }).catch((perr)=>{
        cb(perr);
      });
    },(err,result)=>{
      if (err){
        reject(err);
      }else{
        resolve(result);
      }
    });
  });
}

function exitWithError(str) {
  logger.error('Missing ' + str);
  process.exit(1);
}

function initialSync(){
  return incrementalSync(0);
  /*
  return Promise.resolve().then(() => {
    logger.info('Get stations from webservice..');
    let options = {
      uri: SYNC_BASE_URL + '/json/stations',
      headers: {
        'User-Agent': USER_AGENT
      },
      json: true
    };
    return rp(options);
  })
  .then((stations)=>{
    let all = [];
    // console.log(JSON.stringify(stations[0],null,' '));
    logger.info('Importing ' + stations.length + ' stations..');
    for (let i=0;i<stations.length;i++){
      let obj = stations[i];
      all.push({
        StationUuid: obj.stationuuid,
        ChangeUuid: obj.changeuuid,
        Name: obj.name,
        Url: obj.url,
        Homepage: obj.homepage,
        Favicon: obj.favicon,
        Tags: obj.tags,
        Country: obj.country,
        Subcountry: obj.state,
        Language: obj.language,
        Votes: obj.votes,
        NegativeVotes: obj.negativevotes,
        Creation: obj.lastchangetime,
        IP: obj.ip
      });
    }
    return db.Station.bulkCreate(all);
  });
  */
}

function updateStationInMainTable(stationObj){
  return db.StationHistory.findOne(
    {
      where: {StationUuid: stationObj.StationUuid},
      order: [['Creation','DESC']]
    }
  ).then((station)=>{
    if (!station){
      logger.error('Could not find history entry for: '+stationObj.StationUuid);
      return;
    }

    // try to insert it, will fail if it is already there
    return db.Station.create(stationObj).then(()=>{
      //logger.info('CREATE OK: ' + stationObj.StationUuid);
    }).catch((err)=>{
      //logger.info('CREATE NOT OK: ' + stationObj.StationUuid);
      return db.Station.update(stationObj, {
        where: {StationUuid: stationObj.StationUuid}
      }).catch((err)=>{
        logger.error("could not update:"+stationObj.StationUuid);
      });
    });
  });
}

function insertStationHistoryEntry(obj){
  let s = {
    StationUuid: obj.stationuuid,
    ChangeUuid: obj.changeuuid,
    Name: obj.name,
    Url: obj.url,
    Homepage: obj.homepage,
    Favicon: obj.favicon,
    Tags: obj.tags,
    Country: obj.country,
    Subcountry: obj.state,
    Language: obj.language,
    Votes: obj.votes,
    NegativeVotes: obj.negativevotes,
    Creation: obj.lastchangetime,
    IP: obj.ip
  };
  let p = db.StationHistory.create(s)
  .then(()=>{
    s.insertOK = true;
    return updateStationInMainTable(s);
  })
  .catch((err)=>{
    s.insertOK = false;
  })
  .then(()=>{
    return s;
  });
  return p;
}

function incrementalSync(seconds){
  return Promise.resolve().then(() => {
    logger.info('Get incremental changes from webservice..');
    let options = {
      uri: SYNC_BASE_URL + '/json/stations/changed?seconds=' + seconds,
      headers: {
        'User-Agent': USER_AGENT
      },
      json: true
    };
    return rp(options);
  })
  .then((stations)=>{
    let all = [];
    // console.log(JSON.stringify(stations[0],null,' '));
    logger.info('Importing ' + stations.length + ' changes..');
    for (let i=0;i<stations.length;i++){
      let obj = stations[i];
      all.push(insertStationHistoryEntry(obj));
    }
    return Promise.all(all);
  }).then((items)=>{
    let inserted = items.filter((item)=>{
      return item.insertOK;
    });
    return inserted.length;
  });
}

function doIncrementalSync(){
  incrementalSync(SYNC_INTERVAL * 2).then((items)=>{
    logger.info('Incremental sync of '+items+' items done');
  }).catch((err)=>{
    logger.error(err);
  }).then(()=>{
    setTimeout(doIncrementalSync, SYNC_INTERVAL_MSEC);
  });
}

retryPromise(10, 3000, function () {
  logger.info('Connecting to db..');
  return db.sequelize.authenticate();
})
  .then(() => {
    logger.info('Recreate db tables..');
    return db.sequelize.sync({
      force: true
    });
  })
  .then(()=>{
    return initialSync();
  })
  .then(()=>{
  //   console.log('Selecting first station from DB..');
  //   return db.Station.findOne();
  // })
  // .then((s) => {
  //   console.log('Found station:' + JSON.stringify(s, null, ' '));
    logger.info('Initial sync done');
    setTimeout(doIncrementalSync, SYNC_INTERVAL_MSEC);
    // return db.sequelize.close();
  })
  .catch(err => {
    logger.error('Unable to connect to the database:', err);
    process.exit(1);
  });
