var express = require('express');
var router = express.Router();
var User = require('../models/users');
var bcrypt = require('bcrypt');
var passport = require('passport');

//GET /users/register
router.get('/register', function(req, res, next) {
  res.render('register');
});

router.post('/register', function(req, res, next) {
  let validationErrors = [];
  if (req.body.firstName && req.body.lastName) {
    req.body.fullName = `${req.body.firstName} ${req.body.lastName}`;
  }
  let user = new User(req.body);
  user.validate(err => {
    if (err) {
      for (error in err.errors) {
        if (err.errors.hasOwnProperty(error)) {
          validationErrors.push(err.errors[error]);
        }
      }
    }
    if (req.body.eulaAgree === "false") {
      err = new Error('User must agree with the EULA');
      err.status = 400;
      validationErrors.push(err);
    }
    if (req.body.password != req.body.confirmPassword) {
      err = new Error("The two passwords did not match!");
      err.status = 400;
      validationErrors.push(err);
    }
    if (validationErrors.length == 0){
      User.create(user, (err, user) => {
        if (err) {
          err = new Error("The email you provided is already in use");
          err.status = 400;
          res.render('register', {errors: [err]});
        } else {
          res.redirect('/');
        };
      });
    } else {
      res.render('register', {errors: validationErrors});
    }
  });
});

router.put('/tracks', function(req, res, next) {
  var favorites = req.user.favorites;
  if (req.user.favorites.indexOf(req.body.id) === -1) {
    favorites.push(req.body.id);
  };
  User.findOneAndUpdate(
    {"_id": req.user._id},
    {"favorites": favorites},
    function(err, doc) {
      console.log(doc)
    }
  );
  res.redirect(req.get('referer'));
})

router.delete('/tracks', function(req, res, next) {
  var favorites = req.user.favorites;
  if (favorites.indexOf(req.body.id) > -1) {
    for (var i = favorites.length-1; i >= 0; i--) {
      if (favorites[i] === req.body.id) {
        favorites.splice(i, 1);
      };
    };
  };
  User.findOneAndUpdate(
    {"_id":req.user._id},
    {"favorites": favorites},
    function(err, doc) {
      console.log(doc)
    }
  );
  res.redirect(req.get('referer'));
});

router.post('/login', function(req, res, next) {
  if (req.body.email && req.body.password) {
    User.findOne({email:req.body.email})
    .exec((err, user) => {
      if (err) {
        return next(err)
      } else if (!user) {
        let err = new Error('Invalid login data');
        err.status = 401;
        return next(err);
      } else {
        bcrypt.compare(req.body.password, user.password, function (err, result) {
          if (err) {
            err = new Error("Password does not match our records");
            err.status = 401;
            return next(err);
          }
          if (result) {
            req.session.passport.user = user;
            res.redirect('/profile');
          } else {
            var err = new Error("Invalid login data");
            err.status = 401;
            return next(err);
          }
        })
      }
    })
  }
});

router.get('/login/spotify',
    passport.authenticate('spotify'));

router.get('/spotify/return',
    passport.authenticate('spotify', {failureRedirect: '/'}),
    function(req, res) {
      //Success auth, redirect
      res.redirect('/profile');
    });

router.get('/logout', function(req, res) {
  req.logout();
  res.redirect('/')
})

module.exports = router;
