var util = require('util');
var EventEmitter = require('events');
var child_process = require('child_process');

var Gammu = function(section) {
  this.section = section === undefined ? 0 : section;

  // check gammu command
  child_process.exec("gammu", function(error, stdout, stderr) {
    if (!error || error.code !== 127)
      this.emit('idle');
  }.bind(this));
};

util.inherits(Gammu, EventEmitter);

Gammu.prototype.sendSMS = function(recipient, content, callback) {
  var cmd = "gammu -s "+this.section+" sendsms TEXT "+recipient+" -text \"" +content+"\"";
  child_process.exec(cmd, function(error, stdout, stderr) {
    callback(error);

    // disable the modem for 60sec if error
    if (error)
      setTimeout(function() {
        this.emit('idle');
      }, 60000);

    this.emit('idle');
  }.bind(this));
};

module.exports = function(options) {
  return new Gammu(options);
}
