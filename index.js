'use strict';

const fs      = require('fs');
const config  = require('./config');
const request = require('superagent');
const redact  = (key, value) => /password/i.test(key) ? value.split('').map(() => '*').join('') : value;
const error   = (err, status, res) => {
  err.status   = status;
  err.response = res;
  return err;
};

// handle response from ServiceNow API
const report = res => {
  if (res.status === 201) {
    let result;
    try {
      result = JSON.parse(res.text).result;
    } catch (e) {
      throw error(e, 500, res);
    }

    if (config.newChange) {
      // check if new change was created (given an internal_identifier)
      if (result.internal_identifier) {
        if (config.intIDFile) {
          fs.writeFileSync(config.intIDFile, result.internal_identifier);
        }
        console.log(`Notification successfully sent - new change ID: "${result.internal_identifier}"`);
        return res;
      }
      // check if status update was processed (5 obviously means OK)
    } else if (result.status === '5') {
      console.log('Notification successfully sent - change', config.success ? 'completed' : 'cancelled');
      return res;
    }

    throw error(new Error('Bad Request'), 400, res);
  }

  throw error(new Error('Server Error - unsupported response'), 500, res);
};

// ServiceNow request
module.exports = request
  .post(config.endpoint)
  .auth(config.username, config.password)
  .type('application/json')
  .set('Accept', 'application/json')
  .send(config.message)
  .then(report)
  .catch(err => {
    console.debug('Config parameters:', JSON.stringify(config, 2));
    console.error('Notification failed, response:', err.status, err.message);
    if (err.response) {
      console.debug(err.response.json || err.response.text);
    }
    process.exit(err.status || 2); // eslint-disable-line no-process-exit
    throw err;
  });

module.exports.redact = redact;
module.exports.report = report;
