
var express = require('express')
  , util = require('util')
  , everyauth = require('everyauth')
  , ejs = require('ejs')
  , graph = require('fbgraph')
  , mongoose = require('mongoose')
  , underscore = require('underscore')
  , async = require('async')
  ;

var appID = process.env.FACEBOOK_APP_ID
  , Schema = mongoose.Schema
  , ObjectId = Schema.ObjectId
  ;

var myapp = { id : appID };

var app = express.createServer(
    express.logger()
  , express.static(__dirname + '/public')
  , express.bodyParser()
  , express.cookieParser()
  , everyauth.middleware()
  , express.session({secret: process.env.SESSION_SECRET || 'kdgfcbdgfsgftsrcgsgr'})
  , express.errorHandler()
);
everyauth.helpExpress(app);
everyauth.debug = true;

// Ensure HTTPS: http://elias.kg/post/14971446990/force-ssl-with-express-js-on-heroku-nginx
app.use(function(req, res, next) {
    var schema = req.headers["x-forwarded-proto"];

    if (!schema || schema === "https") {
        return next();
    }
    // --- Redirect to https
    res.redirect("https://" + req.headers.host + req.url);
});

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
    },
    lastlogin: {type: Date, default: Date.now}
});

var EventSchema = new Schema({
    event : ObjectId,
    date : {type: Date, default: Date.now},
    desc : String
});

mongoose.connect('mongodb://'+process.env.MONGO_USER+':'+process.env.MONGO_PASS+'@'+process.env.MONGO_URL+'/'+process.env.MONGO_DB);
var PersonModel = mongoose.model('Person', PersonSchema);
var EventModel = mongoose.model('Event', EventSchema);

// Add a new event to the logs
function addEvent(description) {
    var newEvent = new EventModel();
    newEvent.desc = description;
    newEvent.save();
};

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
	        , update = { "facebook.authtoken": accessToken,
			     "facebook.authexpire": expire,
			     "lastlogin": Date.now()
			   }
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
    if (req.loggedIn) {
	res.redirect("/dash");
    } else {
	res.render('front.ejs',
		   { title: "Friendcare",
		     appID: appID,
		     myapp: myapp,
		     req: req
		   });
    }
});

function updateError(error, userid) {
    if ((error.code === 190) && (error.error_subcode === 458)) {
	// User removed authorization for app
	PersonModel.findOne( {"facebook.userid" : userid}, function(err, person) {
	    if ((!err) && (person))  {
		console.log("!! Removing user because removed app: "+userid);
		addEvent("Removing user because removed app: "+userid);
		person.remove();
	    }
	});
    };
};

function updateFriends(id, first) {
    PersonModel.findOne({"facebook.userid" : id}, function(err, user) {
	if (err) {
	    return
	} else if (!user) {
	    console.log("Update friends: no such user?");
	    return
	} else {
	    async.series([
		function(callback){
		    console.log(id, "Graph update")
		    graph.setAccessToken(user.facebook.authtoken);
		    graph.get(id, {fields : 'friends', limit: '5000', offset: '0'}, function(err, res) {
			if (err) {
			    callback(err, null);
			} else {
		            console.log(id);
			    var newlistG = underscore.map(res.friends.data, function(val) {return val.id.toString(); });
			    callback(null, newlistG);
			}
		    });
		},
		function(callback){
		    console.log(id, "FQL update");
		    var query = "SELECT uid, name FROM user where uid in (Select uid2 from friend where uid1=me())";
		    graph.setAccessToken(user.facebook.authtoken);
		    graph.fql(query, function(err, res) {
			if (err) {
			    callback(err, null);
			} else {
			    var newlistF = underscore.map(res.data, function(x) {return x.uid.toString(); });
			    callback(null, newlistF);
			}
		    });
		}
	    ],
	    function(err, results){
		if (err) {
		    updateError(err, id);
		    return
		}
		var newG = results[0],
		    newF = results[1];
		var except = underscore.union(underscore.difference(newG, newF), underscore.difference(newF, newG));
		if (except.length > 0) {
		    addEvent("Different length for Graph/FQL "+id.toString()+":"+except.join());
		};

		var newlist = newF;  // Trust FQL more somehow
		var oldlist = user.facebook.friendlist;
		var gain = underscore.difference(newlist, oldlist);
		var loss = underscore.difference(oldlist, newlist);

		if (first) {
		    console.log("Firstupdate")
	            update = { "facebook.friendlist": newlist, "facebook.lastcheck": Date.now() }
		} else if ((gain.length > 0) || (loss.length > 0)) {
		    console.log("Friendsupdate", gain, loss);
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
    return date.getFullYear()+"-"+pad2(date.getMonth()+1)+"-"+pad2(date.getDate());
}

function checktime(date) {
    var now = Date.now();
    var timediff = (now - date) / 1000;
    if (timediff < 120) {
	res = "just now";
    } else if (timediff < 3600) {
	res = Math.floor(timediff / 60) + " minutes ago";
    } else if (timediff < 129600) {
	res = "about " + Math.round(timediff / 3600) + " hours ago";
    } else {
	res = "about " + Math.round(timediff / 86400) + " days ago";
    }
    return res;
}

app.get("/dash", function (req, res) {
    if (! req.loggedIn) {
	res.redirect("/");
    } else {
	var id = req.session.auth.facebook.user.id;
	PersonModel.findOne({"facebook.userid" : id}, function(err, user) {
	    if (user.facebook.friendlist.length > 0) {
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
		var thisuser = {userid: id, friendcount: user.facebook.friendlist.length, authtoken: user.facebook.authtoken };
		res.render('dash.ejs', {
		    title: "Friendcare",
		    thisuser: thisuser,
		    grouped: grouped,
		    dates: dates,
		    lastcheck: checktime(user.facebook.lastcheck),
		    myapp: myapp,
		    req: req
		});
	    } else {
		// Likely very first update where the database is not done yet
		graph.setAccessToken(user.facebook.authtoken);
		graph.get(id, {fields : 'friends', limit: '5000', offset: '0'}, function(err, fbres) {
		    var friendcount = 0;
		    if (!err) {
			friendcount = fbres.friends.data.length;
		    }
		    var thisuser = {userid: id, friendcount: friendcount, authtoken: user.facebook.authtoken };
		    res.render('dash.ejs', {
			title: "Friendcare",
			thisuser: thisuser,
			dates: [],
			lastcheck: "just now",
			myapp: myapp,
			req: req
		    }); //res.render
		}); // graph.get
	    } // else
	})
    }
});


//The 404 Route (ALWAYS Keep this as the last route)
app.get('/*', function(req, res){
    throw new NotFound;
});

function NotFound(msg){
    this.name = 'NotFound';
    Error.call(this, msg);
    Error.captureStackTrace(this, arguments.callee);
}

app.error(function(err, req, res, next){
    if (err instanceof NotFound) {
        res.render('404.ejs', { title: "Not found | Friendcare",
				myapp: myapp,
				req: req,
				status: 404 });
    } else {
	throw err;
    }
    // } else {
    // 	res.send("Errored...", {status: 500});
    // }
});

var port = process.env.PORT || 3000;

app.listen(port, function() {
  console.log("Listening on " + port);
});
