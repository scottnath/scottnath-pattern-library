var browserSync = require('browser-sync').create();
var changed = require('gulp-changed');
var cp = require('child_process');
var del = require('del');
var exec = require('child_process').exec;
var fs = require('fs');
var gulp = require('gulp');
var path = require('path');
var patternUtils = require('pattern-library-utilities');
var print = require('gulp-print');
var rename = require('gulp-rename');
var replace = require('gulp-replace');
var runSequence = require('run-sequence');
var sass = require('gulp-sass');
var taskListing = require('gulp-task-listing');
var watch = require('gulp-watch');

/******************************************
CONFIGURATION
*/
// configuration file must be YAML
var configurationFile = './config.yml';
var configYml;

// attempt to synchronously open the yaml configuration file
try {
  // open the configuration file
  configYml = fs.readFileSync(configurationFile, {encoding: 'utf8'});
}
catch (e) {
  console.log('Configuration Load Error:', e);
}
// convert configuration file to JS Object
var configObject = patternUtils.convertYamlToObject(configYml);
// regex to search for variables
var variableRegex = /{{.*}}/g;
// convert variables
var configuration = patternUtils.convertRecursiveJsonVariables(configObject, variableRegex);


/******************************************
NPM-BASED GULP TASKS
These gulp tasks are imported into gulp by referencing their javascript module.
*/

/**
 * Pattern Importer
 *
 * Searches for all `pattern.yml` files in the source directory, parses them, and uses the data to write or copy the pattern's files to the appropriate destination locations.
 *
 * @example
 * // import local project's patterns into prototyper
 * `gulp patterns-import-local`
 *
 * @param {Object} gulp including file should in inject the gulp module
 * @param {Object} projectOptions  object of options
 *
 * @requires NPM:pattern-importer
 */

// array will contain all pattern import task-names
var patternImportTasks = [];

// NPM-Imported Pattern Libraries
if (configuration.npmPatternRepos) {
  configuration.npmPatternRepos.forEach(function (repo) {
    'use strict';
    var npmImporterOptions = {
      config: {
        htmlTemplateDest: configuration.fileTypes.patterns.prototyperDestDir,
        stylesDest: configuration.fileTypes.sass.prototyperSrcDir + '/npm/' + repo.name,
        scriptsDest: configuration.fileTypes.js.prototyperSrcDir + '/npm/' + repo.name,
        convertCategoryTitles: false
      },
      taskName: 'patterns-import-npm-' + repo.name,
      src: ['./node_modules/' + repo.repoDir + '/patterns/**/pattern.yml']
    };
    patternImportTasks.push(npmImporterOptions.taskName);
    patternUtils.gulpImportPatterns(gulp, npmImporterOptions);
  });
}

// Project pattern library
patternImportTasks.push(configuration.gulpTasks.patternImporter.localPatterns.taskName);
patternUtils.gulpImportPatterns(gulp, configuration.gulpTasks.patternImporter.localPatterns);

/**
Import from all pattern libraries
**/
gulp.task('patterns-import-all', function () {
  'use strict';
  runSequence.apply(null, patternImportTasks);
});

/**
 * Glob and Inject JS
 *
 * Separate glob and inject tasks for pattern libraries' and global assets's javascript directories.
 *
 * @example
 * // import global assets
 * `gulp glob-inject-js-globalAssets`
 * // writes `<script>` statements into the target file for each .js file in ./PATH/js/global-assets/
 *
 * @param {Object} gulp including Gulp object injects the gulp module
 * @param {Object} globbingOptions  object of options
 *
 * @requires NPM:pattern-library-utilities
 * @requires NPM:run-sequence
 */

// array will contain all javascript glob/inject task-names
var javascriptGlobTasks = [];

// NPM-Imported Pattern Libraries
if (configuration.npmPatternRepos) {
  configuration.npmPatternRepos.forEach(function (repo) {
    'use strict';
    var globbingOptionsNpm = {
      config: {
        starttag: '<!-- inject:npm:' + repo.name + ':{{ext}} -->',
        endtag: '<!-- endinjectnpm' + repo.name + ' -->',
        relative: false,
        ignorePath: '/patternlab/source'
      },
      files: [ // relative paths to files to be globbed
        configuration.fileTypes.js.prototyperSrcDir + '/npm/' + repo.name + '/*.js',
        configuration.fileTypes.js.prototyperSrcDir + '/npm/' + repo.name + '/**/*.js'
      ],
      src: configuration.gulpTasks.fileGlobInject.js.srcFile, // source file with types of files to be glob-injected
      dest: configuration.gulpTasks.fileGlobInject.js.destDir, // destination directory where we'll write our ammended source file
      taskName: 'glob-inject-js-npm-' + repo.name,
      dependencies: []
    };
    javascriptGlobTasks.push(globbingOptionsNpm.taskName);
    patternUtils.gulpFileGlobInject(gulp, globbingOptionsNpm);
  });
}

