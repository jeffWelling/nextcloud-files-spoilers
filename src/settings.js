/**
 * SPDX-FileCopyrightText: 2024 Jeff <jeff@example.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import Vue from 'vue'
import PersonalSettings from './views/PersonalSettings.vue'

// Try mounting immediately, or wait for DOM if not ready
function mount() {
	const container = document.getElementById('files_spoilers_settings')
	if (container) {
		console.log('Mounting File Spoilers settings')
		const View = Vue.extend(PersonalSettings)
		new View().$mount(container)
	} else {
		console.warn('Container #files_spoilers_settings not found')
	}
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', mount)
} else {
	mount()
}
