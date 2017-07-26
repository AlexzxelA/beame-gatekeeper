/**
 * Created by zenit1 on 13/11/2016.
 */
"use strict";

const gulp           = require('gulp');
const sass           = require('gulp-sass');
const rename         = require("gulp-rename");
const concat         = require('gulp-concat');
const uglify         = require('gulp-uglify');
const htmlreplace    = require('gulp-html-replace');
const cleanCSS       = require('gulp-clean-css');
//const minifyCss      = require('gulp-minify-css');
const s3             = require('gulp-s3');
const gzip           = require('gulp-gzip');
const stripDebug     = require('gulp-strip-debug');
const strip          = require('gulp-strip-comments');
const inlinesource   = require('gulp-inline-source');
const htmlmin        = require('gulp-htmlmin');
const clean          = require('gulp-rimraf');
const cloudfront     = require("gulp-cloudfront-invalidate");
const gulpif         = require('gulp-if');
//const modifyCssUrls  = require('gulp-modify-css-urls');
const ignore         = require('gulp-ignore');
const injectPartials = require('gulp-inject-partials');
//const minify         = require('gulp-minifier');
const minifyInline   = require('gulp-minify-inline-scripts');
const bucket_dir     = 'insta-server-dev';

const dist_folder_name  = 'dist';
const build_folder_name = 'build';

const tools_folder_name = 'tools';
const tools_bucket_dir  = 'insta-server-meta';

const web_src_root_path = './apps/';
const gulpUtil          = require('gulp-util');

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

//console.log(`version is ${version} ${typeof version}`);


const compilePage = (pagePath, distPath) => {

	console.log(`saving ${pagePath} to ${distPath}`);

	let cdn_folder_path = '/';//`https://cdn.beame.io/${bucket_dir}/${version}/`;

	gulp.src(pagePath)
		.pipe(htmlreplace({
			'css':                `${cdn_folder_path}css/app.min.css`,
			'login-js':           `${cdn_folder_path}js/login.min.js`,
			'client-login-js':    `${cdn_folder_path}js/client_login.min.js`,
			'lib-sjak':           `${cdn_folder_path}js/lib-sjak.min.js`,
			'lib-sjk':            `${cdn_folder_path}js/lib-sjk.min.js`,
			'lib-jjf':            `${cdn_folder_path}js/lib-jjf.min.js`,
			'signup-js-head':     `${cdn_folder_path}js/signup.head.min.js`,
			'signup-js-foot':     `${cdn_folder_path}js/signup.foot.min.js`,
			'signin-js-head':     `${cdn_folder_path}js/signin.head.min.js`,
			'signin-js-foot':     `${cdn_folder_path}js/signin.foot.min.js`,
			'whisperer-js':       `${cdn_folder_path}js/whisperer.min.js`,
			'client-approval-js': `${cdn_folder_path}js/clint.approve.min.js`,
			'direct-signin-js':   `${cdn_folder_path}js/direct.signin.min.js`,
			'express-signin-js':  `${cdn_folder_path}js/xprs.signin.min.js`,
			'utils-head':         `${cdn_folder_path}js/utils.min.js`,
			'cef':                `${cdn_folder_path}js/cef.min.js`,
			'safari':             `${cdn_folder_path}js/safari.js`,
			'config-js-head':     `${cdn_folder_path}js/config.head.min.js`,
			'config-js-foot':     `${cdn_folder_path}js/config.foot.min.js`,
			'admin-js-head':      `${cdn_folder_path}js/admin.head.min.js`,
			'admin-js-foot':      `${cdn_folder_path}js/admin.foot.min.js`,
			'inv-js-foot':        `${cdn_folder_path}js/admin.invitation.min.js`,
			'admin-template':     ``,
			'logo':               `<img src="${cdn_folder_path}img/logo.svg" />`
		}))
		.pipe(htmlmin({collapseWhitespace: true}))
		.pipe(inlinesource())
		.pipe(minifyInline())
		.pipe(gulp.dest(distPath));

};


const compileJs = (funcArray, dist_name, optimize, innerFolder = '') => {
	gulp.src(funcArray)
		.pipe(concat(dist_name))
		.pipe(gulpif(optimize, strip()))
		.pipe(gulpif(optimize, stripDebug()))
		.pipe(ignore.exclude(["**/*.map"]))
		.pipe(gulpif(optimize, uglify()).on('error', gulpUtil.log))
		.pipe(gulp.dest(`./${dist_folder_name}/js/${innerFolder}`));
};

const compileCleanJs = (funcArray, dist_name, innerFolder = '') => {
	gulp.src(funcArray)
		.pipe(concat(dist_name))
		.pipe(strip())
		.pipe(stripDebug())
		.pipe(gulp.dest(`./${dist_folder_name}/js/${innerFolder}`));
};

