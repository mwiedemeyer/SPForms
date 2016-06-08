var gulp = require('gulp');
var concat = require('gulp-concat');
var ts = require('gulp-typescript');
var uglify = require('gulp-uglify');

gulp.task('default', ['bundle:2013', 'bundle:2010', 'bundle:2010-2013']);

gulp.task('ts', function () {
    var tsResult = gulp.src(['./*.ts', './Scripts/typings/**/*.ts'])
        .pipe(ts());
    return tsResult.js.pipe(gulp.dest('./'));
});

gulp.task('bundle:2013', ['ts'], function () {
    return gulp.src(['SPForms_Main.js',
        'SPForms_Fields.js',
        'SPForms_PeoplePicker2013.js',
        'SPForms_ProfileBase.js',
        'SPForms_Profile2013.js'
    ])
        .pipe(concat('SPForms.2013.js'))
        .pipe(gulp.dest('./dist/'))
        .pipe(concat('SPForms.2013.min.js'))
         .pipe(uglify({
             mangle: true,
             compress: true
         }))
        .pipe(gulp.dest('./dist/'));
});

gulp.task('bundle:2010', ['ts'], function () {
    return gulp.src(['SPForms_Main.js',
        'SPForms_Fields.js',
        'SPForms_PeoplePicker2010.js',
        'SPForms_ProfileBase.js',
        'SPForms_Profile2010.js'
    ])
        .pipe(concat('SPForms.2010.js'))
        .pipe(gulp.dest('./dist/'))
        .pipe(concat('SPForms.2010.min.js'))
         .pipe(uglify({
             mangle: true,
             compress: true
         }))
        .pipe(gulp.dest('./dist/'));
});

gulp.task('bundle:2010-2013', ['ts'], function () {
    return gulp.src(['SPForms_Main.js',
        'SPForms_Fields.js',
        'SPForms_PeoplePicker2010.js',
        'SPForms_PeoplePicker2013.js',
        'SPForms_ProfileBase.js',
        'SPForms_Profile2010.js',
        'SPForms_Profile2013.js'
    ])
        .pipe(concat('SPForms.2010-2013.js'))
        .pipe(gulp.dest('./dist/'))
        .pipe(concat('SPForms.2010-2013.min.js'))
         .pipe(uglify({
             mangle: true,
             compress: true
         }))
        .pipe(gulp.dest('./dist/'));
});