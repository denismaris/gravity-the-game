// Jest stand-in for the native haptics module - tests assert on calls,
// never on the device motor.
module.exports = {
  trigger: jest.fn(),
  triggerPattern: jest.fn(),
  stop: jest.fn(),
  impact: jest.fn(),
  isSupported: jest.fn(() => true),
  setEnabled: jest.fn(),
  isEnabled: jest.fn(() => true),
};
