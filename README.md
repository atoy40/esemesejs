# esemesejs
esemesejs is a simple REST service to send SMS using multiple modems

## Server Usage
you can start the web service using ```node server.js```. Environment variables can be use to setup :
* MONGOURL : the database URL (default to mongodb://localhost:27017/smsdb)
* PORT : The listening port (default 8888)
* CONFIG : The location of the configuration file (default to /etc/esemesejs.conf)

## configuration file
The configuration file allows you to configure keys (authorizations) and modems.
```json
{
  "clients": [
    {
      "name": "localhost",
      "ips": ["127.0.0.1", "10.1.2.97", "::1"],
      "key": "d6zpumfnmlwksb7faxy7zsm16qzzoi91",
      "maxprio": 1
    }
  ],
  "devices": [
    "gammu:0"
    "gammu:1"
  ]
}
```

## Client usage
you can push a SMS ny sending a HTTP POST request to /sendsms path. For example using cURL :
```bash
curl -v \
  -H "Authorization: APIKEY d6zpumfnmlwksb7faxy7zsm16qzzoi91" \
  -H "Content-Type: application/json" \
  -X POST \
  -d '{"priority": 2, "recipient": "0699999999", "content": "helloworld"}' \
  http://localhost:8888/sendsms
```
The SMS is then added to a queue and the reponse (HTTP 200) will contains a JSON object with the id keyc which can be use to retrieve SMS status.
If an error occurs (bad parameters or key), a HTTP error code will be send with a JSON object containing the error key.
Example :
```{"id":"560e5475d24c09ec2aa9c2df"}```

You can get the message status using a HTTP GET request to /getstatus/[id] :
```bash
curl -v \
  -H "Authorization: APIKEY d6zpumfnmlwksb7faxy7zsm16qzzoi91"
  http://localhost:8888/getstatus/560e5475d24c09ec2aa9c2df
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

## Drivers
the drivers folder contains modem driver code. To use a driver, add it to the devices array using the syntax "drivername:option".
You can use :
* gammu:sectionnumber : It use the gammu utility to send SMS, it can cover 99% of cases... the section number reflect the section configured in gammurc file. 
* at:device : This driver use the serial device directly, for unsupported gammu devices. device is a /dev/tty matching your modem.
* fake:timeout : a fake modem, timeout (milliseconds) is the time needed to release the modem
* fakeerr:timeout : a fake modem generating errors.
