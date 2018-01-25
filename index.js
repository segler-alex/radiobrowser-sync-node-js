'use strict';

const db = require('./models');
const rp = require('request-promise');

db.sequelize
  .authenticate()
  .then(() => {
    console.log('Connection has been established successfully.');
    return db.Station.findOne().then((s) => {
      console.log(JSON.stringify(s, null, ' '));
    });
  })
  .catch(err => {
    console.error('Unable to connect to the database:', err);
    process.exit(1);
  });

  var options = {
      uri: 'http://localhost/webservice/json/stations/byname/bbc',
      headers: {
          'User-Agent': 'radiobrowsersync/0.0.1'
      },
      json: true
  };
  rp(options)
      .then(function (stations) {
          console.log("--"+stations.length);
          console.log("--"+JSON.stringify(stations[0],null,' '));
      })
      .catch(function (err) {
          console.error("--"+err);
      });
