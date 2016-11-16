'use strict';
module.exports = {
    up: function(queryInterface, Sequelize) {

            return queryInterface.createTable('Registrations',            {
                "id": {
                    "type": "INTEGER",
                    "primaryKey": true,
                    "autoIncrement": true
                },
                "name": {
                    "type": "VARCHAR(255)"
                },
                "email": {
                    "type": "VARCHAR(255)",
                    "allowNull": true
                },
                "externalUserId": {
                    "type": "VARCHAR(255)",
                    "allowNull": true
                },
                "hash": {
                    "type": "TEXT",
                    "unique": true
                },
                "hashValidTill": {
                    "type": "TIME"
                },
                "completed": {
                    "type": "TINYINT(1)",
                    "allowNull": false,
                    "defaultValue": false
                },
                "fqdn": {
                    "type": "VARCHAR(255)",
                    "unique": true
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
       return queryInterface.dropTable('Registrations');
    }
};