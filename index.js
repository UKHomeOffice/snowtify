'use strict';

const config  = require('./config');
const request = require('superagent');

// ServiceNow request
module.exports = request
  .post(config.endpoint)
  .auth(config.username, config.password)
  .type('application/json')
  .set('Accept', 'application/json')
  .send(config.message);
