var vec2 = require('gl-matrix').vec2;
var seedrandom = require('seedrandom');

var canvas = {
    stage: document.getElementById('stage'),
    grid: document.getElementById('grid'),
    ui: document.getElementById('ui'),
    debug: document.getElementById('debug')
};

var ctx = {
    stage: canvas.stage.getContext('2d'),
    grid: canvas.grid.getContext('2d'),
    ui: canvas.ui.getContext('2d'),
    debug: canvas.debug.getContext('2d')
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

var fps = 60;
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
    drawTile: 1,
    isDrawing: true,
    rng: seedrandom(Date.now())
};

var gridHeight = Math.ceil(canvas.stage.height / game.gridNodeHeight);
var gridWidth = Math.ceil(canvas.stage.width / game.gridNodeWidth);
var gridFab = require('./grid');
var grid = gridFab(gridWidth, gridHeight, Uint16Array);
var heatMap = gridFab(gridWidth, gridHeight, Uint16Array);

var fs = require('fs');
var stripJsonComments = require('strip-json-comments');
var tileset = JSON.parse(stripJsonComments(fs.readFileSync(__dirname + '/../data/tiles.json', 'utf8')));

var roomTemp = tileset.air.baseTemperature;

for (var y = 0; y < heatMap.length; y++) {
    for (var x = 0; x < heatMap[y].length; x++) {
        heatMap[y][x] = roomTemp;
    }
}

var tileLookup = [];
for (var tileName in tileset) {
    if (tileset.hasOwnProperty(tileName)) {
        tileLookup[tileset[tileName].id] = tileName;
        if (tileset[tileName].density === -1) {
            tileset[tileName].density = Infinity;
        }
    }
}
var tileCount = tileLookup.length;

tileset.fromID = function (id) {
    return tileset[tileLookup[id]];
};

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
    if (game.mouse.mouse1) {
        game.isDrawing = true;
    } else {
        game.isDrawing = false;
    }

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
    game.rng = seedrandom(loop.tick);

    if (game.isDrawing) {
        var gridCoords = screenToGridCoords(game.mouse.position);
        var target = tileset.fromID(grid.get(gridCoords));
        var toDraw = tileset.fromID(game.drawTile);

        if (tileLookup[target.id] === 'air' || toDraw.density > target.density || tileLookup[toDraw.id] === 'air') {
            grid.put(gridCoords, toDraw.id);
            delete staticTiles[gridCoords.toString()];
        }
    }

    var neighbors = [];
    for (var y = grid.length - 1; y >= 0; y--) {
        for (var x = 0; x < grid[y].length; x++) {
            var coords = [x, y];
            var tile = tileset.fromID(grid.get(coords));

            processTile(coords, tile);
        }
    }
}

function applyThermalActivity (coords, tile, neighbors) {
    var currentTemp = heatMap.get(coords);
    var i;

    if (tile.traits.indexOf('heater') !== -1) {
        currentTemp = Math.min(currentTemp * 1.05, tile.baseTemperature);
        heatMap.set(coords, currentTemp);

        var neighborTemp;
        for (i = 0; i < neighbors.length; i++) {
            if (neighbors[i] === null) { continue; }

            neighborTemp = heatMap.get(neighbors[i]);
            neighborTemp = Math.min(neighborTemp + currentTemp * 0.05, tile.baseTemperature);
            heatMap.set(neighbors[i], neighborTemp);
        }
    } else if (tile.traits.indexOf('cooler') !== -1) {
        // TODO implement me
    } else {
        var sigmaTemp = currentTemp * 0.8;

        var n = 1;
        for (i = 0; i < neighbors.length; i++) {
            if (neighbors[i] === null) { continue; }

            sigmaTemp += heatMap.get(neighbors[i]);
            n++;
        }

        heatMap.set(coords, Math.max(sigmaTemp / n, roomTemp));
    }
}

