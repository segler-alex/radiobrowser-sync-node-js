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

const q = async.queue(insertWorker, 4);
let LAST_DOWNLOAD = null;

q.drain = ()=>{
  logger.info('Insert queue drained');
}

let IMPORT_CHANGES_COUNTER = 0;

setInterval(()=>{
  let l = q.length();
  if (l > 0){
    logger.info('Station status update queue length:'+q.length());
  }
},10000);

/*setInterval(()=>{
  logger.info('Imported ' + IMPORT_CHANGES_COUNTER + ' changes');
},10000);*/

function insertWorker(task, cb){
  updateStationInMainTable(task.stationuuid).then(()=>{
    IMPORT_CHANGES_COUNTER++;
    cb();
  }).catch((err)=>{
    cb(err);
  });
}

function queuePushPromisified(stationuuid){
  return new Promise((resolve,reject)=>{
    q.push({stationuuid},function(err, result){
      if (err){
        return reject(err);
      }else{
        return resolve(result);
      }
    });
  })
}

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

function updateStationInMainTable(stationuuid){
  return db.StationHistory.findOne(
    {
      where: {StationUuid: stationuuid},
      order: [['Creation','DESC']]
    }
  ).then((station)=>{
    if (!station){
      logger.error('Could not find history entry for: '+stationuuid);
      return;
    }
    let stationCopy = {
      StationUuid: station.StationUuid,
      ChangeUuid: station.ChangeUuid,
      Name: station.Name,
      Url: station.Url,
      Homepage: station.Homepage,
      Favicon: station.Favicon,
      Tags: station.Tags,
      Country: station.Country,
      Subcountry: station.Subcountry,
      Language: station.Language,
      Votes: station.Votes,
      NegativeVotes: station.NegativeVotes,
      Creation: station.Creation,
      IP: station.IP
    };
    // try to insert it, will fail if it is already there
    return db.Station.create(stationCopy).then(()=>{
      //logger.info('CREATE OK: ' + stationuuid);
      stationCopy.action = 'created';
    }).catch((err)=>{
      //logger.info('CREATE NOT OK: ' + stationuuid);
      return db.Station.update(stationCopy, {
        where: {StationUuid: stationuuid}
      }).then(()=>{
        stationCopy.action = 'updated';
      }).catch((err)=>{
        stationCopy.action = 'failed';
        logger.error("could not update:"+stationuuid);
      });
    }).then(()=>{
      return stationCopy;
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
  if (LAST_DOWNLOAD){
    let now = new Date();
    let diff = (now.getTime() - LAST_DOWNLOAD.getTime()) / 1000;
    logger.info('Seconds since last download: ' + diff);
    seconds = Math.ceil(diff * 2);
  }else{
    seconds = 0;
  }
  LAST_DOWNLOAD=new Date();
  return Promise.resolve().then(() => {
    logger.debug('Get incremental changes from webservice..');
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
    logger.debug('Importing ' + stations.length + ' changes..');
    for (let i=0;i<stations.length;i++){
      let obj = stations[i];
      all.push(insertStationHistoryEntry(obj));
    }
    return Promise.all(all);
  }).then((items)=>{
    // filter out items we could not add to history table
    let inserted = items.filter((item)=>{
      return item.insertOK;
    });
    logger.debug('Inserted ' + inserted.length + ' in history table');
    // check all stations that we inserted new changes in history table
    let list = inserted.map((item)=>{
      return queuePushPromisified(item.StationUuid);
    });
    return Promise.all(list);
  }).then((list)=>{
    return list.length;
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
