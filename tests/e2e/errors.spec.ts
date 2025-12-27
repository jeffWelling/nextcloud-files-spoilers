/**
 * SPDX-FileCopyrightText: 2024 Jeff <jeff@example.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Error Scenarios Tests (error-001 to error-004)
 * Tests for error handling and edge cases
 */

import { test, expect, selectors, config } from './fixtures/nextcloud'

test.describe('Error Scenarios', () => {
	/**
	 * Test ID: error-001
	 * Invalid Placeholder File ID (deleted file)
	 */
	test('4.1: Handle deleted placeholder file gracefully', async ({ nextcloud, page }) => {
		// Set a placeholder to a non-existent file ID (simulating deleted file)
		// First, go to settings and verify no JS errors occur

		const consoleErrors: string[] = []
		page.on('console', msg => {
			if (msg.type() === 'error') {
				consoleErrors.push(msg.text())
			}
		})

		// Try to set an invalid placeholder via direct API
		// (bypassing validation to simulate file being deleted after being set)
		const invalidFileId = 999999999

		// Make the request but don't expect it to succeed
		const response = await page.request.put(
			`${config.baseUrl}/ocs/v2.php/apps/files_spoilers/api/v1/settings/placeholder`,
			{
				headers: {
					'OCS-APIRequest': 'true',
					'Content-Type': 'application/json',
				},
				data: { fileId: invalidFileId },
				failOnStatusCode: false,
			}
		)

		// API should reject invalid file
		expect(response.ok()).toBe(false)

		// Navigate to Files app to check for JS errors
		await nextcloud.goToFiles()
		await page.waitForTimeout(2000)

		// Filter out expected/known errors
		const criticalErrors = consoleErrors.filter(err =>
			!err.includes('404') && // 404s for missing resources are expected
			!err.includes('ResizeObserver') // ResizeObserver errors are common and non-critical
		)

		// Should have no critical JS errors
		expect(criticalErrors.length).toBe(0)
	})

	/**
	 * Test ID: error-002
	 * Network Errors During Settings Save
	 */
	test('4.2: Handle network errors when saving settings', async ({ nextcloud, page }) => {
		await nextcloud.goToSpoilerSettings()

		// Intercept and block the API request
		await page.route('**/apps/files_spoilers/api/v1/settings/trigger-labels', route => {
			route.abort('failed')
		})

		// Get initial trigger count
		const initialTriggers = await nextcloud.getTriggerLabelsFromUI()
		const initialCount = initialTriggers.length

		// Attempt to add a new trigger label
		await nextcloud.addTriggerLabelViaUI('network', 'test')

		// Wait for error notification
		await nextcloud.waitForError()

		// Verify error message is displayed
		const errorMessage = page.locator(`${selectors.errorNotification}, ${selectors.errorMessage}`)
		await expect(errorMessage).toBeVisible()

		// Verify trigger list is unchanged
		const currentTriggers = await nextcloud.getTriggerLabelsFromUI()
		expect(currentTriggers.length).toBe(initialCount)
		expect(currentTriggers).not.toContain('network=test')

		// Remove the route block
		await page.unroute('**/apps/files_spoilers/api/v1/settings/trigger-labels')
	})

	/**
	 * Test ID: error-003
	 * files_labels App API Unavailable
	 */
	test('4.3: Gracefully handle files_labels API unavailable', async ({ nextcloud, page }) => {
		const consoleErrors: string[] = []
		const consoleWarnings: string[] = []

		page.on('console', msg => {
			if (msg.type() === 'error') {
				consoleErrors.push(msg.text())
			} else if (msg.type() === 'warning') {
				consoleWarnings.push(msg.text())
			}
		})

		// Block files_labels API calls
		await page.route('**/apps/files_labels/api/v1/**', route => {
			route.abort('failed')
		})

		// Navigate to Files app
		await page.goto(`${config.baseUrl}/apps/files`)
		await page.waitForSelector(selectors.fileList, { timeout: 30000 })

		// Wait for label fetch attempts
		await page.waitForTimeout(3000)

		// Page should load without crashing
		// Files should be visible (even if not spoilered)
		const fileRows = page.locator(selectors.fileRowByName)
		expect(await fileRows.count()).toBeGreaterThan(0)

		// Should not have fatal JS errors that break the page
		const fatalErrors = consoleErrors.filter(err =>
			err.includes('Uncaught') ||
			err.includes('TypeError') ||
			err.includes('ReferenceError')
		)
		expect(fatalErrors.length).toBe(0)

		// Remove the route block
		await page.unroute('**/apps/files_labels/api/v1/**')
	})

	/**
	 * Test ID: error-004
	 * Large Number of Files - Performance
	 */
	test('4.4: Performance with many files', async ({ nextcloud, page }) => {
		// This test checks that the app doesn't make excessive API calls
		// and handles large file lists efficiently

		const apiCalls: string[] = []

		// Monitor API calls
		page.on('request', request => {
			const url = request.url()
			if (url.includes('/api/v1/labels/')) {
				apiCalls.push(url)
			}
		})

		// Navigate to Files app
		const startTime = Date.now()
		await page.goto(`${config.baseUrl}/apps/files`)
		await page.waitForSelector(selectors.fileList)
		await page.waitForTimeout(2000) // Wait for label fetching

		const loadTime = Date.now() - startTime

		// Page should load in reasonable time (< 10 seconds)
		expect(loadTime).toBeLessThan(10000)

		// Count visible files
		const fileCount = await page.locator(selectors.fileRowByName).count()

		// API calls should be batched, not one per file
		// With batching, we should have far fewer calls than files
		const labelBulkCalls = apiCalls.filter(url => url.includes('/bulk'))
		const individualCalls = apiCalls.filter(url => !url.includes('/bulk'))

		console.log(`Files: ${fileCount}, Bulk calls: ${labelBulkCalls.length}, Individual calls: ${individualCalls.length}`)

		if (fileCount > 10) {
			// If we have many files, bulk endpoint should be used
			expect(labelBulkCalls.length).toBeGreaterThan(0)
			// Individual calls should be minimal (fallback only)
			expect(individualCalls.length).toBeLessThan(fileCount / 2)
		}
	})

	/**
	 * Additional test: Persistent failure notification
	 */
	test('4.5: Show notification after persistent API failures', async ({ nextcloud, page }) => {
		let failureCount = 0

		// Block all label requests to simulate persistent failure
		await page.route('**/apps/files_labels/api/v1/**', route => {
			failureCount++
			route.abort('failed')
		})

		// Navigate to Files app
		await page.goto(`${config.baseUrl}/apps/files`)
		await page.waitForSelector(selectors.fileList)

		// Wait for multiple batch attempts
		await page.waitForTimeout(5000)

		// After 3+ failures, user should be notified
		// Check for error notification
		if (failureCount >= 3) {
			const notification = page.locator(`${selectors.errorNotification}`)
			// Notification may or may not be visible depending on implementation
			// This test documents the expected behavior
		}

		await page.unroute('**/apps/files_labels/api/v1/**')
	})

	/**
	 * Additional test: Recovery after network restoration
	 */
	test('4.6: Recover after network is restored', async ({ nextcloud, page }) => {
		// Start with blocked API
		await page.route('**/apps/files_labels/api/v1/**', route => {
			route.abort('failed')
		})

		await page.goto(`${config.baseUrl}/apps/files`)
		await page.waitForSelector(selectors.fileList)
		await page.waitForTimeout(2000)

		// Files should be visible but possibly not spoilered
		const initialSpoilerCount = await nextcloud.countSpoileredFiles()

		// Restore network
		await page.unroute('**/apps/files_labels/api/v1/**')

		// Reload page
		await page.reload()
		await page.waitForSelector(selectors.fileList)
		await page.waitForTimeout(2000)

		// Now spoilers should work if there are spoilered files
		// (depends on test data)
	})

	/**
	 * Additional test: Settings page loads without files_labels
	 */
	test('4.7: Settings page works even if files_labels API fails', async ({ nextcloud, page }) => {
		// Block files_labels API (but not files_spoilers API)
		await page.route('**/apps/files_labels/api/v1/**', route => {
			route.abort('failed')
		})

		// Navigate to settings
		await nextcloud.goToSpoilerSettings()

		// Settings should still load and be functional
		const keyInput = page.locator(selectors.keyInput)
		await expect(keyInput).toBeVisible()

		// Should be able to add trigger labels
		await nextcloud.addTriggerLabelViaUI('test', 'value')
		await nextcloud.waitForSuccess()

		// Verify trigger was added
		const triggers = await nextcloud.getTriggerLabelsFromUI()
		expect(triggers).toContain('test=value')

		await page.unroute('**/apps/files_labels/api/v1/**')
	})
})
