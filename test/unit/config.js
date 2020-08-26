'use strict';

const fs     = require('fs');
const mfs    = require('mock-fs');
const moment = require('moment');

// fake modules
const fmoment = function () {
  return arguments.length ? moment(...arguments) : moment('2000-08-01 13:00:00');
};
const ffs = files => {
  const fakeFS = Object.create(fs);
  fakeFS.readFileSync = function (file, options) {
    if (files.hasOwnProperty(file)) {
      return files[file];
    }
    return fs.readFileSync(file, options);
  };
  return fakeFS;
};

describe('Config module', () => {
  const { configure, loadFromFile, stripControl, DEFAULTS } = require('../../src/config');

  describe('helper function', () => {

    describe('#loadFromFile', function () {
      const dir          = '/a/dir';
      const contents     = 'some text';
      const content      = 'with-contents';
      const noContent    = 'with-no-contents';
      const readFileSync = sinon.spy(fs, 'readFileSync');

      before(() => {
        mfs({
          [dir]: {
            [content]: contents,
            [noContent]: ''
          }
        });
      });
      beforeEach(() => {
        readFileSync.resetHistory();
      });

      it('should simply return when no file is specified', () => {
        expect(loadFromFile()).to.be.undefined;
        expect(readFileSync).not.to.have.been.called;
        expect(loadFromFile('')).to.be.undefined;
        expect(readFileSync).not.to.have.been.called;
      });
      it('should return the file contents if a file is specified', () => {
        expect(loadFromFile(`${dir}/${content}`)).to.equal(contents);
        expect(readFileSync).to.have.been.calledOnce;
        expect(loadFromFile(`${dir}/${noContent}`)).to.equal('');
        expect(readFileSync).to.have.been.calledTwice;
      });
      it('should throw an error if the specified file does not exist', () => {
        const file = 'not-a-file';
        expect(() => loadFromFile(file)).to.throw(Error);
        expect(readFileSync).to.have.been.calledWith(file);
        expect(readFileSync).to.have.thrown('Error');
      });

      after(() => {
        mfs.restore();
      });
    });

    describe('#stripControl', function () {
      before('get fixture text', () => {
        this.text = loadFromFile('./test/fixtures/test-output.txt');
        this.clean = loadFromFile('./test/fixtures/clean-output.txt');
      });
      it('should remove the unwated (control) characters from the text input', () =>
        expect(stripControl(this.text))
          .be.a('string')
          .and.have.lengthOf.below(this.text.length)
          .and.to.match(/^[^\0-\x08\x11-\x1f]+$/g) // eslint-disable-line no-control-regex
          .and.to.equal(this.clean));
    });
  });

  describe('exported object should contain values from environment variables', () => {
    describe('if the disabled flag is set', () => {
      const env = {
        PLUGIN_SNOW_DISABLED:     'true',
        PLUGIN_PROTOCOL:          'test',
        PLUGIN_PROD_HOST:         'test',
        PLUGIN_TEST_HOST:         'test',
        PLUGIN_SEND_TO_PROD:      'test',
        PLUGIN_USERNAME:          'test',
        PLUGIN_PASSWORD:          'test',
        PLUGIN_INTERNAL_ID_FILE:  'test',
        PLUGIN_EXTERNAL_ID:       'test',
        PLUGIN_NOTIFICATION_TYPE: 'test',
        PLUGIN_TITLE:             'test',
        PLUGIN_START_TIME:        'test',
        PLUGIN_END_TIME:          'test',
        PLUGIN_DESCRIPTION:       'test',
        PLUGIN_TESTING:           'test',
        PLUGIN_FAIL_ON_ERROR:     'test'
      };
      const files = { [env.PLUGIN_INTERNAL_ID_FILE]: '' };
      const conf = proxyquire('../src/config', { fs: ffs(files), moment: fmoment }).configure(env);

      it('should be the only item', () => expect(conf).to.be.an('object').that.deep.equals({ disabled: true }));
    });

    describe('with maximal (explicit) configuration for', () => {
      describe('a new deployment notification returns an object which', function () {
        const env = {
          PLUGIN_PROTOCOL:          'http',
          PLUGIN_PROD_HOST:         'prod.com',
          PLUGIN_TEST_HOST:         'test.com',
          PLUGIN_SEND_TO_PROD:      'True',
          PLUGIN_USERNAME:          'user',
          PLUGIN_PASSWORD:          'pass',
          PLUGIN_INTERNAL_ID_FILE:  '/test-files/snow-int-id',
          PLUGIN_EXTERNAL_ID:       'ext-id',
          PLUGIN_NOTIFICATION_TYPE: 'deployment',
          PLUGIN_TITLE:             'title',
          PLUGIN_START_TIME:        '2000-01-01 12:00:00',
          PLUGIN_END_TIME:          '2000-01-01 12:30:00',
          PLUGIN_DESCRIPTION:       'desc',
          PLUGIN_TESTING:           'tests',
          PLUGIN_FAIL_ON_ERROR:     'false'
        };
        const files = { [env.PLUGIN_INTERNAL_ID_FILE]: '' };
        const conf = proxyquire('../src/config', { fs: ffs(files), moment: fmoment }).configure(env);

        it('should return a populated config object', () => expect(conf).to.be.an('object'));
        it('should indicate the notification type', () => expect(conf).to.have.property('newChange', true));
        it('should have path to ID file', () => expect(conf)
          .to.have.property('intIDFile', env.PLUGIN_INTERNAL_ID_FILE));
        it('should have endpoint', () => expect(conf).to.have.property('endpoint',
            `${env.PLUGIN_PROTOCOL}://${env.PLUGIN_PROD_HOST}/${DEFAULTS.SNOW_PATH}`));
        it('should have username', () => expect(conf).to.have.property('username', env.PLUGIN_USERNAME));
        it('should have password', () => expect(conf).to.have.property('password', env.PLUGIN_PASSWORD));
        it('should have a message object', () => expect(conf).to.have.property('message')
          .which.is.an('object')
          .that.includes({
            'messageid':           'HO_SIAM_IN_REST_CHG_POST_JSON',
            'external_identifier': env.PLUGIN_EXTERNAL_ID
          }));
        it('should have a payload in the message', () => expect(conf.message).to.have.property('payload')
          .that.is.an('object').which.deep.equals({
            title: env.PLUGIN_TITLE,
            startTime: env.PLUGIN_START_TIME,
            endTime: env.PLUGIN_END_TIME,
            description: env.PLUGIN_DESCRIPTION,
            supplierRef: env.PLUGIN_EXTERNAL_ID,
            testing: env.PLUGIN_TESTING
          }));
        it('should have fail on error disabled', () => expect(conf).to.have.property('failOnError', false));
        it('should not be disabled', () => expect(conf.disabled).not.to.be.true);
      });

      describe('a successful deployment notification returns an object which', function () {
        const env = {
          PLUGIN_PROTOCOL:           'http',
          PLUGIN_PROD_HOST:          'prod.com',
          PLUGIN_TEST_HOST:          'test.com',
          PLUGIN_SEND_TO_PROD:       'true',
          PLUGIN_USERNAME:           'user',
          PLUGIN_PASSWORD:           'pass',
          PLUGIN_INTERNAL_ID:        'int-id',
          PLUGIN_EXTERNAL_ID:        'ext-id',
          PLUGIN_NOTIFICATION_TYPE:  'status update',
          PLUGIN_DEPLOYMENT_OUTCOME: 'success',
          PLUGIN_COMMENTS:           'it went well',
          PLUGIN_FAIL_ON_ERROR:      'yes'
        };
        const conf = configure(env);

        it('should return a populated config object', () => expect(conf).to.be.an('object'));
        it('should indicate the notification type', () => expect(conf).to.have.property('newChange', false));
        it('should indicate the update status', () => expect(conf).to.have.property('success', true));
        it('should have endpoint', () => expect(conf)
          .to.have.property('endpoint', `${env.PLUGIN_PROTOCOL}://${env.PLUGIN_PROD_HOST}/${DEFAULTS.SNOW_PATH}`));
        it('should have username', () => expect(conf).to.have.property('username', env.PLUGIN_USERNAME));
        it('should have password', () => expect(conf).to.have.property('password', env.PLUGIN_PASSWORD));
        it('should have a payload object', () => expect(conf).to.have.property('message')
          .which.is.an('object')
          .that.has.property('messageid', 'HO_SIAM_IN_REST_CHG_UPDATE_JSON'));
        it('should have an internal ID in the payload', () => expect(conf.message)
          .to.have.property('internal_identifier', env.PLUGIN_INTERNAL_ID));
        it('should have a message in the payload', () => expect(conf.message).to.have.property('payload')
          .that.is.an('object').which.deep.equals({ success: 'true', comments: env.PLUGIN_COMMENTS }));
        it('should have fail on error enabled', () => expect(conf).to.have.property('failOnError', true));
      });

      describe('a failed deployment notification returns an object which', function () {
        const env = {
          PLUGIN_PROTOCOL:           'http',
          PLUGIN_PROD_HOST:          'prod.com',
          PLUGIN_TEST_HOST:          'test.com',
          PLUGIN_SEND_TO_PROD:       'true',
          SNOW_USER:                 'user',
          SNOW_TEST_USER:            'test-user',
          SNOW_PROD_USER:            'prod-user',
          SNOW_PASS:                 'pass',
          SNOW_TEST_PASS:            'test-pass',
          SNOW_PROD_PASS:            'prod-pass',
          PLUGIN_USERNAME:           'plugin-user',
          PLUGIN_PASSWORD:           'plugin-pass',
          PLUGIN_INTERNAL_ID:        'int-id',
          PLUGIN_EXTERNAL_ID:        'ext-id',
          PLUGIN_NOTIFICATION_TYPE:  'StatusUpdate',
          PLUGIN_DEPLOYMENT_OUTCOME: 'MEGA FAIL',
          PLUGIN_COMMENTS:           'it did not go well'
        };
        const conf = configure(env);

        it('should return a populated config object', () => expect(conf).to.be.an('object'));
        it('should indicate the notification type', () => expect(conf).to.have.property('newChange', false));
        it('should indicate the update status', () => expect(conf).to.have.property('success', false));
        it('should have endpoint', () => expect(conf)
          .to.have.property('endpoint', `${env.PLUGIN_PROTOCOL}://${env.PLUGIN_PROD_HOST}/${DEFAULTS.SNOW_PATH}`));
        it('should have username', () => expect(conf).to.have.property('username', env.PLUGIN_USERNAME));
        it('should have password', () => expect(conf).to.have.property('password', env.PLUGIN_PASSWORD));
        it('should have a payload object', () => expect(conf).to.have.property('message')
          .which.is.an('object')
          .that.has.property('messageid', 'HO_SIAM_IN_REST_CHG_UPDATE_JSON'));
        it('should have an internal ID in the payload', () => expect(conf.message)
          .to.have.property('internal_identifier', env.PLUGIN_INTERNAL_ID));
        it('should have a message in the payload', () => expect(conf.message).to.have.property('payload')
          .that.is.an('object').which.deep.equals({ success: 'false', comments: env.PLUGIN_COMMENTS }));
      });
    });

    describe('with minimal (implicit) configuration', () => {
      describe('a new deployment notification returns an object which', function () {
        // all values from global drone config
        const env = {
          DRONE_REPO_NAME:    'my-repo',
          DRONE_BUILD_NUMBER: 42,
          DRONE_DEPLOY_TO:    'prod',
          SNOW_USER:          'user',
          SNOW_TEST_USER:     'test-user',
          SNOW_PROD_USER:     'prod-user',
          SNOW_PASS:          'pass',
          SNOW_TEST_PASS:     'test-pass',
          SNOW_PROD_PASS:     'prod-pass',
          SNOW_DESC_FILE:     '/test-files/snow-desc'
        };
        const desc = 'deployment desc from file';
        const files = { [env.SNOW_DESC_FILE]: desc };
        const conf = proxyquire('../src/config', { fs: ffs(files), moment: fmoment }).configure(env);
        const exitID = `${env.SNOW_PROD_USER}-${env.DRONE_REPO_NAME}-${env.DRONE_BUILD_NUMBER}`;

        it('should return a populated config object', () => expect(conf).to.be.an('object'));
        it('should indicate the notification type', () => expect(conf).to.have.property('newChange', true));
        it('should have endpoint', () => expect(conf)
          .to.have.property('endpoint', `https://${DEFAULTS.PROD_HOST}/${DEFAULTS.SNOW_PATH}`));
        it('should have prod user', () => expect(conf).to.have.property('username', env.SNOW_PROD_USER));
        it('should have prod pass', () => expect(conf).to.have.property('password', env.SNOW_PROD_PASS));
        it('should have a payload object', () => expect(conf).to.have.property('message')
          .which.is.an('object')
          .that.includes({
            'messageid':           'HO_SIAM_IN_REST_CHG_POST_JSON',
            'external_identifier': exitID
          }));
        it('should have a payload in the message', () => expect(conf.message).to.have.property('payload')
          .that.is.an('object').which.deep.equals({
            title: `Deployment #${env.DRONE_BUILD_NUMBER} of ${env.DRONE_REPO_NAME}`,
            startTime: '2000-08-01 13:00:00',
            endTime: '2000-08-01 13:30:00',
            description: desc,
            supplierRef: exitID
          }));
      });

      describe('a successful deployment notification returns an object which', function () {
        const env = {
          DRONE_REPO_NAME:    'my-repo',
          DRONE_BUILD_NUMBER: 42,
          SNOW_ENDPOINT:      'ftp://prety.sure/this/would.not?work=though',
          SNOW_USER:          'user',
          SNOW_TEST_USER:     'test-user',
          SNOW_PROD_USER:     'prod-user',
          SNOW_PASS:          'pass',
          SNOW_TEST_PASS:     'test-pass',
          SNOW_PROD_PASS:     'prod-pass',
          SNOW_INT_ID_FILE:   '/test-files/snow-int-id',
          SNOW_DESC_FILE:     '/test-files/snow-desc',
          SNOW_COMMENTS_FILE: '/test-files/snow-comments',
          DRONE_BUILD_STATUS: 'SUCCESS'
        };
        const intID = 'snow internal ID';
        const comments = 'it went well';
        const files = {
          [env.SNOW_INT_ID_FILE]: intID,
          [env.SNOW_DESC_FILE]: 'description from earlier notification, overridden by update comments',
          [env.SNOW_COMMENTS_FILE]: comments
        };
        const conf = proxyquire('../src/config', { fs: ffs(files), moment: fmoment }).configure(env);

        it('should return a populated config object', () => expect(conf).to.be.an('object'));
        it('should indicate the notification type', () => expect(conf).to.have.property('newChange', false));
        it('should indicate the update status', () => expect(conf).to.have.property('success', true));
        it('should have endpoint', () => expect(conf).to.have.property('endpoint', env.SNOW_ENDPOINT));
        it('should have test user', () => expect(conf).to.have.property('username', env.SNOW_TEST_USER));
        it('should have test pass', () => expect(conf).to.have.property('password', env.SNOW_TEST_PASS));
        it('should have a payload object', () => expect(conf).to.have.property('message')
          .which.is.an('object')
          .that.has.property('messageid', 'HO_SIAM_IN_REST_CHG_UPDATE_JSON'));
        it('should have an internal ID in the payload', () => expect(conf.message)
          .to.have.property('internal_identifier', intID));
        it('should have a message in the payload', () => expect(conf.message).to.have.property('payload')
          .that.is.an('object').which.deep.equals({ success: 'true', comments: comments }));
      });

      describe('a failed deployment notification returns an object which', function () {
        const env = {
          DRONE_REPO_NAME:    'my-repo',
          DRONE_BUILD_NUMBER: 42,
          SNOW_USER:          'user',
          SNOW_PASS:          'pass',
          SNOW_INT_ID_FILE:   '/test-files/snow-int-id',
          SNOW_DESC_FILE:     '/test-files/snow-desc',
          SNOW_COMMENTS_FILE: '/test-files/snow-comments',
          DRONE_BUILD_STATUS: 'FAILED'
        };
        const intID = 'snow internal ID';
        const comments = 'it did not go well!';
        const files = {
          [env.SNOW_INT_ID_FILE]: intID,
          [env.SNOW_DESC_FILE]: 'description from earlier notification, overridden by update comments',
          [env.SNOW_COMMENTS_FILE]: comments
        };
        const conf = proxyquire('../src/config', { fs: ffs(files), moment: fmoment }).configure(env);

        it('should return a correctly populated config object', () => expect(conf).to.be.an('object'));
        it('should indicate the notification type', () => expect(conf).to.have.property('newChange', false));
        it('should indicate the update status', () => expect(conf).to.have.property('success', false));
        it('should have endpoint', () => expect(conf)
          .to.have.property('endpoint', `https://${DEFAULTS.TEST_HOST}/${DEFAULTS.SNOW_PATH}`));
        it('should have username', () => expect(conf).to.have.property('username', env.SNOW_USER));
        it('should have password', () => expect(conf).to.have.property('password', env.SNOW_PASS));
        it('should have a payload object', () => expect(conf).to.have.property('message')
          .which.is.an('object')
          .that.has.property('messageid', 'HO_SIAM_IN_REST_CHG_UPDATE_JSON'));
        it('should have an internal ID in the payload', () => expect(conf.message)
          .to.have.property('internal_identifier', intID));
        it('should have a message in the payload', () => expect(conf.message).to.have.property('payload')
          .that.is.an('object').which.deep.equals({ success: 'false', comments: comments }));
      });
    });
  });

  describe('an error should be thrown if the end time', () => {
    it('is in the past and no start time has been provided', () =>
      expect(() => configure({ PLUGIN_END_TIME: '2000-01-01 00:00:00' }))
        .to.Throw(RangeError, 'The deployment start time MUST be before the end time'));

    it('is before the start time', () =>
      expect(() => configure({
        PLUGIN_START_TIME: '2000-01-01 10:00:00',
        PLUGIN_END_TIME: '2000-01-01 00:00:00'
      }))
        .to.Throw(RangeError, 'The deployment start time MUST be before the end time'));
  });
});