// global assets
var globbingOptionsGlobalAssetsJs = {
  config: {
    starttag: '<!-- inject:globalassets:{{ext}} -->',
    endtag: '<!-- endinjectglobalassets -->',
    relative: false,
    ignorePath: '/patternlab/source'
  },
  files: [ // relative paths to files to be globbed
    configuration.fileTypes.js.prototyperSrcDir + '/' + configuration.globalAssets + '/*.js',
    configuration.fileTypes.js.prototyperSrcDir + '/' + configuration.globalAssets + '/**/*.js'
  ],
  src: configuration.gulpTasks.fileGlobInject.js.srcFile, // source file with types of files to be glob-injected
  dest: configuration.gulpTasks.fileGlobInject.js.destDir, // destination directory where we'll write our ammended source file
  taskName: 'glob-inject-js-global-assets',
  dependencies: ['global-assets-import-js']
};
javascriptGlobTasks.push(globbingOptionsGlobalAssetsJs.taskName);
patternUtils.gulpFileGlobInject(gulp, globbingOptionsGlobalAssetsJs);

// local-files
var globbingOptionsLocalJs = {
  config: {
    starttag: '<!-- inject:local:{{ext}} -->',
    endtag: '<!-- endinjectlocal -->',
    relative: false,
    ignorePath: '/patternlab/source'
  },
  files: [ // relative paths to files to be globbed
    configuration.fileTypes.js.prototyperSrcDir + '/local/*.js',
    configuration.fileTypes.js.prototyperSrcDir + '/local/**/*.js'
  ],
  src: configuration.gulpTasks.fileGlobInject.js.srcFile, // source file with types of files to be glob-injected
  dest: configuration.gulpTasks.fileGlobInject.js.destDir, // destination directory where we'll write our ammended source file
  taskName: 'glob-inject-js-local',
  dependencies: []
};
javascriptGlobTasks.push(globbingOptionsLocalJs.taskName);
patternUtils.gulpFileGlobInject(gulp, globbingOptionsLocalJs);

// glob all javascript files at once
gulp.task('glob-inject-js-all', function () {
  'use strict';
  runSequence.apply(null, javascriptGlobTasks);
});

/**
 * Glob and Inject SASS
 *
 * Separate glob and inject tasks for pattern libraries' and global asset's SASS (.scss) directories.
 *
 * @example
 * // import global assets
 * `gulp glob-inject-scss-global-assets`
 * // writes @import statements in the main style.scss file for each .scss file in ./PATH/styles/scss/global-assets/
 *
 * @param {Object} gulp including file should in inject the gulp module
 * @param {Object} projectOptions  object of options
 *
 * @requires NPM:pattern-library-utilities
 */
// array will contain all javascript glob/inject task-names
var sassGlobTasks = [];

// NPM-Imported Pattern Libraries
if (configuration.npmPatternRepos) {
  configuration.npmPatternRepos.forEach(function (repo) {
    'use strict';
    var globbingOptionsNpm = {
      config: {
        starttag: '// inject:npm:' + repo.name + ':scss',
        endtag: '// endinjectnpm' + repo.name
      },
      files: [ // relative paths to files to be globbed
        configuration.fileTypes.sass.prototyperSrcDir + '/npm/' + repo.name + '/*.scss',
        configuration.fileTypes.sass.prototyperSrcDir + '/npm/' + repo.name + '/**/*.scss'
      ],
      src: configuration.gulpTasks.fileGlobInject.sass.srcFile, // source file with types of files to be glob-injected
      dest: configuration.gulpTasks.fileGlobInject.sass.destDir, // destination directory where we'll write our ammended source file
      taskName: 'glob-inject-sass-npm-' + repo.name,
      dependencies: []
    };
    sassGlobTasks.push(globbingOptionsNpm.taskName);
    patternUtils.gulpScssGlobInject(gulp, globbingOptionsNpm);
  });
}

