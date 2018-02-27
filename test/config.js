'use strict';

const fs         = require('fs');
const mfs        = require('mock-fs');
const moment     = require('moment');
const config     = rewire('../config');
const prop       = (obj, property) => obj.__get__(property); // eslint-disable-line no-underscore-dangle
const snowP      = prop(config, 'snowPath');

// fake modules
const fmoment = function () {
  return arguments.length ? moment(...arguments) : moment('2000-01-01 13:00:00');
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
      });
      beforeEach(() => {
        this.loadFromFile = prop(config, 'loadFromFile');
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
  });

  describe('exported object should contain values from environment variables', () => {
    describe('with maximal (explicit) configuration for', () => {
      describe('a new deployment notification returns an object which', function () {
        before(() => {
          const env = {
            PLUGIN_PROTOCOL:          'http',
            PLUGIN_PROD_URL:          'prod.com',
            PLUGIN_TEST_URL:          'test.com',
            PLUGIN_SEND_TO_PROD:      'True',
            PLUGIN_USERNAME:          'user',
            PLUGIN_PASSWORD:          'pass',
            PLUGIN_INTERNAL_ID_FILE:  '/test-files/snow-int-id',
            PLUGIN_EXTERNAL_ID:       'ext-id',
            PLUGIN_NOTIFICATION_TYPE: 'deployment',
            PLUGIN_TITLE:             'title',
            PLUGIN_END_TIME:          '2000-01-01 12:30:00',
            PLUGIN_DESCRIPTION:       'desc',
            PLUGIN_TESTING:           'tests'
          };
          this.env                           = env;
          global.injected                    = { env: env };
          const files                        = { };
          files[env.PLUGIN_INTERNAL_ID_FILE] = '';
          this.config                        = proxyquire('../config', { fs: ffs(files), moment: fmoment });
        });
        it('should return a populated config object', () => expect(this.config).to.be.an('object'));
        it('should have path to ID file', () => expect(this.config)
          .to.have.property('intIDFile', this.env.PLUGIN_INTERNAL_ID_FILE));
        it('should have endpoint', () => expect(this.config)
          .to.have.property('endpoint', `${this.env.PLUGIN_PROTOCOL}://${this.env.PLUGIN_PROD_URL}/${snowP}`));
        it('should have username', () => expect(this.config).to.have.property('username', this.env.PLUGIN_USERNAME));
        it('should have password', () => expect(this.config).to.have.property('password', this.env.PLUGIN_PASSWORD));
        it('should have a payload object', () => expect(this.config).to.have.property('message')
          .which.is.an('object')
          .that.has.property('messageid', 'HO_SIAM_IN_REST_CHG_POST_JSON'));
        it('should have a message in the payload', () => expect(this.config.message).to.have.property('payload')
          .that.is.json.and.an('object').which.deep.equals({
            title: this.env.PLUGIN_TITLE,
            endTime: this.env.PLUGIN_END_TIME,
            description: this.env.PLUGIN_DESCRIPTION,
            supplierRef: this.env.PLUGIN_EXTERNAL_ID,
            testing: this.env.PLUGIN_TESTING
          }));
      });

      describe('a successful deployment notification returns an object which', function () {
        before(() => {
          const env = {
            PLUGIN_PROTOCOL:           'http',
            PLUGIN_PROD_URL:           'prod.com',
            PLUGIN_TEST_URL:           'test.com',
            PLUGIN_SEND_TO_PROD:       'true',
            PLUGIN_USERNAME:           'user',
            PLUGIN_PASSWORD:           'pass',
            PLUGIN_INTERNAL_ID:        'int-id',
            PLUGIN_EXTERNAL_ID:        'ext-id',
            PLUGIN_NOTIFICATION_TYPE:  'status update',
            PLUGIN_DEPLOYMENT_OUTCOME: 'success',
            PLUGIN_COMMENTS:           'it went well'
          };
          this.env        = env;
          global.injected = { env: env };
          this.config     = rewire('../config');
        });
        it('should return a populated config object', () => expect(this.config).to.be.an('object'));
        it('should have endpoint', () => expect(this.config)
          .to.have.property('endpoint', `${this.env.PLUGIN_PROTOCOL}://${this.env.PLUGIN_PROD_URL}/${snowP}`));
        it('should have username', () => expect(this.config).to.have.property('username', this.env.PLUGIN_USERNAME));
        it('should have password', () => expect(this.config).to.have.property('password', this.env.PLUGIN_PASSWORD));
        it('should have a payload object', () => expect(this.config).to.have.property('message')
          .which.is.an('object')
          .that.has.property('messageid', 'HO_SIAM_IN_REST_CHG_UPDATE_JSON'));
        it('should have an internal ID in the payload', () => expect(this.config.message)
          .to.have.property('internal_identifier', this.env.PLUGIN_INTERNAL_ID));
        it('should have an external ID in the payload', () => expect(this.config.message)
          .to.have.property('external_identifier', this.env.PLUGIN_EXTERNAL_ID));
        it('should have a message in the payload', () => expect(this.config.message).to.have.property('payload')
          .that.is.json.and.an('object').which.deep.equals({ success: 'true', comments: this.env.PLUGIN_COMMENTS }));
      });

      describe('a failed deployment notification returns an object which', function () {
        before(() => {
          const env = {
            PLUGIN_PROTOCOL:           'http',
            PLUGIN_PROD_URL:           'prod.com',
            PLUGIN_TEST_URL:           'test.com',
            PLUGIN_SEND_TO_PROD:       'true',
            PLUGIN_USERNAME:           'user',
            PLUGIN_PASSWORD:           'pass',
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
        it('should have endpoint', () => expect(this.config)
          .to.have.property('endpoint', `${this.env.PLUGIN_PROTOCOL}://${this.env.PLUGIN_PROD_URL}/${snowP}`));
        it('should have username', () => expect(this.config).to.have.property('username', this.env.PLUGIN_USERNAME));
        it('should have password', () => expect(this.config).to.have.property('password', this.env.PLUGIN_PASSWORD));
        it('should have a payload object', () => expect(this.config).to.have.property('message')
          .which.is.an('object')
          .that.has.property('messageid', 'HO_SIAM_IN_REST_CHG_UPDATE_JSON'));
        it('should have an internal ID in the payload', () => expect(this.config.message)
          .to.have.property('internal_identifier', this.env.PLUGIN_INTERNAL_ID));
        it('should have an external ID in the payload', () => expect(this.config.message)
          .to.have.property('external_identifier', this.env.PLUGIN_EXTERNAL_ID));
        it('should have a message in the payload', () => expect(this.config.message).to.have.property('payload')
          .that.is.json.and.an('object').which.deep.equals({ success: 'false', comments: this.env.PLUGIN_COMMENTS }));
      });
    });

    describe('with minimal (implicit) configuration', () => {
      describe('a new deployment notification returns an object which', function () {
        before(() => {
          // all values from global drone config
          const env = {
            DRONE_REPO_NAME:    'my-repo',
            DRONE_BUILD_NUMBER: 42,
            DEPLOY_TO:          'prod',
            SNOW_USER:          'user',
            SNOW_PASS:          'pass',
            SNOW_DESC_FILE:     '/test-files/snow-desc'
          };
          this.env                  = env;
          this.desc                 = 'deployment desc from file';
          const files               = { };
          files[env.SNOW_DESC_FILE] = this.desc;
          global.injected           = { env: env };
          this.config               = proxyquire('../config', { fs: ffs(files), moment: fmoment });
        });
        it('should return a populated config object', () => expect(this.config).to.be.an('object'));
        it('should have endpoint', () => expect(this.config)
          .to.have.property('endpoint', `https://${prop(config, 'snowProdInstance')}/${snowP}`));
        it('should have username', () => expect(this.config)
          .to.have.property('username', this.env.SNOW_USER));
        it('should have password', () => expect(this.config)
          .to.have.property('password', this.env.SNOW_PASS));
        it('should have a payload object', () => expect(this.config).to.have.property('message')
          .which.is.an('object')
          .that.has.property('messageid', 'HO_SIAM_IN_REST_CHG_POST_JSON'));
        it('should have a message in the payload', () => expect(this.config.message).to.have.property('payload')
          .that.is.json.and.an('object').which.deep.equals({
            title: `Deployment #${this.env.DRONE_BUILD_NUMBER} of ${this.env.DRONE_REPO_NAME}`,
            endTime: '2000-01-01 13:30:00',
            description: this.desc,
            supplierRef: `${this.env.SNOW_USER}-${this.env.DRONE_REPO_NAME}-${this.env.DRONE_BUILD_NUMBER}`
          }));
      });

      describe('a successful deployment notification returns an object which', function () {
        before(() => {
          const env = {
            DRONE_REPO_NAME:      'my-repo',
            DRONE_BUILD_NUMBER:   42,
            DEPLOY_TO:            'PRODUCTION',
            SERVICE_NOW_USERNAME: 'user',
            SERVICE_NOW_PASSWORD: 'pass',
            SNOW_INT_ID_FILE:     '/test-files/snow-int-id',
            SNOW_DESC_FILE:       '/test-files/snow-desc',
            SNOW_COMMENTS_FILE:   '/test-files/snow-comments',
            status:               'SUCCESS'
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
        it('should have endpoint', () => expect(this.config)
          .to.have.property('endpoint', `https://${prop(config, 'snowProdInstance')}/${snowP}`));
        it('should have username', () => expect(this.config)
          .to.have.property('username', this.env.SERVICE_NOW_USERNAME));
        it('should have password', () => expect(this.config)
          .to.have.property('password', this.env.SERVICE_NOW_PASSWORD));
        it('should have a payload object', () => expect(this.config).to.have.property('message')
          .which.is.an('object')
          .that.has.property('messageid', 'HO_SIAM_IN_REST_CHG_UPDATE_JSON'));
        it('should have an internal ID in the payload', () => expect(this.config.message)
          .to.have.property('internal_identifier', this.intID));
        it('should have an external ID in the payload', () => expect(this.config.message)
          .to.have.property('external_identifier',
            `${this.env.SERVICE_NOW_USERNAME}-${this.env.DRONE_REPO_NAME}-${this.env.DRONE_BUILD_NUMBER}`));
        it('should have a message in the payload', () => expect(this.config.message).to.have.property('payload')
          .that.is.json.and.an('object').which.deep.equals({ success: 'true', comments: this.comments }));
      });

      describe('a failed deployment notification returns an object which', function () {
        before(() => {
          const env = {
            DRONE_REPO_NAME:      'my-repo',
            DRONE_BUILD_NUMBER:   42,
            SERVICE_NOW_USERNAME: 'user',
            SERVICE_NOW_PASSWORD: 'pass',
            SNOW_INT_ID_FILE:     '/test-files/snow-int-id',
            SNOW_DESC_FILE:       '/test-files/snow-desc',
            SNOW_COMMENTS_FILE:   '/test-files/snow-comments',
            status:               'FAILED'
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
        it('should have endpoint', () => expect(this.config)
          .to.have.property('endpoint', `https://${prop(config, 'snowTestInstance')}/${snowP}`));
        it('should have username', () => expect(this.config)
          .to.have.property('username', this.env.SERVICE_NOW_USERNAME));
        it('should have password', () => expect(this.config)
          .to.have.property('password', this.env.SERVICE_NOW_PASSWORD));
        it('should have a payload object', () => expect(this.config).to.have.property('message')
          .which.is.an('object')
          .that.has.property('messageid', 'HO_SIAM_IN_REST_CHG_UPDATE_JSON'));
        it('should have an internal ID in the payload', () => expect(this.config.message)
          .to.have.property('internal_identifier', this.intID));
        it('should have an external ID in the payload', () => expect(this.config.message)
          .to.have.property('external_identifier',
            `${this.env.SERVICE_NOW_USERNAME}-${this.env.DRONE_REPO_NAME}-${this.env.DRONE_BUILD_NUMBER}`));
        it('should have a message in the payload', () => expect(this.config.message).to.have.property('payload')
          .that.is.json.and.an('object').which.deep.equals({ success: 'false', comments: this.comments }));
      });
    });
  });
});
