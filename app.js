var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
var session = require('express-session');
var MongoStore = require('connect-mongo')(session);
var index = require('./routes/index');
var users = require('./routes/users');
var search = require('./routes/search');
var User = require('./models/users');
var passport = require('passport');
var SpotifyStrategy = require('passport-spotify').Strategy;
var methodOverride = require('method-override')
var app = express();

function generateOrFindUser (accessToken, refreshToken, profile, done) {
  if(profile.emails[0]) {
    User.findOneAndUpdate({
      email: profile.emails[0].value
    }, {
      spotifyId: profile.id,
      fullName: profile.displayName,
      email: profile.emails[0].value,
      profilePic: profile.photos[0],
      refreshToken: refreshToken
    }, {
      upsert: true
    },
    done);
  } else {
    var noEmailError = new Error('Your email privacy settings prevent you from signing into MYS.');
    return done(noEmailError, null);
  };
};

//Configure spotify Strategy
passport.use(new SpotifyStrategy({
    clientID: process.env.SPOTIFY_APP_ID || "eb9c368e41ab454fba821c00ec73805b",
    clientSecret: process.env.SPOTIFY_APP_SECRET || "4055d2c4df6546fea8b395cc8ebf1ed5",
    callbackURL: "http://localhost:3000/users/spotify/return"},
    generateOrFindUser
));

passport.serializeUser(function(user, done){
  done(null, user._id);
});

passport.deserializeUser(function(userId, done) {
  User.findById(userId, done);
});

mongoose.connect("mongodb://localhost:27017/mys");
var db = mongoose.connection;

app.use(session({
  secret: 'Why does it always have to be cats?',
  resave: false,
  saveUninitialized: true,
  store: new MongoStore({
    mongooseConnection: db
  })
}))


// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(methodOverride('_method'));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

//Initialize passport
app.use(passport.initialize());

//Restore session
app.use(passport.session());

db.on('error', console.error.bind(console, 'connection error:'));

app.use('/', index);
app.use('/search', search);
app.use('/users', users);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
