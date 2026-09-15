import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        // mongodb-memory-server downloads/boots a real mongod binary on first
        // run, which can take a while — give tests room instead of flaking.
        testTimeout: 30000,
        hookTimeout: 30000,
        // Test-only env vars, set before any test file's imports evaluate —
        // this is what lets authController.js read a valid JWT_SECRET /
        // GOOGLE_CLIENT_ID at module-load time without a real server/.env.
        env: {
            NODE_ENV: 'test',
            JWT_SECRET: 'test-jwt-secret-do-not-use-in-prod',
            GOOGLE_CLIENT_ID: 'test-google-client-id',
        },
    },
});
