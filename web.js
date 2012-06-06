
var express = require('express')
  , util = require('util')
  , everyauth = require('everyauth')
  , ejs = require('ejs')
  , graph = require('fbgraph')
  , mongoose = require('mongoose')
  , underscore = require('underscore')
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
	      updateFriends(fbUserMetadata.id, true);
	      return promise.fulfill(usersByFbId[fbUserMetadata.id] || (usersByFbId[fbUserMetadata.id] = addUser('facebook', fbUserMetadata)));
	  } else {
	      console.log("User exists");
	      var expire = new Date();
	      expire.setTime(expire.getTime()+accessTokExtra.expires*1000);
	      console.log("--->", expire);
	      var conditions = { "facebook.userid": fbUserMetadata.id }
	        , update = { "facebook.authtoken": accessToken, "facebook.authexpire": expire}
	        , options = { multi: true };
              console.log(update);
	      PersonModel.update(conditions, update, options, function(err, numAffected) {
		  console.log("Update done: "+numAffected+" row");
	      });
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

function updateFriends(id, first) {
    PersonModel.findOne({"facebook.userid" : id}, function(err, user) {
	if (err) {
	    return
	} else if (!user) {
	    console.log("Update friends: no such user?");
	    return
	} else {
	    graph.setAccessToken(user.facebook.authtoken);
	    console.log(id)
	    graph.get(id, {fields : 'friends', limit: '5000', offset: '0'}, function(err, res) {
		var newlist = underscore.map(res.friends.data, function(val) {return val.id});
		var oldlist = user.facebook.friendlist;
		var gain = underscore.difference(newlist, oldlist);
		var loss = underscore.difference(oldlist, newlist);
		console.log("Gain", gain);
		console.log("Loss", loss);
		// var changes = new ChangeSchema({gain: gain, loss: loss});

		if (first) {
		    console.log("Firstupdate")
	            update = { "facebook.friendlist": newlist, "facebook.lastcheck": Date.now() }
		} else if ((gain.length > 0) || (loss.length > 0)) {
		    console.log("Friendsupdate");
	            update = { "facebook.friendlist": newlist, "facebook.lastcheck": Date.now(), "$push": {"facebook.changes": {"gain": gain, "loss": loss} } }
		} else {
		    console.log("Singleupdate");
		    update = { "facebook.lastcheck": Date.now() }
		}
		var conditions = { "facebook.userid": id }
	          , options = { multi: false };

		PersonModel.update(conditions, update, options, function(err, numAffected) {
	      	    console.log("Update done: "+numAffected+" row");
		});
		
	    });
	}
    });
}

app.get("/allupdate", function(req, res) {
    if (req.query['auth'] == process.env.UPDATESECRET) {
	PersonModel.find({}, function(err, users) {
	    users.forEach( function(user){
		updateFriends(user.facebook.userid);
	    });
	});
	res.send("Yup!");
    } else {
	res.send("Nope");
    }
});

// http://www.electrictoolbox.com/pad-number-two-digits-javascript/
function pad2(number) {
     return (number < 10 ? '0' : '') + number
}

function getSimpleDate(date) {
    return date.getFullYear()+"-"+pad2(date.getMonth())+"-"+pad2(date.getDate());
}

app.get("/dash", function (req, res) {
    if (! req.loggedIn) {
	res.redirect("/");
    } else {
	var id = req.session.auth.facebook.user.id;
	PersonModel.findOne({"facebook.userid" : id}, function(err, user) {
	    // var sortchange = underscore.sortBy(user.facebook.changes, function(change) { return change.date; });
	    // Sorting
	    // var sortchange = underscore.sortBy(user.facebook.changes, function(change) { return change.date; });
	    // Group all updates into a single day
	    var grouped = underscore.groupBy(user.facebook.changes, function(change) {return getSimpleDate(change.date);});
	    for (date in grouped) {
		var x = grouped[date];
		var y = underscore.reduce(x,
					  function(total, current) {
					      var newgain = underscore.union(total.gain, current.gain);
					      var newloss = underscore.union(total.loss, current.loss);
					      return { gain: newgain, loss: newloss };
					  },
					  { gain: [], loss: [] } );
		var gain = underscore.difference(y.gain, y.loss);
		var loss = underscore.difference(y.loss, y.gain);
		grouped[date] = {gain: gain, loss: loss};
	    }
	    var dates = Object.keys(grouped).sort().reverse();
	    console.log(dates);
	    console.log(grouped);
	    var thisuser = {userid: id, friendcount: user.facebook.friendlist.length, authtoken: user.facebook.authtoken };
	    res.render('dash.ejs', {
		title: "Friendcare",
		thisuser: thisuser,
		grouped: grouped,
		dates: dates
	    });
	})
    }
});

var port = process.env.PORT || 3000;

app.listen(port, function() {
  console.log("Listening on " + port);
});
