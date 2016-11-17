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
const clean        = require('gulp-rimraf');

const dist_folder_name = 'bin';

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

function handlePage(pagePath, distPath) {

	gulp.src(pagePath)
		.pipe(htmlreplace({
			'css': 'css/app.min.css?v=' + new Date().getTime(),
			'js':  'js/app.min.js?v=' + new Date().getTime()
		}))
		.pipe(htmlmin({collapseWhitespace: true}))
		.pipe(inlinesource())
		.pipe(gulp.dest(distPath));

}

gulp.task('clean', function () {
	return gulp.src(`${dist_folder_name}`, {read: false})
		.pipe(clean());
});

gulp.task('compile_css', function () {
	gulp.src(['./public/css/app.css'])
		.pipe(concat('app.min.css'))
		.pipe(cleanCSS({compatibility: 'ie10'}))
		.pipe(gulp.dest(`./${dist_folder_name}/css/`));
});


gulp.task('compile-production', ['clean', 'sass', 'compile_css'], function () {

	gulp.src(
		[
			'./public/lib/jquery/jquery.min.js',
			'./public/lib/angular/angular.min.js',
			'./public/lib/kendo/kendo.qr.min.js',
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
		.pipe(gulp.dest(`./${dist_folder_name}/js/`));


	handlePage('./public/pages/gw/welcome.html', `./${dist_folder_name}/pages/gw/`);
	handlePage('./public/pages/gw/signin.html', `./${dist_folder_name}/pages/gw/`);
	handlePage('./public/pages/gw/logged-in-home.html', `./${dist_folder_name}/pages/gw/`);
	handlePage('./public/pages/customer_auth/register.html', `./${dist_folder_name}/pages/customer_auth/`);
	handlePage('./public/pages/beame_auth/signup.html', `./${dist_folder_name}/pages/beame_auth/`);


	gulp.src('./public/js/utils.js').pipe(gulp.dest(`./${dist_folder_name}/js/`));
	gulp.src('./public/img/**/*').pipe(gulp.dest(`./${dist_folder_name}/img/`));
	gulp.src('./public/lib/**/*').pipe(gulp.dest(`./${dist_folder_name}/lib/`));
	gulp.src('./public/templates/**/*').pipe(gulp.dest(`./${dist_folder_name}/templates/`));


});

