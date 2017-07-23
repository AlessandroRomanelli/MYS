var express = require('express');
var router = express.Router();
var rp = require('request-promise')
var User = require('../models/users');
var bcrypt = require('bcrypt');
var passport = require('passport');

var spotifyAuth = ["eb9c368e41ab454fba821c00ec73805b", "4055d2c4df6546fea8b395cc8ebf1ed5"];


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
  if (req.user) {
    var favorites = req.user.favorites;
    if (req.user.favorites.indexOf(req.body.id) === -1) {
      favorites.push(req.body.id);
    };
    User.findOneAndUpdate(
      {"_id": req.user._id},
      {
        "favorites": favorites,
      },
      function(err, doc) {
        return true
      }
    );
    res.redirect(req.get('referer'));
  } else {
    res.redirect(req.get('referer'));
  }
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
    {
      "favorites": favorites,
    },
    function(err, doc) {
      return true
    }
  );
  res.redirect(req.get('referer'));
});

router.get('/tracks/save', function(req, res, next) {
  var data = {};
  var key64 = new Buffer(spotifyAuth.join(':')).toString('base64');
  rp.post({
    url: 'https://accounts.spotify.com/api/token',
    headers: {
      'Content-Type'  : "application/x-www-form-urlencoded",
      'Authorization' : `Basic ${key64}`
    },
    qs: {
      grant_type: 'refresh_token',
      refresh_token: req.user.refreshToken
    }
  })
  .then(response => {
    response = JSON.parse(response);
    data.access_token = response.access_token;
    var body = JSON.stringify({
      name: 'MYS Exported tracks',
      public: false,
      description: 'A playlist of songs exported the MYS website'
    });
    return rp.post({
      url: `https://api.spotify.com/v1/users/${req.user.spotifyId}/playlists`,
      headers: {
        'Authorization' : `Bearer ${response.access_token}`,
        'Content-Type'  : 'application/json'
      },
      body: body
    })
    .then(response => {
      response = JSON.parse(response);
      data.playlistUrl = response.href;
      return data;
    })
    .then(data => {
      favoritesUri = [];
      var favorites = req.user.favorites;
      for (var i = 0; i < favorites.length; i ++) {
        var uri = `spotify:track:${favorites[i]}`;
        favoritesUri.push(uri);
      }
      var body = JSON.stringify({
        uris: favoritesUri
      });
      return rp.post({
        url: `${data.playlistUrl}/tracks`,
        headers: {
          'Authorization' : `Bearer ${data.access_token}`,
          'Content-Type'  : 'application/json'
        },
        body: body
      })
      .then(response => {
        res.redirect('/profile');
      })
      .catch(err => {
        return next(err);
      });
    })
    .catch(err => {
      return next(err);
    });
  })
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
  passport.authenticate('spotify', {scope: ['user-read-email', 'user-read-private', 'playlist-modify-private']})
);

router.get('/spotify/return',
    passport.authenticate('spotify', {failureRedirect: '/'}),
    function(req, res) {
      //Success auth, redirect
      debugger
      res.redirect('/profile');
    });

router.get('/logout', function(req, res) {
  req.logout();
  res.redirect('/')
})

module.exports = router;

// var data = {};
// var key64 = new Buffer(spotifyAuth.join(':')).toString('base64');
// return rp.post({
//   url: "https://accounts.spotify.com/api/token",
//   headers: {
//     'Content-Type'  : "application/x-www-form-urlencoded",
//     'Authorization' : `Basic ${key64}`
//   },
//   qs: {
//     grant_type: "client_credentials"
//   }
// })
// .then(response => {
//   response = JSON.parse(response);
//   data.token = response.access_token;
//   return data
// })
// .then(data => {
//   return rp.post({
//     url: `https://api.spotify.com/v1/users/${req.user.spotifyId}/playlists`,
//     headers: {
//       'Authorization' : `Bearer ${data.token}`,
//       'Content-Type'  : 'application/json'
//     },
//     body: {
//       name: 'MYS Playlist',
//       description: 'A playlist exported by the MYS website'
//     },
//     json: true
//   })
//   .then(response => {
//     response = JSON.parse(response);
//     data.playlist = response;
//     return data
//   })
//   .catch(err => {
//     return next(err);
//   });
// })
// .then(data => {
//   favoritesUri = [];
//   var favorites = req.user.favorites;
//   for (var i = 0; i < favorites.length; i ++) {
//     var uri = `spotify:track:${favorites[i]}`;
//     favoritesUri.push(uri);
//   }
//   return rp.post({
//     url: `https://api.spotify.com/v1/users/${user.spotifyId}/playlists/${data.playlist.id}/tracks`,
//     headers: {
//       'Authorization' : `Bearer ${data.token}`,
//       'Content-Type'  : 'application/json'
//     },
//     body: {
//       uris: user.favoritesUri
//     },
//     json: true
//   })
//   .then(response => {
//     res.redirect(req.get('referer'));
//   })
//   .catch(err => {
//     return next(err);
//   });
// })
// .catch(err => {
//   return next(err);
// });
