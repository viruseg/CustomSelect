import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: 'tests/integration',
    timeout: 15000,
    use: { baseURL: 'http://localhost:5173' },
    webServer: {
        command: 'npm run dev',
        port: 5173,
        reuseExistingServer: true,
    },
    projects: [
        { name: 'chromium', use: { browserName: 'chromium' } },
        { name: 'firefox', use: { browserName: 'firefox' } },
        { name: 'webkit', use: { browserName: 'webkit' } },
    ],
});
