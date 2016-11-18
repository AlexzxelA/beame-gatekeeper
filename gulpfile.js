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
const cloudfront   = require("gulp-cloudfront-invalidate");


const dist_folder_name = 'dist';

const compilePage = (pagePath, distPath) => {

	gulp.src(pagePath)
		.pipe(htmlreplace({
			'css':            'https://cdn.beame.io/insta-server/css/app.min.css',
			'js':             'https://cdn.beame.io/insta-server/js/app.min.js',
			'lib':            'https://cdn.beame.io/insta-server/js/lib.min.js',
			'signin-js-head': 'https://cdn.beame.io/insta-server/js/signin.min.js',
			'signup-js-head': 'https://cdn.beame.io/insta-server/js/signup.min.js'
		}))
		.pipe(htmlmin({collapseWhitespace: true}))
		.pipe(inlinesource())
		.pipe(gulp.dest(distPath));

};

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


gulp.task('clean', () => {
	return gulp.src(`${dist_folder_name}`, {read: false})
		.pipe(clean());
});

gulp.task('compile-css', () => {
	gulp.src(['./public/css/app.css'])
		.pipe(concat('app.min.css'))
		.pipe(cleanCSS({compatibility: 'ie10'}))
		.pipe(gulp.dest(`./${dist_folder_name}/css/`));
});

gulp.task('compile-js', () => {

	gulp.src(
		[
			'./public/js/utils.js',
			'./public/js/signin.js'
		]
		)
		.pipe(concat('signin.min.js'))
		.pipe(uglify())
		.pipe(strip())
		.pipe(stripDebug())
		.pipe(gulp.dest(`./${dist_folder_name}/js/`));

	gulp.src(
		[
			'./public/js/utils.js',
			'./public/js/signup.js'
		]
		)
		.pipe(concat('signup.min.js'))
		.pipe(uglify())
		.pipe(strip())
		.pipe(stripDebug())
		.pipe(gulp.dest(`./${dist_folder_name}/js/`));

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
		.pipe(gulp.dest(`./${dist_folder_name}/js/`));

	gulp.src(
		[
			'./public/lib/socket.io-1.4.5.min.js',
			'./public/lib/angular-1.5.7.min.js',
			'./public/lib/jquery-2.2.4.min.js',
			'./public/lib/kendo-2016.3.1118.qr.min.js'
		]
		)
		.pipe(concat('lib.min.js'))
		.pipe(gulp.dest(`./${dist_folder_name}/js/`));
});

gulp.task('compile-pages', () => {

	compilePage('./public/pages/gw/welcome.html', `./${dist_folder_name}/pages/gw/`);
	compilePage('./public/pages/gw/signin.html', `./${dist_folder_name}/pages/gw/`);
	compilePage('./public/pages/gw/logged-in-home.html', `./${dist_folder_name}/pages/gw/`);
	compilePage('./public/pages/customer_auth/register.html', `./${dist_folder_name}/pages/customer_auth/`);
	compilePage('./public/pages/beame_auth/signup.html', `./${dist_folder_name}/pages/beame_auth/`);
});


gulp.task('compile', ['sass', 'compile-css', 'compile-js', 'compile-pages'], () => {

	gulp.src('./public/img/**/*').pipe(gulp.dest(`./${dist_folder_name}/img/`));
	gulp.src('./public/templates/**/*').pipe(gulp.dest(`./${dist_folder_name}/templates/`));


});

gulp.task('deploy', ['compile'], function () {
	var options = {headers: {'Cache-Control': 'max-age=315360000, no-transform, public'}, gzippedOnly: true};

	var config = require('./local_config/aws_config.json');

	var key = config.aws_key, secret = config.aws_secret;

	var aws = {
		"key":    key,
		"secret": secret,
		"bucket": config.bucket,
		"region": "us-east-1"
	};

	gulp.src([`./${dist_folder_name}/js/app.min.js`])
		.pipe(rename("insta-server/js/app.min.js"))
		.pipe(gzip())
		.pipe(s3(aws, options));

	gulp.src([`./${dist_folder_name}/js/lib.min.js`])
		.pipe(rename("insta-server/js/lib.min.js"))
		.pipe(gzip())
		.pipe(s3(aws, options));

	gulp.src([`./${dist_folder_name}/js/signin.min.js`])
		.pipe(rename("insta-server/js/signin.min.js"))
		.pipe(gzip())
		.pipe(s3(aws, options));

	gulp.src([`./${dist_folder_name}/js/signup.min.js`])
		.pipe(rename("insta-server/js/signup.min.js"))
		.pipe(gzip())
		.pipe(s3(aws, options));

	gulp.src([`./${dist_folder_name}/css/app.min.css`])
		.pipe(rename("insta-server/css/app.min.css"))
		.pipe(gzip())
		.pipe(s3(aws, options));


	setTimeout(function () {
		var cf_settings = {
			distribution:    config.beame_cdn_distribution, // Cloudfront distribution ID
			paths:           ['/insta-server/*'],                 // Paths to invalidate
			accessKeyId:     key,               // AWS Access Key ID
			secretAccessKey: secret,        // AWS Secret Access Key
			wait:            false                     // Whether to wait until invalidation is completed (default: false)
		};

		gulp.src('*')
			.pipe(cloudfront(cf_settings));

	}, 1000 * 10);

});