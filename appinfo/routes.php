<?php

declare(strict_types=1);

/**
 * SPDX-FileCopyrightText: 2025 Jeff Welling <real.jeff.welling@gmail.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

return [
	'ocs' => [
		// Settings API
		['name' => 'Settings#get', 'url' => '/api/v1/settings', 'verb' => 'GET'],
		['name' => 'Settings#setTriggerLabels', 'url' => '/api/v1/settings/trigger-labels', 'verb' => 'PUT'],
		['name' => 'Settings#setPlaceholder', 'url' => '/api/v1/settings/placeholder', 'verb' => 'PUT'],
		['name' => 'Settings#deletePlaceholder', 'url' => '/api/v1/settings/placeholder', 'verb' => 'DELETE'],

		// Check spoiler status for files
		['name' => 'Spoiler#check', 'url' => '/api/v1/spoiler/{fileId}', 'verb' => 'GET'],
		['name' => 'Spoiler#checkBulk', 'url' => '/api/v1/spoiler/bulk', 'verb' => 'POST'],
	],
];
