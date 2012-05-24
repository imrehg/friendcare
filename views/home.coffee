doctype 5
html ->
  head ->
    meta charset: 'utf-8'
    title "#{@title or 'Untitled'} | A completely plausible website"
    meta(name: 'description', content: @description) if @description?

    link rel: 'stylesheet/less', type: 'text/css', href: '/stylesheets/app.less'

    style '''
      body {font-family: sans-serif}
      header, nav, section, footer {display: block}
    '''

    script src: '/scripts/jquery-1.7.2.min.js'
    script src: '/scripts/less-1.3.0.min.js'

    coffeescript ->
      # $(document).ready ->
      #   alert 'Alerts suck!'
  body ->
    header ->
      h1 @title or 'Untitled'

    div '#myid.myclass.anotherclass', style: 'position: fixed', ->
      p 'Divitis kills! Inline styling too.'

    section ->
      h2 "Let's count to 10:"
      p i for i in [1..10]

    footer ->
      # CoffeeScript comments. Not visible in the output document.
      comment 'HTML comments.'
      p 'Bye!'