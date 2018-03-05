'use strict';

const moment      = require('moment');
const { expect }  = require('chai').use(require('chai-json'));
process.title     = 'ServiceNow-mock-api';
const validFuture = str => (date => date.isValid() && date.isAfter(moment()))(moment(str, 'YYYY-MM-DD HH:mm:ss', true));
const newID       = 'CHG1234567';

module.exports = {
  path:   '/api/now/table/x_fho_siam_integra_transactions',
  status: (req, res, next) => {
    if (req.headers.authorization !== 'Basic ' + new Buffer('snow-user:snow-pass').toString('base64')) {
      res.status(401);
      res.send('unauthorised');
    } else {
      res.status(201);
      next();
    }
  },
  method: 'POST',
  template: (params, query, body, cookies, headers) => {
    let response;

    expect(headers).to.include({
      'content-type': 'application/json',
      accept:         'application/json'
    });
    expect(cookies).to.be.empty;
    expect(params).to.be.empty;
    expect(query).to.be.empty;
    expect(body).to.have.property('messageid');

    if (body.messageid === 'HO_SIAM_IN_REST_CHG_POST_JSON') {
      expect(body).to.have.property('payload').that.is.a('string');
      const json = JSON.parse(body.payload);
      expect(json).to.be.an('object');
      expect(json).to.have.property('title').that.is.a('string').and.is.not.empty;
      expect(json).to.have.property('endTime').that.is.a('string').and.is.not.empty;
      expect(json).to.have.property('description').that.is.a('string').and.is.not.empty;
      expect(json).to.have.property('supplierRef').that.is.a('string').and.is.not.empty;
      response = {
        result: {
          'internal_identifier': validFuture(json.endTime) ? newID : ''
        }
      };
    } else {
      expect(body).to.have.property('messageid', 'HO_SIAM_IN_REST_CHG_UPDATE_JSON');
      expect(body).to.have.property('internal_identifier').that.is.a('string').and.is.not.empty;
      expect(body).to.have.property('external_identifier').that.is.a('string').and.is.not.empty;
      expect(body).to.have.property('payload').that.is.a('string')
        .and.that.is.json.that.has.keys(['success', 'comments']);
      response = {
        result: {
          status: body.internal_identifier.startsWith('!') || body.external_identifier.startsWith('!') ? '7' : '5'
        }
      };
    }

    return response;
  }
};