var pendingGlobals = [];
function processTile (coords, tile) {
    var neighbors = grid.neighbors(coords, []);

    if (loop.tick % 2 === 0) {
        applyThermalActivity(coords, tile, neighbors);
    }

    if (tile.traits.indexOf('empty') !== -1 || tile.traits.indexOf('immobile') !== -1) {
        return;
    }

    var actions = getTileActions(coords, tile, neighbors);
    var action = selectTileAction(tile, actions)[1];

    applyTileAction(coords, tile, neighbors, action);
    applyDensitySwap(coords, tile, neighbors);
    applyGlobalAction(pendingGlobals);
}

var staticTiles = {};

function structuralCollapseCheck (start, loc) {
    var screenCoords = gridToScreenCoords(loc);
    var target = tileset.fromID(grid.get(loc));
    var out = [];

    if (staticTiles[loc.toString()]) { return grid.floodFill.SKIP; }

    if (target.traits.indexOf('structural') === -1) {
        if (target.traits.indexOf('solid') !== -1) {
            vec2.subtract(out, loc, start);
            if (out[1] >= out[0]) {
                return grid.floodFill.ABORT;
            }
        } else {
            return grid.floodFill.SKIP;
        }
    }
}

function pressureFlowCheck (start, loc) {
    var screenCoords = gridToScreenCoords(loc);

    if (loc[1] < start[1]) {
        return grid.floodFill.SKIP;
    }

    var target = tileset.fromID(grid.get(loc));

    if (target.traits.indexOf('empty') !== -1) {
        grid.swap(start, loc);

        return grid.floodFill.ABORT;
    } else if (target.traits.indexOf('liquid') === -1) {
        return grid.floodFill.SKIP;
    }
}

function applyGlobalAction (pendingActions) {
    var action;
    var result;
    var neighbors = [];
    for (var i = 0; i < pendingActions.length; i++) {
        action = pendingActions[i];
        grid.neighbors(action[0], neighbors);

        if (action[1] === 'structural-collapse') {
            var sNeighbor = neighbors[grid.direction.S];

            if (sNeighbor !== null && staticTiles[sNeighbor.toString()]) { continue; }

            result = grid.floodFill(action[0], structuralCollapseCheck.bind(null, action[0]));
            if (result === grid.floodFill.END && sNeighbor !== null &&
                tileset[tileLookup[grid.get(sNeighbor)]].traits.indexOf('empty') !== -1) {
                grid.swap(action[0], sNeighbor);
                delete staticTiles[action[0].toString()];
                delete staticTiles[sNeighbor.toString()];
            } else {
                staticTiles[action[0].toString()] = true;
                // if (sNeighbor !== null) {
                //     staticTiles[sNeighbor.toString()] = true;
                // }
            }
        } else if (action[1] === 'pressure-flow') {
            if (staticTiles[neighbors[grid.direction.S].toString()]) { continue; }

            result = grid.floodFill(action[0], pressureFlowCheck.bind(null, action[0]));
            if (result === grid.floodFill.END) {
                staticTiles[neighbors[grid.direction.S].toString()] = true;
                staticTiles[action[0].toString()] = true;
            }
        }
    }
    pendingActions.length = 0;
}

function applyDensitySwap (coords, tile, neighbors) {
    var sNeighbor = grid.get(neighbors[grid.direction.S]);
    var sTile = tileset.fromID(sNeighbor);
    if (sNeighbor !== null && tileset.fromID(sTile.id).traits.indexOf('empty') === -1 && tile.density > sTile.density) {
        grid.swap(coords, neighbors[grid.direction.S]);
    }
}

function applyTileAction (coords, tile, neighbors, action) {
    if (action.indexOf('swap-') !== -1) {
        var dir = action.split('-')[1].toUpperCase();
        grid.swap(coords, neighbors[grid.direction[dir]]);
        delete staticTiles[coords.toString()];
        delete staticTiles[neighbors[grid.direction[dir].toString()]];
    } else if (action === 'clear') {
        grid.clear(coords);
    }
}

