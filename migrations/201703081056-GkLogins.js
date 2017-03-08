'use strict';
module.exports = {
    up: function(queryInterface, Sequelize) {

	    return queryInterface.createTable('GkLogins', {
		    id:             {
			    allowNull:     false,
			    autoIncrement: true,
			    primaryKey:    true,
			    type:          Sequelize.INTEGER
		    },
		    fqdn:           {
			    type: Sequelize.STRING,
			    unique:true,
			    allowNull: false
		    },
		    name:          {
			    type:      Sequelize.STRING,
			    allowNull: false
		    },
		    isActive: {
			    type: Sequelize.BOOLEAN,
			    allowNull: false,
			    defaultValue:true
		    },
		    createdAt:      {
			    allowNull: false,
			    type:      Sequelize.DATE
		    },
		    updatedAt:      {
			    allowNull: false,
			    type:      Sequelize.DATE
		    }
	    });
    },
    down: function(queryInterface, Sequelize) {
       return queryInterface.dropTable('GkLogins');
    }
};