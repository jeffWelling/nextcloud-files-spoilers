<!--
  - SPDX-FileCopyrightText: 2024 Jeff <jeff@example.com>
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
	<div class="spoiler-placeholder" @click="handleClick">
		<!-- Custom placeholder image if configured -->
		<img
			v-if="customPlaceholderUrl"
			:src="customPlaceholderUrl"
			:alt="t('files_spoilers', 'Hidden preview')"
			class="custom-placeholder">

		<!-- Default: Eye-off icon -->
		<div v-else class="default-placeholder">
			<EyeOffIcon :size="iconSize" />
		</div>
	</div>
</template>

<script>
import EyeOffIcon from 'vue-material-design-icons/EyeOff.vue'
import { generateUrl } from '@nextcloud/router'

export default {
	name: 'SpoilerPlaceholder',

	components: {
		EyeOffIcon,
	},

	props: {
		/**
		 * Size of the placeholder icon
		 */
		iconSize: {
			type: Number,
			default: 32,
		},
		/**
		 * File ID of the custom placeholder image (optional)
		 */
		placeholderFileId: {
			type: Number,
			default: null,
		},
	},

	emits: ['reveal'],

	computed: {
		customPlaceholderUrl() {
			if (!this.placeholderFileId) {
				return null
			}
			// Generate preview URL for the custom placeholder
			return generateUrl('/core/preview?fileId={fileId}&x=128&y=128', {
				fileId: this.placeholderFileId,
			})
		},
	},

	methods: {
		handleClick(event) {
			// Emit reveal event on double-click or if explicitly requested
			if (event.detail === 2) {
				this.$emit('reveal')
			}
		},
	},
}
</script>

<style scoped lang="scss">
.spoiler-placeholder {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 100%;
	height: 100%;
	background-color: #666666;
	border-radius: inherit;
	cursor: pointer;
	transition: background-color 0.2s ease;

	&:hover {
		background-color: #555555;
	}
}

.default-placeholder {
	display: flex;
	align-items: center;
	justify-content: center;
	color: #ffffff;
	opacity: 0.8;
}

.custom-placeholder {
	width: 100%;
	height: 100%;
	object-fit: cover;
	border-radius: inherit;
}
</style>