// global assets
var globbingOptionsGlobalAssetsSass = {
  config: {
    starttag: '// inject:globalassets:scss',
    endtag: '// endinjectglobalassets'
  },
  files: [ // relative paths to files to be globbed
    configuration.fileTypes.sass.prototyperSrcDir + '/' + configuration.globalAssets  + '/*.scss',
    configuration.fileTypes.sass.prototyperSrcDir + '/' + configuration.globalAssets + '/**/*.scss'
  ],
  src: configuration.gulpTasks.fileGlobInject.sass.srcFile, // source file with types of files to be glob-injected
  dest: configuration.gulpTasks.fileGlobInject.sass.destDir, // destination directory where we'll write our ammended source file
  taskName: 'glob-inject-sass-global-assets',
  dependencies: ['global-assets-import-sass']
};
sassGlobTasks.push(globbingOptionsGlobalAssetsSass.taskName);
patternUtils.gulpScssGlobInject(gulp, globbingOptionsGlobalAssetsSass);

// local pattern library
var globbingOptionsLocalSass = {
  config: {
    starttag: '// inject:local:scss',
    endtag: '// endinjectlocal'
  },
  files: [ // relative paths to files to be globbed
    configuration.fileTypes.sass.prototyperSrcDir + '/local/*.scss',
    configuration.fileTypes.sass.prototyperSrcDir + '/local/**/*.scss'
  ],
  src: configuration.gulpTasks.fileGlobInject.sass.srcFile, // source file with types of files to be glob-injected
  dest: configuration.gulpTasks.fileGlobInject.sass.destDir, // destination directory where we'll write our ammended source file
  taskName: 'glob-inject-sass-local',
  dependencies: []
};
sassGlobTasks.push(globbingOptionsLocalSass.taskName);
patternUtils.gulpScssGlobInject(gulp, globbingOptionsLocalSass);

// glob all javascript files at once
gulp.task('glob-inject-sass-all', function () {
  'use strict';

  runSequence.apply(null, sassGlobTasks);
});

/**
 * GitHub Pages deployment
 *
 * Uses ghPages task to deploy prototyper's public folder to gh-pages. Does a url-replace task before and after
 *
 * @requires NPM:pattern-library-utilities
 */
// set up the gh-pages gulp task from pattern-library-utilities
patternUtils.gulpGhPages(gulp, {});
// gh-pages full deployment gulp task
gulp.task('ghPagesDeploy', function () {
  'use strict';

  runSequence(
    'replace-url-ghpages',
    'ghPages',
    'replace-url-local'
  );

});

/******************************************
PATTERN LAB GULP TASKS
*/

/**
Clean the PatternLab Source Folder
*/
gulp.task('patternlab-clean', function (done) {
  'use strict';

  del(['patternlab/source/_patterns'], function (err, paths) {

    console.log('Deleted files/folders:\n', paths.join('\n'));
    done();
  });
});

/**
 * Patternlab-install task - installs Patternlab via composer if ./patternlab folder not exists.
 *
 * @requires fs
 * @requires child_process.exec
 */
gulp.task('patternlab-install', function (done) {
  'use strict';

  fs.exists(configuration.patternlab.dest, function (exists) {
    if (!exists) {

      // composer create-project pattern-lab/edition-twig-standard has promts,
      // passing answers to command in advance to prevent installation blocking.
      var command = "(echo '1'\
      sleep 1\
      echo 'r'\
      sleep 1 ) | composer create-project pattern-lab/edition-twig-standard " + configuration.patternlab.dest + ' ' + configuration.patternlab.version;

      console.log('Installing Patternlab...');
      exec(command, function (error, stdout, stderr) {
        // print buffers
        console.log(stdout, stderr);
        if (error !== null) {
          console.error(error);
        }
        done();
      });
    }
    else {
      console.log('Patternlab is already installed, skipping installation...');
      done();
    }
  });
});

/**
Copy templates into prototyper
*/
// array will contain all template copy task-names
var copyTemplateTasks = [];