const compileCss = (funcArray, dist_name) => {
	gulp.src(funcArray)
		.pipe(concat(dist_name))
		// .pipe(modifyCssUrls({
		// 	// modify: (url) => {
		// 	// 	return `/${bucket_dir}/${version}/${url}`;
		// 	// }
		// 	//prepend: `/${bucket_dir}/${version}`
		// 	// ,append: '?cache-buster'
		// }))
		.pipe(cleanCSS({compatibility: 'ie10'}))
		.pipe(gulp.dest(`./${dist_folder_name}/css/`));
};

const uploadFile = (name, aws, options) => {
	gulp.src([`./${dist_folder_name}/${name}`])
		.pipe(rename(`${bucket_dir}/${version}/${name}`))
		.pipe(gzip())
		.pipe(s3(aws, options));
};

const uploadStaticFile = (src, dist, renameFunc, invalidationPath) => {
	let options                      = {headers: {'Cache-Control': 'max-age=315360000, no-transform, public'}, gzippedOnly: true},
	    config                       = require('./local_config/aws_config.json'),
	    key = config.aws_key, secret = config.aws_secret,
	    aws                          = {
		    "key":    key,
		    "secret": secret,
		    "bucket": config.bucket,
		    "region": "us-east-1"
	    };

	gulp.src([src])
		.pipe(rename(dist || renameFunc))
		.pipe(gzip())
		.pipe(s3(aws, options));


	if (invalidationPath && invalidationPath.length) {
		setTimeout(function () {
			let cf_settings = {
				distribution:    config.beame_cdn_distribution, // Cloudfront distribution ID
				paths:           invalidationPath,                 // Paths to invalidate
				accessKeyId:     key,               // AWS Access Key ID
				secretAccessKey: secret,        // AWS Secret Access Key
				wait:            false                     // Whether to wait until invalidation is completed (default: false)
			};

			gulp.src('*')
				.pipe(cloudfront(cf_settings));

		}, 1000 * 3);
	}

};

gulp.task('sass', function () {
	gulp.src('./public/scss/app.scss')
		.pipe(sass().on('error', (err) => {
			console.error(' gulp sass error ', err);
			process.exit(1);
		}))
		.pipe(gulp.dest('./public/css/'));

	gulp.src('./public/scss/google_fonts/fonts/**')
		.pipe(gulp.dest('./public/css/fonts/'));
});

gulp.task('web_sass', function () {
	gulp.src(web_src_root_path + 'scss/*.scss')
		.pipe(sass())
		.pipe(gulp.dest('./apps/photo/public/css/'));

	gulp.src(web_src_root_path + 'scss/*.scss')
		.pipe(sass())
		.pipe(gulp.dest('./apps/stream/public/css/'));

});

gulp.task('rasp_sass', function () {
	gulp.src('./apps/rasp/public/scss/*.scss')
		.pipe(sass())
		.pipe(gulp.dest('./apps/rasp/public/css/'));

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
	gulp.src(`${dist_folder_name}`, {read: false})
		.pipe(clean());
});

gulp.task('compile-css', () => {
	compileCss(['./public/css/app.css'], 'app.min.css');
});

