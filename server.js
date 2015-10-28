var express = require('express');
var bodyParser = require('body-parser');
var bunyan = require('bunyan');
var fs = require('fs');
var SMSQueue = require('./smsqueue');

var app = express();
var log = bunyan.createLogger({name: "esemesejs", streams: [ { level: process.env.LOGLEVEL || 'info', stream: process.stdout } ], serializers: bunyan.stdSerializers });
var q;
var config;

/* Use body-parser middleware to extract JSON into HTTP body */
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

/* Add a bunyan child logger per request */
app.use(function(req, res, next) {
  log.trace({req: req});
  res.log = req.log = log.child({ip: req.ip});
  res.sendError = function(code, message) {
    res.log.error({ code: code }, message);
    res.status(code).json({error: message});
  };
  next();
});

/* Authentication middleware */
var checkApiKey = function(key, ip) {
  var client;
  config.clients.some(function(val) {
    if (val.key == key && val.ips.indexOf(ip) != -1) {
      client = val;
      return true;
    }
  });

  return client;
}

app.use(function(req, res, next) {

  if (!req.get('Authorization'))
    return res.sendError(401, "No authorization token provided");

  var match = req.get('Authorization').match("^APIKEY (.*)$");
  var client;

  if (!match || !(client = checkApiKey(match[1], req.ip)))
    return res.sendError(401, "Bad authorization token");

  client.hasOwnProperty("maxprio") || (client.maxprio = 1);

  req.clientconf = client;
  next();
});

/* Route definitions */
var router = express.Router();

router.post("/sendsms", function(req, res) {
  var data = req.body;
  data.hasOwnProperty("priority") || (data.priority = 2);
  data.client = req.clientconf.name || req.ip;

  if (data.priority < req.clientconf.maxprio)
    return res.sendError(400, "Max priority allowed is "+req.clientconf.maxprio);

  q.enqueue(req.body, function(err, id) {
    if (err)
      return res.sendError(400, err);

    res.json({id: id});
  });
});

router.get("/status/:sms_id", function(req, res) {
  q.getEntryStatus(req.params.sms_id, function(err, doc) {
    res.json(doc);
  });
});

router.get("/report", function(req, res) {
  var from, to;
  if (req.query.from && req.query.to) {
    from = new Date(req.query.from);
    to = new Date(req.query.to);
  } else {
    // default to last 24h
    to = new Date();
    from = new Date(to-(24*3600*1000));
  }

  q.getReport(req.clientconf.name, from, to, function(err, doc) {
    res.json(doc);
  });
});

app.use('/', router);

/* Default params */
var port = process.env.PORT || 8888;
var mongourl = process.env.MONGOURL || "mongodb://localhost:27017/smsdb";
var configfile = process.env.CONFIG || "/etc/esemesejs.conf";

fs.readFile(configfile, function(err, data) {
  if (err)
    return log.error("Unable to read config file "+configfile);

  config = JSON.parse(data);

  if (!config.devices)
    log.warn("no device defined");

  if (!config.clients) {
    log.info("no client defined, localhost added with apikey d6zpumfnmlwksb7faxy7zsm16qzzoi91");
    config.clients = {
      name: "localhost",
      ips: ['127.0.0.1', '::1'],
      key: "d6zpumfnmlwksb7faxy7zsm16qzzoi91",
      maxprio: 1
    };
  }

  /* Server start */
  q = new SMSQueue(mongourl, config.devices, log);

  q.on('ready', function() {
    log.info("Connected to mongo database "+mongourl);

    app.listen(port, function(err) {
      if (err)
        return log.error({error: err}, "unable to connect to DB");

      log.info("Listening on port "+port);
    });
  });
});

