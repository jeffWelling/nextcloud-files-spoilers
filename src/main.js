/**
 * SPDX-FileCopyrightText: 2024 Jeff <jeff@example.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import axios from '@nextcloud/axios'
import { generateOcsUrl, generateUrl } from '@nextcloud/router'
import { subscribe } from '@nextcloud/event-bus'

// Store for spoiler state
const spoilerState = {
	settings: {
		trigger_labels: ['sensitive=true'],
		placeholder_file_id: null,
	},
	labelCache: new Map(), // fileId -> labels
	revealedFiles: new Set(),
	loaded: false,
	pendingPromises: new Map(), // fileId -> Promise (for deduplication)
}

// Batch fetching state
const batchState = {
	queue: new Map(), // fileId -> { resolve, reject }
	timer: null,
	BATCH_DELAY: 50, // ms to wait before sending batch request
}

// Load user settings
async function loadSettings() {
	if (spoilerState.loaded) {
		return
	}

	try {
		const url = generateOcsUrl('apps/files_spoilers/api/v1/settings')
		const response = await axios.get(url)
		spoilerState.settings = response.data.ocs.data
		spoilerState.loaded = true
		console.log('[files_spoilers] Settings loaded:', spoilerState.settings)
	} catch (error) {
		console.error('[files_spoilers] Failed to load settings:', error)
	}
}

// Execute batch fetch of labels
async function executeBatchFetch() {
	batchState.timer = null

	if (batchState.queue.size === 0) {
		return
	}

	// Copy and clear the queue
	const pending = new Map(batchState.queue)
	batchState.queue.clear()

	const fileIds = Array.from(pending.keys())
	console.log('[files_spoilers] Batch fetching labels for', fileIds.length, 'files')

	try {
		const url = generateOcsUrl('apps/files_labels/api/v1/labels/bulk')
		const response = await axios.post(url, { fileIds })
		const results = response.data.ocs.data || {}

		// Resolve all promises with their results
		for (const [fileId, handlers] of pending) {
			const labels = results[fileId] || {}
			spoilerState.labelCache.set(fileId, labels)
			spoilerState.pendingPromises.delete(fileId)
			handlers.resolve(labels)
		}
	} catch (error) {
		console.error('[files_spoilers] Batch fetch failed, falling back to individual requests:', error)
		// Fallback: fetch individually
		for (const [fileId, handlers] of pending) {
			try {
				const url = generateOcsUrl('apps/files_labels/api/v1/labels/{fileId}', { fileId })
				const response = await axios.get(url)
				const labels = response.data.ocs.data || {}
				spoilerState.labelCache.set(fileId, labels)
				handlers.resolve(labels)
			} catch (e) {
				spoilerState.labelCache.set(fileId, {})
				handlers.resolve({})
			} finally {
				spoilerState.pendingPromises.delete(fileId)
			}
		}
	}
}

// Fetch labels for a file (batched)
function fetchLabels(fileId) {
	// Return cached result immediately
	if (spoilerState.labelCache.has(fileId)) {
		return Promise.resolve(spoilerState.labelCache.get(fileId))
	}

	// Return existing pending promise (deduplication)
	if (spoilerState.pendingPromises.has(fileId)) {
		return spoilerState.pendingPromises.get(fileId)
	}

	// Create a new promise and add to batch queue
	const promise = new Promise((resolve, reject) => {
		batchState.queue.set(fileId, { resolve, reject })
	})

	spoilerState.pendingPromises.set(fileId, promise)

	// Schedule batch execution
	if (!batchState.timer) {
		batchState.timer = setTimeout(executeBatchFetch, batchState.BATCH_DELAY)
	}

	return promise
}

// Check if file labels match any trigger
function isSpoilered(fileLabels, triggerLabels) {
	if (!fileLabels || typeof fileLabels !== 'object') {
		return false
	}

	for (const trigger of triggerLabels) {
		const parts = trigger.split('=')
		if (parts.length !== 2) continue
		const [key, value] = parts
		if (fileLabels[key] === value) {
			return true
		}
	}

	return false
}

// Process a single file row
async function processFileRow(row) {
	// Get file ID from various possible sources
	const fileId = parseInt(
		row.dataset?.fileId
		|| row.dataset?.id
		|| row.getAttribute('data-cy-files-list-row-fileid')
		|| row.querySelector('[data-cy-files-list-row-fileid]')?.getAttribute('data-cy-files-list-row-fileid')
		|| '',
		10
	)

	if (!fileId || isNaN(fileId)) {
		return
	}

	// Skip if already revealed
	if (spoilerState.revealedFiles.has(fileId)) {
		return
	}

	// Find preview container
	const previewContainer = row.querySelector(
		'.files-list__row-icon, ' +
		'.files-list__row-icon-preview, ' +
		'[data-cy-files-list-row-icon], ' +
		'.thumbnail-wrapper, ' +
		'.thumbnail'
	)

	if (!previewContainer) {
		return
	}

	// Skip if already processed
	if (previewContainer.dataset.spoilerChecked === 'true') {
		return
	}
	previewContainer.dataset.spoilerChecked = 'true'

	// Fetch labels and check
	const labels = await fetchLabels(fileId)

	if (isSpoilered(labels, spoilerState.settings.trigger_labels)) {
		applySpoilerPlaceholder(previewContainer, fileId)
	}
}

// Apply spoiler placeholder to a preview container
function applySpoilerPlaceholder(previewContainer, fileId) {
	// Check if already spoilered
	if (previewContainer.querySelector('.spoiler-placeholder')) {
		return
	}

	// Hide the original preview content
	for (const child of previewContainer.children) {
		if (!child.classList.contains('spoiler-placeholder')) {
			child.style.display = 'none'
		}
	}

	// Create placeholder
	const placeholder = document.createElement('div')
	placeholder.className = 'spoiler-placeholder'

	// Use custom placeholder image if configured, otherwise default SVG
	if (spoilerState.settings.placeholder_file_id) {
		const img = document.createElement('img')
		img.src = generateUrl('/core/preview?fileId={fileId}&x=128&y=128', {
			fileId: spoilerState.settings.placeholder_file_id,
		})
		img.alt = 'Spoiler'
		img.style.cssText = 'width: 100%; height: 100%; object-fit: cover;'
		placeholder.appendChild(img)
	} else {
		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
		svg.setAttribute('width', '24')
		svg.setAttribute('height', '24')
		svg.setAttribute('viewBox', '0 0 24 24')
		svg.setAttribute('fill', 'none')
		svg.setAttribute('stroke', 'currentColor')
		svg.setAttribute('stroke-width', '2')

		const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
		path.setAttribute('d', 'M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24')
		svg.appendChild(path)

		const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
		line.setAttribute('x1', '1')
		line.setAttribute('y1', '1')
		line.setAttribute('x2', '23')
		line.setAttribute('y2', '23')
		svg.appendChild(line)

		placeholder.appendChild(svg)
	}

	placeholder.style.cssText = `
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		min-height: 32px;
		background: var(--color-background-dark, #666);
		color: var(--color-text-lighter, #fff);
		border-radius: var(--border-radius, 4px);
		cursor: pointer;
		overflow: hidden;
	`
	placeholder.title = 'Click to reveal'
	placeholder.setAttribute('role', 'button')
	placeholder.setAttribute('tabindex', '0')
	placeholder.setAttribute('aria-label', 'Hidden content - click or press Enter to reveal')

	// Add click handler to reveal
	placeholder.addEventListener('click', (e) => {
		e.preventDefault()
		e.stopPropagation()
		revealFile(previewContainer, fileId)
	})

	// Add keyboard handler for accessibility
	placeholder.addEventListener('keydown', (e) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault()
			e.stopPropagation()
			revealFile(previewContainer, fileId)
		}
	})

	previewContainer.appendChild(placeholder)
}

// Reveal a spoilered file
function revealFile(previewContainer, fileId) {
	spoilerState.revealedFiles.add(fileId)

	// Remove placeholder
	const placeholder = previewContainer.querySelector('.spoiler-placeholder')
	if (placeholder) {
		placeholder.remove()
	}

	// Show original content
	for (const child of previewContainer.children) {
		child.style.display = ''
	}

	// Reset checked flag so it won't be re-spoilered
	previewContainer.dataset.spoilerRevealed = 'true'
}

// Process all file rows in a container
function processSpoilers(container) {
	const rows = container.querySelectorAll?.(
		'.files-list__row, ' +
		'[data-cy-files-list-row], ' +
		'.file-row, ' +
		'tr[data-file]'
	) || []

	for (const row of rows) {
		processFileRow(row)
	}
}

// Set up mutation observer to watch for new files
function setupObserver() {
	const observer = new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			for (const node of mutation.addedNodes) {
				if (node.nodeType === Node.ELEMENT_NODE) {
					// Check if this is a file row
					if (node.matches?.('.files-list__row, [data-cy-files-list-row]')) {
						processFileRow(node)
					} else {
						// Check children
						processSpoilers(node)
					}
				}
			}
		}
	})

	// Find file list container
	const findAndObserve = () => {
		const containers = document.querySelectorAll(
			'.files-list, ' +
			'[data-cy-files-list], ' +
			'#fileList, ' +
			'.files-filestable'
		)

		for (const container of containers) {
			if (!container.dataset.spoilerObserving) {
				container.dataset.spoilerObserving = 'true'
				observer.observe(container, { childList: true, subtree: true })
				console.log('[files_spoilers] Observing container:', container)
				processSpoilers(container)
			}
		}
	}

	// Initial setup
	findAndObserve()

	// Also watch for the file list to appear (SPA navigation)
	const bodyObserver = new MutationObserver(() => {
		findAndObserve()
	})
	bodyObserver.observe(document.body, { childList: true, subtree: true })
}

// Handle label changes from files_labels app
function handleLabelChange({ fileId, labels }) {
	console.log('[files_spoilers] Label changed for file', fileId, labels)

	// Update cache
	spoilerState.labelCache.set(fileId, labels)

	// Check if this file should now be spoilered or revealed
	const shouldBeSpoilered = isSpoilered(labels, spoilerState.settings.trigger_labels)
	const isRevealed = spoilerState.revealedFiles.has(fileId)

	// Find the file row in the DOM
	const row = document.querySelector(
		`[data-cy-files-list-row-fileid="${fileId}"], ` +
		`tr[data-file][data-id="${fileId}"], ` +
		`.files-list__row[data-file-id="${fileId}"]`
	)

	if (!row) {
		return
	}

	const previewContainer = row.querySelector(
		'.files-list__row-icon, ' +
		'.files-list__row-icon-preview, ' +
		'[data-cy-files-list-row-icon], ' +
		'.thumbnail-wrapper, ' +
		'.thumbnail'
	)

	if (!previewContainer) {
		return
	}

	if (shouldBeSpoilered && !isRevealed) {
		// Apply spoiler
		applySpoilerPlaceholder(previewContainer, fileId)
	} else if (!shouldBeSpoilered) {
		// Remove spoiler if present
		const placeholder = previewContainer.querySelector('.spoiler-placeholder')
		if (placeholder) {
			revealFile(previewContainer, fileId)
		}
		// Also remove from revealed set since label no longer triggers
		spoilerState.revealedFiles.delete(fileId)
	}
}

// Initialize
async function init() {
	console.log('[files_spoilers] Initializing...')
	await loadSettings()
	setupObserver()

	// Listen for label changes from files_labels
	subscribe('files_labels:label-changed', handleLabelChange)

	console.log('[files_spoilers] Ready')
}

// Start when DOM is ready
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', init)
} else {
	init()
}
