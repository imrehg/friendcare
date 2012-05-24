# requires
express = require 'express'

# Setup app
app = express.createServer express.logger(), express.static(__dirname + '/../public'), express.bodyParser(), express.cookieParser()

app.set 'view engine', 'coffee'
app.register '.coffee', require('coffeekup').adapters.express
app.set 'view options', layout: false

# Main page
app.get '/', (req, res) -> res.render 'home', foo: 'bar',  title: 'That\'s how you lip the mic'

# Start server
run = ->
        port = process.env.PORT or 3000
        app.listen port, -> console.log 'Listening on '+port

exports.run = run