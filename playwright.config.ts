/**
 * SPDX-FileCopyrightText: 2024 Jeff <jeff@example.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright configuration for Nextcloud files_spoilers E2E tests
 *
 * Environment variables:
 * - NEXTCLOUD_URL: Base URL of Nextcloud instance (default: http://localhost:8080)
 * - TEST_USER: Test user username (default: testuser1)
 * - TEST_PASSWORD: Test user password (default: testpass123)
 * - TEST_USER_2: Second test user for multi-user tests (default: testuser2)
 * - TEST_PASSWORD_2: Second test user password (default: testpass123)
 * - ADMIN_USER: Admin username (default: admin)
 * - ADMIN_PASSWORD: Admin password (default: admin)
 */
export default defineConfig({
	testDir: './tests/e2e',
	fullyParallel: false, // Run tests sequentially to avoid state conflicts
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: 1, // Single worker for Nextcloud tests
	reporter: [
		['html', { open: 'never' }],
		['list'],
	],

	use: {
		baseURL: process.env.NEXTCLOUD_URL || 'http://localhost:8080',
		trace: 'on-first-retry',
		screenshot: 'only-on-failure',
		video: 'retain-on-failure',
		actionTimeout: 15000,
		navigationTimeout: 30000,
	},

	projects: [
		// Setup project - creates auth state for test users
		{
			name: 'setup',
			testMatch: /global-setup\.ts/,
		},
		// Main test project
		{
			name: 'chromium',
			use: {
				...devices['Desktop Chrome'],
				storageState: 'tests/e2e/.auth/testuser1.json',
			},
			dependencies: ['setup'],
		},
	],

	// Global timeout for each test
	timeout: 60000,

	// Expect timeout
	expect: {
		timeout: 10000,
	},
})
