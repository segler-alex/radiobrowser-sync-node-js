'use strict';
module.exports = (sequelize, DataTypes) => {
  var Station = sequelize.define('Station', {
    StationID: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    StationUuid: {
      type: DataTypes.UUID,
      unique: true
    },
    ChangeUuid: {
      type: DataTypes.UUID,
      unique: true
    },
    Name: {
      type: DataTypes.STRING
    },
    Url: {
      type: DataTypes.STRING
    },
    Homepage: {
      type: DataTypes.STRING
    },
    Favicon: {
      type: DataTypes.STRING
    },
    Creation: {
      type: DataTypes.DATE
    },
    Country: {
      type: DataTypes.STRING
    },
    Language: {
      type: DataTypes.STRING
    },
    Tags: {
      type: DataTypes.STRING
    },
    Votes: {
      type: DataTypes.INTEGER
    },
    NegativeVotes: {
      type: DataTypes.INTEGER
    },
    Source: {
      type: DataTypes.STRING
    },
    Subcountry: {
      type: DataTypes.STRING
    },
    clickcount: {
      type: DataTypes.INTEGER
    },
    ClickTrend: {
      type: DataTypes.INTEGER
    },
    ClickTimestamp: {
      type: DataTypes.DATE
    },
    Codec: {
      type: DataTypes.STRING
    },
    LastCheckOK: {
      type: DataTypes.BOOLEAN
    },
    LastCheckTime: {
      type: DataTypes.DATE
    },
    Bitrate: {
      type: DataTypes.INTEGER
    },
    UrlCache: {
      type: DataTypes.STRING
    },
    LastCheckOkTime: {
      type: DataTypes.DATE
    },
    Hls: {
      type: DataTypes.BOOLEAN
    },
    IP: {
      type: DataTypes.STRING
    }
  }, {
    classMethods: {
      associate: function(models) {
        // associations can be defined here
      }
    },
    tableName: 'Station',
    timestamps: false
  });
  return Station;
};