function getTileActions (coords, tile, neighbors) {
    var actions = [];

    if (tile.traits.indexOf('liquid') !== -1 || tile.traits.indexOf('viscous') !== -1) {
        var scheduledMove = false;

        if (neighbors[grid.direction.S] !== null &&
            tileset.fromID(grid.get(neighbors[grid.direction.S])).traits.indexOf('empty') !== -1) {
            scheduledMove = true;
            actions.push([0.9, 'swap-s']);
        }

        if (neighbors[grid.direction.SW] !== null &&
            tileset.fromID(grid.get(neighbors[grid.direction.W])).traits.indexOf('empty') !== -1 &&
            tileset.fromID(grid.get(neighbors[grid.direction.SW])).traits.indexOf('empty') !== -1) {
            scheduledMove = true;
            actions.push([0.025, 'swap-sw']);
        }

        if (neighbors[grid.direction.SW] !== null &&
            tileset.fromID(grid.get(neighbors[grid.direction.E])).traits.indexOf('empty') !== -1 &&
            tileset.fromID(grid.get(neighbors[grid.direction.SE])).traits.indexOf('empty') !== -1) {
            scheduledMove = true;
            actions.push([0.025, 'swap-se']);
        }

        if (neighbors[grid.direction.N] !== null &&
            tileset.fromID(grid.get(neighbors[grid.direction.NE])).traits.indexOf('fluid') !== -1) {
            if (tileset.fromID(grid.get(neighbors[grid.direction.W])).traits.indexOf('empty') !== -1) {
                scheduledMove = true;
                actions.push([0.25, 'swap-w']);
            }

            if (tileset.fromID(grid.get(neighbors[grid.direction.E])).traits.indexOf('empty') !== -1) {
                scheduledMove = true;
                actions.push([0.25, 'swap-e']);
            }
        }

        if (!scheduledMove && neighbors[grid.direction.S] !== null) {
            pendingGlobals.push([coords, 'pressure-flow']);
        }
    }

    /*
     * Particulate tiles fall pretty much like you'd expect, including diagonally if they can
     */
    if (tile.traits.indexOf('particulate') !== -1) {
        if (neighbors[grid.direction.S] !== null &&
            tileset.fromID(grid.get(neighbors[grid.direction.S])).traits.indexOf('empty') !== -1) {
            actions.push([0.9, 'swap-s']);
        }

        if (neighbors[grid.direction.SW] !== null &&
            tileset.fromID(grid.get(neighbors[grid.direction.W])).traits.indexOf('empty') !== -1 &&
            tileset.fromID(grid.get(neighbors[grid.direction.SW])).traits.indexOf('empty') !== -1) {
            actions.push([0.0001, 'swap-sw']);
        }

        if (neighbors[grid.direction.SE] !== null &&
            tileset.fromID(grid.get(neighbors[grid.direction.E])).traits.indexOf('empty') !== -1 &&
            tileset.fromID(grid.get(neighbors[grid.direction.SE])).traits.indexOf('empty') !== -1) {
            actions.push([0.0001, 'swap-se']);
        }
    }

    /*
     * Structural tiles can form arches if there is another structural tile near
     * them. If they don't fall, they trigger a global check: they collapse if
     * they're further out than up from a grounded structural tile (one with a
     * solid tile beneath it)
     */
    if (tile.traits.indexOf('structural') !== -1) {
        if (neighbors[grid.direction.S] !== null &&
            tileset.fromID(grid.get(neighbors[grid.direction.S])).traits.indexOf('empty') !== -1 &&
            tileset.fromID(grid.get(neighbors[grid.direction.W])).traits.indexOf('structural') === -1 &&
            tileset.fromID(grid.get(neighbors[grid.direction.E])).traits.indexOf('structural') === -1 &&
            tileset.fromID(grid.get(neighbors[grid.direction.SW])).traits.indexOf('structural') === -1 &&
            tileset.fromID(grid.get(neighbors[grid.direction.SE])).traits.indexOf('structural') === -1) {
            actions.push([0.9, 'fall-s']);
        } else if (tileset.fromID(grid.get(neighbors[grid.direction.W])).traits.indexOf('structural') === -1 ||
            tileset.fromID(grid.get(neighbors[grid.direction.E])).traits.indexOf('structural') === -1 ||
            tileset.fromID(grid.get(neighbors[grid.direction.SW])).traits.indexOf('structural') === -1 ||
            tileset.fromID(grid.get(neighbors[grid.direction.SE])).traits.indexOf('structural') === -1) {
            pendingGlobals.push([coords, 'structural-collapse']);
        }
    }

    if (tile.traits.indexOf('gas') !== -1) {
        actions.push([0.25, 'noop']);

        if (neighbors[grid.direction.N] !== null &&
            tileset.fromID(grid.get(neighbors[grid.direction.N])).traits.indexOf('empty') !== -1) {
            actions.push([0.9, 'swap-n']);
        }

        if (neighbors[grid.direction.NW] !== null &&
            tileset.fromID(grid.get(neighbors[grid.direction.NW])).traits.indexOf('empty') !== -1) {
            actions.push([0.05, 'swap-nw']);
        }

        if (neighbors[grid.direction.NE] !== null &&
            tileset.fromID(grid.get(neighbors[grid.direction.NE])).traits.indexOf('empty') !== -1) {
            actions.push([0.05, 'swap-ne']);
        }
    }

    if (actions.length === 0 && neighbors[grid.direction.S] === null) {
        actions.push([1, 'clear']);
    } else if (actions.length === 0) {
        actions.push([1, 'noop']);
    }

    return actions;
}

