'use strict';

const { expect } = require('chai');

module.exports = {
  path:   '/api/now/table/x_fho_siam_integra_transactions',
  method: 'POST',
  template: (params, query, body, cookies, headers) => {
    expect(headers).to.include({
      authorization:  'Basic ' + new Buffer('snow-user:snow-pass').toString('base64'),
      'content-type': 'application/json',
      accept:         'application/json'
    });
    expect(cookies).to.be.empty;
    expect(params).to.be.empty;
    expect(query).to.be.empty;
    expect(body).to.have.property('messageid');
    if (body.messageid === 'HO_SIAM_IN_REST_CHG_POST_JSON') {
      expect(body).to.have.property('payload')
        .that.is.a('string');
    } else {
      expect(body).to.have.property('messageid', 'HO_SIAM_IN_REST_CHG_UPDATE_JSON');
      expect(body).to.have.property('internal_identifier').that.is.a('string');
      expect(body).to.have.property('external_identifier').that.is.a('string');
      expect(body).to.have.property('payload')
        .that.is.a('string');
    }

    return {
      'internal_identifier': 'new int ID'
    };
  }
};
