'use strict';
module.exports = (sequelize, DataTypes) => {
  var StationHistory = sequelize.define('StationHistory', {
    StationChangeID: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    StationUuid: {
      type: DataTypes.UUID
    },
    ChangeUuid: {
      type: DataTypes.UUID,
      unique: true
    },
    StationID: {
      type: DataTypes.INTEGER
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
    Subcountry: {
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
    IP: {
      type: DataTypes.STRING
    }
  }, {
    classMethods: {
      associate: function(models) {
        // associations can be defined here
      }
    },
    tableName: 'StationHistory',
    timestamps: false
  });
  return StationHistory;
};
