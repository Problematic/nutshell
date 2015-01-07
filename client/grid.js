module.exports = function (width, height) {
    var grid = new Array(height);
    grid.width = width;
    grid.height = height;

    for (var i = 0; i < width; i++) {
        grid[i] = new Uint16Array(width);
    }

    grid.swap = function swap (source, target) {
        var tmp = this[source[1]][source[0]];
        this[source[1]][source[0]] = this[target[1]][target[0]];
        this[target[1]][target[0]] = tmp;

        // clear static flags, if any
        tmp &= ~(1 << 1);
        this[source[1]][source[0]] &= ~(1 << 1);
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
        return coords[0] >= 0 && coords[0] < this.width && coords[1] >= 0 && coords[1] < this.height;
    };

    grid.directions = [
    [-1, -1],   // NW
    [0, -1],    // N
    [1, -1],    // NE
    [1, 0],     // E
    [1, 1],     // SE
    [0, 1],     // S
    [-1, 1],    // SW
    [-1, 0]     // W
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
    grid.neighbors = function neighbors (coords, out) {
        if (!out) {
            throw new Error('Must provide an out array to neighbors');
        }

        for (var i = 0; i < this.directions.length; i++) {
            var dir = [ coords[0] + grid.directions[i][0], coords[1] + grid.directions[i][1] ];
            if (this.inBounds(dir)) {
                out[i] = this.peek(dir);
            } else {
                out[i] = null;
            }
        }
        return out;
    };

    grid.neighborCoords = function neighborCoords (coords) {
        var neighbors = [];
        for (var i = 0; i < this.directions.length; i++) {
            var dir = [ coords[0] + grid.directions[i][0], coords[1] + grid.directions[i][1] ];
            if (this.inBounds(dir)) {
                neighbors[i] = dir;
            } else {
                neighbors[i] = null;
            }
        }
        return neighbors;
    };

    grid.floodFill = function floodFill (start, process) {
        var queue = [start];
        var processed = [];
        var current;
        var status = this.floodFill.CONTINUE;
        var neighbors;

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
            neighbors = this.neighborCoords(current);
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

    grid.add = function add (coords, vec) {
        if (!(coords instanceof Array) || !(vec instanceof Array)) {
            throw new Error('coords and addition vector must be an array');
        }
        return [coords[0] + vec[0], coords[1] + vec[1]];
    };

    grid.flipUpdated = function flipUpdated (coords) {
        grid.put(coords, grid.peek(coords) ^ 1);
    };

    grid.flipStatic = function flipStatic (coords) {
        grid.put(coords, grid.peek(coords) ^ 2);
    };


    return grid;
};
