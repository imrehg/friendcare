var async   = require('async');
var express = require('express');
var util    = require('util');
var jade = require('jade');
var everyauth = require('everyauth');
var FacebookClient = require('facebook-client').FacebookClient;
var facebook = new FacebookClient();

var mongoose = require('mongoose');
var mongouser = process.env.MONGOUSER;
var mongopass = process.env.MONGOPASS;
mongoose.connect('mongodb://'+mongouser+':'+mongopass+'@ds033067.mongolab.com:33067/friendcare');

var Schema = mongoose.Schema
  , ObjectId = Schema.ObjectId;

// Schemas
var Update = new Schema({
    date : Date
  , fgained : [String]
  , flost : [String]
});

var User = new Schema({
    user      : ObjectId
  , fbid      : String
  , fbtoken   : String
  , friendlist: [String]
  , lastupdate: Date
  , updates   : [Update]
});

// configure facebook authentication
everyauth.facebook
  .appId(process.env.FACEBOOK_APP_ID)
  .appSecret(process.env.FACEBOOK_SECRET)
  .scope('offline_access')
  .entryPath('/login')
  .redirectPath('/home')
  .findOrCreateUser(function() {
    return({});
  });


// create an express webserver
var app = express.createServer(
  express.logger(),
  express.static(__dirname + '/public'),
  express.bodyParser(),
  express.cookieParser(),
  // set this to a secret value to encrypt session cookies
  express.session({ secret: process.env.SESSION_SECRET || 'yeahthisissecretYEAH' }),
  function(request, response, next) {
    var method = request.headers['x-forwarded-proto'] || 'http';
    everyauth.facebook.myHostname(method + '://' + request.headers.host);
    next();
  },
  everyauth.middleware(),
  require('facebook').Facebook()
);

app.set('view options', {
  layout: false
});

// listen to the PORT given to us in the environment
var port = process.env.PORT || 3000;

app.listen(port, function() {
  console.log("Listening on " + port);
});

app.get('/', function(req, res) {
  if (req.session.auth) {
      console.log(req.session);
      res.redirect('/dash');
  }
  else {
    res.render('opening.jade', {
	           title: "Opening"
              });	    
  }
});

app.get('/home', function(req, res) {
  res.redirect('/dash');
});
app.get('/dash', function(req, res) {
  if (req.session.auth) {
      res.render('dash.jade', {
	             title: "Dashboard",
  		     token: req.session.auth.facebook.accessToken
      });      
  } else {
      res.redirect('/login');
  }
});


/////////////////////////////////
app.get('/jade', function(req, res) {
    console.log(req.facebook.me);
    res.render('test.jade', {
	           title: "Testing",
                   loggedin: req.facebook.token
              });
});


// respond to GET /home
app.get('/timeline', function(request, response) {

        // render the home page
        response.render('timeline.ejs', {
          layout:   false,
          app:      app
        });

});

// Catch 404
app.get('*', function(request, response) {
	    lookingfor = request.params[0];
	    response.render('404.jade', {
				layout:   false,
				lookingfor: lookingfor
			    });
});
