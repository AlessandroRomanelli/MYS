'use strict'

var express = require('express');
var router = express.Router();
var rp = require('request-promise')

var spotifyAuth = [process.env.SPOTIFY_APP_ID, process.env.SPOTIFY_APP_SECRET];

var optionsTMDb = {
  baseUrl: "https://api.themoviedb.org/3/",
  qs: {
    api_key: "4288c19b69475f4d2c7c5815bf66330e",
    append_to_response: 'credits'
  }
};

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

//GET /search
router.get('/', function(req, res, next) {
  res.render('search', {data: null, user: req.user});
})

//GET /search/movies
router.get('/movies', function(req, res, next) {
  if (!req.query.movie_name) {
    return res.render('search', {data: null, error: true, user: req.user});
  }

  optionsTMDb.qs.query = req.query.movie_name;
  optionsTMDb.qs.page = req.query.page;

  rp.get(`search/movie/`, optionsTMDb)
  .then(movies => {
    movies = JSON.parse(movies);
    if (req.query.page > movies.total_pages) {
      movies.total_results = 0;
      res.render('search', {data: body})
    };
    movies.results.sort(function(a,b) {
      if (a.popularity > b.popularity) {
        return -1;
      } else {
        return 1;
      };
    });
    movies.results.forEach(entry => {
      entry.popularity = (Math.round(entry.popularity*100))/100;
    });
    res.render('search', { data: movies, user: req.user });
  })
  .catch(err => {
    return next(err);
  })
});

//GET /search/movies/:id
router.get('/movies/:id', function(req, res, next) {
  let data = {};
  //Get the movie info
  rp.get(`movie/${req.params.id}`, optionsTMDb)
  .then(movie => {
    movie = JSON.parse(movie);
    if (movie.status_code === 34) {
      var err = new Error('Page not found.');
      err.status = 404;
      return next(err);
    };
    if (movie.credits) {
      movie.directors = getDirectors(movie.credits.crew);
    };
    data.movie = movie;
    return data;
  })
  //Get the auth token from Spotify
  .then(data => {
    var key64 = new Buffer(spotifyAuth.join(':')).toString('base64');
    return rp.post({
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
      data.access_token = response.access_token;
      return data;
    })
    .catch(err => {
      return next(err);
    })
  })
  //Get albums that match the movie soundtrack
  .then(data => {
    return rp.get({
      url: "https://api.spotify.com/v1/search",
      headers: {
        'Authorization' : `Bearer ${data.access_token}`
      },
      qs: {
        type: 'album',
        q: `${data.movie.original_title}`
      }
    })
    .then(response => {
      response = JSON.parse(response);
      if (response.albums.total == 0) {
        res.render('movie', { movie: data.movie, songs: null, user: req.user});
      }
      data.album_href = response.albums.items[0].href;
      return data;
    })
    .catch(err => {
      return next(err);
    })
  })
  //Get the tracks of the matched playlist
  .then(data => {
    return rp.get({
      url: data.album_href,
      headers: {
        'Authorization' : `Bearer ${data.access_token}`
      }
    })
    //Add duration and artists in readable formats to the song object
    .then(response => {
      response = JSON.parse(response);
      response.tracks.items.forEach(entry => {
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
      data.songs = response.tracks.items;
      return data
    })
  })
  //Render to the movie page
  .then(data => {
    res.render('movie', { movie: data.movie, songs: data.songs, user: req.user });
  })
  .catch(err => {
    return next(err);
  })
});

module.exports = router;
