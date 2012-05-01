/** Friendcare: MIT-license 2012 Gergely Imreh <imrehg@gmail.com> **/

$("document").ready(function () {
   // $("#test").append("Hello...");


  $("#logout").click(function() {
     FB.logout(function(response) {
       // user is now logged out
     });
     alert("Logging out");
   });
});

(function(d, s, id) {
     var js, fjs = d.getElementsByTagName(s)[0];
     if (d.getElementById(id)) return;
     js = d.createElement(s); js.id = id;
     js.src = "//connect.facebook.net/en_US/all.js";
     fjs.parentNode.insertBefore(js, fjs);
 }(document, 'script', 'facebook-jssdk'));