<?php

declare(strict_types=1);

/**
 * SPDX-FileCopyrightText: 2025 Jeff Welling <real.jeff.welling@gmail.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

namespace OCA\FilesSpoilers\Settings;

use OCA\FilesSpoilers\AppInfo\Application;
use OCA\FilesSpoilers\Service\SpoilerService;
use OCP\AppFramework\Http\TemplateResponse;
use OCP\AppFramework\Services\IInitialState;
use OCP\Settings\ISettings;

class Personal implements ISettings {
	public function __construct(
		private SpoilerService $spoilerService,
		private IInitialState $initialState,
	) {
	}

	public function getForm(): TemplateResponse {
		try {
			$settings = $this->spoilerService->getSettings();
			$this->initialState->provideInitialState('settings', $settings);
		} catch (\RuntimeException $e) {
			// Not authenticated - provide empty defaults
			$this->initialState->provideInitialState('settings', [
				'trigger_labels' => ['sensitive=true'],
				'placeholder_file_id' => null,
			]);
		}

		return new TemplateResponse(Application::APP_ID, 'settings/personal');
	}

	public function getSection(): string {
		return 'files_spoilers';
	}

	public function getPriority(): int {
		return 90;
	}
}
