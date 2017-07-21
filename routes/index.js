var express = require('express');
var router = express.Router();
var rp = require('request-promise');

var spotifyAuth = ["eb9c368e41ab454fba821c00ec73805b", "4055d2c4df6546fea8b395cc8ebf1ed5"];

function getDirectors (crew) {
  var directors = [];
  crew.forEach(entry => {
    if (entry.job == 'Director') {
      directors.push(entry.name);
    };
  });
  if (directors.length == 0) {
    directors.push('Unknown');
  };
  return directors;
}

//GET '/' Homepage
router.get('/', function(req, res, next) {
  res.render('home', { title: 'Express', user: req.user});
});

router.get('/about', function(req, res, next) {
  res.render('about', { user: req.user });
})

router.get('/profile', function(req, res, next) {
  var key64 = new Buffer(spotifyAuth.join(':')).toString('base64');
  if (!req.user) {
    var err = new Error('You are not logged in.')
    err.status = 400;
    return next(err);
  };
  if (req.user.favorites.length === 0) {
    var err = new Error;
    err.status = 404;
    res.render('profile', {user: req.user, error: err});
  } else {
    rp.post({
      url: "https://accounts.spotify.com/api/token",
      headers: {
        'Content-Type'  : "application/x-www-form-urlencoded",
        'Authorization' : `Basic ${key64}`
      },
      qs: {
        grant_type: "client_credentials"
      }
    })
    .then(response => {
      response = JSON.parse(response);
      return response.access_token;
    })
    .then(token => {
      rp.get({
        url: "https://api.spotify.com/v1/tracks",
        headers: {
          'Authorization' : `Bearer ${token}`
        },
        qs: {
          ids: req.user.favorites.join(',')
        }
      })
      .then(response => {
        response = JSON.parse(response);
        response.tracks.forEach(entry => {
          //Duration
          var ms = entry.duration_ms,
          min = (ms/1000/60) << 0,
          sec = (ms/1000) % 60 << 0;
          if (sec < 10) {
            sec = '0'+sec;
          };
          var duration = `${min}:${sec}`;
          entry.duration = duration;
          //Artist
          entry.artistsString = [];
          entry.artists.forEach(function(artist, index) {
            if (index < 3) {
              entry.artistsString.push(artist.name);
            }
          })
          //Is favorite?
          entry.favorite = false;
          if (req.user) {
            if (req.user.favorites.indexOf(entry.id) > -1) {
              entry.favorite = true;
            }
          }
        })
        return response
      })
      .then(response => {
        res.render('profile', {user: req.user, songs: response.tracks});
      })
      .catch(err => {
        return next(err);
      })
    })
    .catch(err => {
      return next(err);
    })
  }
});

module.exports = router;
