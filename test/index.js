'use strict';

const http     = require('http');
const snowPath = rewire('../config').__get__('snowPath'); // eslint-disable-line no-underscore-dangle
const mockPort = 3000;
const app      = require('../node_modules/express/lib/application');
let server;
app.listen = function listen() {
  server = http.createServer(this);
  return server.listen.apply(server, arguments);
};
// overridden the express listen function so we can get a reference to the server
// created for the express app, then we can close it nicely after the tests finish

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

  describe('send new deployment notification', function () {
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

  describe('send new deployment notification', function () {
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

  after('close the dyson mock API service', () => {
    server.close();
  });
});
