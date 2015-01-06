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
    window.requestAnimationFrame(gameLoop);

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
window.requestAnimationFrame(gameLoop);

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
    }
};

var gridHeight = Math.ceil(canvas.stage.height / game.gridNodeHeight);
var gridWidth = Math.ceil(canvas.stage.width / game.gridNodeWidth);
var grid = new Array(gridHeight);
for (var i = 0; i < Math.ceil(canvas.stage.width / game.gridNodeWidth); i++) {
    grid[i] = new Uint16Array(gridWidth);
}

function pack (vals) {
    // array of format [T, E, P, U]
    // packs to a 16-bit number, in the following format:
    // TTTT TTTT ---- PPPU
    // where T = tile type, - = unused, U = last updated

    if (!(vals instanceof Array)) {
        throw new Error('vals must be an array');
    }

    var packed = (vals[0] << 8 | vals[1] << 4 | vals[2] << 1 | vals[3]);
    return packed;
}

function unpack (packed, out) {
    out[0] = packed >> 8;
    out[1] = (packed >> 4) & 0xf;
    out[2] = (packed >> 1) & 7;
    out[3] = packed & 1;
    out.packedValue = packed;

    return out;
}

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

grid.swap = function swap (source, target) {
    var tmp = this[source[1]][source[0]];
    this[source[1]][source[0]] = this[target[1]][target[0]];
    this[target[1]][target[0]] = tmp;
};

grid.peek = function peek (coords) {
    return this[coords[1]][coords[0]];
};

grid.put = function put (coords, value) {
    this[coords[1]][coords[0]] = value;
};

grid.clear = function clear (coords) {
    this[coords[1]][coords[0]] = 0;
};

grid.inBounds = function inBounds (coords) {
    return coords[0] >= 0 && coords[0] < gridWidth && coords[1] >= 0 && coords[1] < gridHeight;
};

var dirs = [
    [-1, -1],   // NW
    [0, -1],    // N
    [1, -1],    // NE
    [1, 0],     // E
    [1, 1],     // SE
    [0, 1],     // S
    [-1, 1],    // SW
    [-1, 0]     // W
];
var dir = {
    NW: 0,
    N: 1,
    NE: 2,
    E: 3,
    SE: 4,
    S: 5,
    SW: 6,
    W: 7,
    0: 'NW',
    1: 'N',
    2: 'NE',
    3: 'E',
    4: 'SE',
    5: 'S',
    6: 'SW',
    7: 'W'
};
grid.neighbors = function neighbors (coords) {
    var neighbors = [];
    for (var i = 0; i < dirs.length; i++) {
        var dir = [ coords[0] + dirs[i][0], coords[1] + dirs[i][1] ];
        if (this.inBounds(dir)) {
            neighbors[i] = this.peek(dir);
        } else {
            neighbors[i] = null;
        }
    }
    return neighbors;
};

grid.canSwap = function canSwap (source, target) {
    if (!grid.inBounds(source) || !grid.inBounds(target)) {
        return false;
    }
    var s = [];
    var t = [];
    unpack(grid.peek(source), s);
    unpack(grid.peek(target), t);
    return t[DATA_TYPE] === TILE_NONE || tiles[t[DATA_TYPE]].density < tiles[s[DATA_TYPE]].density;
};

grid.add = function add (coords, vec) {
    if (!(coords instanceof Array) || !(vec instanceof Array)) {
        throw new Error('coords and addition vector must be an array');
    }
    return [coords[0] + vec[0], coords[1] + vec[1]];
};

grid.flipUpdated = function flipUpdated (coords) {
    grid.put(coords, grid.peek(coords) ^ 1);
};

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

var toggleDirs = [dir.W, dir.E, dir.SW, dir.SE];

var DATA_TYPE = 0;
var DATA_TEMP = 1;
var DATA_PRESSURE = 2;
var DATA_UPDATED = 3;

var TILE_NONE = 0;
var TILE_BLOCK = 1;
var TILE_WATER = 2;
var TILE_OIL = 3;

