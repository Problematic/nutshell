module.exports = {
    DATA_TYPE: 0,
    DATA_TEMP: 1,
    DATA_PRESSURE: 2,
    DATA_STATIC: 3,
    DATA_UPDATED: 4,

    pack: function pack (vals) {
        // array of format [T, -, P, S, U]
        // packs to a 16-bit number, in the following format:
        // TTTT TTTT ---P PPSU
        // where T = tile type, - = unused, S = static, U = last updated

        if (!Array.isArray(vals)) {
            throw new Error('vals must be an array');
        }
        if (vals.length !== 5) {
            throw new Error('vals must contain 5 elements');
        }

        var packed = (vals[this.DATA_TYPE] << 8 | vals[this.DATA_TEMP] << 5 | vals[this.DATA_PRESSURE] << 2 | vals[this.DATA_STATIC] << 1 | vals[this.DATA_UPDATED]);
        return packed;
    },

    unpack: function unpack (packed, out) {
        out[this.DATA_TYPE] = packed >> 8;
        out[this.DATA_TEMP] = (packed >> 5) & 7;
        out[this.DATA_PRESSURE] = (packed >> 2) & 7;
        out[this.DATA_STATIC] = (packed >> 1) & 1;
        out[this.DATA_UPDATED] = packed & 1;

        out.packedValue = packed;

        return out;
    },

    flipUpdated: function flipUpdated (value) {
        return value ^ 1;
    },

    flipStatic: function flipStatic (value) {
        return value ^ 2;
    }
};
