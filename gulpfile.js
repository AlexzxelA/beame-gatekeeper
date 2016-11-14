/**
 * Created by zenit1 on 13/11/2016.
 */
"use strict";

const gulp = require('gulp');
const sass = require('gulp-sass');
const rename = require("gulp-rename");

gulp.task('app_sass', function () {
	gulp.src('./public/scss/app.scss')
		.pipe(sass().on('error', (err) => {
			console.error(' gulp sass error ',err);
			process.exit(1);
		}))
		.pipe(gulp.dest('./public/css/'));
});

gulp.task('cust_auth__sass', function () {
	gulp.src('./public/scss/app.scss')
		.pipe(sass().on('error', (err) => {
			console.error(' gulp sass error ',err);
			process.exit(1);
		}))
		.pipe(rename('register.css'))
		.pipe(gulp.dest('./public/css/'));
});