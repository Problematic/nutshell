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

    drawGrid(ctx.grid);
    stageBoundingRect = canvas.stage.getBoundingClientRect();
}
window.addEventListener('resize', resizeCanvas, false);
resizeCanvas();

canvas.stage.addEventListener('contextmenu', function (event) {
    event.preventDefault();
    return false;
});

var UPDATE_INTERVAL = 50;
var LAG_CAP = 1000;
var last = Date.now();
var lag = 0;
var fps = 0;
var fpsFilter = 50;
function gameLoop () {
    gameAnimationFrame = window.requestAnimationFrame(gameLoop);

    var current = Date.now();
    var delta = current - last;
    var frameFPS = 1000 / delta;
    fps += (frameFPS - fps) / fpsFilter;
    last = current;
    lag += delta;

    processInput();

    if (lag > LAG_CAP) {
        // if we're out of focus, rAF doesn't keep ticking, so lag can get
        // very large and take a long time to simulate (during which time
        // everything is locked up from the user's perspective)
        console.log('Shortening lag from', lag, 'to lag cap', LAG_CAP);
        lag = LAG_CAP;
    }
    while (lag >= UPDATE_INTERVAL) {
        game.tick++;
        update(UPDATE_INTERVAL / 1000);
        lag -= UPDATE_INTERVAL;
    }

    render(lag / UPDATE_INTERVAL);
}
gameAnimationFrame = window.requestAnimationFrame(gameLoop);

var game = {
    tick: 0,
    gridNodeWidth: 10,
    gridNodeHeight: 10,
    mouse: {
        position: [0, 0],
        mouse1: false
    },
    player: {
        blockType: 0,
        isDrawing: false
    },
    activeTile: 1
};

var gridHeight = Math.ceil(canvas.stage.height / game.gridNodeHeight);
var gridWidth = Math.ceil(canvas.stage.width / game.gridNodeWidth);
var grid = require('./grid')(gridWidth, gridHeight);

var dataTools = require('./data-tools');

function drawGrid(ctx) {
    for (var x = 0; x < gridHeight; x++) {
        ctx.moveTo(0, x * game.gridNodeHeight + 0.5);
        ctx.lineTo(canvas.stage.width, x * game.gridNodeHeight + 0.5);
    }
    for (var y = 0; y < gridWidth; y++) {
        ctx.moveTo(y * game.gridNodeWidth + 0.5, 0);
        ctx.lineTo(y * game.gridNodeWidth + 0.5, canvas.stage.height);
    }

    ctx.strokeStyle = '#333333';
    ctx.stroke();
}
drawGrid(ctx.grid);

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

    game.mouse.shift = event.shiftKey;
    game.mouse.meta = event.metaKey;
    game.mouse.ctrl = event.ctrlKey;
    game.mouse.alt = event.altKey;
}

var toggleDirs = [grid.direction.W, grid.direction.E, grid.direction.SW, grid.direction.SE];

var TILE_NONE = 0;
var TILE_BLOCK = 1;
var TILE_WATER = 2;
var TILE_OIL = 3;

