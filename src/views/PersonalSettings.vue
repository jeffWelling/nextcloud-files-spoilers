<!--
  - SPDX-FileCopyrightText: 2024 Jeff <jeff@example.com>
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
	<div class="files-spoilers-settings">
		<NcSettingsSection
			:name="t('files_spoilers', 'File Spoilers')"
			:description="t('files_spoilers', 'Hide previews for files with specific labels')">
			<!-- Trigger Labels Section -->
			<div class="setting-group">
				<h3>{{ t('files_spoilers', 'Spoiler triggers') }}</h3>
				<p class="description">
					{{ t('files_spoilers', 'Files with any of these labels will have their preview hidden.') }}
				</p>

				<!-- Current triggers -->
				<div class="trigger-list">
					<div
						v-for="(label, index) in triggerLabels"
						:key="index"
						class="trigger-item">
						<span class="trigger-label">{{ label }}</span>
						<NcButton
							type="tertiary"
							:aria-label="t('files_spoilers', 'Remove trigger')"
							@click="removeLabel(index)">
							<template #icon>
								<CloseIcon :size="20" />
							</template>
						</NcButton>
					</div>
				</div>

				<!-- Add new trigger -->
				<div class="add-trigger">
					<form @submit.prevent="addLabel">
						<div class="input-group">
							<input
								v-model="newKey"
								type="text"
								:placeholder="t('files_spoilers', 'Label key (e.g., sensitive)')"
								class="input-key"
								required
								pattern="[a-z0-9_:.-]+"
								:disabled="saving">
							<span class="separator">=</span>
							<input
								v-model="newValue"
								type="text"
								:placeholder="t('files_spoilers', 'Value (e.g., true)')"
								class="input-value"
								required
								:disabled="saving">
							<NcButton
								type="primary"
								native-type="submit"
								:disabled="saving || !newKey || !newValue">
								<template #icon>
									<PlusIcon :size="20" />
								</template>
								{{ t('files_spoilers', 'Add') }}
							</NcButton>
						</div>
					</form>
				</div>
			</div>

			<!-- Custom Placeholder Section -->
			<div class="setting-group">
				<h3>{{ t('files_spoilers', 'Custom placeholder') }}</h3>
				<p class="description">
					{{ t('files_spoilers', 'Optionally use a custom image instead of the default gray placeholder.') }}
				</p>

				<div v-if="placeholderFileId" class="placeholder-preview">
					<img :src="placeholderPreviewUrl" alt="">
					<NcButton
						type="tertiary-no-background"
						@click="clearPlaceholder">
						<template #icon>
							<CloseIcon :size="20" />
						</template>
						{{ t('files_spoilers', 'Remove custom placeholder') }}
					</NcButton>
				</div>

				<NcButton
					v-else
					type="secondary"
					@click="openFilePicker">
					<template #icon>
						<ImageIcon :size="20" />
					</template>
					{{ t('files_spoilers', 'Choose image') }}
				</NcButton>
			</div>

			<!-- Status messages -->
			<div v-if="error" class="message error">
				{{ error }}
			</div>
			<div v-if="success" class="message success">
				{{ success }}
			</div>
		</NcSettingsSection>
	</div>
</template>

<script>
import axios from '@nextcloud/axios'
import { generateOcsUrl, generateUrl } from '@nextcloud/router'
import { loadState } from '@nextcloud/initial-state'
import { showError, showSuccess } from '@nextcloud/dialogs'
import { translate as t } from '@nextcloud/l10n'
import NcSettingsSection from '@nextcloud/vue/dist/Components/NcSettingsSection.js'
import NcButton from '@nextcloud/vue/dist/Components/NcButton.js'
import CloseIcon from 'vue-material-design-icons/Close.vue'
import PlusIcon from 'vue-material-design-icons/Plus.vue'
import ImageIcon from 'vue-material-design-icons/Image.vue'

