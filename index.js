'use strict';

const db = require('./models');
const rp = require('request-promise');

console.log('Connecting to db..');
db.sequelize
  .authenticate()
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
      uri: 'http://localhost/webservice/json/stations',
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
