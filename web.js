
var express = require('express')
  , util = require('util')
  , everyauth = require('everyauth')
  , ejs = require('ejs')
  , graph = require('fbgraph')
  , mongoose = require('mongoose')
  ;

var appID = process.env.FACEBOOK_APP_ID
  , Schema = mongoose.Schema
  , ObjectId = Schema.ObjectId
  ;

var app = express.createServer(
    express.logger()
  , express.static(__dirname + '/public')
  , express.bodyParser()
  , express.cookieParser()
  , express.favicon()
  , everyauth.middleware()
  , express.session({secret: process.env.SESSION_SECRET || 'kdgfcbdgfsgftsrcgsgr'})
  , express.errorHandler()
);
everyauth.helpExpress(app);
everyauth.debug = true;

var usersById = {};
var usersByFbId = {};
var nextUserId = {};

var ChangeSchema = new Schema({
    date: {type: Date, default: Date.now},
    gain: [String],
    loss: [String]
});

var PersonSchema = new Schema({
    person : ObjectId,
    facebook: {
        userid: String,
	authtoken: {type: String},
	authexpire: {type: Date},
	friendlist: [String],
	lastcheck: {type: Date, default: Date.now},
	changes: [ChangeSchema]
    }
});

mongoose.connect('mongodb://'+process.env.MONGO_USER+':'+process.env.MONGO_PASS+'@'+process.env.MONGO_URL);
var PersonModel = mongoose.model('Person', PersonSchema);


everyauth.facebook
  .appId(process.env.FACEBOOK_APP_ID)
  .appSecret(process.env.FACEBOOK_SECRET)
  .findOrCreateUser(function(session, accessToken, accessTokExtra, fbUserMetadata) {
      var promise = this.Promise();
      PersonModel.findOne({"facebook.userid" : fbUserMetadata.id}, function(err, user) {
	  if (err) {
	      return promise.fail(err);
	  } else if (!user) {
	      console.log("User creation");
	      var newperson = new PersonModel();
	      var expire = new Date();
	      expire.setTime(expire.getTime()+accessTokExtra.expires*1000);
	      newperson.facebook.userid = fbUserMetadata.id;
	      newperson.facebook.authtoken = accessToken;
	      newperson.facebook.authexpire = expire;
	      newperson.facebook.friendlist = [];
	      newperson.save();
	      return promise.fulfill(usersByFbId[fbUserMetadata.id] || (usersByFbId[fbUserMetadata.id] = addUser('facebook', fbUserMetadata)));
	  } else {
	      console.log("User exists");
	      return promise.fulfill(usersByFbId[fbUserMetadata.id] || (usersByFbId[fbUserMetadata.id] = addUser('facebook', fbUserMetadata)));
	  }
      });
      return promise;
   })
  .redirectPath('/dash');

function addUser(source, sourceUser) {
    var user;
    if (arguments.length === 1) { // password-based
        user = sourceUser = source;
        user.id = ++nextUserId;
        return usersById[nextUserId] = user;
    } else { // non-password-based
        user = usersById[++nextUserId] = {
           id: nextUserId
        };
        user[source] = sourceUser;
    }
    return user;
}
everyauth.debug = true;

app.configure(function() {
    app.use(everyauth.middleware());
    app.use(express.methodOverride());
    app.use(app.router);
    everyauth.helpExpress(app);
});

app.get("/", function (req, res) {
  res.render('front.ejs', {
                 title: "Welcome to Friendcare",
		 appID: appID
		 });
});

app.get("/dash", function (req, res) {
    if (! req.loggedIn) {
	res.redirect("/");
    } else {
	res.render('dash.ejs', {
	    title: "Friendcare",
	    user: req.user
	});
    }
});

var port = process.env.PORT || 3000;

app.listen(port, function() {
  console.log("Listening on " + port);
});
