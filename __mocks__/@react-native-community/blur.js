// The native blur views have no JS-only form: in tests they are plain Views
// that keep their props, so a test can see a blur was asked for.
const React = require('react');
const { View } = require('react-native');

const BlurView = React.forwardRef((props, ref) => React.createElement(View, { ...props, ref, testID: props.testID ?? 'blur-view' }));
const VibrancyView = BlurView;

module.exports = { BlurView, VibrancyView };
