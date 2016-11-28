/**
 * Created by zenit1 on 13/11/2016.
 */
"use strict";

const gulp          = require('gulp');
const sass          = require('gulp-sass');
const rename        = require("gulp-rename");
const concat        = require('gulp-concat');
const uglify        = require('gulp-uglify');
const htmlreplace   = require('gulp-html-replace');
const cleanCSS      = require('gulp-clean-css');
const minifyCss   = require('gulp-minify-css');
const s3            = require('gulp-s3');
const gzip          = require('gulp-gzip');
const stripDebug    = require('gulp-strip-debug');
const strip         = require('gulp-strip-comments');
const inlinesource  = require('gulp-inline-source');
const htmlmin       = require('gulp-htmlmin');
const clean         = require('gulp-rimraf');
const cloudfront    = require("gulp-cloudfront-invalidate");
const gulpif        = require('gulp-if');
const modifyCssUrls = require('gulp-modify-css-urls');

const bucket_dir = 'insta-server-dev';

const dist_folder_name = 'dist';

const tools_folder_name = 'tools';
const tools_bucket_dir = 'insta-server-meta';

const web_dist_root_path    = 'Web/';
const web_src_root_path     = './apps/mobile/';

const getVersion = () => {
	const pad2 = (n) => {
		return (n < 10 ? '0' : '') + n;
	};

	let date = new Date();

	return '' + date.getFullYear() +
		pad2(date.getMonth() + 1) +
		pad2(date.getDate()) +
		pad2(date.getHours()) +
		pad2(date.getMinutes()) +
		pad2(date.getSeconds());
};

const version = process.env.version || getVersion();

console.log(`version is ${version} ${typeof version}`);

const compilePage = (pagePath, distPath) => {

	let cdn_folder_path = `https://cdn.beame.io/${bucket_dir}/${version}/`;

	gulp.src(pagePath)
		.pipe(htmlreplace({
			'css':            `${cdn_folder_path}css/app.min.css`,
			'js':             `${cdn_folder_path}js/app.min.js`,
			'lib':            `${cdn_folder_path}js/lib.min.js`,
			'signin-js-head': `${cdn_folder_path}js/signin.min.js`,
			'signup-js-head': `${cdn_folder_path}js/signup.min.js`,
			'logo':`<img src="${cdn_folder_path}img/logo.svg" />`
		}))
		.pipe(htmlmin({collapseWhitespace: true}))
		.pipe(inlinesource())
		.pipe(gulp.dest(distPath));

};

const compileJs = (funcArray, dist_name, optimize) => {
	gulp.src(funcArray)
		.pipe(concat(dist_name))
		.pipe(gulpif(optimize, strip()))
		.pipe(gulpif(optimize, stripDebug()))
	//	.pipe(gulpif(optimize, uglify()))
		.pipe(gulp.dest(`./${dist_folder_name}/js/`));
};

const compileCss = (funcArray, dist_name) => {
	gulp.src(funcArray)
		.pipe(concat(dist_name))
		.pipe(modifyCssUrls({
			// modify: (url) => {
			// 	return `/${bucket_dir}/${version}/${url}`;
			// }
			prepend: `/${bucket_dir}/${version}`
			// ,append: '?cache-buster'
		}))
		.pipe(cleanCSS({compatibility: 'ie10'}))
		.pipe(gulp.dest(`./${dist_folder_name}/css/`));
};

const uploadFile = (name, aws, options) => {
	gulp.src([`./${dist_folder_name}/${name}`])
		.pipe(rename(`${bucket_dir}/${version}/${name}`))
		.pipe(gzip())
		.pipe(s3(aws, options));
};

gulp.task('sass', function () {
	gulp.src('./public/scss/app.scss')
		.pipe(sass().on('error', (err) => {
			console.error(' gulp sass error ', err);
			process.exit(1);
		}))
		.pipe(gulp.dest('./public/css/'));
});

gulp.task('sass-tools', function () {
	gulp.src('./public/scss/app.scss')
		.pipe(sass().on('error', (err) => {
			console.error(' gulp sass error ', err);
			process.exit(1);
		}))
		.pipe(gulp.dest('./tools/css/'));
});

gulp.task('watch', function () {
	gulp.watch("./public/scss/**/*.scss", ["sass"]);
});

gulp.task('clean', () => {
	return gulp.src(`${dist_folder_name}`, {read: false})
		.pipe(clean());
});