if (configuration.templates) {
  configuration.templates.forEach(function (template) {
    'use strict';

    var copyTemplateTask = 'tpl-copy-' + template.name;
    copyTemplateTasks.push(copyTemplateTask);

    gulp.task(copyTemplateTask, function (done) {

      gulp.src(template.src)
        .pipe(rename(template.destFile))
        .pipe(gulp.dest(template.destDir))
        .on('end', done);

    });

  });
}
// copy all templates in parallel
gulp.task('tpl-copy-all', copyTemplateTasks);

/**
Generate the Patternlab Public Folder from the Source Folder
TODO: error handling
*/
gulp.task('patternlab-build-public', function (done) {
  'use strict';

  return cp.spawn('php', ['patternlab/core/console', '--generate'])
      .on('close', done);
});

/******************************************
PATTERN LIBRARY GULP TASKS
*/


/**
 * SASS Compilation
 *
 * Uses gulp-sass (libsass) to compile scss
 *
 * @requires NPM:gulp-sass
 */
gulp.task('sass', configuration.gulpTasks.gulpSass.dependencies, function () {
  'use strict';

  return gulp.src(configuration.fileTypes.sass.prototyperSrc) // primary sass file in SOURCE
    .pipe(sass().on('error', sass.logError))
    .pipe(gulp.dest(configuration.fileTypes.sass.prototyperDestDir));
});

/**
Global Assets Importing
import files from ./global-assets into ./patternlab/sources
*/

// import global javascript
gulp.task('global-assets-import-js', function () {
  'use strict';

  return gulp.src(configuration.fileTypes.js.globalAssetsSrc)
    .pipe(changed(configuration.fileTypes.js.prototyperSrcDir + '/' + configuration.globalAssets))
    .pipe(print())
    .pipe(gulp.dest(configuration.fileTypes.js.prototyperSrcDir + '/' + configuration.globalAssets));

});

// import global sass
gulp.task('global-assets-import-sass', function () {
  'use strict';

  return gulp.src(configuration.fileTypes.sass.globalAssetsSrc)
    .pipe(changed(configuration.fileTypes.sass.globalAssetsDest))
    .pipe(print())
    .pipe(gulp.dest(configuration.fileTypes.sass.globalAssetsDest));

});

// import global css
gulp.task('global-assets-import-css', function () {
  'use strict';

  return gulp.src(configuration.fileTypes.css.globalAssetsSrc)
    .pipe(changed(configuration.fileTypes.css.globalAssetsDest))
    .pipe(print())
    .pipe(gulp.dest(configuration.fileTypes.css.globalAssetsDest));

});

// import global fonts
gulp.task('global-assets-import-fonts', function () {
  'use strict';

  return gulp.src(configuration.fileTypes.fonts.globalAssetsSrc)
    .pipe(changed(configuration.fileTypes.fonts.globalAssetsDest))
    .pipe(print())
    .pipe(gulp.dest(configuration.fileTypes.fonts.globalAssetsDest));

});

// import global images
gulp.task('global-assets-import-images', function () {
  'use strict';

  return gulp.src(configuration.fileTypes.images.globalAssetsSrc)
    .pipe(changed(configuration.fileTypes.images.globalAssetsDest))
    .pipe(print())
    .pipe(gulp.dest(configuration.fileTypes.images.globalAssetsDest));

});

// import all global files
gulp.task('global-assets-import-all', ['global-assets-import-js', 'global-assets-import-sass', 'global-assets-import-css', 'global-assets-import-fonts', 'global-assets-import-images']);

/**
BROWSER SYNC
*/
gulp.task('browsersync', function () {
  'use strict';

  // .init starts the server
  browserSync.init({
    server: {
      baseDir: './patternlab/public'
    }
  });

});

/**
Replace content for gh-pages deployment
**/

/**
 * Gulp task that replaces some urls for gh-pages deployment
 *
 * @requires NPM:gulp-replace
 */
// change urls to match final gh-pages url prefix
gulp.task('replace-url-ghpages', function () {
  'use strict';

  gulp.src(configuration.gulpTasks.replaceUrl.src, {base: "./"})
    .pipe(replace('"baseurl": ""', '"baseurl": "' + configuration.gulpTasks.replaceUrl.ghPagesPrefix + '"'))
    .pipe(gulp.dest('.'));
});
// change urls to remove final gh-pages url prefix
gulp.task('replace-url-local', function () {
  'use strict';

  gulp.src(configuration.gulpTasks.replaceUrl.src, {base: "./"})
    .pipe(replace('"baseurl": "' + configuration.gulpTasks.replaceUrl.ghPagesPrefix + '"', '"baseurl": ""'))
    .pipe(gulp.dest('.'));
});

