'use strict';

const http     = require('http');
const snowPath = rewire('../config').__get__('snowPath'); // eslint-disable-line no-underscore-dangle
const mockPort = 3000;
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
  describe('helper function', () => {
    describe('redact', () => {
      const req = { };
      req.post = req.auth = req.type = req.set = req.send = req.then = req.catch = () => req;
      const { redact } = proxyquire('..', { superagent: req });
      // you are now leaving hack city...

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

    describe('send new deployment notification', function () {
      before(() => {
        this.config = {
          endpoint: `http://localhost:${mockPort}/${snowPath}`,
          username: 'snow-user',
          password: 'snow-pass',
          message:  '{' +
            '"messageid":"HO_SIAM_IN_REST_CHG_POST_JSON",' +
            '"payload":"{' +
              '\\\"title\\\":\\\"new deployment\\\",' +
              '\\\"endTime\\\":\\\"in a mo\\\",' +
              '\\\"description\\\":\\\"something new\\\",' +
              '\\\"supplierRef\\\":\\\"ext ID\\\",' +
              '\\\"testing\\\":\\\"the test results\\\"' +
            '}"}'
        };
      });

      it('should receive a 200 OK response', () =>
        expect(proxyquire('../index', { './config': this.config })).to.eventually.include({
          status: 200,
          text: JSON.stringify({ 'internal_identifier': 'new int ID' })
        }));
    });

    describe('send deployment status update notification', function () {
      before(() => {
        this.config = {
          endpoint: `http://localhost:${mockPort}/${snowPath}`,
          username: 'snow-user',
          password: 'snow-pass',
          message:  '{' +
            '"messageid":"HO_SIAM_IN_REST_CHG_UPDATE_JSON",' +
            '"internal_identifier":"int ID",' +
            '"external_identifier":"ext ID",' +
            '"payload":"{\\\"success\\\":\\\"true\\\",\\\"comments\\\":\\\"All good\\\"}"}'
        };
      });

      it('should receive a 200 OK response', () =>
        expect(proxyquire('../index', { './config': this.config })).to.eventually.have.property('status', 200));
    });

    describe('send deployment status update notification', function () {
      before(() => {
        this.config = {
          endpoint: `http://localhost:${mockPort}/${snowPath}`,
          username: 'snow-user',
          password: 'snow-pass',
          message:  '{' +
            '"messageid":"HO_SIAM_IN_REST_CHG_UPDATE_JSON",' +
            '"internal_identifier":"int ID",' +
            '"external_identifier":"ext ID",' +
            '"payload":"{\\\"success\\\":\\\"false\\\",\\\"comments\\\":\\\"Something bad happened\\\"}"}'
        };
      });

      it('should receive a 200 OK response', () =>
        expect(proxyquire('../index', { './config': this.config })).to.eventually.have.property('status', 200));
    });

    describe('Check failures are reported', () => {
      before(() => {
        this.exit    = process.exit;
        process.exit = sinon.spy();
        this.config  = {
          endpoint: `http://localhost:${mockPort}/${snowPath}`,
          message:  '{"payload":"unauthorised notification"}'
        };
      });

      it('should receive a 401 Unauthorised response when wrong details are sent', () =>
        proxyquire('../index', { './config': this.config })
          .then(() => {
            throw new Error('should have failed with a 401 error, but the promise resolved');
          })
          .catch((e) => {
            expect(e).to.be.an.instanceOf(Error)
              .which.includes({ message: 'Unauthorized' })
              .and.has.property('response').which.includes({
                status:   401,
                text:    'unauthorised'
              });
            expect(process.exit).to.have.been.calledOnce.and.calledWith(2);
          }));

      after(() => {
        process.exit = this.exit;
      });
    });

    after('close the dyson mock API service', () => {
      server.close();
    });
  });
});
