var vec2 = require('gl-matrix').vec2;

module.exports = function (width, height, ArrayConstructor) {
    var grid = new Array(height);
    grid.width = width;
    grid.height = height;

    for (var i = 0; i < width; i++) {
        grid[i] = new ArrayConstructor(width);
    }

    grid.swap = function swap (source, target) {
        var tmp = this[source[1]][source[0]];
        this[source[1]][source[0]] = this[target[1]][target[0]];
        this[target[1]][target[0]] = tmp;
    };

    grid.peek = function peek (coords) {
        if (coords === null) { return null; }
        return this[coords[1]][coords[0]];
    };
    grid.get = grid.peek;

    grid.put = function put (coords, value) {
        this[coords[1]][coords[0]] = value;
    };
    grid.set = grid.put;

    grid.clear = function clear (coords) {
        this[coords[1]][coords[0]] = 0;
    };

    grid.inBounds = function inBounds (coords) {
        return coords[0] >= 0 && coords[0] < this.width && coords[1] >= 0 && coords[1] < this.height;
    };

    grid.directions = [
        vec2.fromValues(-1, -1),    // NW
        vec2.fromValues(0, -1),     // N
        vec2.fromValues(1, -1),     // NE
        vec2.fromValues(1, 0),      // E
        vec2.fromValues(1, 1),      // SE
        vec2.fromValues(0, 1),      // S
        vec2.fromValues(-1, 1),     // SW
        vec2.fromValues(-1, 0)      // W
    ];
    grid.direction = {
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

    /**
     * Returns the coordinates for cells in the Moore neighborhood of `coords`.
     * Populates `out` with null for cells that are out of bounds.
     * @param {glMatrix.vec2} coords
     * @param {array} out - the reference array to populate with results
     */
    grid.neighbors = function neighbors (coords, out) {
        if (!Array.isArray(out)) {
            throw new Error('Must provide an out array to neighbors');
        }

        for (var i = 0; i < this.directions.length; i++) {
            var dir = [];
            vec2.add(dir, coords, this.directions[i]);
            if (this.inBounds(dir)) {
                out[i] = dir;
            } else {
                out[i] = null;
            }
        }
        return out;
    };

    grid.floodFill = function floodFill (start, process) {
        var queue = [start];
        var processed = [];
        var current;
        var status = this.floodFill.CONTINUE;
        var neighbors = [];

        function isProcessed (coords) {
            for (var i = 0; i < processed.length; i++) {
                if (coords[0] === processed[i][0] && coords[1] === processed[i][1]) {
                    return true;
                }
            }
            return false;
        }

        while (queue.length) {
            current = queue.pop();
            status = process(current);
            if (status === this.floodFill.ABORT) {
                return this.floodFill.ABORT;
            } else if (status === this.floodFill.SKIP) {
                continue;
            }
            processed.push(current);
            this.neighbors(current, neighbors);
            for (var i = 0; i < neighbors.length; i++) {
                if (neighbors[i] === null) { continue; }
                if (!isProcessed(neighbors[i])) {
                    queue.push(neighbors[i]);
                }
            }
        }

        return this.floodFill.END;
    };
    grid.floodFill.ABORT = 0;
    grid.floodFill.PROCESS = 1;
    grid.floodFill.SKIP = 2;
    grid.floodFill.END = 3;

    grid.flipUpdated = function flipUpdated (coords) {
        grid.put(coords, grid.peek(coords) ^ 1);
    };

    grid.flipStatic = function flipStatic (coords) {
        grid.put(coords, grid.peek(coords) ^ 2);
    };

    return grid;
};
