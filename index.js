'use strict';

const config  = require('./config');
const request = require('superagent');
const redact  = (key, value) => /password/i.test(key) ? value.split('').map(() => '*').join('') : value;

// ServiceNow request
module.exports = request
  .post(config.endpoint)
  .auth(config.username, config.password)
  .type('application/json')
  .set('Accept', 'application/json')
  .send(config.message)
  .then(res => {
    console.log('Notification successfully sent, response:', res.statusCode, res.json || res.text);
    return res;
  })
  .catch(err => {
    console.error('Config parameters:', JSON.stringify(config, 2));
    console.error('Notification failed, response:', err.status, err.message, err.response.json || err.response.text);
    process.exit(2); // eslint-disable-line no-process-exit
    throw err;
  });

module.exports.redact = redact;
