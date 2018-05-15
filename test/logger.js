'use strict';

const logs  = require('./logger-mock/logs.json');
const shell = require('shelljs');

describe('Logger', function () {
  before('point the shell wrapper to the test directory and remove any old log files', () => {
    this.pwd = shell.pwd().stdout;
    expect(shell.cd('test/logger-mock').code).to.equal(0);
    expect(shell.rm('-f', './*.log').code).to.equal(0);
  });

  describe('the default console logger', () => {
    describe('with default configuration', function () {
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
          .and.does.not.contain(` VERBOSE: ${logs.verbose}`));
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
            .that.contains(' VERBOSE: Logging at level: debug')
            .and.contains(` WARN: ${logs.warn}`)
            .and.contains(` INFO: ${logs.info}`)
            .and.contains(` VERBOSE: ${logs.verbose}`));
      });
    });
  });

  describe('when the file logger is enabled', () => {
    const logFile = 'snowtify.log';

    describe('with default configuration', function () {
      before(() => {
        this.result = shell.exec(`SNOW_LOG_FILE=${logFile} ./log-tester.js`);
        expect(this.result).to.include.property('code', 0);
      });

      describe('the console logger', () => {
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
            .and.does.not.contain(` VERBOSE: ${logs.verbose}`));
      });

      describe('the file logger', () => {
        before('get log contents', () => {
          const result = shell.cat(logFile);
          expect(result.code).to.equal(0);
          this.contents = result.stdout;
        });

        it('should log to the specified output file', () =>
          expect(this.contents)
            .to.contain(` ERROR: ${logs.error}`)
            .and.contain(` WARN: ${logs.warn}`)
            .and.contain(` INFO: ${logs.info}`)
            .and.not.contain(` VERBOSE: ${logs.verbose}`)
            .and.not.contain(` DEBUG: ${logs.debug}`));
      });
    });

    describe('with default log level configuration (set to ERROR)', function () {
      before(() => {
        this.result = shell.exec(`SNOW_LOG_FILE=${logFile} SNOW_LOG_LEVEL=ERROR ./log-tester.js`);
        expect(this.result).to.include.property('code', 0);
      });

      describe('the console logger', () => {
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

      describe('the file logger', () => {
        before('get log contents', () => {
          const result = shell.cat(logFile);
          expect(result.code).to.equal(0);
          this.contents = result.stdout;
        });

        it('should log only errors to the specified output file (and overwrite any previous content)', () =>
          expect(this.contents)
            .to.contain(` ERROR: ${logs.error}`)
            .and.not.contain(` WARN: ${logs.warn}`)
            .and.not.contain(` INFO: ${logs.info}`)
            .and.not.contain(` VERBOSE: ${logs.verbose}`)
            .and.not.contain(` DEBUG: ${logs.debug}`));
      });
    });

    describe('configuring the file log level to', () => {
      describe('display errors only with an environment variable', function () {
        before(() => {
          this.result = shell.exec(`SNOW_LOG_FILE=${logFile} SNOW_LOG_FILE_LEVEL=ERROR ./log-tester.js`);
          expect(this.result).to.include.property('code', 0);
        });

        describe('the console logger', () => {
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
              .and.does.not.contain(` VERBOSE: ${logs.verbose}`));
        });

        describe('the file logger', () => {
          before('get log contents', () => {
            const result = shell.cat(logFile);
            expect(result.code).to.equal(0);
            this.contents = result.stdout;
          });

          it('should log only errors to the specified output file (and overwrite any previous content)', () =>
            expect(this.contents)
              .to.contain(` ERROR: ${logs.error}`)
              .and.not.contain(` WARN: ${logs.warn}`)
              .and.not.contain(` INFO: ${logs.info}`)
              .and.not.contain(` VERBOSE: ${logs.verbose}`)
              .and.not.contain(` DEBUG: ${logs.debug}`));
        });
      });

      describe('display warnings with drone plugin settings', function () {
        before(() => {
          this.result = shell.exec(`PLUGIN_LOG_FILE=${logFile} PLUGIN_LOG_FILE_LEVEL=waRN ./log-tester.js`);
          expect(this.result).to.include.property('code', 0);
        });

        describe('the console logger', () => {
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
              .and.does.not.contain(` VERBOSE: ${logs.verbose}`));
        });

        describe('the file logger', () => {
          before('get log contents', () => {
            const result = shell.cat(logFile);
            expect(result.code).to.equal(0);
            this.contents = result.stdout;
          });

          it('should log only errors to the specified output file (and overwrite any previous content)', () =>
            expect(this.contents)
              .to.contain(` ERROR: ${logs.error}`)
              .and.contain(` WARN: ${logs.warn}`)
              .and.not.contain(` INFO: ${logs.info}`)
              .and.not.contain(` VERBOSE: ${logs.verbose}`)
              .and.not.contain(` DEBUG: ${logs.debug}`));
        });
      });

      describe('DEBUG with the command line argument overriding the equivalent environment variable', function () {
        before(() => {
          this.result = shell.exec(
            `SNOW_LOG_FILE=${logFile} SNOW_LOG_FILE_LEVEL=ERROR ./log-tester.js --log-file-level debug`);
          expect(this.result).to.include.property('code', 0);
        });

        describe('the console logger', () => {
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
              .and.does.not.contain(` VERBOSE: ${logs.verbose}`));
        });

        describe('the file logger', () => {
          before('get log contents', () => {
            const result = shell.cat(logFile);
            expect(result.code).to.equal(0);
            this.contents = result.stdout;
          });

          it('should log all messages to the specified output file (and overwrite any previous content)', () =>
            expect(this.contents)
              .to.contain(` VERBOSE: Logging to file "${logFile}" at level: debug`)
              .and.contain(` ERROR: ${logs.error}`)
              .and.contain(` WARN: ${logs.warn}`)
              .and.contain(` INFO: ${logs.info}`)
              .and.contain(` VERBOSE: ${logs.verbose}`)
              .and.contain(` DEBUG: ${logs.debug}`));
        });
      });
    });
  });

  after('restore pwd', () => {
    shell.cd(this.pwd);
  });

});