gulp.task('compile-js', () => {


	compileJs([
		'./public/js/notification_manager.js',
		'./public/lib/clipboard.min.js',
		'./public/js/utils.js',
		'./public/js/admin/config_head.js'
	], 'config.head.min.js', true);

	compileJs([
		'./public/lib/jszip-2.4.0.min.js',
		'./public/lib/jquery/jquery.form-3.5.1.min.js',
		'./public/js/admin/notification.js',
		'./public/js/admin/config_foot.js',
		'./public/js/admin/dash.js'
	], 'config.foot.min.js', true);

	compileJs([
		'./public/js/notification_manager.js',
		'./public/lib/clipboard.min.js',
		'./public/js/utils.js',
		'./public/js/admin/admin_head.js'
	], 'admin.head.min.js', true);

	compileJs([
		'./public/lib/jszip-2.4.0.min.js',
		'./public/lib/jquery/jquery.form-3.5.1.min.js',
		'./public/js/admin/notification.js',
		'./public/js/admin/admin_foot.js',
		'./public/js/admin/cred.detail.js',
		'./public/js/admin/cred.tree.js',
		'./public/js/admin/gk.login.js',
		'./public/js/admin/invitation.manage.js',
		'./public/js/admin/service.manage.js',
		'./public/js/admin/user.manage.js',
		'./public/js/admin/vpn.manage.js',
		'./public/js/admin/registration.manage.js',
		'./public/js/admin/dash.js'
	], 'admin.foot.min.js', true);

	compileJs(
		[
			'./public/js/admin/notification.js',
			'./public/js/admin/invitation.js'
		], 'admin.invitation.min.js', true);

	compileJs(
		[
			'./public/js/utils.js',
			'./public/js/signup.js'
		], 'signup.head.min.js', true);

	compileJs(
		[
			'./public/js/crypto.js',
			'./public/js/virt_host_controller.js',
			'./public/js/notification_manager.js',
			'./public/js/user_image.js',
			'./public/js/qr.js'
		], 'signup.foot.min.js', true);

	compileJs([
		'./public/js/utils.js',
		'./public/js/signin.js'
	], 'signin.head.min.js', true);

	compileJs(
		[
			'./public/js/crypto.js',
			'./public/js/virt_host_controller.js',
			'./public/js/notification_manager.js',
			'./public/js/user_image.js',
			'./public/js/session_controller.js',
			'./public/js/qr.js',
			'./public/js/whisper_generator.js',
		], 'signin.foot.min.js', true);

	compileCleanJs(
		[
			'./public/js/whisperer.js'
		], 'whisperer.min.js');


	compileJs(
		[
			'./public/js/utils.js'
		], 'utils.min.js', true);

	compileJs(
		[
			'./public/js/jwk-bundle.js'
		], 'jwk-bundle.js', false);

	compileJs(
		[
			'./public/js/beame_login.js'
		], 'login.min.js', true);

	compileJs(
		[
			'./public/js/client_login.js'
		], 'client_login.min.js', true);

	compileJs(
		[
			'./public/js/cef_manager.js'
		], 'cef.min.js', true);

	compileJs(
		[
			'./public/js/safari.js'
		], 'safari.js', false);

	compileJs(
		[
			'./public/js/zendesk-widget.js'
		], 'zendesk-widget.js', false);

	compileJs(
		[
			'./public/js/short_crypto.js',
			'./public/js/virt_host_controller.js',
			'./public/js/notification_manager.js',
			'./public/js/user_image.js',
			'./public/js/session_controller.js',
			'./public/js/drct_signin.js'
		], 'direct.signin.min.js', true);

	compileJs(
		[
			'./public/js/crypto.js',
			'./public/js/virt_host_controller.js',
			'./public/js/notification_manager.js',
			'./public/js/user_image.js',
			'./public/js/session_controller.js',
			'./public/js/xprs_signin.js'
		], 'xprs.signin.min.js', true);


	compileJs(
		[
			'./public/js/crypto.js',
			'./public/js/virt_host_controller.js',
			'./public/js/notification_manager.js',
			'./public/js/user_image.js',
			'./public/js/client_approval.js'
		], 'clint.approve.min.js', true);

	compileJs(
		[
			'./public/lib/socket.io-1.7.3.min.js',
			'./public/lib/angular-1.5.7.min.js',
			'./public/lib/jquery/jquery-2.2.4.min.js',
			'./public/lib/kendo/kendo-2017.2.621.qr.min.js'
		], 'lib-sjak.min.js', false);

	compileJs(
		[
			'./public/lib/socket.io-1.7.3.min.js',
			'./public/lib/jquery/jquery-2.2.4.min.js',
			'./public/lib/kendo/kendo-2017.2.621.qr.min.js'
		], 'lib-sjk.min.js', false);

	compileJs(
		[
			'./public/lib/jquery/jquery-2.2.4.min.js',
			'./public/lib/jquery/jquery.form-3.5.1.min.js'
		], 'lib-jjf.min.js', false);
});

