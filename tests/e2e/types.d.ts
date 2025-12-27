/**
 * SPDX-FileCopyrightText: 2024 Jeff <jeff@example.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Type declarations for Nextcloud globals
 */

declare global {
	interface Window {
		OC?: {
			EventBus?: {
				emit: (event: string, data: unknown) => void
				subscribe: (event: string, callback: (data: unknown) => void) => void
			}
		}
	}

	// Nextcloud global object
	const OC: {
		EventBus?: {
			emit: (event: string, data: unknown) => void
			subscribe: (event: string, callback: (data: unknown) => void) => void
		}
	} | undefined
}

export {}