function selectTileAction (tile, actions) {
    if (actions.length === 1 && actions[0][1] === 'noop') {
        return actions[0];
    }

    var threshold = game.rng();
    var sigmaP = 0;
    for (var i = 0; i < actions.length; i++) {
        sigmaP += actions[i][0];
    }
    var weight = 0;

    for (i = 0; i < actions.length; i++) {
        weight += actions[i][0] / sigmaP;
        if (threshold < weight) {
            return actions[i];
        }
    }
}

function drawUI (t) {
    var coords = screenToGridCoords(game.mouse.position);
    var screenCoords = gridToScreenCoords(coords);  // drawing the cursor aligned to the grid square

    ctx.ui.clearRect(0, 0, canvas.ui.width, canvas.ui.height);

    ctx.ui.fillStyle = tileset[tileLookup[game.drawTile]].color;
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
        var tile = tileset[tileLookup[i]];
        ctx.ui.fillStyle = tile.color;

        ctx.ui.beginPath();
        ctx.ui.rect(switcherX + switcherTileSize * i + (switcherPadding / 4 * i), switcherY + switcherTileSize / 2, switcherTileSize, switcherTileSize);
        ctx.ui.fill();
        if (game.drawTile === i) {
            ctx.ui.stroke();
        }
    }

    ctx.ui.fillStyle = 'white';
    ctx.ui.fillText('Current tile: ' + tileLookup[game.drawTile] + " " + JSON.stringify(tileset.fromID(game.drawTile).traits), switcherX, switcherY + switcherHeight + switcherPadding / 2);
}

function render (t) {
    var coords = [];

    ctx.stage.fillStyle = 'black';
    ctx.stage.fillRect(0, 0, canvas.stage.width, canvas.stage.height);

    for (var y = 0; y < grid.length; y++) {
        for (var x = 0; x < grid[y].length; x++) {
            coords[0] = x;
            coords[1] = y;

            var screenCoords = gridToScreenCoords(coords);

            var tile = tileset.fromID(grid.get(coords));

            var temp = heatMap.get(coords);
            if (temp > roomTemp) {
                ctx.stage.fillStyle = 'rgba(255, 0, 0, ' + (1 - roomTemp / temp) + ')';
                ctx.stage.fillRect(screenCoords[0], screenCoords[1], game.gridNodeWidth, game.gridNodeHeight);
            }

            if (tileLookup[tile.id] === 'air') { continue; }

            ctx.stage.fillStyle = tile.color;

            ctx.stage.fillRect(screenCoords[0], screenCoords[1], game.gridNodeWidth, game.gridNodeHeight);
        }
    }
}
