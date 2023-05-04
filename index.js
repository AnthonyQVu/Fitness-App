'use strict'
const express = require('express');
const passport = require('passport');
const cookieSession = require('cookie-session');
const GoogleStrategy = require('passport-google-oauth20');
const pr = require('./user/profileSqlWrap');
const hiddenClientID = process.env['ClientID']
const hiddenClientSecret = process.env['ClientSecret']
const app = express();
const googleLoginData = {
    clientID: hiddenClientID,
    clientSecret: hiddenClientSecret,
    callbackURL: '/auth/accepted',
    proxy: true
};

passport.use(new GoogleStrategy(googleLoginData, gotProfile) );
app.use('/', printURL);

app.use(cookieSession({
    maxAge: 6 * 60 * 60 * 1000, // Six hours in milliseconds
    // after this user is logged out.
    keys: ['hanger waldo mercy dance']  
}));

app.use(passport.initialize()); 
app.use(passport.session()); 
app.get("/", (request, response) => {
  response.sendFile(__dirname + "/public/splash.html");
});

app.get('/*',express.static('public'));
app.get('/auth/google',
	passport.authenticate('google',{ scope: ['profile'] }) );
app.get('/auth/accepted',
	function (req, res, next) {
	    console.log("at auth/accepted");
	    next();
	},
	passport.authenticate('google'),
	function (req, res) {
	    console.log('Logged in and using cookies!')
	    res.redirect('/public/index.html');
	});

app.get('/*',
	isAuthenticated, 
	express.static('user') 
       ); 

app.get('/query', isAuthenticated,
    function (req, res) { 
      console.log("saw query");
      res.send('HTTP query!') });

app.get('/logout', function(req, res){
  req.logout();
  res.redirect('/splash.html');
});

app.get('/name', isAuthenticated, async function(req, res, next) {
  console.log("Server recieved a get get request at", req.url);
  userid = req.user.userid;
  result = await pr.all("select * from Profile where userid = ?",[userid]);
  res.send(result);
});

const dbo = require('./user/databaseOps');
const db = require('./user/sqlWrap');
const act = require('./user/activity');
app.use(express.json());
app.post('/store', isAuthenticated, async function(request, response, next) {
  let userid = request.user.userid;
  let object = request.body;
  const insertDB = "insert into ActivityTable (activity, date, amount, userid) values (?,?,?,?)"
  await db.run(insertDB,[object.activity, object.date , object.scalar,userid]);
  response.send({ message: "I got your POST request"});
});

app.get('/reminder', async function(request, response, next) {
  console.log("Server recieved a post request at", request.url)
  let currTime = newUTCTime()
  currTime = (new Date()).getTime()
  let userid = request.user.userid;
  let result = await dbo.get_most_recent_planned_activity_in_range(userid, 0, currTime)
  await dbo.delete_past_activities_in_range(userid, 0, currTime);
  
  if (result != null){
    result.scalar = result.amount
    result.date = result['MAX(date)']
    response.send(act.Activity(result));
  } else {
    response.send({message: 'All activities up to date!'});
  }
});

app.get('/week', isAuthenticated, async function(request, response, next) {
  console.log("Server recieved a post request at", request.url);
  let date = parseInt(request.query.date)
  let activity = request.query.activity
  let userid = request.user.userid;
  if (activity === undefined) {
    let result = await dbo.get_most_recent_entry(userid)
    try {
      activity = result.activity
    } catch(error) {
      activity = "none"
    }
  }
  
  let min = date - 6 * MS_IN_DAY
  let max = date
  let result = await dbo.get_similar_activities_in_range(activity, min, max, userid)

  let data = Array.from({length: 7}, (_, i) => {
    return { date: date - i * MS_IN_DAY, value: 0 }
  })

  for(let i = 0 ; i < result.length; i++) {
    let idx = Math.floor((date - result[i].date)/MS_IN_DAY)
    data[idx].value += result[i].amount
  }
  
  response.send(data.reverse());
});

const listener = app.listen(3000, () => {
  console.log("The static server is listening on port " + listener.address().port);
});

const MS_IN_DAY = 86400000

 function newUTCTime() {
    let gmtDate = new Date()
    let utcDate = (new Date(gmtDate.toLocaleDateString()))
    let utcTime = Date.UTC(
        utcDate.getFullYear(),
        utcDate.getMonth(),
        utcDate.getDay()
    )
    console.log("time:", utcTime)
    return utcTime
}

function date_to_UTC_datetime(date) {
  let utcDate = new Date(date.toLocaleDateString())
  return Date.UTC(
        utcDate.getFullYear(),
        utcDate.getMonth(),
        utcDate.getDay()
    )
}

app.use( fileNotFound );

function printURL (req, res, next) {
    console.log(req.url);
    next();
}

function fileNotFound(req, res) {
    let url = req.url;
    res.type('text/plain');
    res.status(404);
    res.send('Cannot find '+url);
    }

function isAuthenticated(req, res, next) {
    if (req.user) {
	    next();
    } else {
	res.redirect('/splash.html');
    }
}

async function gotProfile(accessToken, refreshToken, profile, done) {
    let userid = profile.id;  
    console.log(userid);
    let name = profile.name.givenName;
    console.log(name);

    try {
      result = await pr.all("select * from Profile where userid = ?",[userid]);
    } catch(error) {
      console.log(error)
    }

    if (result == 0) {
      await pr.run("insert into Profile (userid, name) values (?,?)", [userid, name]);
    }

    let all = await pr.all("select * from Profile" );
    done(null, userid); 
}

passport.serializeUser((userid, done) => {
    done(null, userid);
});

passport.deserializeUser((userid, done) => {
    userData = {
      userid: userid, 
      };
    done(null, userData);
});