var tiles = [];
tiles[TILE_NONE] = {
    color: 'black'
};
tiles[TILE_BLOCK] = {
    color: 'gray',
    density: Infinity,
    fixed: true,
    fluid: false,
    draw: function (ctx, coords, tile) {
        var screenCoords = gridToScreenCoords(coords);
        ctx.fillStyle = tiles[tile[dataTools.DATA_TYPE]].color;
        ctx.fillRect(screenCoords[0], screenCoords[1], game.gridNodeWidth, game.gridNodeHeight);
    }
};
tiles[TILE_WATER] = {
    color: 'lightblue',
    density: 1.0,
    fixed: false,
    fluid: true,
    colors: [
        '#74ccf4',
        '#74ccf4',
        '#5abcd8',
        '#1ca3ec',
        '#1ca3ec',
        '#2389da',
        '#2389da',
        '#0f5e9c'
    ],
    update: function (coords, tile, neighbors, grid) {
        var target;
        var ds = [grid.directions[grid.direction.S], grid.directions[toggleDirs[2 + game.tick % 2]], grid.directions[toggleDirs[2 + (game.tick + 1) % 2]]];
        for (var i = 0; i < ds.length; i++) {
            target = grid.add(coords, ds[i]);
            if (canSwap(coords, target)) {
                grid.flipUpdated(coords);
                grid.swap(coords, target);

                return;
            }
        }

        var neighbor = [];
        dataTools.unpack(neighbors[grid.direction.N], neighbor);
        if (neighbor[dataTools.DATA_TYPE] === TILE_WATER) {
            for (i = 0; i < 2; i++) {
                if (canSwap(coords, grid.add(coords, grid.directions[toggleDirs[(game.tick + i) % 2]]))) {
                    grid.flipUpdated(coords);
                    grid.swap(coords, grid.add(coords, grid.directions[toggleDirs[(game.tick + i) % 2]]));

                    return;
                }
            }

            tile[dataTools.DATA_PRESSURE] = Math.min(7, neighbor[dataTools.DATA_PRESSURE] + 1);
            grid.put(coords, dataTools.pack(tile));
        } else {
            var neighborPressure = 0;

            dataTools.unpack(neighbors[grid.direction.W], neighbor);
            if (neighbor[dataTools.DATA_TYPE] === TILE_WATER) {
                neighborPressure += neighbor[dataTools.DATA_PRESSURE];
            }
            dataTools.unpack(neighbors[grid.direction.E], neighbor);
            if (neighbor[dataTools.DATA_TYPE] === TILE_WATER) {
                neighborPressure += neighbor[dataTools.DATA_PRESSURE];
            }

            tile[dataTools.DATA_PRESSURE] = Math.floor(neighborPressure / 2);
            grid.put(coords, dataTools.pack(tile));

            dataTools.unpack(neighbors[grid.direction.S], neighbor);
            if (neighbor[dataTools.DATA_TYPE] === TILE_WATER && !neighbor[dataTools.DATA_STATIC]) {
                var targetLoc = grid.add(coords, grid.directions[grid.direction.S]);
                var check = [];

                var result = grid.floodFill(targetLoc, function (loc) {
                    if (loc[1] < coords[1]) {
                        return grid.floodFill.SKIP;
                    }

                    dataTools.unpack(grid.peek(loc), check);
                    if (check[dataTools.DATA_TYPE] === TILE_BLOCK) {
                        return grid.floodFill.SKIP;
                    } else if (check[dataTools.DATA_TYPE] === TILE_NONE) {
                        grid.swap(coords, loc);
                        return grid.floodFill.ABORT;
                    }
                });

                if (result === grid.floodFill.END) {
                    grid.flipStatic(targetLoc);
                }
            }
        }

        if (neighbors[grid.direction.S] === null) {
            grid.clear(coords);
        }
    },
    draw: function (ctx, coords, tile) {
        var screenCoords = gridToScreenCoords(coords);
        ctx.fillStyle = tiles[tile[dataTools.DATA_TYPE]].colors[tile[dataTools.DATA_PRESSURE]];
        ctx.fillRect(screenCoords[0], screenCoords[1], game.gridNodeWidth, game.gridNodeHeight);
    }
};
tiles[TILE_OIL] = {
    color: 'purple',
    density: 0.8,
    fixed: false,
    fluid: true,
    update: function (coords, tile, neighbors, grid) {},
    draw: function (ctx, coords, tile) {
        var screenCoords = gridToScreenCoords(coords);
        ctx.fillStyle = tiles[tile[dataTools.DATA_TYPE]].colors[tile[dataTools.DATA_PRESSURE]];
        ctx.fillRect(screenCoords[0], screenCoords[1], game.gridNodeWidth, game.gridNodeHeight);
    }
};

function processInput () {
    if (game.mouse.mouse1) {
        game.player.isDrawing = game.activeTile;
    } else {
        game.player.isDrawing = false;
    }
}
function handleKeyboardInput(event){
    //Saves the current map when ctrl-s is pressed
    if(event.ctrlKey && String.fromCharCode(event.which).toLowerCase() === 's'){
        event.preventDefault();
        serveSaveFile();
    }
    //Check for up arrow to update active tile
    if(event.keyCode === 38){
        if(game.activeTile == tiles.length -1){
            game.activeTile = 0;
        }
        else{
            game.activeTile++;
        }
    }
    // Check for down arrow to change active tile
    if(event.keyCode === 40){
        if(game.activeTile === 0){
            game.activeTile = tiles.length -1;
        }
        else{
            game.activeTile--;
        }
    }
}

