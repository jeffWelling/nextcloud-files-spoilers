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
use OCP\Files\IRootFolder;
use OCP\IRequest;
use OCP\IServerContainer;
use OCP\IUserSession;

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
		private IRootFolder $rootFolder,
		private IUserSession $userSession,
		private IServerContainer $serverContainer,
	) {
		parent::__construct($appName, $request);
	}

	/**
	 * Verify the current user can access the given file ID
	 *
	 * @param int $fileId
	 * @return bool True if user can access the file
	 */
	private function canAccessFile(int $fileId): bool {
		$user = $this->userSession->getUser();
		if ($user === null) {
			return false;
		}

		try {
			$userFolder = $this->rootFolder->getUserFolder($user->getUID());
			$nodes = $userFolder->getById($fileId);
			return !empty($nodes);
		} catch (\Exception $e) {
			return false;
		}
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
			// Verify user can access this file
			if (!$this->canAccessFile($fileId)) {
				return new DataResponse(
					['message' => 'File not found or access denied'],
					Http::STATUS_NOT_FOUND
				);
			}

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

			// Filter to only files the user can access
			$accessibleFileIds = array_filter($fileIds, fn($id) => $this->canAccessFile((int)$id));

			if (empty($accessibleFileIds)) {
				return new DataResponse([
					'files' => [],
				]);
			}

			// Get labels for accessible files only
			$filesLabels = $this->getFilesLabels($accessibleFileIds);

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
	 * Uses IServerContainer (public API) instead of \OC::$server (internal API).
	 *
	 * @param int $fileId
	 * @return array<string, string>
	 */
	private function getFileLabels(int $fileId): array {
		try {
			// Use public IServerContainer interface to get cross-app service
			$labelsService = $this->serverContainer->get(\OCA\FilesLabels\Service\LabelsService::class);
			$labels = $labelsService->getLabelsForFile($fileId);

			// Convert Label entities to key-value array
			$result = [];
			foreach ($labels as $label) {
				$result[$label->getLabelKey()] = $label->getLabelValue();
			}
			return $result;
		} catch (\Exception $e) {
			// files_labels not available or other error
			// Return empty labels - file won't be spoilered
			return [];
		}
	}

	/**
	 * Get labels for multiple files from files_labels app
	 *
	 * Uses IServerContainer (public API) instead of \OC::$server (internal API).
	 *
	 * @param int[] $fileIds
	 * @return array<int, array<string, string>>
	 */
	private function getFilesLabels(array $fileIds): array {
		try {
			// Use public IServerContainer interface to get cross-app service
			$labelsService = $this->serverContainer->get(\OCA\FilesLabels\Service\LabelsService::class);
			$labelsMap = $labelsService->getLabelsForFiles($fileIds);

			// Convert Label entities to key-value arrays
			$result = [];
			foreach ($labelsMap as $fileId => $labels) {
				$result[$fileId] = [];
				foreach ($labels as $label) {
					$result[$fileId][$label->getLabelKey()] = $label->getLabelValue();
				}
			}
			return $result;
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
