'use strict';

const db = require('./models');
const rp = require('request-promise');
const async = require('async');

const SYNC_BASE_URL = process.env.SYNC_BASE_URL || exitWithError('SYNC_BASE_URL');

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

retryPromise(10, 3000, function () {
  console.log('Connecting to db..');
  return db.sequelize.authenticate();
})
  .then(() => {
    console.log('OK');
    console.log('Recreate db tables..');
    return db.sequelize.sync({
      force: true
    });
  })
  .then(() => {
    console.log('OK');
    console.log('Get stations from webservice..');
    var options = {
      uri: SYNC_BASE_URL + '/json/stations',
      headers: {
        'User-Agent': 'radiobrowsersync/0.0.1'
      },
      json: true
    };
    return rp(options);
  })
  .then((stations)=>{
    console.log('OK');
    var all = [];
    // console.log(JSON.stringify(stations[0],null,' '));
    console.log('Importing ' + stations.length + ' stations..');
    for (var i=0;i<stations.length;i++){
      all.push({
        Name: stations[i].name,
        Url: stations[i].url,
        Homepage: stations[i].homepage,
        Favicon: stations[i].favicon,
        Uuid: stations[i].stationuuid,
        Tags: stations[i].tags,
        Country: stations[i].country,
        Subcountry: stations[i].state,
        Language: stations[i].language,
        Votes: stations[i].votes,
        NegativeVotes: stations[i].negativevotes,
        Creation: stations[i].lastchangetime
      });
    }
    return db.Station.bulkCreate(all);
  })
  .then(()=>{
    console.log('OK');
    return db.Station.findOne();
  })
  .then((s) => {
    console.log('Found station:' + JSON.stringify(s, null, ' '));
    return db.sequelize.close();
  })
  .catch(err => {
    console.error('Unable to connect to the database:', err);
    process.exit(1);
  });
