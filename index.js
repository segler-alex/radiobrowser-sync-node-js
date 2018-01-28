'use strict';

const db = require('./models');
const rp = require('request-promise');
const retry = require('retry-as-promised');

const SYNC_BASE_URL = process.env.SYNC_BASE_URL || exitWithError('SYNC_BASE_URL');

function exitWithError(str) {
  console.error('Missing ' + str);
  process.exit(1);
}

retry(function (options) {
  console.log('Connecting to db..');
  return db.sequelize.authenticate();
}, {
  max: 10, // maximum amount of tries
  timeout: 10000, // throw if no response or error within milisecnd timeout, default: undefined,
  backoffBase: 5000, // Initial backoff duration in ms. Default: 100,
  backoffExponent: 1.5, // Exponent to increase backoff each try. Default: 1.1
  name:  'SourceX' // if user supplies string, it will be used when composing error/reporting messages; else if retry gets a callback, uses callback name in erroring/reporting; else (default) uses litteral string 'unknown'
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
