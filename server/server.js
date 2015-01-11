var express = require('express');
var app = express();
var server = require('http').Server(app);
var path = require('path');
var browserify = require('browserify-middleware');

browserify.settings('transform', ['brfs']);

app.use(express.static('public'));

var shared = ['crypto'];
app.get('/js/libs.js', browserify(shared, {
    cache: true,
    precompile: true,
    minify: true,
    gzip: true
}));
app.get('/js/client.js', browserify('./client/client.js', {
    external: shared
}));

app.get('/', function (req, res) {
    res.sendFile(path.resolve(__dirname + '/../templates/index.html'));
});

server.listen(process.env.PORT || 5000, function () {});
