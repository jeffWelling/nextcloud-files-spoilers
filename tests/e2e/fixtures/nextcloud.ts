/**
 * SPDX-FileCopyrightText: 2024 Jeff <jeff@example.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { test as base, expect, Page, BrowserContext } from '@playwright/test'
import * as path from 'path'
import * as fs from 'fs'

// Environment configuration
export const config = {
	baseUrl: process.env.NEXTCLOUD_URL || 'http://localhost:8080',
	testUser1: process.env.TEST_USER || 'testuser1',
	testPassword1: process.env.TEST_PASSWORD || 'testpass123',
	testUser2: process.env.TEST_USER_2 || 'testuser2',
	testPassword2: process.env.TEST_PASSWORD_2 || 'testpass123',
	adminUser: process.env.ADMIN_USER || 'admin',
	adminPassword: process.env.ADMIN_PASSWORD || 'admin',
}

// CSS Selectors for Nextcloud UI elements
export const selectors = {
	// File list selectors
	fileRow: (filename: string) => `[data-cy-files-list-row-name="${filename}"], [data-cy-files-list-row]:has-text("${filename}")`,
	fileRowByName: '[data-cy-files-list-row]',
	fileIcon: '[data-cy-files-list-row-icon]',
	fileActions: '[data-cy-files-list-row-actions]',
	fileList: '[data-cy-files-list]',
	spoilerPlaceholder: '.spoiler-placeholder',
	normalPreview: '.files-list__row-icon-preview, [data-cy-files-list-row-icon] img',

	// Settings selectors
	settingsSection: '.files-spoilers-settings',
	triggerList: '.trigger-list',
	triggerItem: '.trigger-item',
	triggerItemByLabel: (label: string) => `.trigger-item:has-text("${label}")`,
	triggerRemoveButton: (label: string) => `.trigger-item:has-text("${label}") button`,
	keyInput: 'input.input-key, input[placeholder*="Label key"]',
	valueInput: 'input.input-value, input[placeholder*="Value"]',
	addButton: 'button:has-text("Add")',
	chooseImageButton: 'button:has-text("Choose image")',
	removePlaceholderButton: 'button:has-text("Remove custom placeholder")',
	placeholderPreview: '.placeholder-preview img',

	// Notifications
	successNotification: '.toastify.toast-success, .success',
	errorNotification: '.toastify.toast-error, .error',
	errorMessage: '.message.error',
	successMessage: '.message.success',

	// Navigation
	filesApp: '[data-cy-files-navigation-item="files"]',
	settingsLink: 'a[href*="/settings/user"]',
	breadcrumb: '.files-list__header-breadcrumbs',

	// Labels sidebar (files_labels app)
	labelsSidebarTab: '[data-cy-sidebar-tab-id="files_labels"]',
	labelInput: '.labels-input input',
	labelAddButton: '.labels-add-button',
}

/**
 * NextcloudPage - Page Object for Nextcloud interactions
 */
export class NextcloudPage {
	constructor(public readonly page: Page) {}

	/**
	 * Navigate to the Files app
	 */
	async goToFiles(folder: string = '/') {
		const url = folder === '/'
			? `${config.baseUrl}/apps/files`
			: `${config.baseUrl}/apps/files/?dir=${encodeURIComponent(folder)}`
		await this.page.goto(url)
		await this.page.waitForSelector(selectors.fileList, { timeout: 30000 })
	}

	/**
	 * Navigate to File Spoilers settings
	 */
	async goToSpoilerSettings() {
		await this.page.goto(`${config.baseUrl}/settings/user/files_spoilers`)
		await this.page.waitForSelector(selectors.settingsSection, { timeout: 30000 })
	}

	/**
	 * Get file row element
	 */
	getFileRow(filename: string) {
		return this.page.locator(selectors.fileRow(filename)).first()
	}

	/**
	 * Check if file has spoiler placeholder
	 */
	async isFileSpoilered(filename: string): Promise<boolean> {
		const fileRow = this.getFileRow(filename)
		const spoiler = fileRow.locator(selectors.spoilerPlaceholder)
		return await spoiler.count() > 0
	}

