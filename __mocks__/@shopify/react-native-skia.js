/**
 * Lightweight Jest mock for `@shopify/react-native-skia`.
 *
 * Skia's real implementation requires a native TurboModule (and, for a
 * fully faithful test double, the canvaskit-wasm binary), neither of which
 * are available under Jest's Node test environment. For our purposes -
 * smoke-testing that the component tree renders without throwing - we only
 * need simple no-op stand-ins for the handful of primitives this project
 * uses.
 */
const React = require('react');

function makeStub(name) {
  const Stub = (props) => React.createElement(name, props, props?.children ?? null);
  Stub.displayName = name;
  return Stub;
}

module.exports = {
  Canvas: makeStub('SkiaCanvasMock'),
  Group: makeStub('SkiaGroupMock'),
  Circle: makeStub('SkiaCircleMock'),
  Rect: makeStub('SkiaRectMock'),
  RoundedRect: makeStub('SkiaRoundedRectMock'),
  vec: (x, y) => ({ x, y }),
};
