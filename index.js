'use strict';

const db = require('./models');
const rp = require('request-promise');
const async = require('async');

const SYNC_BASE_URL = process.env.SYNC_BASE_URL || exitWithError('SYNC_BASE_URL');
const USER_AGENT = 'radiobrowsersync/0.0.1';
const SYNC_INTERVAL = parseInt(process.env.SYNC_INTERVAL) || exitWithError('SYNC_INTERVAL');
const SYNC_INTERVAL_MSEC = SYNC_INTERVAL * 1000;

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
  console.error('Missing ' + str);
  process.exit(1);
}

function initialSync(){
  return Promise.resolve().then(() => {
    console.log('Get stations from webservice..');
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
    console.log('Importing ' + stations.length + ' stations..');
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
    console.log('Get incremental changes from webservice..');
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
    console.log('Importing ' + stations.length + ' changes..');
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
  console.log('doIncrementalSync()');
  incrementalSync(SYNC_INTERVAL * 2).then(()=>{
    console.log('Incremental sync done');
  }).catch((err)=>{
    console.log(err);
  }).then(()=>{
    setTimeout(doIncrementalSync, SYNC_INTERVAL_MSEC);
  });
}

retryPromise(10, 3000, function () {
  console.log('Connecting to db..');
  return db.sequelize.authenticate();
})
  .then(() => {
    console.log('Recreate db tables..');
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
    setTimeout(doIncrementalSync, SYNC_INTERVAL_MSEC);
    // return db.sequelize.close();
  })
  .catch(err => {
    console.error('Unable to connect to the database:', err);
    process.exit(1);
  });
