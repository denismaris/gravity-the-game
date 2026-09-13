/**
 * Jest mock for `react-native-sound`.
 *
 * The real module needs a native TurboModule that isn't present under
 * Jest's Node environment. This is a minimal stand-in with the same shape
 * (`sound.ts`'s usage only) so importing `src/game/rendering/sound.ts` -
 * and anything that transitively imports it, e.g. every screen - works in
 * tests without ever touching real audio.
 */
class Sound {
  constructor(_filename, _basePath, onLoad) {
    this._loaded = true;
    if (onLoad) onLoad(null);
  }

  isLoaded() {
    return this._loaded;
  }

  play(onEnd) {
    if (onEnd) onEnd(true);
    return this;
  }

  stop(callback) {
    if (callback) callback();
    return this;
  }

  release() {
    return this;
  }

  setVolume() {
    return this;
  }
}

Sound.MAIN_BUNDLE = '';
Sound.DOCUMENT = '';
Sound.LIBRARY = '';
Sound.CACHES = '';
Sound.setCategory = () => {};
Sound.setActive = () => {};
Sound.setMode = () => {};

module.exports = Sound;
module.exports.default = Sound;
