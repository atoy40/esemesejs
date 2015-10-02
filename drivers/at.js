var util = require('util');
var EventEmitter = require('events');
var async = require('async');
var serialport = require("serialport");
var pdu = require("sms-pdu-node");

var Modem = function(device) {
  this.serialPort = new serialport.SerialPort(device, { baudrate: 9600, parser: serialport.parsers.readline("\n") });

  this.serialPort.on('open', function() {
    this.emit("idle");
  }.bind(this));

  this.serialPort.on('data', function(data) {
    console.log("data:");
    console.log(data.toString());
    if (data.toString().match(/^\+CMGS:/))
      this._cmgs = true;
    if (this._cmgs && data.toString().match(/^OK/)) {
      this._cmgs = false;
      this.emit("idle");
    }
  }.bind(this));
};

util.inherits(Modem, EventEmitter);

Modem.prototype.sendSMS = function(recipient, content, callback) {
  var msg = pdu(content, recipient, null, 7);
  console.log(msg);
  async.series([
    this.seqWrite("AT+CMGF=0\r"),
    this.seqWrite(msg.command+"\r"),
    this.seqWrite(msg.pdu+String.fromCharCode(26)),
  ], function(err, res) {
    callback(err);
  }.bind(this));
};

Modem.prototype.writeAndDrain = function(data, callback) {
  this.serialPort.write(data, function(err) {
    if (err) {
      callback(err);
      return;
    }
    this.serialPort.drain(callback);
  }.bind(this));
};

Modem.prototype.seqWrite = function(data, callback) {
  return function(callback) {
    this.writeAndDrain(data, callback);
  }.bind(this)
}

module.exports = function(options) {
  return new Modem(options);
}
