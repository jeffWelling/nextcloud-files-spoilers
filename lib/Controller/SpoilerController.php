<?php

declare(strict_types=1);

/**
 * SPDX-FileCopyrightText: 2024 Jeff <jeff@example.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

namespace OCA\FilesSpoilers\Controller;

use OCA\FilesSpoilers\Service\SpoilerService;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\DataResponse;
use OCP\AppFramework\OCSController;
use OCP\IRequest;

/**
 * Controller for checking spoiler status of files.
 *
 * Note: This controller requires the files_labels app to be available.
 * It integrates with files_labels to get file labels and check against
 * the user's configured spoiler triggers.
 */
class SpoilerController extends OCSController {
	public function __construct(
		string $appName,
		IRequest $request,
		private SpoilerService $spoilerService,
	) {
		parent::__construct($appName, $request);
	}

	/**
	 * Check if a single file should be spoilered
	 *
	 * @param int $fileId The file ID to check
	 * @return DataResponse
	 */
	#[NoAdminRequired]
	public function check(int $fileId): DataResponse {
		try {
			// Get labels from files_labels app
			$labels = $this->getFileLabels($fileId);
			$isSpoilered = $this->spoilerService->isSpoilered($labels);

			return new DataResponse([
				'fileId' => $fileId,
				'spoilered' => $isSpoilered,
				'labels' => $labels,
			]);
		} catch (\RuntimeException $e) {
			return new DataResponse(
				['message' => $e->getMessage()],
				Http::STATUS_UNAUTHORIZED
			);
		} catch (\Exception $e) {
			return new DataResponse(
				['message' => 'Failed to check spoiler status: ' . $e->getMessage()],
				Http::STATUS_INTERNAL_SERVER_ERROR
			);
		}
	}

	/**
	 * Check spoiler status for multiple files at once
	 *
	 * @param array $fileIds Array of file IDs to check
	 * @return DataResponse
	 */
	#[NoAdminRequired]
	public function checkBulk(array $fileIds): DataResponse {
		try {
			if (empty($fileIds)) {
				return new DataResponse(
					['message' => 'No file IDs provided'],
					Http::STATUS_BAD_REQUEST
				);
			}

			// Limit to prevent abuse
			if (count($fileIds) > 1000) {
				return new DataResponse(
					['message' => 'Too many file IDs (max 1000)'],
					Http::STATUS_BAD_REQUEST
				);
			}

			// Get labels for all files
			$filesLabels = $this->getFilesLabels($fileIds);

			// Check spoiler status for each
			$results = $this->spoilerService->checkBulkSpoilerStatus($filesLabels);

			return new DataResponse([
				'files' => $results,
			]);
		} catch (\RuntimeException $e) {
			return new DataResponse(
				['message' => $e->getMessage()],
				Http::STATUS_UNAUTHORIZED
			);
		} catch (\Exception $e) {
			return new DataResponse(
				['message' => 'Failed to check spoiler status: ' . $e->getMessage()],
				Http::STATUS_INTERNAL_SERVER_ERROR
			);
		}
	}

	/**
	 * Get labels for a single file from files_labels app
	 *
	 * @param int $fileId
	 * @return array<string, string>
	 */
	private function getFileLabels(int $fileId): array {
		// Try to get the LabelsService from files_labels
		try {
			$labelsService = \OC::$server->get(\OCA\FilesLabels\Service\LabelsService::class);
			return $labelsService->getLabels($fileId);
		} catch (\Exception $e) {
			// files_labels not available or other error
			// Return empty labels - file won't be spoilered
			return [];
		}
	}

	/**
	 * Get labels for multiple files from files_labels app
	 *
	 * @param int[] $fileIds
	 * @return array<int, array<string, string>>
	 */
	private function getFilesLabels(array $fileIds): array {
		try {
			$labelsService = \OC::$server->get(\OCA\FilesLabels\Service\LabelsService::class);
			return $labelsService->getLabelsForFiles($fileIds);
		} catch (\Exception $e) {
			// files_labels not available or other error
			// Return empty labels for all files
			$result = [];
			foreach ($fileIds as $fileId) {
				$result[$fileId] = [];
			}
			return $result;
		}
	}
}