var tiles = [];
tiles[TILE_BLOCK] = {
    color: 'gray',
    density: Infinity,
    fixed: true,
    fluid: false,
    draw: function (ctx, coords, tile) {
        var screenCoords = gridToScreenCoords(coords);
        ctx.fillStyle = tiles[tile[DATA_TYPE]].color;
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
        '#2389da',
        '#2389da',
        '#2389da',
        '#2389da'
    ],
    update: function (coords, tile, neighbors, grid) {
        var ds = [dirs[dir.S], dirs[toggleDirs[2 + game.tick % 2]], dirs[toggleDirs[2 + (game.tick + 1) % 2]]];
        for (var i = 0; i < ds.length; i++) {
            var target = grid.add(coords, ds[i]);
            if (grid.canSwap(coords, target)) {
                grid.flipUpdated(coords);
                grid.swap(coords, target);

                return;
            }
        }

        if (neighbors[dir.N] === null) { return; }
        var above = [];
        unpack(neighbors[dir.N], above);
        if (above[DATA_TYPE] === TILE_WATER) {
            for (i = 0; i < 2; i++) {
                if (grid.canSwap(coords, grid.add(coords, dirs[toggleDirs[i]]))) {
                    grid.flipUpdated(coords);
                    grid.swap(coords, grid.add(coords, dirs[toggleDirs[i]]));

                    return;
                }
            }

            tile[DATA_PRESSURE] = Math.min(7, above[DATA_PRESSURE] + 1);
            grid.put(coords, pack(tile));
        }

        if (neighbors[dir.S] === null) {
            grid.clear(coords);
        }
    },
    draw: function (ctx, coords, tile) {
        var screenCoords = gridToScreenCoords(coords);
        ctx.fillStyle = tiles[tile[DATA_TYPE]].colors[tile[DATA_PRESSURE]];
        ctx.fillRect(screenCoords[0], screenCoords[1], game.gridNodeWidth, game.gridNodeHeight);
    }
};
tiles[TILE_OIL] = {
    color: 'purple',
    density: 0.8,
    fixed: false,
    fluid: true,
    update: function (coords, tile, neighbors, grid) {}
};

function processInput () {
    if (game.mouse.mouse1 && game.mouse.meta) {
        game.player.isDrawing = TILE_NONE;
    } else if (game.mouse.mouse1 && game.mouse.shift) {
        game.player.isDrawing = TILE_WATER;
    } else if (game.mouse.mouse1 && game.mouse.ctrl) {
        game.player.isDrawing = TILE_OIL;
    } else if (game.mouse.mouse1) {
        game.player.isDrawing = TILE_BLOCK;
    } else {
        game.player.isDrawing = false;
    }
}
canvas.stage.addEventListener('mousemove', handleMouseInput);
canvas.stage.addEventListener('mousedown', handleMouseInput);
canvas.stage.addEventListener('mouseup', handleMouseInput);

var scratch = [];
function update (dt) {
    var gridCoords = screenToGridCoords(game.mouse.position);
    if (game.player.isDrawing !== false) {
        if (game.player.isDrawing === 0 || unpack(grid.peek(gridCoords), scratch)[DATA_TYPE] === 0) {
            grid.put(gridCoords, pack([game.player.isDrawing, 0, 0, (game.tick + 1) % 2]));
        }
    }

    var tile = [];
    var target = [];
    var tickDirs = [dir.W, dir.E, dir.SW, dir.SE];
    for (var y = grid.length - 1; y >= 0; y--) {
        for (var x = grid[y].length - 1; x >= 0; x--) {
            var coords = [x, y];

            unpack(grid.peek(coords), tile);

            if (tile[DATA_UPDATED] === game.tick % 2 || tile[DATA_TYPE] === TILE_NONE || tiles[tile[DATA_TYPE]].fixed) {
                continue;
            }

            tiles[tile[DATA_TYPE]].update(coords, tile, grid.neighbors(coords), grid);
        }
    }
}

function render (t) {
    ctx.stage.fillStyle = 'black';
    ctx.stage.fillRect(0, 0, canvas.stage.width, canvas.stage.height);

    var tile = [];
    for (var y = 0; y < grid.length; y++) {
        for (var x = 0; x < grid[y].length; x++) {
            unpack(grid.peek([x, y]), tile);
            if (tile[DATA_TYPE] !== TILE_NONE) {
                tiles[tile[DATA_TYPE]].draw(ctx.stage, [x, y], tile);
            }
        }
    }

    var coords = screenToGridCoords(game.mouse.position);
    ctx.ui.clearRect(0, canvas.ui.height - 100, 200, canvas.ui.height);
    ctx.ui.fillStyle = 'white';
    ctx.ui.fillText('FPS: ' + fps.toFixed(2), 15, canvas.ui.height - 15);
    ctx.ui.fillText('Grid Coords: (' + coords[0] + ',' + coords[1] + ')', 15, canvas.ui.height - 30);
}
