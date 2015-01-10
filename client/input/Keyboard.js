function Keyboard (el) {
    this._addListeners(el);

    this._keyState = {};
    this._firstChecked = {};
    this._preventDefaultOn = [
        Keyboard.Keymap.TAB
    ];
}

Keyboard.Keymap = Keyboard.prototype.Keymap = require('./keymap');

Keyboard.prototype.isKeyDown = function (keycode) {
    return !!this._keyState[keycode];
};

Keyboard.prototype.isKeyFirstDown = function (keycode) {
    if (!this._keyState[keycode] || this._firstChecked[keycode]) {
        return false;
    }

    this._firstChecked[keycode] = true;
    return true;
};

Keyboard.prototype._handleInput = function (event) {
    this._keyState[event.which] = event.type === 'keydown';

    if (event.type === 'keyup') {
        delete this._firstChecked[event.which];
    }

    if (this._preventDefaultOn.indexOf(event.which) !== -1) {
        event.preventDefault();
    }
};

Keyboard.prototype._addListeners = function (element) {
    element.addEventListener('keydown', this._handleInput.bind(this));
    element.addEventListener('keyup', this._handleInput.bind(this));
};

module.exports = Keyboard;
