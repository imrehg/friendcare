# requires
express = require 'express'
mongoose = require 'mongoose'
uuid = require 'node-uuid'

# Setup app
app = express.createServer express.logger(), express.static(__dirname + '/../public'), express.bodyParser(), express.cookieParser()

app.set 'view engine', 'coffee'
app.register '.coffee', require('coffeekup').adapters.express
app.set 'view options', layout: false

# # Database
mongouser = process.env.MONGOUSER
mongopass = process.env.MONGOPASS
conn = mongoose.connect 'mongodb://'+mongouser+':'+mongopass+'@ds033067.mongolab.com:33067/friendcare'

Schema = mongoose.Schema
ObjectId = Schema.ObjectId
Update = new Schema
        date :
                type: Date,
                default: Date.now,
        fgained : [String],
        flost : [String]
User = new Schema
        user : ObjectId,
        fbid : String,
        fbtoken : String,
        friendlist: [String],
        lastupdate:
                type: Date,
                default: Date.now,
        updates : [Update]

UpdateModel = conn.model('UpdateModel', Update)
UserModel = conn.model('UserModel', User);

# Main page
app.get '/', (req, res) ->
        oneguy = new UserModel fbtoken: uuid.v4()
        oneguy.save()
        console.log oneguy.fbtoken
        res.render 'home', foo: 'bar',  title: 'That\'s how you lip the mic'

#####
# Update database
update = (record) ->
        thisUpdate = new UpdateModel
        record.updates.push thisUpdate
        record.save (err) ->
                console.log err if err
        console.log "Record:"+record.fbtoken

app.get '/superupdate', (req, res) ->
        i = 0
        UserModel.find {}, (err, docs) ->
                update doc for doc in docs
        res.send "Okay!\n"
#####

# Start server
run = ->
        port = process.env.PORT or 3000
        app.listen port, -> console.log 'Listening on '+port

exports.run = run