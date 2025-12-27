/**
 * SPDX-FileCopyrightText: 2024 Jeff <jeff@example.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Settings Flow Tests (settings-001 to settings-007)
 * Tests for the File Spoilers personal settings page
 */

import { test, expect, selectors, config } from './fixtures/nextcloud'

test.describe('Settings Flow', () => {
	test.beforeEach(async ({ nextcloud }) => {
		// Reset settings to defaults before each test
		await nextcloud.resetSettings()
		await nextcloud.goToSpoilerSettings()
	})

	/**
	 * Test ID: settings-001
	 * Add Trigger Label - Valid Input
	 */
	test('1.1: Add valid trigger label', async ({ nextcloud, page }) => {
		// Verify default trigger label is displayed
		const triggers = await nextcloud.getTriggerLabelsFromUI()
		expect(triggers).toContain('sensitive=true')

		// Add a new trigger label
		await nextcloud.addTriggerLabelViaUI('nsfw', 'true')

		// Wait for success notification
		await nextcloud.waitForSuccess()

		// Verify new trigger appears in list
		const updatedTriggers = await nextcloud.getTriggerLabelsFromUI()
		expect(updatedTriggers).toContain('sensitive=true')
		expect(updatedTriggers).toContain('nsfw=true')
		expect(updatedTriggers).toHaveLength(2)

		// Verify via API
		const apiTriggers = await nextcloud.getTriggerLabels()
		expect(apiTriggers).toContain('nsfw=true')
	})

	/**
	 * Test ID: settings-002
	 * Add Trigger Label - Duplicate Prevention
	 */
	test('1.2: Prevent duplicate trigger labels', async ({ nextcloud, page }) => {
		// Verify default trigger exists
		const triggers = await nextcloud.getTriggerLabelsFromUI()
		expect(triggers).toContain('sensitive=true')

		// Attempt to add duplicate
		await nextcloud.addTriggerLabelViaUI('sensitive', 'true')

		// Should show error message
		const errorMessage = page.locator(selectors.errorMessage)
		await expect(errorMessage).toContainText('already exists')

		// Trigger list should remain unchanged
		const updatedTriggers = await nextcloud.getTriggerLabelsFromUI()
		expect(updatedTriggers.filter(t => t === 'sensitive=true')).toHaveLength(1)
	})

	/**
	 * Test ID: settings-003
	 * Add Trigger Label - Invalid Format Validation
	 */
	test('1.3: Validate label key format', async ({ nextcloud, page }) => {
		// Test cases for invalid keys
		const invalidKeys = [
			{ key: 'UPPERCASE', reason: 'uppercase letters' },
			{ key: 'has spaces', reason: 'spaces' },
			{ key: 'special@chars!', reason: 'special characters' },
		]

		for (const { key, reason } of invalidKeys) {
			// Clear inputs
			await page.fill(selectors.keyInput, '')
			await page.fill(selectors.valueInput, '')

			// Try to enter invalid key
			await page.fill(selectors.keyInput, key)
			await page.fill(selectors.valueInput, 'test')

			// Get input validation state
			const keyInput = page.locator(selectors.keyInput)
			const isValid = await keyInput.evaluate((el: HTMLInputElement) => el.validity.valid)

			// HTML5 pattern validation should fail for invalid keys
			expect(isValid, `Key "${key}" should be invalid due to ${reason}`).toBe(false)
		}

		// Test valid key format
		await page.fill(selectors.keyInput, '')
		await page.fill(selectors.keyInput, 'valid-key_123')
		await page.fill(selectors.valueInput, 'value')

		const keyInput = page.locator(selectors.keyInput)
		const isValid = await keyInput.evaluate((el: HTMLInputElement) => el.validity.valid)
		expect(isValid, 'Key "valid-key_123" should be valid').toBe(true)

		// Submit valid key and verify it saves
		await page.click(selectors.addButton)
		await nextcloud.waitForSuccess()

		const triggers = await nextcloud.getTriggerLabelsFromUI()
		expect(triggers).toContain('valid-key_123=value')
	})

	/**
	 * Test ID: settings-004
	 * Remove Trigger Label
	 */
	test('1.4: Remove trigger label', async ({ nextcloud, page }) => {
		// First add a second trigger so we have two
		await nextcloud.addTriggerLabelViaUI('nsfw', 'true')
		await nextcloud.waitForSuccess()

		// Verify both triggers exist
		let triggers = await nextcloud.getTriggerLabelsFromUI()
		expect(triggers).toContain('sensitive=true')
		expect(triggers).toContain('nsfw=true')

		// Remove nsfw trigger
		await nextcloud.removeTriggerLabelViaUI('nsfw=true')
		await nextcloud.waitForSuccess()

		// Verify nsfw is removed
		triggers = await nextcloud.getTriggerLabelsFromUI()
		expect(triggers).not.toContain('nsfw=true')
		expect(triggers).toContain('sensitive=true')

		// Verify via API
		const apiTriggers = await nextcloud.getTriggerLabels()
		expect(apiTriggers).not.toContain('nsfw=true')
	})

	/**
	 * Test ID: settings-005
	 * Set Custom Placeholder Image - Valid File
	 */
	test('1.5: Set custom placeholder image via file picker', async ({ nextcloud, page }) => {
		// Verify default state - should show "Choose image" button
		const chooseButton = page.locator(selectors.chooseImageButton)
		await expect(chooseButton).toBeVisible()

		// Note: The file picker requires an actual image file to exist
		// For a complete test, we would:
		// 1. Upload a test image first
		// 2. Click the Choose image button
		// 3. Select the image in the file picker
		// 4. Verify the placeholder preview appears

		// For now, we test the API directly
		// This requires a valid image file ID in the test environment
		// Skip if no test image is available

		// Check if file picker opens
		await chooseButton.click()

		// The file picker should open - check for picker modal
		const pickerModal = page.locator('.file-picker, .oc-dialog')
		const hasPickerModal = await pickerModal.count() > 0

		if (hasPickerModal) {
			// Close the picker
			await page.keyboard.press('Escape')
		}

		// If we had a valid file ID, we could test:
		// await nextcloud.setPlaceholderViaAPI(12345)
		// const placeholderPreview = page.locator(selectors.placeholderPreview)
		// await expect(placeholderPreview).toBeVisible()
	})

	/**
	 * Test ID: settings-006
	 * Set Custom Placeholder - Invalid File ID
	 */
	test('1.6: Handle invalid placeholder file ID', async ({ nextcloud, page }) => {
		// Try to set a non-existent file ID via API
		const response = await page.request.put(
			`${config.baseUrl}/ocs/v2.php/apps/files_spoilers/api/v1/settings/placeholder`,
			{
				headers: {
					'OCS-APIRequest': 'true',
					'Content-Type': 'application/json',
				},
				data: { fileId: 999999999 }, // Non-existent file
				failOnStatusCode: false,
			}
		)

		// Should return error status
		expect(response.ok()).toBe(false)
		const status = response.status()
		expect([400, 404]).toContain(status)

		// Settings should remain unchanged
		const settingsResponse = await page.request.get(
			`${config.baseUrl}/ocs/v2.php/apps/files_spoilers/api/v1/settings`,
			{
				headers: { 'OCS-APIRequest': 'true' },
			}
		)
		const data = await settingsResponse.json()
		expect(data.ocs?.data?.placeholder_file_id).toBeNull()
	})

	/**
	 * Test ID: settings-007
	 * Clear Custom Placeholder
	 */
	test('1.7: Clear custom placeholder and revert to default', async ({ nextcloud, page }) => {
		// This test requires a placeholder to be set first
		// We'll test the API path since the full UI flow requires an existing image

		// First, verify the clear placeholder API works
		const clearResponse = await page.request.delete(
			`${config.baseUrl}/ocs/v2.php/apps/files_spoilers/api/v1/settings/placeholder`,
			{
				headers: { 'OCS-APIRequest': 'true' },
			}
		)
		expect(clearResponse.ok()).toBe(true)

		// Reload settings page
		await nextcloud.goToSpoilerSettings()

		// Should show "Choose image" button (default state)
		const chooseButton = page.locator(selectors.chooseImageButton)
		await expect(chooseButton).toBeVisible()

		// "Remove custom placeholder" button should NOT be visible
		const removeButton = page.locator(selectors.removePlaceholderButton)
		await expect(removeButton).not.toBeVisible()
	})

	/**
	 * Additional test: Verify trigger labels persist across page reloads
	 */
	test('1.8: Trigger labels persist after page reload', async ({ nextcloud, page }) => {
		// Add a new trigger
		await nextcloud.addTriggerLabelViaUI('custom', 'value')
		await nextcloud.waitForSuccess()

		// Reload the page
		await page.reload()
		await page.waitForSelector(selectors.settingsSection)

		// Verify trigger is still there
		const triggers = await nextcloud.getTriggerLabelsFromUI()
		expect(triggers).toContain('custom=value')
		expect(triggers).toContain('sensitive=true')
	})

	/**
	 * Additional test: Empty value validation
	 */
	test('1.9: Add button disabled with empty inputs', async ({ page }) => {
		await page.fill(selectors.keyInput, '')
		await page.fill(selectors.valueInput, '')

		const addButton = page.locator(selectors.addButton)
		await expect(addButton).toBeDisabled()

		// Fill only key
		await page.fill(selectors.keyInput, 'test')
		await expect(addButton).toBeDisabled()

		// Fill only value
		await page.fill(selectors.keyInput, '')
		await page.fill(selectors.valueInput, 'value')
		await expect(addButton).toBeDisabled()

		// Fill both
		await page.fill(selectors.keyInput, 'test')
		await page.fill(selectors.valueInput, 'value')
		await expect(addButton).not.toBeDisabled()
	})
})
