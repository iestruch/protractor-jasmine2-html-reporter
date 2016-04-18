var fs = require('fs'),
    mkdirp = require('mkdirp'),
    _ = require('lodash'),
    path = require('path'),
    hat = require('hat');

require('string.prototype.startswith');

var UNDEFINED, exportObject = exports;

var currentIndex = 0;
var allStats = {
    tests: 0,
    skipped: 0,
    failures: 0
};
var successColor = '#f7fff5';
var failColor = '#ffcdd2';
var successClass = 'js-success';
var failClass = 'js-fail';

function checkboxHandling() {

    var checkbox = document.querySelector('#showOnlyFailed');

    function checkboxChangeHandler() {
        var showOnlyFailed = checkbox.checked;
        var successElements = document.querySelectorAll('.js-success');
        var len = successElements.length;

        for (var i = 0; i < len; i++) {
            successElements[i].style.display = showOnlyFailed ? 'none' : 'block';
        }
    }

    checkboxChangeHandler();
    document.querySelector('#showOnlyFailed').addEventListener('change', checkboxChangeHandler);
}

function trim(str) { return str.replace(/^\s+/, "").replace(/\s+$/, ""); }
function elapsed(start, end) { return (end - start) / 1000; }
function isFailed(obj) { return obj.status === "failed"; }
function isSkipped(obj) { return obj.status === "pending"; }
function isDisabled(obj) { return obj.status === "disabled"; }
function parseDecimalRoundAndFixed(num, dec) {
    var d = Math.pow(10, dec);
    return (Math.round(num * d) / d).toFixed(dec);
}
function extend(dupe, obj) { // performs a shallow copy of all props of `obj` onto `dupe`
    for (var prop in obj) {
        if (obj.hasOwnProperty(prop)) {
            dupe[prop] = obj[prop];
        }
    }
    return dupe;
}
function escapeInvalidHtmlChars(str) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
function getQualifiedFilename(path, filename, separator) {
    if (path && path.substr(-1) !== separator && filename.substr(0) !== separator) {
        path += separator;
    }
    return path + filename;
}
function log(str) {
    var con = global.console || console;
    if (con && con.log) {
        con.log(str);
    }
}
function rmdir(dir) {
    try {
        var list = fs.readdirSync(dir);
        for (var i = 0; i < list.length; i++) {
            var filename = path.join(dir, list[i]);
            var stat = fs.statSync(filename);

            if (stat.isDirectory()) {
                // rmdir recursively
                rmdir(filename);
            } else {
                // rm fiilename
                fs.unlinkSync(filename);
            }
        }
        fs.rmdirSync(dir);
    } catch (e) { log("problem trying to remove a folder"); }
}

