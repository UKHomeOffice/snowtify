'use strict';

const { expect } = require('chai');

module.exports = {
  path:   '/api/now/table/x_fho_siam_integra_transactions',
  status: (req, res, next) => {
    if (req.headers.authorization !== 'Basic ' + new Buffer('snow-user:snow-pass').toString('base64')) {
      res.status(401);
      res.send('unauthorised');
    } else {
      next();
    }
  },
  method: 'POST',
  template: (params, query, body, cookies, headers) => {
    let response = 'status updated';

    expect(headers).to.include({
      'content-type': 'application/json',
      accept:         'application/json'
    });
    expect(cookies).to.be.empty;
    expect(params).to.be.empty;
    expect(query).to.be.empty;
    expect(body).to.have.property('messageid');

    if (body.messageid === 'HO_SIAM_IN_REST_CHG_POST_JSON') {
      expect(body, `body has keys: ${body && body.payload ? Object.keys(JSON.parse(body.payload)) : 'no payload'}`)
        .to.have.property('payload').that.is.a('string')
        .and.that.is.json.that.includes.keys(['title', 'endTime', 'description', 'supplierRef']);
      response = {
        'internal_identifier': 'new int ID'
      };
    } else {
      expect(body).to.have.property('messageid', 'HO_SIAM_IN_REST_CHG_UPDATE_JSON');
      expect(body).to.have.property('internal_identifier').that.is.a('string');
      expect(body).to.have.property('external_identifier').that.is.a('string');
      expect(body).to.have.property('payload').that.is.a('string')
        .and.that.is.json.that.has.keys(['success', 'comments']);
    }

    return response;
  }
};
