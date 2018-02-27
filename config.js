'use strict';

const fs     = require('fs');
const moment = require('moment');

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

const pa                = global.injected && global.injected.env || process.env;
const repo              = pa.DRONE_REPO_NAME;
const buildNumber       = pa.DRONE_BUILD_NUMBER;
const protocol          = pa.PLUGIN_PROTOCOL || 'https';
const snowProdInstance  = pa.PLUGIN_PROD_URL || 'lssiprod.service-now.com';
const snowTestInstance  = pa.PLUGIN_TEST_URL || 'lssitest.service-now.com';
const sendToProd        = /^true$/i.test(pa.PLUGIN_SEND_TO_PROD) || /^prod/i.test(pa.DEPLOY_TO);
const username          = pa.PLUGIN_USERNAME || pa.SERVICE_NOW_USERNAME || pa.SNOW_USER;
const password          = pa.PLUGIN_PASSWORD || pa.SERVICE_NOW_PASSWORD || pa.SNOW_PASS;
const intIDFile         = pa.PLUGIN_INTERNAL_ID_FILE || pa.SNOW_INT_ID_FILE;
const internalID        = pa.PLUGIN_INTERNAL_ID || loadFromFile(intIDFile);
const extID             = `${username}-${repo}-${buildNumber}`;
const externalID        = pa.PLUGIN_EXTERNAL_ID || loadFromFile(pa.PLUGIN_EXT_ID_FILE || pa.SNOW_EXT_ID_FILE) || extID;
const snowPath          = 'api/now/table/x_fho_siam_integra_transactions';
const newDeployment     = /^deployment$/i.test(pa.PLUGIN_NOTIFICATION_TYPE);
const statusUpdate      = /^(status)? *update$/i.test(pa.PLUGIN_NOTIFICATION_TYPE);
const title             = pa.PLUGIN_TITLE || `Deployment #${buildNumber} of ${repo}`;
const endTime           = pa.PLUGIN_END_TIME || moment().add(30, 'minutes').format('YYYY-MM-DD HH:mm:ss');
const descriptionFile   = !statusUpdate && loadFromFile(pa.PLUGIN_DESCRIPTION_FILE || pa.SNOW_DESC_FILE);
const description       = pa.PLUGIN_DESCRIPTION || pa.SNOW_DESC || descriptionFile;
const testingFile       = !statusUpdate && loadFromFile(pa.PLUGIN_TESTING_FILE || pa.SNOW_TESTING_FILE);
const testing           = pa.PLUGIN_TESTING || pa.SNOW_TESTING || testingFile;
const commentsFile      = !newDeployment && loadFromFile(pa.PLUGIN_COMMENTS_FILE || pa.SNOW_COMMENTS_FILE);
const comments          = pa.PLUGIN_COMMENTS || pa.SNOW_COMMENTS || commentsFile;
const deploymentOutcome = /^success$/i.test(pa.PLUGIN_DEPLOYMENT_OUTCOME || pa.status);
const newChange         = newDeployment || !(statusUpdate || comments);
const messageTemplates  = {
  openChange: {
    messageid: 'HO_SIAM_IN_REST_CHG_POST_JSON',
    payload:   JSON.stringify(testing ? {
      title:       title,
      endTime:     endTime,
      description: description,
      supplierRef: externalID,
      testing:     testing
    } : {
      title:       title,
      endTime:     endTime,
      description: description,
      supplierRef: externalID
    })
  },
  update: {
    messageid: 'HO_SIAM_IN_REST_CHG_UPDATE_JSON',
    'internal_identifier': internalID,
    'external_identifier': externalID,
    payload:               JSON.stringify({
      success:  deploymentOutcome ? 'true' : 'false',
      comments: comments
    })
  }
};

module.exports = {
  intIDFile: intIDFile,
  endpoint:  `${protocol}://${sendToProd ? snowProdInstance : snowTestInstance}/${snowPath}`,
  username:  username,
  password:  password,
  message:   newChange ? messageTemplates.openChange : messageTemplates.update
};
