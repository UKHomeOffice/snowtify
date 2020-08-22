'use strict';

const fs       = require('fs');
const http     = require('http');
const snowPath = rewire('../src/config').__get__('snowPath');             // eslint-disable-line no-underscore-dangle
const newID    = rewire('./snow-api-mock/rest-api').__get__('newID'); // eslint-disable-line no-underscore-dangle
const mockPort = 3000;
const mockProxyPort = 3001;
const app      = require('../node_modules/express/lib/application');
let server;
// welcome to hack city
app.listen = function listen() {
  server = http.createServer(this);
  return server.listen.apply(server, arguments);
};
// overridden the express listen function so we can get a reference to the server
// created for the express app, then we can close it nicely after the tests finish

describe('index.js', () => {
  const req    = { };
  req.post     = req.auth = req.proxy = req.type = req.set = req.send = req.then = req.catch = () => req;
  // you are now leaving hack city...
  const conf   = { };
  const plugin = proxyquire('..', { superagent: req, './config': conf });
  const redact = plugin.redact;
  const report = plugin.report;
  const logger = {
    log:     sinon.stub(),
    error:   sinon.stub(),
    warn:    sinon.stub(),
    info:    sinon.stub(),
    verbose: sinon.stub(),
    debug:   sinon.stub()
  };

  before(() => {
    sinon.stub(process, 'exit');
  });

  describe('helper function', () => {
    describe('redact', () => {
      it('should redact passwords but preserve their length', () => {
        expect(redact('PassWord', '123')).to.equal('***');
        expect(redact('PassWord', '0123456789')).to.equal('**********');
      });
      it('should not redact non-passwords', () => expect(redact('other', 'stuff')).to.equal('stuff'));
    });
  });

  describe('Make requests to the ServiceNow API', () => {
    before('start the dyson mock API service', () => {
      require('dyson/lib/dyson').bootstrap({
        port:         mockPort,
        configDir:    'test/snow-api-mock',
        proxy:        false,
        multiRequest: ',',
        quiet:        true
      });
    });

    describe('send new deployment notification', () => {
      const config = {
        newChange: true,
        endpoint:  `http://localhost:${mockPort}/${snowPath}`,
        username:  'snow-user',
        password:  'snow-pass',
        message:   JSON.stringify({
          messageid:             'HO_SIAM_IN_REST_CHG_POST_JSON',
          'external_identifier': 'ext ID',
          payload:               {
            title:       'new deployment',
            endTime:     '4000-01-01 13:09:08',
            description: 'something new',
            supplierRef: 'ext ID',
            testing:     'the test results'
          }
        })
      };
      before(() => {
        sinon.stub(fs, 'writeFileSync');
      });

      it('should receive a 201 response', () =>
        expect(proxyquire('..', { './config': config, fs, './logger': logger })).to.eventually.include({
          status: 201,
          text: JSON.stringify({
            result: {
              'internal_identifier': newID
            }
          })
        }));
      it('should not have recorded the "internal_identifier" for this new change', () =>
        expect(fs.writeFileSync).not.to.have.been.called);
      it('should have reported the "internal_identifier" generated', () =>
        expect(logger.info).to.have.been.calledWith(`Notification successfully sent - new change ID: "${newID}"`));

      describe('check the generated internal ID is saved', () => {
        const withFile     = Object.assign({ }, config);
        withFile.intIDFile = '/test/ext';
        before(() => {
          fs.writeFileSync.resetHistory();
        });

        it('should receive a 201 response', () =>
          expect(proxyquire('..', { './config': withFile, fs, './logger': logger })).to.eventually.include({
            status: 201,
            text: JSON.stringify({
              result: {
                'internal_identifier': newID
              }
            })
          }));
        it('should have recorded the "internal_identifier" for this new change', () =>
          expect(fs.writeFileSync).to.have.been.calledOnce.and.calledWith(withFile.intIDFile, newID));
        it('should have reported the "internal_identifier" generated', () =>
          expect(logger.info).to.have.been.calledWith(`Notification successfully sent - new change ID: "${newID}"`));
      });

      after(() => {
        fs.writeFileSync.restore();
      });
    });

    describe('send status update notification', () => {
      describe('for a successful deployment', function () {
        const config = {
          newChange: false,
          success:   true,
          endpoint: `http://localhost:${mockPort}/${snowPath}`,
          username: 'snow-user',
          password: 'snow-pass',
          message:  JSON.stringify({
            messageid:             'HO_SIAM_IN_REST_CHG_UPDATE_JSON',
            'internal_identifier': 'int ID',
            payload:               { success: true, comments: 'All good' }
          })
        };

        it('should receive a 201 response', () =>
          expect(proxyquire('..', { './config': config, './logger': logger }))
            .to.eventually.have.property('status', 201));
        it('should have reported the status', () =>
          expect(logger.info).to.have.been.calledWith('Notification successfully sent - change completed'));
      });

      describe('for an unsuccessful deployment', function () {
        const config = {
          newChange: false,
          success:   false,
          endpoint: `http://localhost:${mockPort}/${snowPath}`,
          username: 'snow-user',
          password: 'snow-pass',
          message:  JSON.stringify({
            messageid:             'HO_SIAM_IN_REST_CHG_UPDATE_JSON',
            'internal_identifier': 'int ID',
            payload:               { success: false, comments: 'Something bad happened' }
          })
        };

        it('should receive a 201 response', () =>
          expect(proxyquire('..', { './config': config, './logger': logger }))
            .to.eventually.have.property('status', 201));
        it('should have reported the status', () =>
          expect(logger.info).to.have.been.calledWith('Notification successfully sent - change cancelled'));
      });
    });

    describe('Check failures are reported', () => {
      describe('when bad credentials are provided', () => {
        const config = {
          endpoint: `http://localhost:${mockPort}/${snowPath}`,
          message:  JSON.stringify({ payload: 'unauthorised notification' })
        };

        before(() => {
          process.exit.resetHistory();
        });

        it('should report a 401 Unauthorised response when wrong details are sent', () =>
          expect(proxyquire('..', { './config': config }))
            .to.eventually.be.rejectedWith(Error, 'Unauthorized')
            .with.property('response').which.includes({
              status: 401,
              text: 'unauthorised'
            }));
        it('should exit with an error', () => expect(process.exit).to.have.been.calledOnce.and.calledWith(401));
      });

      describe('when an error occurs the script still exits cleanly if FAIL_ON_ERROR is set to FALSE', () => {
        const config = {
          endpoint:    `http://localhost:${mockPort}/${snowPath}`,
          message:     JSON.stringify({ payload: 'unauthorised notification' }),
          failOnError: false
        };

        before(() => {
          process.exit.resetHistory();
        });

        it('should report a 401 Unauthorised response as normal', () =>
          expect(proxyquire('..', { './config': config }))
            .to.eventually.be.rejectedWith(Error, 'Unauthorized')
            .with.property('response').which.includes({
              status: 401,
              text: 'unauthorised'
            }));
        it('should NOT exit with an error', () => expect(process.exit).to.have.been.calledOnce.and.calledWith(0));
      });

      describe('when the target internal_identifier file cannot be written to', () => {
        const config = {
          newChange: true,
          intIDFile: '/not/a/proper-file',
          endpoint: `http://localhost:${mockPort}/${snowPath}`,
          username: 'snow-user',
          password: 'snow-pass',
          message:  JSON.stringify({
            messageid:             'HO_SIAM_IN_REST_CHG_POST_JSON',
            'external_identifier': 'ext ID',
            payload:               {
              title:       'new deployment',
              endTime:     '4000-01-01 13:09:08',
              description: 'something new',
              supplierRef: 'ext ID',
              testing:     'the test results'
            }
          })
        };
        before(() => {
          process.exit.resetHistory();
        });

        it('should have an empty "internal_identifier" field and report a 400 Bad Request', () =>
          expect(proxyquire('..', { './config': config }))
            .to.eventually.be.rejectedWith(Error, /^ENOENT: no such file or directory, open/)
            .which.does.not.have.any.keys(['status', 'response']));
        it('should exit with an error', () => expect(process.exit).to.have.been.calledOnce.and.calledWith(2));
      });

      describe('when a bad request is made', () => {
        describe('e.g. opening a new change with the "endTime" in the past', () => {
          const config = {
            newChange: true,
            endpoint:  `http://localhost:${mockPort}/${snowPath}`,
            username:  'snow-user',
            password:  'snow-pass',
            message:   JSON.stringify({
              messageid:             'HO_SIAM_IN_REST_CHG_POST_JSON',
              'external_identifier': 'ext ID',
              payload:               {
                title:       'new deployment',
                endTime:     '2000-01-01 13:09:08',
                description: 'something new',
                supplierRef: 'ext ID',
                testing:     'the test results'
              }
            })
          };
          before(() => {
            process.exit.resetHistory();
          });

          it('should have an empty "internal_identifier" field and report a 400 Bad Request', () =>
            expect(proxyquire('..', { './config': config }))
              .to.eventually.be.rejectedWith(Error, 'Bad Request')
                .which.includes({ status: 400 })
                .and.has.nested.property('response.text', JSON.stringify({
                  result: { 'internal_identifier': '' }
                })));
          it('should exit with an error', () => expect(process.exit).to.have.been.calledOnce.and.calledWith(400));
        });

        describe('e.g. send status update with bad IDs', () => {
          const config = {
            newChange:  false,
            successful: true,
            endpoint:   `http://localhost:${mockPort}/${snowPath}`,
            username:   'snow-user',
            password:   'snow-pass',
            message:    JSON.stringify({
              messageid:             'HO_SIAM_IN_REST_CHG_UPDATE_JSON',
              'internal_identifier': '! a proper int ID',
              payload:               { success: true, comments: 'All good' }
            })
          };
          before(() => {
            process.exit.resetHistory();
          });

          it('should show "ERROR" in the "transaction_status" field and report a 400 Bad Request', () =>
            proxyquire('..', { './config': config })
              .then(() => {
                throw new Error('should have failed with an "Bad Request" error, but the promise resolved');
              })
              .catch((e) => expect(e).to.be.an.instanceOf(Error)
                .which.includes({ status: 400, message: 'Bad Request' })
                .and.has.nested.property('response.text')
                .which.is.json
                .and.has.a.nested.property('result.transaction_status', 'ERROR')
              ));
          it('should exit with an error', () => expect(process.exit).to.have.been.calledOnce.and.calledWith(400));
        });
      });

      describe('even real oddballs', () => {
        describe('when a success status other than 201 is received', () => {
          const fakeResponse = { status: 200, text: 'hello world' };
          before(() => {
            process.exit.resetHistory();
          });

          it('should throw a 500 Server Error', () => expect(() => report(fakeResponse))
            .to.throw(Error, 'Server Error - unsupported response').with.property('status', 500));
        });

        describe('when a non JSON response is received', () => {
          const fakeResponse = { status: 201, text: 'hello world' };

          it('should throw a 500 JSON parsing error', () => expect(() => report(fakeResponse))
            .to.throw(Error, /Unexpected token .? in JSON at position \d+/).with.property('status', 500));
        });
      });
    });

    after('close the dyson mock API service', () => {
      server.close();
    });
  });

  describe('Make requests via a proxy to the ServiceNow API', () => {
    before('start the dyson mock proxy service', () => {
      require('dyson/lib/dyson').bootstrap({
        port:         mockProxyPort,
        configDir:    'test/snow-api-mock',
        proxy:        false,
        multiRequest: ',',
        quiet:        true
      });
    });

    describe('send new deployment notification via the proxy', () => {
      const config = {
        newChange: true,
        proxy: `http://localhost:${mockProxyPort}`,
        endpoint:  `http://localhost:${mockPort}/${snowPath}`,
        username:  'snow-user',
        password:  'snow-pass',
        message:   JSON.stringify({
          messageid:             'HO_SIAM_IN_REST_CHG_POST_JSON',
          'external_identifier': 'ext ID',
          payload:               {
            title:       'new deployment',
            endTime:     '4000-01-01 13:09:08',
            description: 'something new',
            supplierRef: 'ext ID',
            testing:     'the test results'
          }
        })
      };
      before(() => {
        sinon.stub(fs, 'writeFileSync');
      });

      it('should receive a 201 response', () =>
        expect(proxyquire('..', { './config': config, fs, './logger': logger })).to.eventually.include({
          status: 201,
          text: JSON.stringify({
            result: {
              'internal_identifier': newID
            }
          })
        }));

      after(() => {
        fs.writeFileSync.restore();
      });
    });

    after('close the dyson mock API service', () => {
      server.close();
    });
  });

  after(() => {
    process.exit.restore();
  });
});
