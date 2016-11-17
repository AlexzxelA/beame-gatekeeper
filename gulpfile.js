/**
 * Created by zenit1 on 13/11/2016.
 */
"use strict";

const gulp         = require('gulp');
const sass         = require('gulp-sass');
const rename       = require("gulp-rename");
const concat       = require('gulp-concat');
const uglify       = require('gulp-uglify');
const htmlreplace  = require('gulp-html-replace');
const cleanCSS     = require('gulp-clean-css');
const s3           = require('gulp-s3');
const gzip         = require('gulp-gzip');
const stripDebug   = require('gulp-strip-debug');
const strip        = require('gulp-strip-comments');
const inlinesource = require('gulp-inline-source');
const htmlmin      = require('gulp-htmlmin');
const gulpif       = require('gulp-if');

gulp.task('sass', function () {
	gulp.src('./public/scss/app.scss')
		.pipe(sass().on('error', (err) => {
			console.error(' gulp sass error ', err);
			process.exit(1);
		}))
		.pipe(gulp.dest('./public/css/'));
});


gulp.task("watch", function () {
	gulp.watch("./public/scss/**/*.scss", ["sass"]);
});

function handlePage  (pagePath, htmlReplace)  {
	try {
		gulp.src(pagePath)
			.pipe(gulpif(htmlReplace, htmlreplace({
				'css': 'css/styles.min.css?v=' + new Date().getTime(),
				'js':  'js/demo.min.js?v=' + new Date().getTime()
			})))
			// .pipe(htmlreplace({
			// 	'css': 'css/styles.min.css?v=' + new Date().getTime(),
			// 	'js':  'js/demo.min.js?v=' + new Date().getTime()
			// }))
			.pipe(htmlmin({collapseWhitespace: true}))
			.pipe(inlinesource())
			.pipe(gulp.dest('./bin/' + pagePath.substring(2)));
	} catch (e) {
		console.error('handle page ' + pagePath, e);
	}
}

gulp.task('compile-production', ['sass'], function () {

	try {
		gulp.src(
			[
			    './public/js/crypto.js',
				'./public/js/session_controller.js',
				'./public/js/qr.js',
				'./public/js/whisperer.js'
			]
			)
			.pipe(concat('app.min.js'))
			.pipe(uglify())
			.pipe(strip())
			.pipe(stripDebug())
			.pipe(gulp.dest('./bin/js/'));
	} catch (e) {
		console.error('js ', e);
	}


	try {
		gulp.src(['./public/css/'])
			.pipe(concat('styles.min.css'))
			.pipe(cleanCSS({compatibility: 'ie10'}))
			.pipe(gulp.dest('./bin/css/'));
	} catch (e) {
		console.error('css ', e);
	}


	handlePage('./public/pages/gw/welcome.html', false);
	handlePage('./public/pages/gw/signin.html', true);
	handlePage('./public/pages/gw/logged-in-home.html', false);
	handlePage('./public/pages/customer_auth/register.html', false);
	handlePage('./public/pages/beame_auth/signup.html', true);


	try {
		gulp.src('./public/js/utils.js').pipe(gulp.dest('./bin/js/'));
		gulp.src('./public/img/**/*').pipe(gulp.dest('./bin/img/'));
		gulp.src('./public/lib/**/*').pipe(gulp.dest('./bin/lib/'));
		gulp.src('./public/templates/**/*').pipe(gulp.dest('./bin/templates/'));
	} catch (e) {

		console.error('static ', e);
	}

});

