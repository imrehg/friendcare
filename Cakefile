{exec} = require 'child_process'
{print} = require 'util'

# https://github.com/ivarni/heroku-node-coffee-jasmine-boilerplate/blob/master/Cakefile
compile = () ->
        coffee = exec 'coffee -c -o lib/ src/'
        coffee.stdout.on 'data', (data) -> print data.toString()
        coffee.stderr.on 'data', (data) -> print data.toString()

task 'compile', 'Compile scripts', ->
        compile()

task 'watch', 'Watch and rebuild', ->
        exec "coffee -w -c -o lib/ src/", (err, stdout, stderr) ->
                console.log "Recompiled"
                console.log err if err