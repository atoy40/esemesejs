var express = require('express');
var bodyParser = require('body-parser');
var fs = require('fs');
var SMSQueue = require('./smsqueue');

var app = express();
var q;
var config;

/* Use body-parser middleware to extract JSON into HTTP body */
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

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
    return res.status(500).json({error: "No authorization token provided"});

  var match = req.get('Authorization').match("^APIKEY (.*)$");
  var client;

  if (!match || !(client = checkApiKey(match[1], req.ip)))
    return res.status(500).json({error: "Bad authorization token"});

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
    return res.status(400).json({error: "Max priority allowed is "+req.clientconf.maxprio});

  q.enqueue(req.body, function(err, id) {
    if (err)
      return res.status(400).json({error: err});

    res.json({id: id});
  });
});

router.get("/status/:sms_id", function(req, res) {
  q.getEntryStatus(req.params.sms_id, function(err, doc) {
    res.json(doc);
  });
});

router.get("/report", function(req, res) {
  q.getReport(req.clientconf.name, function(err, doc) {
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
    return console.log("Unable to read config file "+configfile);

  config = JSON.parse(data);

  if (!config.devices)
    console.log("no device defined");

  if (!config.clients) {
    console.log("no client defined, localhost added with apikey d6zpumfnmlwksb7faxy7zsm16qzzoi91");
    config.clients = {
      name: "localhost",
      ips: ['127.0.0.1', '::1'],
      key: "d6zpumfnmlwksb7faxy7zsm16qzzoi91",
      maxprio: 1
    };
  }

  /* Server start */
  q = new SMSQueue(mongourl, config.devices);

  q.on('ready', function() {
    console.log("Connected to mongo database");

    app.listen(port, function(err) {
      if (err)
        return console.log("unable to connect to DB");

      console.log("Listening on port "+port);
    });
  });
});

