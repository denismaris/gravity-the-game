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
  Path: makeStub('SkiaPathMock'),
  // Paint-effect children (a gradient/dash pattern nested inside a shape,
  // never rendered on their own) - added for Binairo's board, the first
  // board view whose smoke test needed them. Same plain stand-in as
  // everything else here: enough to exist as a valid element type so the
  // tree renders, nothing about the effect itself is under test.
  LinearGradient: makeStub('SkiaLinearGradientMock'),
  RadialGradient: makeStub('SkiaRadialGradientMock'),
  DashPathEffect: makeStub('SkiaDashPathEffectMock'),
  vec: (x, y) => ({ x, y }),
  rect: (x, y, width, height) => ({ x, y, width, height }),
  rrect: (r, rx, ry) => ({ rect: r, rx, ry }),
  // Pre-built path objects (Bloom's board parses each path once per move
  // rather than per frame). The mock hands the SVG string back, which is
  // all a test renderer needs to compare.
  Skia: { Path: { MakeFromSVGString: svg => ({ svg }) } },
};
