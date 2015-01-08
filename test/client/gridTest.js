var expect = require('chai').expect;
var Grid = require('../../client/grid');

describe('grid', function () {
    describe('construction', function () {
        it('should take width, height, and a constructor type', function () {
            var grid = Grid(5, 7, Array);
            expect(grid.width).to.equal(5);
            expect(grid.height).to.equal(7);
            expect(grid[0]).to.be.instanceof(Array);
        });

        it('should allow for typed arrays', function () {
            var grid = Grid(6, 6, Uint16Array);
            expect(grid[0]).to.be.instanceof(Uint16Array);
        });
    });

    describe('instance methods', function () {
        var grid;

        beforeEach(function () {
            grid = Grid(10, 10, Uint8Array);
        });

        describe('#put()', function () {
            it('sets cell value on grid', function () {
                grid.put([5, 3], 42);
                expect(grid[3][5]).to.equal(42);
            });

            it('should be aliased to set()', function () {
                grid.set([1, 1], 5);
                expect(grid.peek([1, 1])).to.equal(5);
            });
        });

        describe('#peek()', function () {
            it('retrieves put values', function () {
                grid.put([2, 2], 10);
                expect(grid.peek([2, 2])).to.equal(10);
            });

            it('should be aliased to get()', function () {
                grid.put([3, 9], 11);
                expect(grid.get([3, 9])).to.equal(11);
            });

            it('should return null if coords are null', function () {
                expect(grid.peek(null)).to.be.null();
            });
        });

        describe('#clear()', function () {
            it('sets cleared cell to 0', function () {
                grid.put([5, 5], 10);
                grid.clear([5, 5]);
                expect(grid.peek([5, 5])).to.equal(0);
            });
        });

        describe('#swap()', function () {
            it('swaps two cell values', function () {
                grid.put([1, 1], 10);
                grid.put([5, 3], 2);
                grid.swap([1, 1], [5, 3]);
                expect(grid.peek([1, 1])).to.equal(2);
                expect(grid.peek([5, 3])).to.equal(10);
            });

            it('can swap with an empty cell', function () {
                grid.put([2, 2], 13);
                grid.swap([2, 2], [1, 1]);
                expect(grid.peek([2, 2])).to.equal(0);
                expect(grid.peek([1, 1])).to.equal(13);
            });
        });

        describe('#inBounds()', function () {
            it('returns false when coordinates are out of grid bounds', function () {
                expect(grid.inBounds([15, 15])).to.be.false();
            });

            it('returns true when coordinates are within grid bounds', function () {
                expect(grid.inBounds([2, 2])).to.be.true();
            });

            it('returns false if one dimension is in bounds and one is out', function () {
                expect(grid.inBounds([2, 15])).to.be.false();
            });
        });

        describe('#neighbors()', function () {
            it('returns coordinates for 8 adjacent cells', function () {
                var neighbors = [];
                grid.neighbors([5, 5], neighbors);
                expect(neighbors.length).to.equal(8);
            });

            it('returns correct coordinate values', function () {
                var neighbors = [];
                grid.neighbors([5, 5], neighbors);

                expect(neighbors[0]).to.deep.equal([4, 4]);  // NW
                expect(neighbors[1]).to.deep.equal([5, 4]);  // N
                expect(neighbors[2]).to.deep.equal([6, 4]);  // NE
                expect(neighbors[3]).to.deep.equal([6, 5]);  // E
                // TODO finish these
            });
        });
    });
});
