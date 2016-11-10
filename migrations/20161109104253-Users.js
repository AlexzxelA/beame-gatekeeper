'use strict';
module.exports = {
    up: function(queryInterface, Sequelize) {
      
            return queryInterface.createTable('Users',            {
                "id": {
                    "type": "INTEGER",
                    "primaryKey": true,
                    "autoIncrement": true
                },
                "fqdn": {
                    "type": "VARCHAR(255)",
                    "unique": true,
                    "allowNull": false
                },
                "name": {
                    "type": "VARCHAR(255)",
                    "allowNull": true
                },
                "email": {
                    "type": "VARCHAR(255)",
                    "unique": true,
                    "allowNull": true
                },
                "externalUserId": {
                    "type": "VARCHAR(255)",
                    "unique": true,
                    "allowNull": true
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
       return queryInterface.dropTable('Users');
    }
};