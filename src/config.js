'use strict';

const fs     = require('fs');
const moment = require('moment');
const format = 'YYYY-MM-DD HH:mm:ss';
const logger = require('./logger');

const DEFAULTS = {
  SNOW_PATH: 'api/fho/siam_in/create_transaction',
  PROD_HOST: 'lssiprod.service-now.com',
  TEST_HOST: 'lssitest.service-now.com'
};

const loadFromFile = file => { // eslint-disable-line consistent-return
  if (file) {
    try {
      return fs.readFileSync(file, { encoding: 'utf-8' });
    } catch (e) {
      console.error('ERROR: Could not read from file:', file);
      throw e;
    }
  }
};
const stripControl = text =>
  text && text.replace(/\x1b\[\d+m/g, '').replace(/[\0-\x08\x11-\x1f]/g, ''); // eslint-disable-line no-control-regex

const configure = env => { // eslint-disable-line complexity
  logger.debug('Process environment variables');
  if (/^true$/i.test(env.PLUGIN_SNOW_DISABLED || env.SNOW_DISABLED)) {
    return { disabled: true };
  }

  logger.debug('env vars: ' + JSON.stringify(env));
  const repo = env.REPO_NAME || env.DRONE_REPO_NAME;
  const buildNumber = env.BUILD_NUMBER || env.DRONE_BUILD_NUMBER;
  const protocol = env.PLUGIN_PROTOCOL || env.SNOW_PROTOCOL || 'https';
  const snowProdInstance = env.PLUGIN_PROD_HOST || env.SNOW_PROD_HOST || DEFAULTS.PROD_HOST;
  const snowTestInstance = env.PLUGIN_TEST_HOST || env.SNOW_TEST_HOST || DEFAULTS.TEST_HOST;
  const deployTo = /^prod/i.test(env.DRONE_DEPLOY_TO || env.SNOW_DEPLOY_TO);
  const sendToProd = /^true$/i.test(env.PLUGIN_SEND_TO_PROD) || deployTo;
  const testUser = env.PLUGIN_TEST_USER || env.SNOW_TEST_USER;
  const prodUser = env.PLUGIN_PROD_USER || env.SNOW_PROD_USER;
  const username = env.PLUGIN_USERNAME || (sendToProd ? prodUser : testUser) || env.SNOW_USER;
  const testPass = env.PLUGIN_TEST_PASS || env.SNOW_TEST_PASS;
  const prodPass = env.PLUGIN_PROD_PASS || env.SNOW_PROD_PASS;
  const password = env.PLUGIN_PASSWORD || (sendToProd ? prodPass : testPass) || env.SNOW_PASS;
  const intIDFile = env.PLUGIN_INTERNAL_ID_FILE || env.SNOW_INT_ID_FILE;
  const internalID = env.PLUGIN_INTERNAL_ID || env.SNOW_INTERNAL_ID || loadFromFile(intIDFile);
  const externalID = env.PLUGIN_EXTERNAL_ID || env.SNOW_EXTERNAL_ID || `${username}-${repo}-${buildNumber}`;
  const snowPath = env.PLUGIN_PATH || env.SNOW_PATH || DEFAULTS.SNOW_PATH;
  const endpoint = env.PLUGIN_ENDPOINT || env.SNOW_ENDPOINT;
  const newDeployment = /^deployment$/i.test(env.PLUGIN_NOTIFICATION_TYPE || env.SNOW_NOTIFICATION_TYPE);
  const statusUpdate = /^(status)? *update$/i.test(env.PLUGIN_NOTIFICATION_TYPE || env.SNOW_NOTIFICATION_TYPE);
  const title = env.PLUGIN_TITLE || env.SNOW_TITLE || `Deployment #${buildNumber} of ${repo}`;
  const startTime = env.PLUGIN_START_TIME || env.SNOW_START_TIME || moment().format(format);
  const startMoment = moment(startTime, format);
  const endTime = env.PLUGIN_END_TIME || env.SNOW_END_TIME || startMoment.add(30, 'minutes').format(format);
  const descriptionFile = !statusUpdate && loadFromFile(env.PLUGIN_DESCRIPTION_FILE || env.SNOW_DESC_FILE);
  const description = env.PLUGIN_DESCRIPTION || env.SNOW_DESC || descriptionFile;
  const testingFile = !statusUpdate && loadFromFile(env.PLUGIN_TESTING_FILE || env.SNOW_TESTING_FILE);
  const testing = env.PLUGIN_TESTING || env.SNOW_TESTING || testingFile;
  const commentsFile = !newDeployment && loadFromFile(env.PLUGIN_COMMENTS_FILE || env.SNOW_COMMENTS_FILE);
  const comments = env.PLUGIN_COMMENTS || env.SNOW_COMMENTS || commentsFile;
  const success = /^success$/i.test(env.PLUGIN_DEPLOYMENT_OUTCOME || env.SNOW_STATUS || env.DRONE_BUILD_STATUS);
  const newChange = newDeployment || !(statusUpdate || comments);
  const failOnError = !/^false$/i.test(env.PLUGIN_FAIL_ON_ERROR || env.SNOW_FAIL_ON_ERROR);
  const proxy = env.PLUGIN_PROXY || env.SNOW_PROXY;
  const messageTemplates = {
    openChange: {
      messageid: 'HO_SIAM_IN_REST_CHG_POST_JSON',
      'external_identifier': externalID,
      payload: {
        title,
        startTime,
        endTime,
        description: stripControl(description),
        supplierRef: externalID,
      }
    },
    update: {
      messageid: 'HO_SIAM_IN_REST_CHG_UPDATE_JSON',
      'internal_identifier': internalID,
      payload: {
        success: success ? 'true' : 'false',
        comments: stripControl(comments)
      }
    }
  };

  if (moment(endTime, format).isBefore(startMoment)) {
    throw new RangeError(`The deployment start time MUST be before the end time.
If you want to set an end time in the past you must also explicitly set a start time before the end time.
See PLUGIN_START_TIME, SNOW_START_TIME, PLUGIN_END_TIME, SNOW_END_TIME`);
  }

  if (testing) {
    messageTemplates.openChange.payload.testing = stripControl(testing);
  }

  const config = {
    newChange,
    endpoint: endpoint || `${protocol}://${sendToProd ? snowProdInstance : snowTestInstance}/${snowPath}`,
    proxy,
    username,
    password,
    message: newChange ? messageTemplates.openChange : messageTemplates.update,
    intIDFile,
    success,
    failOnError
  };
  logger.verbose('config parameters: ' + JSON.stringify(config));

  return config;
};

module.exports = { configure, loadFromFile, stripControl, DEFAULTS };
