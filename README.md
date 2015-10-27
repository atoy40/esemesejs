# esemesejs

esemesejs is a simple REST service to send SMS using multiple modems

## Server installation and usage

To install, clone this repository and cd into it. Then use ```npm install```
command to install dependencies.

you can start the web service using ```node server.js```. Environment variables can be use to setup :
* MONGOURL : the database URL (default to mongodb://localhost:27017/smsdb)
* PORT : The listening port (default 8888)
* CONFIG : The location of the configuration file (default to /etc/esemesejs.conf)
* LOGLEVEL : the log level. See bunyan for allowed values. Default to
  "info"

## Configuration file

The configuration file allows you to configure keys (authorizations) and modems.
```json
{
  "clients": [
    {
      "name": "localhost",
      "ips": ["127.0.0.1", "::1"],
      "key": "d6zpumfnmlwksb7faxy7zsm16qzzoi91",
      "maxprio": 1
    },
    {
      "name": "mynagiosserver",
      "ips": ["10.10.10.10"],
      "key": "sm16qzzoixy7z91mfnmlwksb7d6zpufa",
      "maxprio": 0
    }
  ],
  "devices": [
    { "driver": "gammu", "options": { "section": 0 } },
    { "driver": "gammu", "options": { "section": 1 } },
    { "driver": "at", "options": { "device": "/dev/ttyACM2" } }
  ]
}
```

## Client usage

### Send a SMS

you can push a SMS by sending a HTTP POST request to /sendsms path. For example using cURL :
```bash
curl -v \
  -H "Authorization: APIKEY d6zpumfnmlwksb7faxy7zsm16qzzoi91" \
  -H "Content-Type: application/json" \
  -X POST \
  -d '{"priority": 2, "recipient": "0699999999", "content": "helloworld"}' \
  http://localhost:8888/sendsms
```
The SMS is then added to a queue and the reponse (HTTP 200) will contains a JSON object with the id key which can be use to retrieve SMS status later.
If an error occurs (bad parameters or key), a HTTP error code will be send with a JSON object containing the error key.

Examples :
```{"id":"560e5475d24c09ec2aa9c2df"}```
```{"error":"Bad authorization token"}```

Request keys are :
* recipient : the phone number.
* content : the content (max to 160 ascii characters).
* priority : 0 (max) to 3. Default to 2. Max priority allowed is defined
  per-client (maxprio parameter).

### Message status
You can get the message status using a HTTP GET request to /status/[id] :
```bash
curl -v \
  -H "Authorization: APIKEY d6zpumfnmlwksb7faxy7zsm16qzzoi91"
  http://localhost:8888/status/560e5475d24c09ec2aa9c2df
```

For example, a pending message will return the JSON object :
```json
{
 "attempts":0,
 "state":"pending",
 "submitted":"2015-10-02T08:37:33.715Z",
 "priority":2
}
```
A sent message will return :
```json
{
 "attempts":1,
 "state":"sent",
 "submitted":"2015-10-02T08:37:33.715Z",
 "priority":2,
 "lastattempt":"2015-10-02T08:37:55.888Z"
}
```

After 3 failed attempts, the message state will be set to "failed", and a lasterror key will contain informations.

### Get reporting

You can get per-client reporting using the /report path. This path can
take two query string parameters : "from" and "to". It must be two
string formated date. For example :
```bash
curl -v \
  -H "Authorization: APIKEY d6zpumfnmlwksb7faxy7zsm16qzzoi91" \
  "http://localhost:8888/report?from=2015-10-16&to=2015-10-17"
```

can returns :
```json
{
 "sent":143,
 "failed":3,
 "pending":2
}
```

Without from and to parameters, report will use last 24h.

## Drivers
the drivers folder contains modem driver code. To use a driver, add an object to the device array containing 2 keys : driver and options (see example in the Configuration file section)

Available drivers are :
* gammu : It use the gammu utility to send SMS, it can cover 99% of cases... options can contains a section key reflecting the "-s" parameter of gammu command line.
* at : This driver use the serial device directly. options must contains a device key pointing the the /dev/tty to use.
* fake : A fake modem for test purposes. options can contains "timeout" (in millisecond) to simulate processing time and "error" (a boolean). If error is true, the modem will always simulate a fail.

## Write a driver

A driver is a nodejs package where module.exports must be a function
taking driver parameters object and returning a new instance.
The driver MUST emit "idle" each time it becomes ready to process a message.