function HierarchicalHTMLReporter(options) {

    var self = this;

    self.started = false;
    self.finished = false;
    // sanitize arguments
    options = options || {};
    self.showOnlyFailedByDefault =
        options.showOnlyFailedByDefault === UNDEFINED ? false : options.showOnlyFailedByDefault;
    self.takeScreenshots = options.takeScreenshots === UNDEFINED ? true : options.takeScreenshots;
    self.savePath = options.savePath || '';
    self.takeScreenshotsOnlyOnFailures =
        options.takeScreenshotsOnlyOnFailures === UNDEFINED ? false : options.takeScreenshotsOnlyOnFailures;
    self.screenshotsFolder = (options.screenshotsFolder || 'screenshots').replace(/^\//, '') + '/';
    self.useDotNotation = options.useDotNotation === UNDEFINED ? true : options.useDotNotation;
    self.filePrefix = options.filePrefix || 'htmlReport';

    var suites = [],
        currentSuite = null,
        totalSpecsExecuted = 0,
        totalSpecsDefined,
    // when use use fit, jasmine never calls suiteStarted / suiteDone, so make a fake one to use
        fakeFocusedSuite = {
            id: 'focused',
            description: 'focused specs',
            fullName: 'focused specs'
        };

    var __suites = {}, __specs = {};

    function getSuite(suite) {
        __suites[suite.id] = extend(__suites[suite.id] || {}, suite);
        return __suites[suite.id];
    }

    function getSpec(spec) {
        __specs[spec.id] = extend(__specs[spec.id] || {}, spec);
        return __specs[spec.id];
    }

    self.jasmineStarted = function(summary) {
        totalSpecsDefined = summary && summary.totalSpecsDefined || NaN;
        exportObject.startTime = new Date();
        self.started = true;

        //Delete previous screenshoots
        rmdir(self.savePath);

    };
    self.suiteStarted = function(suite) {
        suite = getSuite(suite);
        suite._startTime = new Date();
        suite._specs = [];
        suite._suites = [];
        suite._failures = 0;
        suite._skipped = 0;
        suite._disabled = 0;
        suite._parent = currentSuite;
        if (!currentSuite) {
            suites.push(suite);
        } else {
            currentSuite._suites.push(suite);
        }
        currentSuite = suite;
    };
    self.specStarted = function(spec) {
        if (!currentSuite) {
            // focused spec (fit) -- suiteStarted was never called
            self.suiteStarted(fakeFocusedSuite);
        }
        spec = getSpec(spec);
        spec._startTime = new Date();
        spec._suite = currentSuite;
        currentSuite._specs.push(spec);
    };
    self.specDone = function(spec) {
        spec = getSpec(spec);
        spec._endTime = new Date();
        if (isSkipped(spec)) { spec._suite._skipped++; }
        if (isDisabled(spec)) { spec._suite._disabled++; }
        if (isFailed(spec)) { spec._suite._failures++; }
        totalSpecsExecuted++;

        //Take screenshots taking care of the configuration
        if ((self.takeScreenshots && !self.takeScreenshotsOnlyOnFailures) ||
            (self.takeScreenshots && self.takeScreenshotsOnlyOnFailures && isFailed(spec))) {
            spec.screenshot = hat() + '.png';
            browser.takeScreenshot().then(function(png) {
                browser.getCapabilities().then(function(capabilities) {
                    var screenshotPath;

                    //Folder structure and filename
                    screenshotPath = path.join(self.savePath + self.screenshotsFolder, spec.screenshot);

                    mkdirp(path.dirname(screenshotPath), function(err) {
                        if (err) {
                            throw new Error('Could not create directory for ' + screenshotPath);
                        }
                        writeScreenshot(png, screenshotPath);
                    });
                });
            });
        }

    };
    self.suiteDone = function(suite) {
        suite = getSuite(suite);
        if (suite._parent === UNDEFINED) {
            // disabled suite (xdescribe) -- suiteStarted was never called
            self.suiteStarted(suite);
        }
        suite._endTime = new Date();
        currentSuite = suite._parent;
    };
    self.jasmineDone = function() {
        if (currentSuite) {
            // focused spec (fit) -- suiteDone was never called
            self.suiteDone(fakeFocusedSuite);
        }

        var output = '';
        for (var i = 0; i < suites.length; i++) {
            output += suiteAsHtml(suites[i]);
        }
        // if we have anything to write here, write out the consolidated file
        if (output) {
            var failuresClass = getFailureClass(allStats.failures);
            output =
                '<h3>' + ' Tests: ' + allStats.tests + ' Skipped: ' + allStats.skipped + ' <span class="' +
                failuresClass + '">Failures: ' + allStats.failures + '</span>' +
                '<div style="float: right;">Show only failed tests<input type="checkbox" id="showOnlyFailed" name="showOnlyFailed" checked="' +
                self.showOnlyFailedByDefault + '" style="margin: 10px;' +
                'transform: scale(1.5); -webkit-transform: scale(1.5);"></div>' +
                '</h3>' +
                '<div class="panel-group" id="accordion" role="tablist" aria-multiselectable="true">' + output +
                '</div>';
            wrapOutputAndWriteFile(self.filePrefix, output);
        }
        //log("Specs skipped but not reported (entire suite skipped or targeted to specific specs)", totalSpecsDefined -
        // totalSpecsExecuted + totalSpecsDisabled);

        self.finished = true;
        // this is so phantomjs-testrunner.js can tell if we're done executing
        exportObject.endTime = new Date();
    };

    /******** Helper functions with closure access for simplicity ********/
    function generateFilename(suite) {
        return self.filePrefix + getFullyQualifiedSuiteName(suite, true) + '.html';
    }

    function getFailureClass(fails) {
        var result = {};
        if (fails) {
            result.color = 'bg-danger';
            result.class = failClass;
        } else {
            result.color = 'bg-success';
            result.class = successClass;
        }
        return result;
    }

    function getFullyQualifiedSuiteName(suite, isFilename) {
        var fullName;
        if (self.useDotNotation || isFilename) {
            fullName = suite.description;
            for (var parent = suite._parent; parent; parent = parent._parent) {
                fullName = parent.description + '.' + fullName;
            }
        } else {
            fullName = suite.fullName;
        }

        // Either remove or escape invalid HTML characters
        if (isFilename) {
            var fileName = "",
                rFileChars = /[\w\.]/,
                chr;
            while (fullName.length) {
                chr = fullName[0];
                fullName = fullName.substr(1);
                if (rFileChars.test(chr)) {
                    fileName += chr;
                }
            }
            return fileName;
        } else {
            return escapeInvalidHtmlChars(fullName);
        }
    }

    var writeScreenshot = function(data, filename) {
        var stream = fs.createWriteStream(filename);
        stream.write(new Buffer(data, 'base64'));
        stream.end();
    };

    function suiteAsHtml(suite) {
        var html = '';
        var statObj = {
            tests: 0,
            skipped: 0,
            failures: 0
        };

        currentIndex++;
        var suiteNameAndTime = getFullyQualifiedSuiteName(suite) + ' - ' + elapsed(suite._startTime, suite._endTime) +
                               's';
        var collapse = 'collapse' + currentIndex;
        getMainSuitStatistics(suite, statObj);

        var resultObj = getFailureClass(statObj.failures);
        Object.keys(allStats).forEach(function(key) {
            allStats[key] += statObj[key];
        });

        html += '<div class="panel panel-default ' + resultObj.class + '">' +
                '<div class="panel-heading" style="background-color: #d0e2f0;" role="tab" id="headingOne">' +
                '<h4 class="panel-title">' +
                '<a role="button" data-toggle="collapse" data-parent="#accordion" ' +
                'href="#' + collapse + '"aria-expanded="false"  aria-controls="' + collapse + '">' +
                suiteNameAndTime + '<br>' +
                'Tests: ' + statObj.tests + ' Skipped: ' + statObj.skipped + ' <span class="' + resultObj.color +
                '">Failures: ' + statObj.failures +
                '</span></a></h4></div>' +
                '<div id="' + collapse +
                '" class="panel-collapse collapse" role="tabpanel" "aria-expanded="false" style="height: 0px;" aria-labelledby="headingOne">';

        getSecSuits(suite);

        function getSecSuits(secSuite) {
            if (secSuite._suites && secSuite._suites.length) {
                secSuite._suites.forEach(function(suite, ind) {
                    var collapseId = Date.now() + ind + Math.floor(Math.random() * 10000);
                    var nameAndTime = getFullyQualifiedSuiteName(suite) + ' - ' +
                                      elapsed(suite._startTime, suite._endTime) + 's';
                    var bgColor;
                    var resultClass;

                    if (suite._failures) {
                        bgColor = failColor;
                        resultClass = failClass;
                    } else {
                        bgColor = successColor;
                        resultClass = successClass;
                    }

                    if (suite._specs && suite._specs.length) {
                        html += '<div class="panel panel-default ' + resultClass + '">';
                        html +=
                            '<div class="panel-heading" style="background-color: ' + bgColor + ';" role="tab" id="' + 'head' +
                            collapseId +
                            '"><h4 class="panel-title">';
                        html += '<a class="" role="button" data-toggle="collapse" href="#' + collapseId +
                                '" aria-expanded="false" aria-controls="' + collapseId + '">';
                        html += nameAndTime + '<div>' +
                                ' Tests: <strong>' + suite._specs.length + '</strong>' +
                                ' Skipped: <strong>' + suite._skipped + '</strong>' +
                                ' Failures: <strong>' + suite._failures + '</strong>' +
                                '</div></a></h4></div>';
                        html += '<div id="' + collapseId +
                                '" class="panel-collapse collapse" style="height: 0px;" role="tabpanel" aria-labelledby="' +
                                'head' + collapseId + '" aria-expanded="false">';
                        html += '<ul class="list-group">';

                        for (var i = 0; i < suite._specs.length; i++) {
                            html = getSpecs(suite._specs[i], html);
                        }
                        html += '</ul></div></div>';
                    }

                    getSecSuits(suite);
                })
            }
        }

        html += '</div></div>';
        return html;
    }

    function getSpecs(spec, html) {
        html += '<li class="list-group-item">';
        html += specAsHtml(spec);
        html += '<div class="resume">';
        if (spec.screenshot !== UNDEFINED) {
            html += '<a href="' + self.screenshotsFolder + '/' + spec.screenshot + '">';
            html += '<img src="' + self.screenshotsFolder + '/' + spec.screenshot + '" width="100" height="100" />';
            html += '</a>';
        }
        html += '<br />';
        var num_tests = spec.failedExpectations.length + spec.passedExpectations.length;
        var percentage = (spec.passedExpectations.length * 100) / num_tests;
        html +=
            '<span>Tests passed: ' + parseDecimalRoundAndFixed(percentage, 2) +
            '%</span><br /><progress max="100" value="' +
            Math.round(percentage) + '"></progress>';
        html += '</div>';
        html += '</li>';

        return html;
    }

    function specAsHtml(spec) {

        var html = '<div class="description">';
        html +=
            '<h4>' + escapeInvalidHtmlChars(spec.description) + ' - ' + elapsed(spec._startTime, spec._endTime) +
            's</h4>';

        if (spec.failedExpectations.length > 0 || spec.passedExpectations.length > 0) {
            html += '<ul>';
            _.each(spec.failedExpectations, function(expectation) {
                html += '<li>';
                html += expectation.message + '<span style="padding:0 1em;color:red;">&#10007;</span>';
                html += '</li>';
            });
            _.each(spec.passedExpectations, function(expectation) {
                html += '<li>';
                html += expectation.message + '<span style="padding:0 1em;color:green;">&#10003;</span>';
                html += '</li>';
            });
            html += '</ul></div>';
        }
        return html;
    }

    function getMainSuitStatistics(suite, statObj) {
        statObj.tests += suite._specs && suite._specs.length;
        statObj.skipped += suite._skipped;
        statObj.failures += suite._failures;
        suite._suites.forEach(function(s) {
            getMainSuitStatistics(s, statObj);
        })
    }

    self.writeFile = function(filename, text) {
        var errors = [];
        var path = self.savePath;

        function phantomWrite(path, filename, text) {
            // turn filename into a qualified path
            filename = getQualifiedFilename(path, filename, window.fs_path_separator);
            // write via a method injected by phantomjs-testrunner.js
            __phantom_writeFile(filename, text);
        }

        function nodeWrite(path, filename, text) {
            var fs = require("fs");
            var nodejs_path = require("path");
            require("mkdirp").sync(path); // make sure the path exists
            var filepath = nodejs_path.join(path, filename);
            var htmlfile = fs.openSync(filepath, "w");
            fs.writeSync(htmlfile, text, 0);
            fs.closeSync(htmlfile);
            return;
        }

        // Attempt writing with each possible environment.
        // Track errors in case no write succeeds
        try {
            phantomWrite(path, filename, text);
            return;
        } catch (e) { errors.push('  PhantomJs attempt: ' + e.message); }
        try {
            nodeWrite(path, filename, text);
            return;
        } catch (f) { errors.push('  NodeJS attempt: ' + f.message); }

        // If made it here, no write succeeded.  Let user know.
        log("Warning: writing html report failed for '" + path + "', '" +
            filename + "'. Reasons:\n" +
            errors.join("\n")
        );
    };

    // To remove complexity and be more DRY about the silly preamble and <testsuites> element
    var prefix = '<!DOCTYPE html>' +
                 '<head lang=en><meta charset=UTF-8>' +
                 '<script src="https://code.jquery.com/jquery-2.1.4.min.js"></script>' +
                 '<script src="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.6/js/bootstrap.min.js"></script>' +
                 '<script>document.addEventListener("DOMContentLoaded", ' + checkboxHandling + ')</script>' +
                 '<link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.6/css/bootstrap.min.css">' +
                 '<title></title>' +
                 '</head>' +
                 '<body>';

    var suffix = '</body></html>';

    function wrapOutputAndWriteFile(filename, text) {
        if (filename.substr(-5) !== '.html') { filename += '.html'; }
        self.writeFile(filename, (prefix + text + suffix));
    }

    return this;
}

module.exports = HierarchicalHTMLReporter;
