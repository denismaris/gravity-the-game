/* eslint-env jest */
// Tests never reach the real backend, whatever src/backend/config.ts holds:
// the app runs offline in every test unless one mocks the client itself.
jest.mock('./src/backend/config', () => ({
  BACKEND_CONFIG: { url: '', anonKey: '' },
  backendConfigured: () => false,
}));
