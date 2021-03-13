/*
CSC3916 HW2
File: Server.js
Description: Web API scaffolding for Movie API
 */

var express = require('express');
var bodyParser = require('body-parser');
var passport = require('passport');
var authController = require('./auth');
var authJwtController = require('./auth_jwt');
var jwt = require('jsonwebtoken');
var cors = require('cors');
var User = require('./Users');
var Movie = require('./Movies')

var app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(passport.initialize());

var router = express.Router();

function getJSONObjectForMovieRequirement(req) {
    var json = {
        headers: "No headers",
        key: process.env.UNIQUE_KEY,
        body: "No body"
    };

    if (req.body != null) {
        json.body = req.body;
    }

    if (req.headers != null) {
        json.headers = req.headers;
    }

    return json;
}

router.post('/signup', function(req, res) {
    if (!req.body.username || !req.body.password) {
        res.json({success: false, msg: 'Please include both username and password to signup.'})
    } else {
        var user = new User();
        user.name = req.body.name;
        user.username = req.body.username;
        user.password = req.body.password;

        user.save(function(err){
            if (err) {
                if (err.code == 11000){
                    res.statusCode = 409;
                    return res.json({success: false, message: 'A user with that username already exists.'});
                }
                else {
                    console.log(err.message); //probably don't want to expose login related server errors to user but we want to log them for our own use
                    res.statusCode = 500;
                    return res.json({success: false, message: "Internal server error."});
                }
            }
            res.json({success: true, msg: 'Successfully created new user.'})
        });
    }
});

router.post('/signin', function (req, res) {
    var userNew = new User();
    userNew.username = req.body.username;
    userNew.password = req.body.password;

    User.findOne({ username: userNew.username }).select('name username password').exec(function(err, user) {
        if (err) {
            res.send(err);
        }

        user.comparePassword(userNew.password, function(isMatch) {
            if (isMatch) {
                var userToken = { id: user.id, username: user.username };
                var token = jwt.sign(userToken, process.env.SECRET_KEY);
                res.json ({success: true, token: 'JWT ' + token});
            }
            else {
                res.status(401).send({success: false, msg: 'Authentication failed.'});
            }
        })
    })
});

router.route('/movies')
    .post(authJwtController.isAuthenticated, function(req, res){
        if(!req.body.Title || !req.body.Year || !req.body.Genre || !req.body.LeadActors){
            res.statusCode = 400;
            return res.json({success: false, message: "POST should have title, year, genre, and 3 lead actors."})
        }
        let movie = new Movie();
        movie.Title = req.body.Title;
        movie.Year = req.body.Year;
        movie.Genre = req.body.Genre;
        movie.LeadActors = req.body.LeadActors;

        movie.save((err) => {
            if(err){
                if(err.code === 11000) {
                    res.statusCode = 409;
                    return res.json({success: false, message: "a movie already exists with that title"})
                }
                else{
                    res.statusCode = 500;
                    return res.json({success: false, message: err.message});
                }
            }
            else{
                return res.json({success: true, message: "movie created in db."})
            }
        })
    })
    .get(authJwtController.isAuthenticated, function(req, res){
        if(!req.body.Title){
            res.statusCode = 400;
            return res.json({success: false, message: "GET should have Title attribute with title of desired movie in body."});
        }

        Movie.findOne({Title: req.body.Title}).select('Title Year Genre LeadActors').exec((err, movie) => {
            if(err){
                res.statusCode = 500;
                return res.json(err.message);
            }
            else if(!movie){
                res.statusCode = 404;
                return res.json({success: false, message: "movie not found in database."})
            }
            else
                return res.json({success: true, movie: movie});
        });
    })
    .put(authJwtController.isAuthenticated, function(req, res) {
        if(!req.body.Title || !req.body.FieldToUpdate || !req.body.NewValue){
            res.statusCode = 400;
            return res.json({success: false, message: "PUT should have 'Title', 'FieldToUpdate', and 'NewValue' fields in body."});
        }

        Movie.findOne({Title: req.body.Title}).select('Title Year Genre LeadActors').exec((err, movie) => {
            if(err){
                if (err.code === 400){ //something was wrong with the provided data.
                    res.statusCode = 400;
                    return res.json({success: false, error: err.message})
                }
                else{ //probably a server error
                    console.log(err.message);
                    res.statusCode = 500;
                    return res.json({success: false, message: "Internal server error."});
                }
            }
            if(movie === null){
                res.statusCode = 404;
                return res.json({success: false, message: "A movie doesn't exist with that title."})
            }
            else{
                if(!movie[req.body.FieldToUpdate]){
                    res.statusCode = 400;
                    return res.json({success: false, message: "Provided field to update does not exist."})
                }
                if(typeof req.body.NewValue !== typeof movie[req.body.FieldToUpdate]){
                    res.statusCode = 400;
                    return res.json({success: false, message: "Type of new value must match type of old value."})
                }
                movie[req.body.FieldToUpdate] = req.body.NewValue;
                movie.save((err) =>{
                    if(err){
                        if(err.code === 400)
                            res.statusCode = 400;
                        else
                            res.statusCode = 500;
                        return res.json({success: false, message: err.message});
                    }
                    return res.json({success: true, message: "movie successfully updated"});
                })
            }

        })
    })
    .delete(authJwtController.isAuthenticated, function(req, res){
        if(!req.body.Title){
            res.statusCode = 400;
            return res.json({success: false, message: "DELETE should have Title attribute with title of desired movie in body." });
        }
        Movie.deleteOne({"Title": req.body.Title}).exec((err, result) => {
            if(err){
                    res.statusCode = 500;
                    return res.json({success: false, message: "Internal server error."});
                }
            else if(result.n === 0){
                res.statusCode = 404;
                return res.json({success: false, message: "Movie couldn't be deleted, did not exist in database."});
            }
            else {
                res.statusCode = 200;
                return res.json({success: true, message: "Movie deleted from database."});
            }

        })
    });
app.use('/', router);
app.listen(process.env.PORT || 8080);
module.exports = app; // for testing only


