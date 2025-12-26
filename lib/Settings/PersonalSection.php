<?php

declare(strict_types=1);

/**
 * SPDX-FileCopyrightText: 2024 Jeff <jeff@example.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

namespace OCA\FilesSpoilers\Settings;

use OCP\IL10N;
use OCP\IURLGenerator;
use OCP\Settings\IIconSection;

class PersonalSection implements IIconSection {
	public function __construct(
		private IL10N $l,
		private IURLGenerator $urlGenerator,
	) {
	}

	public function getID(): string {
		return 'files_spoilers';
	}

	public function getName(): string {
		return $this->l->t('File Spoilers');
	}

	public function getPriority(): int {
		return 55;
	}

	public function getIcon(): string {
		return $this->urlGenerator->imagePath('files_spoilers', 'app-dark.svg');
	}
}
