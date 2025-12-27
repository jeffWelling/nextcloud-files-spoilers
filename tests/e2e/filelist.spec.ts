/**
 * SPDX-FileCopyrightText: 2024 Jeff <jeff@example.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * File List Behavior Tests (filelist-001 to filelist-005)
 * Tests for spoiler display and interaction in the Files app
 */

import { test, expect, selectors, config } from './fixtures/nextcloud'

test.describe('File List Behavior', () => {
	// Test file names - these should be created in the test environment
	const spoileredFile = 'test-spoilered-image.jpg'
	const normalFile = 'test-normal-image.png'
	const spoileredFile2 = 'test-spoilered-image-2.jpg'
	const spoileredDoc = 'test-spoilered-doc.pdf'

	test.beforeEach(async ({ nextcloud }) => {
		// Ensure default trigger is set
		await nextcloud.setTriggerLabelsViaAPI(['sensitive=true'])
	})

	/**
	 * Test ID: filelist-001
	 * File with Matching Label Shows Spoiler
	 */
	test('2.1: File with matching label shows spoiler placeholder', async ({ nextcloud, page }) => {
		await nextcloud.goToFiles()

		// Check for test files - if they exist and have labels set up
		const fileRow = nextcloud.getFileRow(spoileredFile)
		const fileExists = await fileRow.count() > 0

		if (fileExists) {
			// Get file ID and ensure it has the sensitive label
			const fileId = await nextcloud.getFileId(spoileredFile)
			if (fileId) {
				await nextcloud.setLabelViaAPI(fileId, 'sensitive', 'true')
			}

			// Reload to trigger spoiler detection
			await page.reload()
			await page.waitForSelector(selectors.fileList)

			// Wait for labels to be fetched and spoiler to be applied
			await page.waitForTimeout(1000)

			// Verify file shows spoiler placeholder
			const isSpoilered = await nextcloud.isFileSpoilered(spoileredFile)
			expect(isSpoilered).toBe(true)

			// Verify placeholder has expected properties
			const spoiler = nextcloud.getFileRow(spoileredFile).locator(selectors.spoilerPlaceholder)
			await expect(spoiler).toHaveAttribute('title', 'Click to reveal')
			await expect(spoiler).toHaveAttribute('role', 'button')
		} else {
			// File doesn't exist in test environment - skip with info
			console.log(`Test file ${spoileredFile} not found - skipping test`)
			test.skip()
		}
	})

	/**
	 * Test ID: filelist-002
	 * File without Matching Label Shows Normally
	 */
	test('2.2: File without matching label shows normal preview', async ({ nextcloud, page }) => {
		await nextcloud.goToFiles()

		const fileRow = nextcloud.getFileRow(normalFile)
		const fileExists = await fileRow.count() > 0

		if (fileExists) {
			// Ensure file does NOT have the trigger label
			const fileId = await nextcloud.getFileId(normalFile)
			if (fileId) {
				// Set a non-trigger label
				await nextcloud.setLabelViaAPI(fileId, 'category', 'work')
			}

			// Reload
			await page.reload()
			await page.waitForSelector(selectors.fileList)
			await page.waitForTimeout(1000)

			// Verify file shows normal preview (not spoilered)
			const isSpoilered = await nextcloud.isFileSpoilered(normalFile)
			expect(isSpoilered).toBe(false)

			// Verify normal preview is visible
			const hasPreview = await nextcloud.hasNormalPreview(normalFile)
			expect(hasPreview).toBe(true)
		} else {
			console.log(`Test file ${normalFile} not found - skipping test`)
			test.skip()
		}
	})

	/**
	 * Test ID: filelist-003
	 * Clicking Spoiler Reveals the File
	 */
	test('2.3: Click spoiler to reveal file preview', async ({ nextcloud, page }) => {
		await nextcloud.goToFiles()

		const fileRow = nextcloud.getFileRow(spoileredFile)
		const fileExists = await fileRow.count() > 0

		if (fileExists) {
			// Ensure file is spoilered
			const fileId = await nextcloud.getFileId(spoileredFile)
			if (fileId) {
				await nextcloud.setLabelViaAPI(fileId, 'sensitive', 'true')
			}

			await page.reload()
			await page.waitForSelector(selectors.fileList)
			await page.waitForTimeout(1000)

			// Verify file is initially spoilered
			let isSpoilered = await nextcloud.isFileSpoilered(spoileredFile)
			expect(isSpoilered).toBe(true)

			// Click the spoiler to reveal
			await nextcloud.revealSpoiler(spoileredFile)

			// Verify spoiler is removed
			isSpoilered = await nextcloud.isFileSpoilered(spoileredFile)
			expect(isSpoilered).toBe(false)

			// Verify file is marked as revealed
			const isRevealed = await nextcloud.isFileRevealed(spoileredFile)
			expect(isRevealed).toBe(true)

			// Verify original preview is now visible
			const previewVisible = await fileRow.locator(`${selectors.normalPreview}:visible, img:visible`).count() > 0
			expect(previewVisible).toBe(true)
		} else {
			console.log(`Test file ${spoileredFile} not found - skipping test`)
			test.skip()
		}
	})

	/**
	 * Test ID: filelist-004
	 * Multiple Files with Spoilers - Independent Reveal
	 */
	test('2.4: Multiple spoilered files reveal independently', async ({ nextcloud, page }) => {
		await nextcloud.goToFiles()

		// Check if test files exist
		const file1Row = nextcloud.getFileRow(spoileredFile)
		const file2Row = nextcloud.getFileRow(spoileredFile2)
		const file1Exists = await file1Row.count() > 0
		const file2Exists = await file2Row.count() > 0

		if (file1Exists && file2Exists) {
			// Set both files as sensitive
			const fileId1 = await nextcloud.getFileId(spoileredFile)
			const fileId2 = await nextcloud.getFileId(spoileredFile2)

			if (fileId1) await nextcloud.setLabelViaAPI(fileId1, 'sensitive', 'true')
			if (fileId2) await nextcloud.setLabelViaAPI(fileId2, 'sensitive', 'true')

			await page.reload()
			await page.waitForSelector(selectors.fileList)
			await page.waitForTimeout(1000)

			// Verify both are spoilered initially
			expect(await nextcloud.isFileSpoilered(spoileredFile)).toBe(true)
			expect(await nextcloud.isFileSpoilered(spoileredFile2)).toBe(true)

			// Reveal only the first file
			await nextcloud.revealSpoiler(spoileredFile)

			// First file should be revealed
			expect(await nextcloud.isFileSpoilered(spoileredFile)).toBe(false)

			// Second file should still be spoilered
			expect(await nextcloud.isFileSpoilered(spoileredFile2)).toBe(true)

			// Reveal second file
			await nextcloud.revealSpoiler(spoileredFile2)

			// Both should now be revealed
			expect(await nextcloud.isFileSpoilered(spoileredFile)).toBe(false)
			expect(await nextcloud.isFileSpoilered(spoileredFile2)).toBe(false)
		} else {
			console.log('Test files not found - skipping test')
			test.skip()
		}
	})

	/**
	 * Test ID: filelist-005
	 * Folder Navigation Maintains Revealed State
	 */
	test('2.5: Revealed state persists when navigating folders', async ({ nextcloud, page }) => {
		await nextcloud.goToFiles()

		const fileRow = nextcloud.getFileRow(spoileredFile)
		const fileExists = await fileRow.count() > 0

		if (fileExists) {
			// Ensure file is spoilered
			const fileId = await nextcloud.getFileId(spoileredFile)
			if (fileId) {
				await nextcloud.setLabelViaAPI(fileId, 'sensitive', 'true')
			}

			await page.reload()
			await page.waitForSelector(selectors.fileList)
			await page.waitForTimeout(1000)

			// Reveal the file
			await nextcloud.revealSpoiler(spoileredFile)
			expect(await nextcloud.isFileSpoilered(spoileredFile)).toBe(false)

			// Navigate to a different folder (Documents if exists)
			const documentsFolder = page.locator(selectors.fileRow('Documents'))
			if (await documentsFolder.count() > 0) {
				await documentsFolder.dblclick()
				await page.waitForTimeout(500)

				// Navigate back using breadcrumb
				await page.click(`${selectors.breadcrumb} a:has-text("All files"), ${selectors.breadcrumb} a:first-child`)
				await page.waitForSelector(selectors.fileList)
				await page.waitForTimeout(500)

				// File should still be revealed (not re-spoilered)
				expect(await nextcloud.isFileSpoilered(spoileredFile)).toBe(false)
			} else {
				// No subfolder to navigate to - just verify state persists after scroll
				// Scroll away and back
				await page.evaluate(() => window.scrollTo(0, 1000))
				await page.waitForTimeout(200)
				await page.evaluate(() => window.scrollTo(0, 0))
				await page.waitForTimeout(200)

				// Should still be revealed
				expect(await nextcloud.isFileSpoilered(spoileredFile)).toBe(false)
			}
		} else {
			console.log(`Test file ${spoileredFile} not found - skipping test`)
			test.skip()
		}
	})

	/**
	 * Additional test: Keyboard accessibility for revealing spoilers
	 */
	test('2.6: Keyboard navigation to reveal spoiler (Enter key)', async ({ nextcloud, page }) => {
		await nextcloud.goToFiles()

		const fileRow = nextcloud.getFileRow(spoileredFile)
		const fileExists = await fileRow.count() > 0

		if (fileExists) {
			const fileId = await nextcloud.getFileId(spoileredFile)
			if (fileId) {
				await nextcloud.setLabelViaAPI(fileId, 'sensitive', 'true')
			}

			await page.reload()
			await page.waitForSelector(selectors.fileList)
			await page.waitForTimeout(1000)

			// Verify file is spoilered
			expect(await nextcloud.isFileSpoilered(spoileredFile)).toBe(true)

			// Focus on the spoiler placeholder
			const spoiler = fileRow.locator(selectors.spoilerPlaceholder)
			await spoiler.focus()

			// Press Enter to reveal
			await page.keyboard.press('Enter')

			// Verify file is revealed
			await expect(spoiler).not.toBeVisible({ timeout: 5000 })
			expect(await nextcloud.isFileSpoilered(spoileredFile)).toBe(false)
		} else {
			test.skip()
		}
	})

	/**
	 * Additional test: Spoiler placeholder tooltip
	 */
	test('2.7: Spoiler placeholder has correct tooltip', async ({ nextcloud, page }) => {
		await nextcloud.goToFiles()

		const fileRow = nextcloud.getFileRow(spoileredFile)
		const fileExists = await fileRow.count() > 0

		if (fileExists) {
			const fileId = await nextcloud.getFileId(spoileredFile)
			if (fileId) {
				await nextcloud.setLabelViaAPI(fileId, 'sensitive', 'true')
			}

			await page.reload()
			await page.waitForSelector(selectors.fileList)
			await page.waitForTimeout(1000)

			const spoiler = fileRow.locator(selectors.spoilerPlaceholder)

			// Check title attribute
			await expect(spoiler).toHaveAttribute('title', 'Click to reveal')

			// Check aria-label for accessibility
			await expect(spoiler).toHaveAttribute('aria-label', /reveal/i)
		} else {
			test.skip()
		}
	})
})
