'use strict';

var fs = require('fs');
var path = require('path');
var Sequelize = require('sequelize');
var basename = path.basename(__filename);
var db = {};

const DB_HOST = process.env.DB_HOST || exitWithError('DB_HOST');
const DB_USER = process.env.DB_USER || exitWithError('DB_USER');
const DB_PASS = process.env.DB_PASS || exitWithError('DB_PASS');
const DB_NAME = process.env.DB_NAME || exitWithError('DB_NAME');

function exitWithError(str) {
  console.error('Missing ' + str);
  process.exit(1);
}

var sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASS, {
  host: DB_HOST,
  dialect: 'mysql',
  logging: false,

  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

fs
  .readdirSync(__dirname)
  .filter(file => {
    return (file.indexOf('.') !== 0) && (file !== basename) && (file.slice(-3) === '.js');
  })
  .forEach(file => {
    var model = sequelize['import'](path.join(__dirname, file));
    db[model.name] = model;
  });

Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
