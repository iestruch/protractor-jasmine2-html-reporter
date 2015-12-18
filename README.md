# protractor-html-hierarchical-reporter

HTML reporter for Jasmine2 and Protractor that will include screenshots of each test if you want and display suits hierarchically.

## Usage
The <code>protractor-html-hierarchical-reporter</code> is available via npm:

<code>$ npm install protractor-html-hierarchical-reporter --save-dev</code>

In your Protractor configuration file, register protractor-html-hierarchical-reporter in jasmine:

<pre><code>var HierarchicalHTMLReporter = require('protractor-html-hierarchical-reporter');

exports.config = {
   // ...
   onPrepare: function() {
      jasmine.getEnv().addReporter(
        new HierarchicalHTMLReporter({
          savePath: 'target/screenshots'
        })
      );
   }
}</code></pre>

## Options
### Destination folder

Output directory for created files. All screenshots and reports will be stored here.

If the directory doesn't exist, it will be created automatically or otherwise cleaned before running the test suite.

<pre><code>jasmine.getEnv().addReporter(new HierarchicalHTMLReporter({
   savePath: './test/reports/'
}));</code></pre>

Default folder: <code>./</code>

### Screenshots folder (optional)

By default the screenshots are stored in a folder inside the default path

If the directory doesn't exist, it will be created automatically or otherwise cleaned before running the test suite.

<pre><code>jasmine.getEnv().addReporter(new HierarchicalHTMLReporter({
   savePath: './test/reports/',
   screenshotsFolder: 'images'
}));</code></pre>

Default folder: <code>screenshots</code>

### Take screenshots (optional)

When this option is enabled, reporter will create screenshots for specs.

<pre><code>jasmine.getEnv().addReporter(new HierarchicalHTMLReporter({
   takeScreenshots: false
}));</code></pre>

Default is <code>true</code>

### Take screenshots only on failure (optional) - (NEW)

This option allows you to choose if create screenshots always or only when failures.
If you disable screenshots, obviously this option will not be taken into account.

<pre><code>jasmine.getEnv().addReporter(new HierarchicalHTMLReporter({
   takeScreenshots: true,
   takeScreenshotsOnlyOnFailures: true
}));</code></pre>

Default is <code>false</code> (So screenshots are always generated)

### FilePrefix (optional)

Filename for html report.

<pre><code>jasmine.getEnv().addReporter(new HierarchicalHTMLReporter({
   savePath: './test/reports/',
   filePrefix: 'index'
}));</code></pre>

Default is <code>htmlReport.html</code>
