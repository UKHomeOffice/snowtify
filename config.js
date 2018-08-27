'use strict';

const fs     = require('fs');
const moment = require('moment');
const format = 'YYYY-MM-DD HH:mm:ss ZZ';
const logger = require('./logger');

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
const stripControl = text => text && text.replace(/\x1b\[\d+m/g, '').replace(/[\0-\x08\x11-\x1f]/g, '');

logger.debug('Process environment variables');
const pe                = global.injected && global.injected.env || process.env;
logger.debug('env vars: ' + JSON.stringify(pe));
const repo              = pe.REPO_NAME || pe.DRONE_REPO_NAME;
const buildNumber       = pe.BUILD_NUMBER || pe.DRONE_BUILD_NUMBER;
const protocol          = pe.PLUGIN_PROTOCOL || pe.SNOW_PROTOCOL || 'https';
const snowProdInstance  = pe.PLUGIN_PROD_HOST || pe.SNOW_PROD_HOST || 'lssiprod.service-now.com';
const snowTestInstance  = pe.PLUGIN_TEST_HOST || pe.SNOW_TEST_HOST || 'lssitest.service-now.com';
const deployTo          = /^prod/i.test(pe.DRONE_DEPLOY_TO || pe.SNOW_DEPLOY_TO);
const sendToProd        = /^true$/i.test(pe.PLUGIN_SEND_TO_PROD) || deployTo;
const testUser          = pe.PLUGIN_TEST_USER || pe.SNOW_TEST_USER;
const prodUser          = pe.PLUGIN_PROD_USER || pe.SNOW_PROD_USER;
const username          = pe.PLUGIN_USERNAME || (sendToProd ? prodUser : testUser) || pe.SNOW_USER;
const testPass          = pe.PLUGIN_TEST_PASS || pe.SNOW_TEST_PASS;
const prodPass          = pe.PLUGIN_PROD_PASS || pe.SNOW_PROD_PASS;
const password          = pe.PLUGIN_PASSWORD || (sendToProd ? prodPass : testPass) || pe.SNOW_PASS;
const intIDFile         = pe.PLUGIN_INTERNAL_ID_FILE || pe.SNOW_INT_ID_FILE;
const internalID        = pe.PLUGIN_INTERNAL_ID || pe.SNOW_INTERNAL_ID || loadFromFile(intIDFile);
const externalID        = pe.PLUGIN_EXTERNAL_ID || pe.SNOW_EXTERNAL_ID || `${username}-${repo}-${buildNumber}`;
const snowPath          = pe.PLUGIN_PATH || pe.SNOW_PATH || 'api/fho/siam_in/create_transaction';
const endpoint          = pe.PLUGIN_ENDPOINT || pe.SNOW_ENDPOINT;
const newDeployment     = /^deployment$/i.test(pe.PLUGIN_NOTIFICATION_TYPE || pe.SNOW_NOTIFICATION_TYPE);
const statusUpdate      = /^(status)? *update$/i.test(pe.PLUGIN_NOTIFICATION_TYPE || pe.SNOW_NOTIFICATION_TYPE);
const title             = pe.PLUGIN_TITLE || pe.SNOW_TITLE || `Deployment #${buildNumber} of ${repo}`;
const endTime           = pe.PLUGIN_END_TIME || pe.SNOW_END_TIME || moment().add(30, 'minutes').format(format);
const descriptionFile   = !statusUpdate && loadFromFile(pe.PLUGIN_DESCRIPTION_FILE || pe.SNOW_DESC_FILE);
const description       = pe.PLUGIN_DESCRIPTION || pe.SNOW_DESC || descriptionFile;
const testingFile       = !statusUpdate && loadFromFile(pe.PLUGIN_TESTING_FILE || pe.SNOW_TESTING_FILE);
const testing           = pe.PLUGIN_TESTING || pe.SNOW_TESTING || testingFile;
const commentsFile      = !newDeployment && loadFromFile(pe.PLUGIN_COMMENTS_FILE || pe.SNOW_COMMENTS_FILE);
const comments          = pe.PLUGIN_COMMENTS || pe.SNOW_COMMENTS || commentsFile;
const deploymentOutcome = /^success$/i.test(pe.PLUGIN_DEPLOYMENT_OUTCOME || pe.SNOW_STATUS || pe.DRONE_BUILD_STATUS);
const newChange         = newDeployment || !(statusUpdate || comments);
const failOnError       = !/^false$/i.test(pe.PLUGIN_FAIL_ON_ERROR || pe.SNOW_FAIL_ON_ERROR);
const proxy             = pe.PLUGIN_PROXY || pe.SNOW_PROXY;
const messageTemplates  = {
  openChange: {
    messageid:             'HO_SIAM_IN_REST_CHG_POST_JSON',
    'external_identifier': externalID,
    payload:               {
      title:       title,
      endTime:     endTime,
      description: stripControl(description),
      supplierRef: externalID,
    }
  },
  update: {
    messageid: 'HO_SIAM_IN_REST_CHG_UPDATE_JSON',
    'internal_identifier': internalID,
    payload:               {
      success:  deploymentOutcome ? 'true' : 'false',
      comments: stripControl(comments)
    }
  }
};

if (testing) {
  messageTemplates.openChange.payload.testing = stripControl(testing);
}

const config = {
  newChange:   newChange,
  endpoint:    endpoint || `${protocol}://${sendToProd ? snowProdInstance : snowTestInstance}/${snowPath}`,
  proxy:       proxy,
  username:    username,
  password:    password,
  message:     newChange ? messageTemplates.openChange : messageTemplates.update,
  intIDFile:   intIDFile,
  success:     deploymentOutcome,
  failOnError: failOnError
};
logger.verbose('config parameters: ' + JSON.stringify(config));
module.exports = config;
