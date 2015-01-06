var express = require('express');
var app = express();
var server = require('http').Server(app);
var path = require('path');

app.use(express.static('public'));
app.get('/js/client.js', require('browserify-middleware')('./client/client.js'));
app.get('/', function (req, res) {
    res.sendFile(path.resolve(__dirname + '/../templates/index.html'));
});

server.listen(process.env.PORT || 5000, function () {});
