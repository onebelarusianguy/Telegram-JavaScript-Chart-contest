'use strict';

var gulp = require('gulp'),
	sass = require('gulp-sass'),
	minify = require('gulp-minify-css'),
	uglify = require('gulp-uglify'),
	rename = require('gulp-rename'),
	concat = require('gulp-concat'),
	plumber = require('gulp-plumber'),
	browserSync = require('browser-sync'),
	paths = {
		src: './',
		build: './',
		scripts: ['*.js'],
		scriptsToWatch: ['*.js'],
	};

gulp.task('html', function () {
	gulp.src(paths.src + '/*.html')
		.pipe(plumber())
		.pipe(gulp.dest(paths.build + '/'));
});

gulp.task('sass', function () {
	gulp.src(paths.src + '/assets/sass/*.scss')
		.pipe(plumber())
		.pipe(sass({
			outputStyle: 'expanded',
			indentType: 'tab',
			indentWidth: 1 // 1 TAB
		}))
		.on('error', sass.logError)
		.pipe(gulp.dest(paths.build + '/assets/css/'))
		.pipe(rename('styles.min.css'))
		.pipe(minify({
			compatibility: 'ie8'
		}))
		.pipe(gulp.dest(paths.build + '/assets/css/'))
});

gulp.task('scripts', function () {
	//concat
/*	gulp.src(paths.scripts)
		.pipe(plumber())
		.pipe(concat('libs.js'))
		.pipe(gulp.dest(paths.build + '/assets/js/'))
		.pipe(rename('libs.min.js'))
		.pipe(uglify())
		.pipe(gulp.dest(paths.build + '/assets/js/'));

	//common
	gulp.src('_src/assets/js/common.js')
		.pipe(plumber())
		.pipe(rename('common.min.js'))
		.pipe(uglify())
		.pipe(gulp.dest(paths.build + '/assets/js/'));*/
});

gulp.task('watch', ['scripts'], function () {
	//Static Server
	browserSync.init({
		server: {
			baseDir: paths.build + '/'
		},
		notify: false
	});

	gulp.watch(paths.scriptsToWatch, ['scripts']);
	browserSync.watch([paths.build + '*.js']).on('change', browserSync.reload);
});

gulp.task('default', ['watch']);
