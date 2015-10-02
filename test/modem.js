var Modem = require('../modem');

var m = require("../drivers/"+process.argv[2])();

m.once('idle', function() {
  m.sendSMS("0681872245", "blé", function(err) {
    console.log(err ? "Error" : "SMS Sent");
  });
});
