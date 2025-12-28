<?php

declare(strict_types=1);

/**
 * SPDX-FileCopyrightText: 2025 Jeff Welling <real.jeff.welling@gmail.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

namespace OCA\FilesSpoilers\Controller;

use OCA\FilesSpoilers\Service\SpoilerService;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\DataResponse;
use OCP\AppFramework\OCSController;
use OCP\IRequest;

class SettingsController extends OCSController {
	public function __construct(
		string $appName,
		IRequest $request,
		private SpoilerService $spoilerService,
	) {
		parent::__construct($appName, $request);
	}

	/**
	 * Get current spoiler settings
	 *
	 * @return DataResponse
	 */
	#[NoAdminRequired]
	public function get(): DataResponse {
		try {
			$settings = $this->spoilerService->getSettings();
			return new DataResponse($settings);
		} catch (\RuntimeException $e) {
			return new DataResponse(
				['message' => $e->getMessage()],
				Http::STATUS_UNAUTHORIZED
			);
		}
	}

	/**
	 * Set the trigger labels
	 *
	 * @param array $labels Array of "key=value" strings
	 * @return DataResponse
	 */
	#[NoAdminRequired]
	public function setTriggerLabels(array $labels): DataResponse {
		try {
			$this->spoilerService->setTriggerLabels($labels);
			return new DataResponse([
				'trigger_labels' => $labels,
			]);
		} catch (\InvalidArgumentException $e) {
			return new DataResponse(
				['message' => $e->getMessage()],
				Http::STATUS_BAD_REQUEST
			);
		} catch (\RuntimeException $e) {
			return new DataResponse(
				['message' => $e->getMessage()],
				Http::STATUS_UNAUTHORIZED
			);
		}
	}

	/**
	 * Set a custom placeholder file
	 *
	 * @param int $fileId The file ID to use as placeholder
	 * @return DataResponse
	 */
	#[NoAdminRequired]
	public function setPlaceholder(int $fileId): DataResponse {
		try {
			$this->spoilerService->setPlaceholderFileId($fileId);
			return new DataResponse([
				'placeholder_file_id' => $fileId,
			]);
		} catch (\RuntimeException $e) {
			return new DataResponse(
				['message' => $e->getMessage()],
				Http::STATUS_UNAUTHORIZED
			);
		}
	}

	/**
	 * Remove the custom placeholder (use default)
	 *
	 * @return DataResponse
	 */
	#[NoAdminRequired]
	public function deletePlaceholder(): DataResponse {
		try {
			$this->spoilerService->clearPlaceholderFileId();
			return new DataResponse([
				'placeholder_file_id' => null,
			]);
		} catch (\RuntimeException $e) {
			return new DataResponse(
				['message' => $e->getMessage()],
				Http::STATUS_UNAUTHORIZED
			);
		}
	}
}
