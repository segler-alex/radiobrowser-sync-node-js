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
        Name: obj.name,
        Url: obj.url,
        Homepage: obj.homepage,
        Favicon: obj.favicon,
        Uuid: obj.stationuuid,
        Tags: obj.tags,
        Country: obj.country,
        Subcountry: obj.state,
        Language: obj.language,
        Votes: obj.votes,
        NegativeVotes: obj.negativevotes,
        Creation: obj.lastchangetime
      });
    }
    return db.Station.bulkCreate(all);
  });
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
      all.push({
        Name: obj.name,
        Url: obj.url,
        Homepage: obj.homepage,
        Favicon: obj.favicon,
        Uuid: obj.stationuuid,
        ChangeUuid: obj.changeuuid,
        Tags: obj.tags,
        Country: obj.country,
        Subcountry: obj.state,
        Language: obj.language,
        Votes: obj.votes,
        NegativeVotes: obj.negativevotes,
        Creation: obj.lastchangetime
      });
    }
    return db.StationHistory.bulkCreate(all);
  });
}

function doIncrementalSync(){
  incrementalSync(SYNC_INTERVAL * 2).then(()=>{
    logger.info('Incremental sync done');
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
