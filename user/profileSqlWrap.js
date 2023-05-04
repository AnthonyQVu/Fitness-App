'use strict'

const sql = require('sqlite3');
const util = require('util');


// old-fashioned database creation code 

// creates a new database object, not a 
// new database. 

const pr = new sql.Database("profiles.db");

// check if database exists


let cmdp = " SELECT name FROM sqlite_master WHERE type='table' AND name='Profile' ";



pr.get(cmdp, function (err, val) {
  if (val == undefined) {
        console.log("No profile database file - creating one");
        createProfileTable();
  } else {
        console.log("Profile database file found");
  }
});


// called to create table if needed


function createProfileTable() {
  const cmdp = 'CREATE TABLE Profile (rowIdNum INTEGER PRIMARY KEY, userid TEXT, name TEXT)';
  pr.run(cmdp, function(err, val) {
    if (err) {
      console.log("Profile database creation failure",err.message);
    } else {
      console.log("Created profile database");
    }
  });
}

// wrap all database commands in promises

pr.run = util.promisify(pr.run);
pr.get = util.promisify(pr.get);
pr.all = util.promisify(pr.all);



pr.deleteEverything = async function() {
  await pr.run("delete from Profile");
  pr.run("vacuum");
}


// allow code in index.js to use the db object
module.exports = pr;