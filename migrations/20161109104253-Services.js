'use strict';
module.exports = {
    up: function(queryInterface, Sequelize) {
      
            return queryInterface.createTable('Services',            {
                "id": {
                    "type": "INTEGER",
                    "primaryKey": true,
                    "autoIncrement": true
                },
                "url": {
                    "type": "VARCHAR(255)",
                    "unique": true
                },
                "code": {
                    "type": "VARCHAR(255)",
                    "unique": true
                },
                "name": {
                    "type": "VARCHAR(255)"
                },
                "createdAt": {
                    "type": "DATETIME",
                    "allowNull": false
                },
                "updatedAt": {
                    "type": "DATETIME",
                    "allowNull": false
                }
            });
    },
    down: function(queryInterface, Sequelize) {
       return queryInterface.dropTable('Services');
    }
};