	/**
	 * Check if file has normal preview (not spoilered)
	 */
	async hasNormalPreview(filename: string): Promise<boolean> {
		const fileRow = this.getFileRow(filename)
		const preview = fileRow.locator(selectors.normalPreview)
		const spoiler = fileRow.locator(selectors.spoilerPlaceholder)
		return await preview.count() > 0 && await spoiler.count() === 0
	}

	/**
	 * Click spoiler placeholder to reveal file
	 */
	async revealSpoiler(filename: string) {
		const fileRow = this.getFileRow(filename)
		const spoiler = fileRow.locator(selectors.spoilerPlaceholder)
		await spoiler.click()
		// Wait for spoiler to be removed
		await expect(spoiler).not.toBeVisible({ timeout: 5000 })
	}

	/**
	 * Check if file was revealed
	 */
	async isFileRevealed(filename: string): Promise<boolean> {
		const fileRow = this.getFileRow(filename)
		const revealed = fileRow.locator('[data-spoiler-revealed="true"]')
		return await revealed.count() > 0
	}

	/**
	 * Upload a test file via the UI
	 */
	async uploadFile(filePath: string, targetFolder: string = '/') {
		await this.goToFiles(targetFolder)

		// Find file input (may be hidden)
		const fileInput = this.page.locator('input[type="file"]').first()
		await fileInput.setInputFiles(filePath)

		// Wait for upload to complete
		const filename = path.basename(filePath)
		await this.page.waitForSelector(selectors.fileRow(filename), { timeout: 30000 })
	}

	/**
	 * Create a test file in Nextcloud via WebDAV
	 */
	async createTestFile(filename: string, content: string = 'test content') {
		// This would use WebDAV API - for now we'll use the file upload
		// In a real implementation, this would make a PUT request to WebDAV
		console.log(`Creating test file: ${filename}`)
	}

	/**
	 * Delete a file via the UI
	 */
	async deleteFile(filename: string) {
		const fileRow = this.getFileRow(filename)
		await fileRow.locator(selectors.fileActions).click()
		await this.page.click('button:has-text("Delete")')
		await expect(fileRow).not.toBeVisible({ timeout: 10000 })
	}

	/**
	 * Add a label to a file (requires files_labels app)
	 */
	async addLabelToFile(filename: string, labelKey: string, labelValue: string) {
		// Click on file to open sidebar
		await this.getFileRow(filename).click()

		// Wait for sidebar and click Labels tab
		await this.page.click(selectors.labelsSidebarTab)

		// Add label - this depends on files_labels UI
		// For now, we use the API approach
		const fileId = await this.getFileId(filename)
		if (fileId) {
			await this.setLabelViaAPI(fileId, labelKey, labelValue)
		}
	}

	/**
	 * Get file ID from the DOM
	 */
	async getFileId(filename: string): Promise<number | null> {
		const fileRow = this.getFileRow(filename)
		const fileId = await fileRow.getAttribute('data-cy-files-list-row-fileid')
			|| await fileRow.getAttribute('data-file-id')
			|| await fileRow.getAttribute('data-id')
		return fileId ? parseInt(fileId, 10) : null
	}

	/**
	 * Set label via OCS API
	 */
	async setLabelViaAPI(fileId: number, labelKey: string, labelValue: string) {
		const response = await this.page.request.put(
			`${config.baseUrl}/ocs/v2.php/apps/files_labels/api/v1/labels/${fileId}/${labelKey}`,
			{
				headers: {
					'OCS-APIRequest': 'true',
					'Content-Type': 'application/json',
				},
				data: { value: labelValue },
			}
		)
		expect(response.ok()).toBeTruthy()
	}

	/**
	 * Delete label via OCS API
	 */
	async deleteLabelViaAPI(fileId: number, labelKey: string) {
		const response = await this.page.request.delete(
			`${config.baseUrl}/ocs/v2.php/apps/files_labels/api/v1/labels/${fileId}/${labelKey}`,
			{
				headers: {
					'OCS-APIRequest': 'true',
				},
			}
		)
		expect(response.ok()).toBeTruthy()
	}

