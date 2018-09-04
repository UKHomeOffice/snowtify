'use strict';

const fs     = require('fs');
const mfs    = require('mock-fs');
const moment = require('moment');
const config = rewire('../config');
const prop   = (obj, property) => obj.__get__(property); // eslint-disable-line no-underscore-dangle
const snowP  = prop(config, 'snowPath');

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
  describe('helper function', () => {
    describe('#loadFromFile', function () {
      const dir       = '/a/dir';
      const contents  = 'some text';
      const content   = 'with-contents';
      const noContent = 'with-no-contents';

      before(() => {
        const files           = { };
        files[dir]            = { };
        files[dir][content]   = contents;
        files[dir][noContent] = '';
        mfs(files);
        this.loadFromFile = prop(config, 'loadFromFile');
      });
      beforeEach(() => {
        this.readFileSync = sinon.spy(prop(config, 'fs'), 'readFileSync');
      });

      it('should simply return when no file is specified', () => {
        expect(this.loadFromFile()).to.be.undefined;
        expect(this.readFileSync).not.to.have.been.called;
        expect(this.loadFromFile('')).to.be.undefined;
        expect(this.readFileSync).not.to.have.been.called;
      });
      it('should return the file contents if a file is specified', () => {
        expect(this.loadFromFile(`${dir}/${content}`)).to.equal(contents);
        expect(this.readFileSync).to.have.been.calledOnce;
        expect(this.loadFromFile(`${dir}/${noContent}`)).to.equal('');
        expect(this.readFileSync).to.have.been.calledTwice;
      });
      it('should throw an error if the specified file does not exist', () => {
        const file = 'not-a-file';
        expect(() => this.loadFromFile(file)).to.throw(Error, `ENOENT, no such file or directory '${file}'`);
        expect(this.readFileSync).to.have.been.calledWith(file);
        expect(this.readFileSync).to.have.thrown('Error');
      });

      afterEach(() => {
        this.readFileSync.restore();
      });
      after(() => {
        mfs.restore();
      });
    });

    describe('#stripControl', function () {
      before('get fixture text', () => {
        const load = prop(config, 'loadFromFile');
        this.text = load('./test/fixtures/test-output.txt');
        this.clean = load('./test/fixtures/clean-output.txt');
        this.stripControl = prop(config, 'stripControl');
      });
      it('should remove the unwated (control) characters from the text input', () =>
        expect(this.stripControl(this.text))
          .be.a('string')
          .and.have.lengthOf.below(this.text.length)
          .and.to.match(/^[^\0-\x08\x11-\x1f]+$/g)
          .and.to.equal(this.clean));
    });
  });

  describe('exported object should contain values from environment variables', () => {
    describe('with maximal (explicit) configuration for', () => {
      describe('a new deployment notification returns an object which', function () {
        before(() => {
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
          this.env                           = env;
          global.injected                    = { env: env };
          const files                        = { };
          files[env.PLUGIN_INTERNAL_ID_FILE] = '';
          this.config                        = proxyquire('../config', { fs: ffs(files), moment: fmoment });
        });
        it('should return a populated config object', () => expect(this.config).to.be.an('object'));
        it('should indicate the notification type', () => expect(this.config).to.have.property('newChange', true));
        it('should have path to ID file', () => expect(this.config)
          .to.have.property('intIDFile', this.env.PLUGIN_INTERNAL_ID_FILE));
        it('should have endpoint', () => expect(this.config)
          .to.have.property('endpoint', `${this.env.PLUGIN_PROTOCOL}://${this.env.PLUGIN_PROD_HOST}/${snowP}`));
        it('should have username', () => expect(this.config).to.have.property('username', this.env.PLUGIN_USERNAME));
        it('should have password', () => expect(this.config).to.have.property('password', this.env.PLUGIN_PASSWORD));
        it('should have a message object', () => expect(this.config).to.have.property('message')
          .which.is.an('object')
          .that.includes({
            'messageid':           'HO_SIAM_IN_REST_CHG_POST_JSON',
            'external_identifier': this.env.PLUGIN_EXTERNAL_ID
          }));
        it('should have a payload in the message', () => expect(this.config.message).to.have.property('payload')
          .that.is.an('object').which.deep.equals({
            title: this.env.PLUGIN_TITLE,
            startTime: this.env.PLUGIN_START_TIME,
            endTime: this.env.PLUGIN_END_TIME,
            description: this.env.PLUGIN_DESCRIPTION,
            supplierRef: this.env.PLUGIN_EXTERNAL_ID,
            testing: this.env.PLUGIN_TESTING
          }));
        it('should have fail on error disabled', () => expect(this.config).to.have.property('failOnError', false));
      });

      describe('a successful deployment notification returns an object which', function () {
        before(() => {
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
          this.env        = env;
          global.injected = { env: env };
          this.config     = rewire('../config');
        });
        it('should return a populated config object', () => expect(this.config).to.be.an('object'));
        it('should indicate the notification type', () => expect(this.config).to.have.property('newChange', false));
        it('should indicate the update status', () => expect(this.config).to.have.property('success', true));
        it('should have endpoint', () => expect(this.config)
          .to.have.property('endpoint', `${this.env.PLUGIN_PROTOCOL}://${this.env.PLUGIN_PROD_HOST}/${snowP}`));
        it('should have username', () => expect(this.config).to.have.property('username', this.env.PLUGIN_USERNAME));
        it('should have password', () => expect(this.config).to.have.property('password', this.env.PLUGIN_PASSWORD));
        it('should have a payload object', () => expect(this.config).to.have.property('message')
          .which.is.an('object')
          .that.has.property('messageid', 'HO_SIAM_IN_REST_CHG_UPDATE_JSON'));
        it('should have an internal ID in the payload', () => expect(this.config.message)
          .to.have.property('internal_identifier', this.env.PLUGIN_INTERNAL_ID));
        it('should have a message in the payload', () => expect(this.config.message).to.have.property('payload')
          .that.is.an('object').which.deep.equals({ success: 'true', comments: this.env.PLUGIN_COMMENTS }));
        it('should have fail on error enabled', () => expect(this.config).to.have.property('failOnError', true));
      });

      describe('a failed deployment notification returns an object which', function () {
        before(() => {
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
          this.env        = env;
          global.injected = { env: env };
          this.config     = rewire('../config');
        });
        it('should return a populated config object', () => expect(this.config).to.be.an('object'));
        it('should indicate the notification type', () => expect(this.config).to.have.property('newChange', false));
        it('should indicate the update status', () => expect(this.config).to.have.property('success', false));
        it('should have endpoint', () => expect(this.config)
          .to.have.property('endpoint', `${this.env.PLUGIN_PROTOCOL}://${this.env.PLUGIN_PROD_HOST}/${snowP}`));
        it('should have username', () => expect(this.config).to.have.property('username', this.env.PLUGIN_USERNAME));
        it('should have password', () => expect(this.config).to.have.property('password', this.env.PLUGIN_PASSWORD));
        it('should have a payload object', () => expect(this.config).to.have.property('message')
          .which.is.an('object')
          .that.has.property('messageid', 'HO_SIAM_IN_REST_CHG_UPDATE_JSON'));
        it('should have an internal ID in the payload', () => expect(this.config.message)
          .to.have.property('internal_identifier', this.env.PLUGIN_INTERNAL_ID));
        it('should have a message in the payload', () => expect(this.config.message).to.have.property('payload')
          .that.is.an('object').which.deep.equals({ success: 'false', comments: this.env.PLUGIN_COMMENTS }));
      });
    });

    describe('with minimal (implicit) configuration', () => {
      describe('a new deployment notification returns an object which', function () {
        before(() => {
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
          this.env                  = env;
          this.desc                 = 'deployment desc from file';
          const files               = { };
          files[env.SNOW_DESC_FILE] = this.desc;
          global.injected           = { env: env };
          this.config               = proxyquire('../config', { fs: ffs(files), moment: fmoment });
          this.extID                = `${env.SNOW_PROD_USER}-${env.DRONE_REPO_NAME}-${env.DRONE_BUILD_NUMBER}`;
        });
        it('should return a populated config object', () => expect(this.config).to.be.an('object'));
        it('should indicate the notification type', () => expect(this.config).to.have.property('newChange', true));
        it('should have endpoint', () => expect(this.config)
          .to.have.property('endpoint', `https://${prop(config, 'snowProdInstance')}/${snowP}`));
        it('should have prod user', () => expect(this.config).to.have.property('username', this.env.SNOW_PROD_USER));
        it('should have prod pass', () => expect(this.config).to.have.property('password', this.env.SNOW_PROD_PASS));
        it('should have a payload object', () => expect(this.config).to.have.property('message')
          .which.is.an('object')
          .that.includes({
            'messageid':           'HO_SIAM_IN_REST_CHG_POST_JSON',
            'external_identifier': this.extID
          }));
        it('should have a payload in the message', () => expect(this.config.message).to.have.property('payload')
          .that.is.an('object').which.deep.equals({
            title: `Deployment #${this.env.DRONE_BUILD_NUMBER} of ${this.env.DRONE_REPO_NAME}`,
            startTime: '2000-08-01 13:00:00',
            endTime: '2000-08-01 13:30:00',
            description: this.desc,
            supplierRef: this.extID
          }));
      });

      describe('a successful deployment notification returns an object which', function () {
        before(() => {
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
          this.env                      = env;
          this.intID                    = 'snow internal ID';
          this.comments                 = 'it went well';
          const files                   = { };
          files[env.SNOW_INT_ID_FILE]   = this.intID;
          files[env.SNOW_DESC_FILE]     = 'description from earlier notification, overridden by update comments';
          files[env.SNOW_COMMENTS_FILE] = this.comments;
          global.injected               = { env: env };
          this.config                   = proxyquire('../config', { fs: ffs(files), moment: fmoment });
        });
        it('should return a populated config object', () => expect(this.config).to.be.an('object'));
        it('should indicate the notification type', () => expect(this.config).to.have.property('newChange', false));
        it('should indicate the update status', () => expect(this.config).to.have.property('success', true));
        it('should have endpoint', () => expect(this.config).to.have.property('endpoint', this.env.SNOW_ENDPOINT));
        it('should have test user', () => expect(this.config).to.have.property('username', this.env.SNOW_TEST_USER));
        it('should have test pass', () => expect(this.config).to.have.property('password', this.env.SNOW_TEST_PASS));
        it('should have a payload object', () => expect(this.config).to.have.property('message')
          .which.is.an('object')
          .that.has.property('messageid', 'HO_SIAM_IN_REST_CHG_UPDATE_JSON'));
        it('should have an internal ID in the payload', () => expect(this.config.message)
          .to.have.property('internal_identifier', this.intID));
        it('should have a message in the payload', () => expect(this.config.message).to.have.property('payload')
          .that.is.an('object').which.deep.equals({ success: 'true', comments: this.comments }));
      });

      describe('a failed deployment notification returns an object which', function () {
        before(() => {
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
          this.env                      = env;
          this.intID                    = 'snow internal ID';
          this.comments                 = 'it did not go well!';
          const files                   = { };
          files[env.SNOW_INT_ID_FILE]   = this.intID;
          files[env.SNOW_DESC_FILE]     = 'description from earlier notification, overridden by update comments';
          files[env.SNOW_COMMENTS_FILE] = this.comments;
          global.injected               = { env: env };
          this.config                   = proxyquire('../config', { fs: ffs(files), moment: fmoment });
        });
        it('should return a correctly populated config object', () => expect(this.config).to.be.an('object'));
        it('should indicate the notification type', () => expect(this.config).to.have.property('newChange', false));
        it('should indicate the update status', () => expect(this.config).to.have.property('success', false));
        it('should have endpoint', () => expect(this.config)
          .to.have.property('endpoint', `https://${prop(config, 'snowTestInstance')}/${snowP}`));
        it('should have username', () => expect(this.config).to.have.property('username', this.env.SNOW_USER));
        it('should have password', () => expect(this.config).to.have.property('password', this.env.SNOW_PASS));
        it('should have a payload object', () => expect(this.config).to.have.property('message')
          .which.is.an('object')
          .that.has.property('messageid', 'HO_SIAM_IN_REST_CHG_UPDATE_JSON'));
        it('should have an internal ID in the payload', () => expect(this.config.message)
          .to.have.property('internal_identifier', this.intID));
        it('should have a message in the payload', () => expect(this.config.message).to.have.property('payload')
          .that.is.an('object').which.deep.equals({ success: 'false', comments: this.comments }));
      });
    });
  });

  describe('an error should be thrown if the end time', () => {
    before(() => {
      const env = { PLUGIN_END_TIME: '2000-01-01 00:00:00' };
      global.injected = { env: env };
    });
    it('is in the past and no start time has been provided', () =>
      expect(() => rewire('../config')).to.Throw(RangeError, 'The deployment start time MUST be before the end time'));

    before(() => {
      const env = {
        PLUGIN_START_TIME: '2000-01-01 10:00:00',
        PLUGIN_END_TIME: '2000-01-01 00:00:00'
      };
      global.injected = { env: env };
    });
    it('is before the start time', () =>
      expect(() => rewire('../config')).to.Throw(RangeError, 'The deployment start time MUST be before the end time'));
  });
});