gulp.task('compile-pages', () => {

	compilePage('./public/pages/gw/unauthenticated/welcome.html', `./${dist_folder_name}/pages/gw/unauthenticated/`);
	compilePage('./public/pages/gw/unauthenticated/signin.html', `./${dist_folder_name}/pages/gw/unauthenticated/`);
	compilePage('./public/pages/gw/unauthenticated/login.html', `./${dist_folder_name}/pages/gw/unauthenticated/`);
	compilePage('./public/pages/gw/unauthenticated/drct_signin.html', `./${dist_folder_name}/pages/gw/unauthenticated/`);
	compilePage('./public/pages/gw/unauthenticated/forbidden.html', `./${dist_folder_name}/pages/gw/unauthenticated/`);
	compilePage('./public/pages/gw/unauthenticated/xprs_signin.html', `./${dist_folder_name}/pages/gw/unauthenticated/`);
	compilePage('./public/pages/gw/unauthenticated/logged-out.html', `./${dist_folder_name}/pages/gw/unauthenticated/`);
	compilePage('./public/pages/gw/unauthenticated/offline.html', `./${dist_folder_name}/pages/gw/unauthenticated/`);

	compilePage('./public/pages/gw/authenticated/logged-in-home.html', `./${dist_folder_name}/pages/gw/authenticated/`);


	compilePage('./public/pages/customer_auth/register.html', `./${dist_folder_name}/pages/customer_auth/`);
	compilePage('./public/pages/customer_auth/register_success.html', `./${dist_folder_name}/pages/customer_auth/`);
	compilePage('./public/pages/customer_auth/forbidden.html', `./${dist_folder_name}/pages/customer_auth/`);


	compilePage('./public/pages/beame_auth/signup.html', `./${dist_folder_name}/pages/beame_auth/`);
	compilePage('./public/pages/beame_auth/client_approval.html', `./${dist_folder_name}/pages/beame_auth/`);


	compilePage('./public/pages/config/index.html', `./${dist_folder_name}/pages/config/`);


	compilePage('./public/pages/admin/index.html', `./${dist_folder_name}/pages/admin/`);
	compilePage('./public/pages/admin/invitation.html', `./${dist_folder_name}/pages/admin/`);
	compilePage('./public/pages/admin/offline_reg_forbidden.html', `./${dist_folder_name}/pages/admin/`);

	compilePage('./public/pages/login_manager/index.html', `./${dist_folder_name}/pages/login_manager/`);
});

gulp.task('admin-index', function () {
	gulp.src(`./${build_folder_name}/pages/admin/index.html`)
		.pipe(injectPartials({
			prefix: `templates/`
		}))
		.pipe(gulp.dest(`./${dist_folder_name}/pages/admin/`));
});

gulp.task('compile-static', () => {
	gulp.src('./public/img/**/*').pipe(gulp.dest(`./${dist_folder_name}/img/`));

	gulp.src('./public/templates/*.html')
		.pipe(htmlmin({collapseWhitespace: true}))
		.pipe(inlinesource())
		.pipe(gulp.dest(`./${dist_folder_name}/templates/`));

	gulp.src('./public/templates/admin/*.html')
		//.pipe(htmlmin({collapseWhitespace: true}))
		//.pipe(inlinesource())
		.pipe(htmlreplace({
			'admin-template': ``
		}))
		.pipe(gulp.dest(`./${dist_folder_name}/templates/admin/`));

	gulp.src('./public/css/fonts/**')
		.pipe(gulp.dest(`./${dist_folder_name}/css/fonts/`));

	gulp.src('./public/lib/kendo/**')
		.pipe(gulp.dest(`./${dist_folder_name}/lib/kendo/`));

	gulp.src('./public/lib/jquery/**')
		.pipe(gulp.dest(`./${dist_folder_name}/lib/jquery/`));
});

gulp.task('compile', ['compile-sass', 'compile-css', 'compile-static', 'compile-js', 'compile-pages']);

gulp.task('compile-sass', ['sass', 'web_sass', 'rasp_sass']);

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
	uploadFile('js/utils.min.js', aws, options);
	uploadFile('js/lib.min.js', aws, options);
	uploadFile('js/signin.min.js', aws, options);
	uploadFile('js/signup.min.js', aws, options);
	uploadFile('js/approval.min.js', aws, options);
	uploadFile('js/cef.min.js', aws, options);
	uploadFile('css/app.min.css', aws, options);

	gulp.src([`./${dist_folder_name}/img/***`])
		.pipe(rename(function (path) {
			path.dirname += `/${bucket_dir}/${version}/img`;
		}))
		.pipe(gzip())
		.pipe(s3(aws, options));

	callback();

});

gulp.task('upload-tools-to-S3', ['sass-tools'], callback => {

	uploadStaticFile(`./${tools_folder_name}/insta-servers.html`, `${tools_bucket_dir}/insta-servers.html`);


	uploadStaticFile(`./${tools_folder_name}/css/app.css`, `${tools_bucket_dir}/css/app.css`);

	const renameImages = (path) => {
		path.dirname += `/${tools_bucket_dir}/img`;
	};

	uploadStaticFile(`./${tools_folder_name}/img/***`, null, renameImages);

	callback();

});

gulp.task('upload-matching', callback => {

	uploadStaticFile(`./stuff/matching_servers.json`, `${tools_bucket_dir}/matching_servers.json`, null, [`/${tools_bucket_dir}/matching_servers.json`]);

	callback();
});

gulp.task('upload-gw-json', callback => {

	uploadStaticFile(`./stuff/gw_servers.json`, `${tools_bucket_dir}/gw_servers.json`, null, [`/${tools_bucket_dir}/gw_servers.json`]);

	callback();
});