	/**
	 * Get current spoiler trigger labels from settings API
	 */
	async getTriggerLabels(): Promise<string[]> {
		const response = await this.page.request.get(
			`${config.baseUrl}/ocs/v2.php/apps/files_spoilers/api/v1/settings`,
			{
				headers: { 'OCS-APIRequest': 'true' },
			}
		)
		const data = await response.json()
		return data.ocs?.data?.trigger_labels || []
	}

	/**
	 * Set spoiler trigger labels via API
	 */
	async setTriggerLabelsViaAPI(labels: string[]) {
		const response = await this.page.request.put(
			`${config.baseUrl}/ocs/v2.php/apps/files_spoilers/api/v1/settings/trigger-labels`,
			{
				headers: {
					'OCS-APIRequest': 'true',
					'Content-Type': 'application/json',
				},
				data: { labels },
			}
		)
		expect(response.ok()).toBeTruthy()
	}

	/**
	 * Set custom placeholder via API
	 */
	async setPlaceholderViaAPI(fileId: number) {
		const response = await this.page.request.put(
			`${config.baseUrl}/ocs/v2.php/apps/files_spoilers/api/v1/settings/placeholder`,
			{
				headers: {
					'OCS-APIRequest': 'true',
					'Content-Type': 'application/json',
				},
				data: { fileId },
			}
		)
		expect(response.ok()).toBeTruthy()
	}

	/**
	 * Clear custom placeholder via API
	 */
	async clearPlaceholderViaAPI() {
		const response = await this.page.request.delete(
			`${config.baseUrl}/ocs/v2.php/apps/files_spoilers/api/v1/settings/placeholder`,
			{
				headers: { 'OCS-APIRequest': 'true' },
			}
		)
		expect(response.ok()).toBeTruthy()
	}

	/**
	 * Add trigger label via Settings UI
	 */
	async addTriggerLabelViaUI(key: string, value: string) {
		await this.page.fill(selectors.keyInput, key)
		await this.page.fill(selectors.valueInput, value)
		await this.page.click(selectors.addButton)
	}

	/**
	 * Remove trigger label via Settings UI
	 */
	async removeTriggerLabelViaUI(label: string) {
		const removeButton = this.page.locator(selectors.triggerRemoveButton(label))
		await removeButton.click()
	}

	/**
	 * Wait for success notification
	 */
	async waitForSuccess(timeout: number = 5000) {
		await this.page.waitForSelector(
			`${selectors.successNotification}, ${selectors.successMessage}`,
			{ timeout }
		)
	}

	/**
	 * Wait for error notification
	 */
	async waitForError(timeout: number = 5000) {
		await this.page.waitForSelector(
			`${selectors.errorNotification}, ${selectors.errorMessage}`,
			{ timeout }
		)
	}

	/**
	 * Count spoilered files in the current view
	 */
	async countSpoileredFiles(): Promise<number> {
		const spoilers = this.page.locator(selectors.spoilerPlaceholder)
		return await spoilers.count()
	}

	/**
	 * Get all trigger labels from UI
	 */
	async getTriggerLabelsFromUI(): Promise<string[]> {
		const triggers = this.page.locator(`${selectors.triggerItem} .trigger-label`)
		const count = await triggers.count()
		const labels: string[] = []
		for (let i = 0; i < count; i++) {
			labels.push(await triggers.nth(i).textContent() || '')
		}
		return labels
	}

	/**
	 * Reset settings to defaults
	 */
	async resetSettings() {
		await this.setTriggerLabelsViaAPI(['sensitive=true'])
		await this.clearPlaceholderViaAPI()
	}
}

/**
 * Extended test fixture with NextcloudPage
 */
export const test = base.extend<{ nextcloud: NextcloudPage }>({
	nextcloud: async ({ page }, use) => {
		const nextcloud = new NextcloudPage(page)
		await use(nextcloud)
	},
})

export { expect }
