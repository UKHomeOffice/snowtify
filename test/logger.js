'use strict';

const logs  = require('./logger-mock/logs.json');
const shell = require('shelljs');

describe('Logger', function () {
  before('point the shell wrapper to the test directory', () => {
    this.pwd = shell.pwd().stdout;
    shell.cd('test/logger-mock');
  });

  describe('default configuration', function () {
    before(() => {
      this.result = shell.exec('./log-tester.js');
      expect(this.result).to.include.property('code', 0);
    });

    it('should log errors to stderr', () =>
      expect(this.result)
        .to.have.property('stderr')
        .that.contains(` ERROR: ${logs.error}`)
        .and.does.not.contain(` DEBUG: ${logs.debug}`));
    it('should log warnings and info messages to stdout', () =>
      expect(this.result)
        .to.have.property('stdout')
        .that.contains(` WARN: ${logs.warn}`)
        .and.contains(` INFO: ${logs.info}`)
        .and.does.not.contain(` VERBOSE: ${logs.verbose}`))
  });

  describe('configuring the log level to', () => {
    describe('display errors only with an environment variable', function () {
      before(() => {
        this.result = shell.exec('SNOW_LOG_LEVEL=ERROR ./log-tester.js');
        expect(this.result).to.include.property('code', 0);
      });

      it('should log only errors to stderr', () =>
        expect(this.result)
          .to.have.property('stderr')
          .that.contains(` ERROR: ${logs.error}`)
          .and.does.not.contain(` DEBUG: ${logs.debug}`));
      it('should not log any messages to stdout', () =>
        expect(this.result)
          .to.have.property('stdout')
          .that.is.empty);
    });

    describe('display warnings with drone plugin settings', function () {
      before(() => {
        this.result = shell.exec('PLUGIN_LOG_LEVEL=waRN ./log-tester.js');
        expect(this.result).to.include.property('code', 0);
      });

      it('should log only errors to stderr', () =>
        expect(this.result)
          .to.have.property('stderr')
          .that.contains(` ERROR: ${logs.error}`)
          .and.does.not.contain(` DEBUG: ${logs.debug}`));
      it('should log only warnings to stdout', () =>
        expect(this.result)
          .to.have.property('stdout')
          .that.contains(` WARN: ${logs.warn}`)
          .and.does.not.contain(` INFO: ${logs.info}`)
          .and.does.not.contain(` VERBOSE: ${logs.verbose}`));
    });

    describe('DEBUG with the command line argument overriding the equivalent environment variable', function () {
      before(() => {
        this.result = shell.exec('SNOW_LOG_LEVEL=ERROR ./log-tester.js --log-level debug');
        expect(this.result).to.include.property('code', 0);
      });

      it('should log errors and debug messages to stderr', () =>
        expect(this.result)
          .to.have.property('stderr')
          .that.contains(` ERROR: ${logs.error}`)
          .and.contains(` DEBUG: ${logs.debug}`));
      it('should log warnings, info and verbose messages to stdout', () =>
        expect(this.result)
          .to.have.property('stdout')
          .that.contains(` WARN: ${logs.warn}`)
          .and.contains(` INFO: ${logs.info}`)
          .and.contains(` VERBOSE: ${logs.verbose}`));
    });
  });

  after('restore pwd', () => {
    shell.cd(this.pwd);
  });

});
