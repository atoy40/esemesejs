var mongoose = require('mongoose');

module.exports = mongoose.model('Sms', new mongoose.Schema({
  recipient: { type: String, match: /^0[67]/ },
  content: { type: String, maxlength: 160 },
  state: { type: String, enum: 'pending processing sent failed'.split(' ') },
  priority: { type: Number, min: 0, max: 3 },
  attempts: { type: Number, min: 0 },
  client: String,
  submitted: Date,
  lastattempt: Date,
  lasterror: String,
}));
