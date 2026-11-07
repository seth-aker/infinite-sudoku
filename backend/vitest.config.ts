import { fileURLToPath } from 'node:url'
import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      "@": new URL('./src', import.meta.url).pathname,
      "#test": new URL('./test', import.meta.url).pathname,
    }
  },
  test: {
    include: ['test/**/*.test.ts'],
    exclude: [...configDefaults.exclude],
    root: fileURLToPath(new URL('./', import.meta.url)),
    setupFiles: ['./test/setup.ts'],
    clearMocks: true,
    restoreMocks: true,
    unstubEnvs: true,
    env: {
      NODE_ENV: 'test',
      DOTENV_CONFIG_QUIET: 'true',
      PORT: '0',
      DB_CONNECTION_STRING: 'postgres://test:test@localhost:5432/test',
      JWT_SECRET: 'test-jwt-secret-that-is-long-enough-for-hs256',
      SESSION_SECRET: 'test-session-secret',
      SES_ACCESS_KEY_ID: 'test-ses-access-key-id',
      SES_SECRET_ACCESS_KEY: 'test-ses-secret-access-key',
      ORIGIN: 'http://origin.test',
      ISSUER: 'http://issuer.test',
      AUDIENCE: 'http://audience.test',
      ROOT_DIR: '/root/dir',
      WORKER_PATH: '/worker/path.ts',
      LOG_LEVEL: 'silent',
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/action_migration.ts'],
      reporter: ['text', 'html', 'json-summary'],
    },
  },
})
