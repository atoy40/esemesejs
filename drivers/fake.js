var util = require('util');
var EventEmitter = require('events');

var Fake = function(options) {
  this.timeout = options.timeout || 2000;
  this.error = options.error === undefined ? false : options.error;
  this.name = "fake/"+this.timeout+"ms/"+(this.error ? "error" : "succes");

  // simulate initial sate check
  setTimeout(function() {
    this.emit('idle');
  }.bind(this), 100);
};

util.inherits(Fake, EventEmitter);

Fake.prototype.sendSMS = function(recipient, content, callback) {
  // simulate send delay
  setTimeout(function() {
    callback(this.error ? "faked error !" : undefined);
    this.emit('idle');
  }.bind(this), this.timeout);
};

module.exports = function(options) {
  return new Fake(options);
}