/**
Import Single Pattern
TODO: fix bug on SINGLE pattern import on new patterns
**/
function importSinglePattern(file) {
  'use strict';

  // get the directory of the local pattern
  // var patternDir = path.dirname(file);
  // // change the source to THIS pattern's pattern.yml file
  // configuration.gulpTasks.patternImporter.localPatterns.src = [path.join(patternDir,configuration.dataFileName)];
  // // temporarily set up our patterns-import-local gulp task to just import THIS pattern
  // patternUtils.gulpImportPatterns(gulp,configuration.gulpTasks.patternImporter.localPatterns);
  // go through the full import process
  runSequence(
    'patterns-import-local',
    'glob-inject-sass-local',
    'glob-inject-js-local',
    'sass',
    'patternlab-build-public',
    function () {
      browserSync.reload();
      console.log('Local pattern file triggered a watch event. The full Pattern has been re-imported into ' + configuration.patternlab.dest);
    }
  );
}

/**
Complete import into patternlab with a build
**/
gulp.task('build', function (callback) {
  'use strict';

  runSequence(
    'patternlab-install',
    'patternlab-clean',
    'tpl-copy-all',
    'patterns-import-all',
    'global-assets-import-all',
    function () {
      console.log('Import of files into patternlab complete');
      callback();
    }
  );
});

/**
Complete import into patternlab with a build
**/
gulp.task('serve', function (callback) {
  'use strict';

  runSequence(
    ['glob-inject-sass-all', 'glob-inject-js-all'],
    'sass',
    'patternlab-build-public',
    'browsersync',
    'watch'
  );
});

/**
Watch Tasks
**/
gulp.task('watch', function () {
  'use strict';

  /*
    local Pattern Library watch
    TODO: check for deletion and create pattern removal process
  */
  var localPatternsWatcher = watch('./patterns/**/*');
  localPatternsWatcher.on('change', function (event) {
    importSinglePattern(event.path);
  });
  localPatternsWatcher.on('add', function (event) {
    importSinglePattern(event.path);
  });

  /*
    Global Assets watch tasks
  */
  // Global Assets CSS
  watch(configuration.fileTypes.css.globalAssetsSrc, function () {
    runSequence(
      'global-assets-import-css',
      'patternlab-build-public',
      function () {
        browserSync.reload();
        console.log('Global Assets css file change.');
      }
    );
  });
  // Global Assets Fonts
  watch(configuration.fileTypes.fonts.globalAssetsSrc, function () {
    runSequence(
      'global-assets-import-fonts',
      'patternlab-build-public',
      function () {
        browserSync.reload();
        console.log('Global Assets font file change.');
      }
    );
  });
  // Global Assets Images
  watch(configuration.fileTypes.images.globalAssetsSrc, function () {
    runSequence(
      'global-assets-import-images',
      'patternlab-build-public',
      function () {
        browserSync.reload();
        console.log('Global Assets image file change.');
      }
    );
  });
  // Global Assets JS
  watch(configuration.fileTypes.js.globalAssetsSrc, function () {
    runSequence(
      'glob-inject-js-global-assets',
      'patternlab-build-public',
      function () {
        browserSync.reload();
        console.log('Global Assets js file change.');
      }
    );
  });
  // Global Assets SASS
  watch(configuration.fileTypes.sass.globalAssetsSrc, function () {
    runSequence(
      'glob-inject-sass-local',
      'sass',
      'patternlab-build-public',
      function () {
        browserSync.reload();
        console.log('Global Assets scss file change.');
      }
    );
  });

  // watch('./patterns/**/*.js', ['patterns-import-local', 'glob-inject-scss-local', 'sass', 'patternlab-build-public', browserSync.reload]);

  // set a watch on each template file
  if (configuration.templates) {
    configuration.templates.forEach(function (template) {
      watch(template.src, ['tpl-copy-' + template.name, 'patternlab-build-public', browserSync.reload]);
    });
  }
});

/**
 * Gulp task that lists out all available gulp tasks
 *
 * @requires NPM:gulp-task-listing
 */
gulp.task('help', taskListing.withFilters(/:/));

// The default task (called when you run `gulp` from cli)
gulp.task('default', ['help']);
