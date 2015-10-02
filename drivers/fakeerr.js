var util = require('util');
var EventEmitter = require('events');

var FakeErr = function(timeout) {
  this.timeout = timeout || 2000;

  // simulate initial sate check
  setTimeout(function() {
    this.emit('idle');
  }.bind(this), 100);
};

util.inherits(FakeErr, EventEmitter);

FakeErr.prototype.sendSMS = function(recipient, content, callback) {
  // simulate send delay
  setTimeout(function() {
    callback("error");
    this.emit('idle');
  }.bind(this), this.timeout);
};

module.exports = function(options) {
  return new FakeErr(options);
}
