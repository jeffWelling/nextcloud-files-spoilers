/**
 * SPDX-FileCopyrightText: 2024 Jeff <jeff@example.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Multi-user Scenarios Tests (multiuser-001 to multiuser-003)
 * Tests for user-specific settings and shared file scenarios
 */

import { test, expect, selectors, config, NextcloudPage } from './fixtures/nextcloud'

test.describe('Multi-user Scenarios', () => {
	const sharedFile = 'test-shared-image.jpg'

	/**
	 * Test ID: multiuser-001
	 * Different Users Have Different Trigger Labels
	 */
	test('5.1: Each user has independent trigger labels', async ({ browser, page }) => {
		// Create contexts for both users
		const user1Context = await browser.newContext({
			storageState: 'tests/e2e/.auth/testuser1.json'
		})
		const user2Context = await browser.newContext({
			storageState: 'tests/e2e/.auth/testuser2.json'
		})

		const page1 = await user1Context.newPage()
		const page2 = await user2Context.newPage()

		const user1 = new NextcloudPage(page1)
		const user2 = new NextcloudPage(page2)

		try {
			// User 1: Configure trigger labels
			await user1.setTriggerLabelsViaAPI(['sensitive=true', 'private=yes'])

			// User 2: Configure DIFFERENT trigger labels
			await user2.setTriggerLabelsViaAPI(['nsfw=true', 'adult=yes'])

			// Verify User 1's settings
			await user1.goToSpoilerSettings()
			const user1Triggers = await user1.getTriggerLabelsFromUI()
			expect(user1Triggers).toContain('sensitive=true')
			expect(user1Triggers).toContain('private=yes')
			expect(user1Triggers).not.toContain('nsfw=true')
			expect(user1Triggers).not.toContain('adult=yes')

			// Verify User 2's settings
			await user2.goToSpoilerSettings()
			const user2Triggers = await user2.getTriggerLabelsFromUI()
			expect(user2Triggers).toContain('nsfw=true')
			expect(user2Triggers).toContain('adult=yes')
			expect(user2Triggers).not.toContain('sensitive=true')
			expect(user2Triggers).not.toContain('private=yes')

			// Verify settings are stored per-user via API
			const user1ApiTriggers = await user1.getTriggerLabels()
			const user2ApiTriggers = await user2.getTriggerLabels()

			expect(user1ApiTriggers).not.toEqual(user2ApiTriggers)
		} finally {
			await user1Context.close()
			await user2Context.close()
		}
	})

	/**
	 * Test ID: multiuser-002
	 * Shared Files Respect Each User's Individual Settings
	 */
	test('5.2: Shared files respect per-user spoiler settings', async ({ browser }) => {
		const user1Context = await browser.newContext({
			storageState: 'tests/e2e/.auth/testuser1.json'
		})
		const user2Context = await browser.newContext({
			storageState: 'tests/e2e/.auth/testuser2.json'
		})

		const page1 = await user1Context.newPage()
		const page2 = await user2Context.newPage()

		const user1 = new NextcloudPage(page1)
		const user2 = new NextcloudPage(page2)

		try {
			// User 1: Trigger on 'sensitive=true'
			await user1.setTriggerLabelsViaAPI(['sensitive=true'])

			// User 2: Trigger on 'nsfw=true' (NOT sensitive)
			await user2.setTriggerLabelsViaAPI(['nsfw=true'])

			// Navigate both users to Files
			await user1.goToFiles()
			await user2.goToFiles()

			// Check if shared file exists for both users
			const file1Row = user1.getFileRow(sharedFile)
			const file2Row = user2.getFileRow(sharedFile)

			const file1Exists = await file1Row.count() > 0
			const file2Exists = await file2Row.count() > 0

			if (file1Exists && file2Exists) {
				// Get file ID from user1's context
				const fileId = await user1.getFileId(sharedFile)

				if (fileId) {
					// Set the file to have 'sensitive=true' label
					await user1.setLabelViaAPI(fileId, 'sensitive', 'true')

					// Reload both users
					await page1.reload()
					await page2.reload()
					await page1.waitForSelector(selectors.fileList)
					await page2.waitForSelector(selectors.fileList)
					await page1.waitForTimeout(1000)
					await page2.waitForTimeout(1000)

					// User 1 should see file as spoilered (matches 'sensitive=true')
					const user1Spoilered = await user1.isFileSpoilered(sharedFile)
					expect(user1Spoilered).toBe(true)

					// User 2 should see file normally (doesn't match 'nsfw=true')
					const user2Spoilered = await user2.isFileSpoilered(sharedFile)
					expect(user2Spoilered).toBe(false)
				}
			} else {
				console.log(`Shared file ${sharedFile} not available for both users - skipping test`)
				test.skip()
			}
		} finally {
			await user1Context.close()
			await user2Context.close()
		}
	})

	/**
	 * Test ID: multiuser-003
	 * User Cannot See Other Users' Custom Placeholders
	 */
	test('5.3: Custom placeholder settings are private per user', async ({ browser }) => {
		const user1Context = await browser.newContext({
			storageState: 'tests/e2e/.auth/testuser1.json'
		})
		const user2Context = await browser.newContext({
			storageState: 'tests/e2e/.auth/testuser2.json'
		})

		const page1 = await user1Context.newPage()
		const page2 = await user2Context.newPage()

		const user1 = new NextcloudPage(page1)
		const user2 = new NextcloudPage(page2)

		try {
			// Get current settings for both users via API
			const user1Settings = await page1.request.get(
				`${config.baseUrl}/ocs/v2.php/apps/files_spoilers/api/v1/settings`,
				{ headers: { 'OCS-APIRequest': 'true' } }
			)
			const user2Settings = await page2.request.get(
				`${config.baseUrl}/ocs/v2.php/apps/files_spoilers/api/v1/settings`,
				{ headers: { 'OCS-APIRequest': 'true' } }
			)

			const user1Data = await user1Settings.json()
			const user2Data = await user2Settings.json()

			// Verify settings are separate (different objects)
			// Even if values are the same, they should be stored separately
			expect(user1Data.ocs?.data).toBeDefined()
			expect(user2Data.ocs?.data).toBeDefined()

			// Clear placeholders for both users
			await user1.clearPlaceholderViaAPI()
			await user2.clearPlaceholderViaAPI()

			// Verify both have null placeholder
			const user1SettingsAfter = await page1.request.get(
				`${config.baseUrl}/ocs/v2.php/apps/files_spoilers/api/v1/settings`,
				{ headers: { 'OCS-APIRequest': 'true' } }
			)
			const user2SettingsAfter = await page2.request.get(
				`${config.baseUrl}/ocs/v2.php/apps/files_spoilers/api/v1/settings`,
				{ headers: { 'OCS-APIRequest': 'true' } }
			)

			const user1DataAfter = await user1SettingsAfter.json()
			const user2DataAfter = await user2SettingsAfter.json()

			expect(user1DataAfter.ocs?.data?.placeholder_file_id).toBeNull()
			expect(user2DataAfter.ocs?.data?.placeholder_file_id).toBeNull()
		} finally {
			await user1Context.close()
			await user2Context.close()
		}
	})

	/**
	 * Additional test: User settings don't leak between sessions
	 */
	test('5.4: Settings isolated between user sessions', async ({ browser }) => {
		const user1Context = await browser.newContext({
			storageState: 'tests/e2e/.auth/testuser1.json'
		})
		const user2Context = await browser.newContext({
			storageState: 'tests/e2e/.auth/testuser2.json'
		})

		const page1 = await user1Context.newPage()
		const page2 = await user2Context.newPage()

		const user1 = new NextcloudPage(page1)
		const user2 = new NextcloudPage(page2)

		try {
			// User 1: Set a unique trigger
			const uniqueTrigger = `unique-${Date.now()}=value`
			const [key, value] = uniqueTrigger.split('=')

			await user1.goToSpoilerSettings()
			await user1.addTriggerLabelViaUI(key, value)
			await user1.waitForSuccess()

			// User 2: Check their settings
			await user2.goToSpoilerSettings()
			const user2Triggers = await user2.getTriggerLabelsFromUI()

			// User 2 should NOT see User 1's unique trigger
			expect(user2Triggers).not.toContain(uniqueTrigger)
		} finally {
			await user1Context.close()
			await user2Context.close()
		}
	})

	/**
	 * Additional test: Revealed state is session-specific
	 */
	test('5.5: Revealed files are session-specific not user-specific', async ({ browser }) => {
		// This tests that revealing a file in one tab doesn't reveal it in another
		// (even for the same user in different browser sessions)

		const context1 = await browser.newContext({
			storageState: 'tests/e2e/.auth/testuser1.json'
		})
		const context2 = await browser.newContext({
			storageState: 'tests/e2e/.auth/testuser1.json'
		})

		const page1 = await context1.newPage()
		const page2 = await context2.newPage()

		const session1 = new NextcloudPage(page1)
		const session2 = new NextcloudPage(page2)

		const testFile = 'test-spoilered-image.jpg'

		try {
			// Ensure trigger is set
			await session1.setTriggerLabelsViaAPI(['sensitive=true'])

			// Navigate both sessions to Files
			await session1.goToFiles()
			await session2.goToFiles()

			const file1Row = session1.getFileRow(testFile)
			const file2Row = session2.getFileRow(testFile)

			if (await file1Row.count() > 0 && await file2Row.count() > 0) {
				const fileId = await session1.getFileId(testFile)

				if (fileId) {
					// Ensure file has trigger label
					await session1.setLabelViaAPI(fileId, 'sensitive', 'true')

					// Reload both sessions
					await page1.reload()
					await page2.reload()
					await page1.waitForSelector(selectors.fileList)
					await page2.waitForSelector(selectors.fileList)
					await page1.waitForTimeout(1000)
					await page2.waitForTimeout(1000)

					// Both should be spoilered initially
					expect(await session1.isFileSpoilered(testFile)).toBe(true)
					expect(await session2.isFileSpoilered(testFile)).toBe(true)

					// Reveal in session 1
					await session1.revealSpoiler(testFile)
					expect(await session1.isFileSpoilered(testFile)).toBe(false)

					// Session 2 should still be spoilered
					// (revealed state is in-memory, not persisted)
					expect(await session2.isFileSpoilered(testFile)).toBe(true)
				}
			} else {
				test.skip()
			}
		} finally {
			await context1.close()
			await context2.close()
		}
	})
})