gulp.task('compile-css', () => {
	compileCss(['./public/css/app.css'], 'app.min.css');
});

gulp.task('compile-js', () => {

	compileJs([
		'./public/js/utils.js',
		'./public/js/signin.js'
	], 'signin.min.js', true);


	compileJs(
		[
			'./public/js/utils.js',
			'./public/js/signup.js'
		], 'signup.min.js', true);

	compileJs(
		[
			'./public/js/crypto.js',
			'./public/js/notification_manager.js',
			'./public/js/session_controller.js',
			'./public/js/qr.js',
			'./public/js/whisper_generator.js',
			'./public/js/whisperer.js'
		], 'app.min.js', true);

	compileJs(
		[
			'./public/lib/socket.io-1.4.5.min.js',
			'./public/lib/angular-1.5.7.min.js',
			'./public/lib/jquery-2.2.4.min.js',
			'./public/lib/kendo-2016.3.1118.qr.min.js'
		], 'lib.min.js', false);
});

gulp.task('compile-pages', () => {

	compilePage('./public/pages/gw/welcome.html', `./${dist_folder_name}/pages/gw/`);
	compilePage('./public/pages/gw/signin.html', `./${dist_folder_name}/pages/gw/`);
	compilePage('./public/pages/gw/logged-in-home.html', `./${dist_folder_name}/pages/gw/`);
	compilePage('./public/pages/customer_auth/register.html', `./${dist_folder_name}/pages/customer_auth/`);
	compilePage('./public/pages/beame_auth/signup.html', `./${dist_folder_name}/pages/beame_auth/`);
	compilePage('./public/pages/admin/index.html', `./${dist_folder_name}/pages/admin/`);
});

gulp.task('compile-static', () => {
	gulp.src('./public/img/**/*').pipe(gulp.dest(`./${dist_folder_name}/img/`));
	gulp.src('./public/templates/**/*').pipe(gulp.dest(`./${dist_folder_name}/templates/`));
});

gulp.task('compile', ['compile-css', 'compile-js', 'compile-pages', 'compile-static']);

gulp.task('upload-to-S3', callback => {
	let options                      = {headers: {'Cache-Control': 'max-age=315360000, no-transform, public'}, gzippedOnly: true},
	    config                       = require('./local_config/aws_config.json'),
	    key = config.aws_key, secret = config.aws_secret,
	    aws                          = {
		    "key":    key,
		    "secret": secret,
		    "bucket": config.bucket,
		    "region": "us-east-1"
	    };

	console.log(`upload starting ${getVersion()}`);

	uploadFile('js/app.min.js', aws, options);
	uploadFile('js/lib.min.js', aws, options);
	uploadFile('js/signin.min.js', aws, options);
	uploadFile('js/signup.min.js', aws, options);
	uploadFile('css/app.min.css', aws, options);

	gulp.src([`./${dist_folder_name}/img/***`])
		.pipe(rename(function (path) {
			path.dirname += `/${bucket_dir}/${version}/img`;
		}))
		.pipe(gzip())
		.pipe(s3(aws, options));

	callback();

});

gulp.task('upload-tools-to-S3',['sass-tools'], callback => {
	let options                      = {headers: {'Cache-Control': 'max-age=315360000, no-transform, public'}, gzippedOnly: true},
	    config                       = require('./local_config/aws_config.json'),
	    key = config.aws_key, secret = config.aws_secret,
	    aws                          = {
		    "key":    key,
		    "secret": secret,
		    "bucket": config.bucket,
		    "region": "us-east-1"
	    };

	gulp.src([`./${tools_folder_name}/insta-servers.html`])
		.pipe(rename(`${tools_bucket_dir}/insta-servers.html`))
		.pipe(gzip())
		.pipe(s3(aws, options));


	gulp.src([`./${tools_folder_name}/css/app.css`])
		.pipe(rename(`${tools_bucket_dir}/css/app.css`))
		.pipe(gzip())
		.pipe(s3(aws, options));

	gulp.src([`./${tools_folder_name}/img/***`])
		.pipe(rename(function (path) {
			path.dirname += `/${tools_bucket_dir}/img`;
		}))
		.pipe(gzip())
		.pipe(s3(aws, options));

	callback();

});


gulp.task('web_sass', function () {
	gulp.src(web_src_root_path + 'scss/*.scss')
		.pipe(sass())
		.pipe(gulp.dest('./apps/photo/public/css/'));

});
