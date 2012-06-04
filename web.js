
var express = require('express')
  , util = require('util')
  , everyauth = require('everyauth')
  , ejs = require('ejs')
  ;

var appID = process.env.FACEBOOK_APP_ID;

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

everyauth.facebook
  .appId(process.env.FACEBOOK_APP_ID)
  .appSecret(process.env.FACEBOOK_SECRET)
  .findOrCreateUser(function(session, accessToken, accessTokExtra, fbUserMetadata) {
    // console.log(accessToken, accessTokExtra);
    // var expire = new Date();
    // expire.setTime(expire.getTime()+accessTokExtra.expires*1000);
    // console.log("Expires:", expire);
    return usersByFbId[fbUserMetadata.id] || (usersByFbId[fbUserMetadata.id] = addUser('facebook', fbUserMetadata));
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
