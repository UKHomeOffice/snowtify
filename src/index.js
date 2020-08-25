'use strict';

const fs      = require('fs');
const config  = require('./config');
const logger  = require('./logger');

if (config.disabled) {
  logger.info('Exiting because Snowtify is disabled. See SNOW_DISABLED');
} else {

  const request = require('superagent');
  const redact = (key, value) => /password/i.test(key) && value ? value.split('').map(() => '*').join('') : value;
  const error = (err, status, res) => {
    err.status = status;
    err.response = res;
    return err;
  };

  require('superagent-proxy')(request);


  // handle response from ServiceNow API
  const report = res => {
    logger.debug('handle response from ServiceNow');
    if (res.status === 201) {
      let result;
      try {
        logger.debug('parsing response from ServiceNow');
        result = JSON.parse(res.text).result;
        logger.debug('successfully parsed response from ServiceNow');
      } catch (e) {
        throw error(e, 500, res);
      }

      if (config.newChange) {
        // check if new change was created (given an internal_identifier)
        if (result.internal_identifier) {
          if (config.intIDFile) {
            logger.debug(`writing change ID "${result.internal_identifier}" to file: ${config.intIDFile}`);
            fs.writeFileSync(config.intIDFile, result.internal_identifier);
          }
          logger.info(`Notification successfully sent - new change ID: "${result.internal_identifier}"`);
          return res;
        }
      } else if (result.transaction_status === 'PROCESSED') {
        logger.info(`Notification successfully sent - change ${config.success ? 'completed' : 'cancelled'}`);
        return res;
      }

      throw error(new Error('Bad Request'), 400, res);
    }

    throw error(new Error('Server Error - unsupported response'), 500, res);
  };

  // ServiceNow request
  logger.debug('sending details to ServiceNow');
  module.exports = request
    .post(config.endpoint)
    .proxy(config.proxy)
    .auth(config.username, config.password)
    .type('application/json')
    .set('Accept', 'application/json')
    .send(config.message)
    .then(report)
    .catch(err => {
      logger.info('Config parameters: ' + JSON.stringify(config, redact, 2));
      logger.error(`Notification failed, response: ${err.status} ${err.message}`);
      if (err.response) {
        logger.info(err.response.json || err.response.text);
      }
      process.exit(config.failOnError === false ? 0 : (err.status || 2)); // eslint-disable-line no-process-exit
      throw err;
    });

  module.exports.redact = redact;
  module.exports.report = report;
}
