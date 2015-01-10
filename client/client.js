var vec2 = require('gl-matrix').vec2;

var canvas = {
    stage: document.getElementById('stage'),
    grid: document.getElementById('grid'),
    ui: document.getElementById('ui')
};

var ctx = {
    stage: canvas.stage.getContext('2d'),
    grid: canvas.grid.getContext('2d'),
    ui: canvas.ui.getContext('2d')
};

var stageBoundingRect;
var gameAnimationFrame;

function resizeCanvas () {
    for (var name in canvas) {
        canvas[name].width = window.innerWidth;
        canvas[name].height = window.innerHeight;
    }

    setTimeout(drawGrid, 0);
    stageBoundingRect = canvas.stage.getBoundingClientRect();
}
window.addEventListener('resize', resizeCanvas, false);
resizeCanvas();

canvas.stage.addEventListener('contextmenu', function (event) {
    event.preventDefault();
    return false;
});

var fps = 0;
var fpsFilter = 50;

var loop = new (require('helix-loop'))({
    updateInterval: 50
});

loop.on('start', drawGrid);

loop.on('preUpdate', processInput);
loop.on('preUpdate', function (dt) {
    var frameFPS = 1000 / dt;
    fps += (frameFPS - fps) / fpsFilter;
});
loop.on('update', update);

loop.on('render', render);
loop.on('render', drawUI);

loop.start();

var game = {
    gridNodeWidth: 10,
    gridNodeHeight: 10,
    mouse: {
        position: [0, 0],
        mouse1: false
    },
    keyboard: new (require('./input/Keyboard'))(window),
    drawTile: 1
};

var gridHeight = Math.ceil(canvas.stage.height / game.gridNodeHeight);
var gridWidth = Math.ceil(canvas.stage.width / game.gridNodeWidth);
var grid = require('./grid')(gridWidth, gridHeight, Uint16Array);

var dataTools = require('./data-tools');

var fs = require('fs');
var tileTypes = JSON.parse(fs.readFileSync(__dirname + '/../data/tiles.json', 'utf8'));

var tileNames = Object.keys(tileTypes);
var tileLookup = [];
var tileCount = tileNames.length;
for (var i = 0; i < tileNames.length; i++) {
    tileLookup[tileTypes[tileNames[i]].id] = tileNames[i];
}

function drawGrid() {
    for (var x = 0; x < gridHeight; x++) {
        ctx.grid.moveTo(0, x * game.gridNodeHeight + 0.5);
        ctx.grid.lineTo(canvas.stage.width, x * game.gridNodeHeight + 0.5);
    }
    for (var y = 0; y < gridWidth; y++) {
        ctx.grid.moveTo(y * game.gridNodeWidth + 0.5, 0);
        ctx.grid.lineTo(y * game.gridNodeWidth + 0.5, canvas.stage.height);
    }

    ctx.grid.strokeStyle = '#333333';
    ctx.grid.stroke();
}

function getMousePos (event) {
    return [event.clientX - stageBoundingRect.left, event.clientY - stageBoundingRect.top];
}

function screenToGridCoords (coords) {
    return [Math.floor(coords[0] / game.gridNodeWidth), Math.floor(coords[1] / game.gridNodeHeight)];
}
function gridToScreenCoords (coords) {
    return [coords[0] * game.gridNodeWidth, coords[1] * game.gridNodeHeight];
}

function handleMouseInput (event) {
    if (event.type === 'mousemove') {
        game.mouse.position = getMousePos(event);
    } else {
        game.mouse['mouse' + event.which] = event.type === 'mousedown';
    }
}

function processInput () {
    if (game.mouse.mouse1) {}

    if (game.keyboard.isKeyFirstDown(game.keyboard.Keymap.TAB)) {
        if (game.keyboard.isKeyDown(game.keyboard.Keymap.SHIFT)) {
            game.drawTile--;
            if (game.drawTile < 0) {
                game.drawTile = tileCount - 1;
            }
        } else {
            game.drawTile = (game.drawTile + 1) % tileCount;
        }
    }
}

canvas.stage.addEventListener('mousemove', handleMouseInput);
canvas.stage.addEventListener('mousedown', handleMouseInput);
canvas.stage.addEventListener('mouseup', handleMouseInput);

function update (fdt) {
    var tile = [];
    var neighbors = [];
    for (var y = grid.length - 1; y >= 0; y--) {
        for (var x = grid[y].length - 1; x >= 0; x--) {
            var coords = [x, y];
        }
    }
}

function drawUI (t) {
    var coords = screenToGridCoords(game.mouse.position);
    var screenCoords = gridToScreenCoords(coords);  // drawing the cursor aligned to the grid square

    ctx.ui.clearRect(0, 0, canvas.ui.width, canvas.ui.height);

    ctx.ui.fillStyle = tileTypes[tileLookup[game.drawTile]].color;
    ctx.ui.fillRect(screenCoords[0], screenCoords[1], game.gridNodeWidth, game.gridNodeHeight);
    ctx.ui.fillStyle = 'white';
    ctx.ui.fillText('FPS: ' + fps.toFixed(2), 15, canvas.ui.height - 15);
    ctx.ui.fillText('Grid Coords: (' + coords[0] + ',' + coords[1] + ')', 15, canvas.ui.height - 30);

    var tileCount = tileLookup.length;
    var switcherTileSize = 25;
    var switcherPadding = 25;
    var switcherMargin = 25;

    var switcherWidth = switcherTileSize * tileCount + (switcherPadding / 4 * tileCount);
    var switcherHeight = 50;

    var switcherX = canvas.ui.width - switcherWidth - switcherMargin;
    var switcherY = canvas.ui.height - switcherHeight - switcherMargin;

    ctx.ui.strokeStyle = 'white';
    ctx.ui.lineWidth = 2;
    for (var i = 0; i < tileLookup.length; i++) {
        var tile = tileTypes[tileLookup[i]];
        ctx.ui.fillStyle = tile.color;

        ctx.ui.beginPath();
        ctx.ui.rect(switcherX + switcherTileSize * i + (switcherPadding / 4 * i), switcherY + switcherTileSize / 2, switcherTileSize, switcherTileSize);
        ctx.ui.fill();
        if (game.drawTile === i) {
            ctx.ui.stroke();
        }
    }

    ctx.ui.fillStyle = 'white';
    ctx.ui.fillText('Current tile: ' + tileLookup[game.drawTile], switcherX, switcherY + switcherHeight + switcherPadding / 2);
}

function render (t) {
    var coords;

    ctx.stage.fillStyle = 'black';
    ctx.stage.fillRect(0, 0, canvas.stage.width, canvas.stage.height);

    var tile = [];
    for (var y = 0; y < grid.length; y++) {
        for (var x = 0; x < grid[y].length; x++) {
            coords = [x, y];
        }
    }
}