canvas.stage.addEventListener('mousemove', handleMouseInput);
canvas.stage.addEventListener('mousedown', handleMouseInput);
canvas.stage.addEventListener('mouseup', handleMouseInput);
window.addEventListener('keydown',handleKeyboardInput);

function canSwap (source, target) {
    if (!grid.inBounds(source) || !grid.inBounds(target)) {
        return false;
    }
    var s = [];
    var t = [];
    dataTools.unpack(grid.peek(source), s);
    dataTools.unpack(grid.peek(target), t);
    return t[dataTools.DATA_TYPE] === TILE_NONE || tiles[t[dataTools.DATA_TYPE]].density < tiles[s[dataTools.DATA_TYPE]].density;
}

var scratch = [];
function update (dt) {
    var gridCoords = screenToGridCoords(game.mouse.position);
    if (game.player.isDrawing !== false) {
        if (game.player.isDrawing === 0 || dataTools.unpack(grid.peek(gridCoords), scratch)[dataTools.DATA_TYPE] === 0) {
            grid.put(gridCoords, dataTools.pack([game.player.isDrawing, 0, 0, 0, (game.tick + 1) % 2]));
        }
    }

    var tile = [];
    var neighbors = [];
    for (var y = grid.length - 1; y >= 0; y--) {
        for (var x = grid[y].length - 1; x >= 0; x--) {
            var coords = [x, y];

            dataTools.unpack(grid.peek(coords), tile);

            if (tile[dataTools.DATA_UPDATED] === game.tick % 2 || tile[dataTools.DATA_TYPE] === TILE_NONE || tiles[tile[dataTools.DATA_TYPE]].fixed) {
                continue;
            }

            tiles[tile[dataTools.DATA_TYPE]].update(coords, tile, grid.neighbors(coords, neighbors), grid);
        }
    }
}

function render (t) {
    ctx.stage.fillStyle = 'black';
    ctx.stage.fillRect(0, 0, canvas.stage.width, canvas.stage.height);

    var tile = [];
    for (var y = 0; y < grid.length; y++) {
        for (var x = 0; x < grid[y].length; x++) {
            dataTools.unpack(grid.peek([x, y]), tile);
            if (tile[dataTools.DATA_TYPE] !== TILE_NONE) {
                tiles[tile[dataTools.DATA_TYPE]].draw(ctx.stage, [x, y], tile);
            }
        }
    }

    var coords = screenToGridCoords(game.mouse.position);
    var screenCoords = gridToScreenCoords(coords);  // drawing the cursor aligned to the grid square

    ctx.ui.clearRect(0, 0, canvas.ui.width, canvas.ui.height);
    ctx.ui.fillStyle = tiles[game.activeTile].color;
    ctx.ui.fillRect(screenCoords[0], screenCoords[1], game.gridNodeWidth, game.gridNodeHeight);
    ctx.ui.fillStyle = 'white';
    ctx.ui.fillText('FPS: ' + fps.toFixed(2), 15, canvas.ui.height - 15);
    ctx.ui.fillText('Grid Coords: (' + coords[0] + ',' + coords[1] + ')', 15, canvas.ui.height - 30);
}

function serveSaveFile(){
    var a = window.document.createElement('a');
    a.href = window.URL.createObjectURL(new Blob([JSON.stringify(grid)],{type:'application/json'}));
    a.download = 'grid.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}
function loadGridFromFile(file){
    var reader = new FileReader();
    reader.onerror = function(err){
        alert(err.message);
    };
    reader.onloadend = function(event){
        window.cancelAnimationFrame(gameAnimationFrame);
        var loadedGrid = JSON.parse(event.target.result);
        for(var i = 0; i < loadedGrid.length; i++){
            for(var j = 0; j < Object.keys(loadedGrid[i]).length; j++){
                grid[i][j] = loadedGrid[i][j];
            }
            if(i == loadedGrid.length -1) {
                render();
                gameAnimationFrame = window.requestAnimationFrame(gameLoop);
            }
        }

    };
    reader.readAsText(file);
}

document.addEventListener('dragover',function(evt) {
    evt.stopPropagation();
    evt.preventDefault();
    evt.dataTransfer.dropEffect = 'copy'; // Explicitly show this is a copy.
},false);
document.addEventListener('drop',function(evt) {
    evt.stopPropagation();
    evt.preventDefault();
    var files = evt.dataTransfer.files;
    loadGridFromFile(files[0]);
}, false);