export default {
	name: 'PersonalSettings',

	components: {
		NcSettingsSection,
		NcButton,
		CloseIcon,
		PlusIcon,
		ImageIcon,
	},

	data() {
		const initialState = loadState('files_spoilers', 'settings', {
			trigger_labels: ['sensitive=true'],
			placeholder_file_id: null,
		})

		return {
			triggerLabels: [...initialState.trigger_labels],
			placeholderFileId: initialState.placeholder_file_id,
			newKey: '',
			newValue: '',
			saving: false,
			error: null,
			success: null,
		}
	},

	computed: {
		placeholderPreviewUrl() {
			if (!this.placeholderFileId) {
				return null
			}
			return generateUrl('/core/preview?fileId={fileId}&x=128&y=128', {
				fileId: this.placeholderFileId,
			})
		},
	},

	methods: {
		t,

		async addLabel() {
			if (!this.newKey || !this.newValue) {
				return
			}

			const newLabel = `${this.newKey}=${this.newValue}`

			// Check for duplicates
			if (this.triggerLabels.includes(newLabel)) {
				this.error = t('files_spoilers', 'This trigger already exists')
				return
			}

			const updatedLabels = [...this.triggerLabels, newLabel]
			await this.saveTriggerLabels(updatedLabels)

			if (!this.error) {
				this.newKey = ''
				this.newValue = ''
			}
		},

		async removeLabel(index) {
			const updatedLabels = this.triggerLabels.filter((_, i) => i !== index)
			await this.saveTriggerLabels(updatedLabels)
		},

		async saveTriggerLabels(labels) {
			this.saving = true
			this.error = null
			this.success = null

			try {
				const url = generateOcsUrl('apps/files_spoilers/api/v1/settings/trigger-labels')
				await axios.put(url, { labels })
				this.triggerLabels = labels
				this.success = t('files_spoilers', 'Settings saved')
				showSuccess(t('files_spoilers', 'Settings saved'))
				setTimeout(() => {
					this.success = null
				}, 3000)
			} catch (error) {
				console.error('Failed to save trigger labels:', error)
				const message = error.response?.data?.ocs?.meta?.message
					|| t('files_spoilers', 'Failed to save settings')
				this.error = message
				showError(message)
			} finally {
				this.saving = false
			}
		},

		openFilePicker() {
			// For now, prompt for file ID directly
			// TODO: Integrate with Nextcloud file picker when build issues are resolved
			const fileIdStr = prompt(t('files_spoilers', 'Enter the file ID of your placeholder image:'))
			if (fileIdStr) {
				const fileId = parseInt(fileIdStr, 10)
				if (!isNaN(fileId) && fileId > 0) {
					this.setPlaceholder(fileId)
				} else {
					showError(t('files_spoilers', 'Invalid file ID'))
				}
			}
		},

		async setPlaceholder(fileId) {
			this.saving = true
			this.error = null

			try {
				const url = generateOcsUrl('apps/files_spoilers/api/v1/settings/placeholder')
				await axios.put(url, { fileId })
				this.placeholderFileId = fileId
				showSuccess(t('files_spoilers', 'Placeholder updated'))
			} catch (error) {
				console.error('Failed to set placeholder:', error)
				const message = error.response?.data?.ocs?.meta?.message
					|| t('files_spoilers', 'Failed to set placeholder')
				this.error = message
				showError(message)
			} finally {
				this.saving = false
			}
		},

		async clearPlaceholder() {
			this.saving = true
			this.error = null

			try {
				const url = generateOcsUrl('apps/files_spoilers/api/v1/settings/placeholder')
				await axios.delete(url)
				this.placeholderFileId = null
				showSuccess(t('files_spoilers', 'Using default placeholder'))
			} catch (error) {
				console.error('Failed to clear placeholder:', error)
				const message = error.response?.data?.ocs?.meta?.message
					|| t('files_spoilers', 'Failed to clear placeholder')
				this.error = message
				showError(message)
			} finally {
				this.saving = false
			}
		},
	},
}
</script>

<style scoped lang="scss">
.files-spoilers-settings {
	max-width: 700px;
}

.setting-group {
	margin-bottom: 32px;

	h3 {
		font-size: 16px;
		font-weight: 600;
		margin: 0 0 8px 0;
	}

	.description {
		color: var(--color-text-lighter);
		margin: 0 0 16px 0;
	}
}

.trigger-list {
	display: flex;
	flex-direction: column;
	gap: 8px;
	margin-bottom: 16px;
}

.trigger-item {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 8px 12px;
	background-color: var(--color-background-dark);
	border-radius: var(--border-radius);

	.trigger-label {
		font-family: monospace;
		font-size: 14px;
	}
}

.add-trigger {
	.input-group {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}

	.input-key,
	.input-value {
		padding: 8px 12px;
		border: 1px solid var(--color-border);
		border-radius: var(--border-radius);
		font-size: 14px;
		min-width: 150px;

		&:focus {
			outline: none;
			border-color: var(--color-primary-element);
		}
	}

	.separator {
		font-size: 18px;
		font-weight: bold;
		color: var(--color-text-lighter);
	}
}

.placeholder-preview {
	display: flex;
	align-items: center;
	gap: 16px;

	img {
		width: 64px;
		height: 64px;
		object-fit: cover;
		border-radius: var(--border-radius);
		border: 1px solid var(--color-border);
	}
}

.message {
	padding: 12px;
	border-radius: var(--border-radius);
	margin-top: 16px;

	&.error {
		background-color: var(--color-error);
		color: var(--color-primary-text);
	}

	&.success {
		background-color: var(--color-success);
		color: var(--color-primary-text);
	}
}
</style>
