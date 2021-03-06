var util = require('util');
var EventEmitter = require('events');
var mongoose = require('mongoose');
var SMS = require('./sms');

var SMSQueue = function(mongourl, devices, log) {
  this.freeModems = [];
  this.log = log;

  // connect mongo database
  mongoose.connect(mongourl, function(err) {
    if (err)
      return this.log.error("Unable to connect to DB");
    this.emit("ready");
  }.bind(this));

  // instanciate modems
  devices.forEach(function(device, index) {
    if (!device.driver)
      return this.log.warn("Device need a driver");

    var options = device.options || {};
    options.log = this.log;
    var modem = require('./drivers/'+device.driver)(options);

    modem.on('idle', function() {
      this.log.info("Modem "+modem.name+" available");
      this.freeModems.push(modem);
      this.processQueue();
    }.bind(this));
  }.bind(this));

  // process queue every minutes to resend failed messages
  setInterval(function() {
    var time = new Date();
    if (!this.lastprocess || (time.getTime()-this.lastprocess.getTime()) > 60000)
      this.processQueue();
  }.bind(this), 10000);
};

util.inherits(SMSQueue, EventEmitter);

/*
 * Enqueue a new message to database
 */
SMSQueue.prototype.enqueue = function(data, callback) {
  this.log.trace({ data: data }, "Enqueue message");
  var sms = new SMS(data);
  sms.submitted = new Date();
  sms.state = "pending";
  sms.attempts = 0;

  sms.save(function(err, doc) {
    if (err)
      return callback(String(err));

    callback(err, doc._id);
    this.processQueue();
  }.bind(this));
};

/*
 * Process the next message
 */
SMSQueue.prototype.processQueue = function() {
  this.log.debug("Process queue");
  this.lastprocess = new Date();
  var modem = this.freeModems.pop();

  // no free modem found
  if (modem === undefined)
    return

  SMS.findOneAndUpdate({state: "pending"}, {'$set': { state: "processing" }}, { sort: {priority: 1, submitted: 1}, 'new': true }, function(err, doc) {
    if (err)
      return this.log.error(err);

    if (!doc) {
      this.log.debug("Queue is empty");
      this.freeModems.push(modem);
      return;
    }

    this.log.info("Processing message "+doc._id);
    modem.sendSMS(doc.recipient, doc.content, function(err) {
      doc.attempts++;
      if (err && doc.attempts < 3) {
        doc.state = "pending";
        doc.lasterror = err;
      } else if (err) {
        doc.state = "failed";
        doc.lasterror = err;
      } else {
        doc.state = "sent";
      }
      doc.lastattempt = new Date();
      doc.save(function() {
      }.bind(this));
    }.bind(this));
  }.bind(this));
}

SMSQueue.prototype.getEntryStatus = function(id, callback) {
  SMS.findOne({_id: id}, { _id: 0, state: 1, attempts: 1, lastattempt: 1, submitted: 1, priority: 1, lasterror: 1 }, function(err, doc) {
    callback(err, doc);
  });
};

SMSQueue.prototype.getReport = function(client, from, to, callback) {
  SMS.aggregate([
    { $match: { $and: [ { client: client }, { submitted: { $gte: from } }, { submitted: { $lte: to } } ] } },
    { $group: { _id: "$state", "total": { $sum: 1 } } },
  ], function(err, doc) {
    var result = {};
    doc.forEach(function(val) {
      result[val._id] = val.total;
    });
    callback(err, result);
  });
}

module.exports = SMSQueue;
