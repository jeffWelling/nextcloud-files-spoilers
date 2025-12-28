<?php

declare(strict_types=1);

/**
 * SPDX-FileCopyrightText: 2025 Jeff Welling <real.jeff.welling@gmail.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

namespace OCA\FilesSpoilers\Service;

use OCP\Files\IRootFolder;
use OCP\Files\NotFoundException;
use OCP\IConfig;
use OCP\IUserSession;
use Psr\Log\LoggerInterface;

/**
 * Service for managing spoiler settings and checking spoiler status.
 */
class SpoilerService {
	private const APP_ID = 'files_spoilers';
	private const KEY_TRIGGER_LABELS = 'trigger_labels';
	private const KEY_PLACEHOLDER_FILE_ID = 'placeholder_file_id';
	private const DEFAULT_TRIGGER_LABELS = ['sensitive=true'];

	public function __construct(
		private IConfig $config,
		private IUserSession $userSession,
		private IRootFolder $rootFolder,
		private LoggerInterface $logger,
	) {
	}

	/**
	 * Get the current user ID
	 *
	 * @throws \RuntimeException if not authenticated
	 */
	private function getUserId(): string {
		$user = $this->userSession->getUser();
		if ($user === null) {
			throw new \RuntimeException('Not authenticated');
		}
		return $user->getUID();
	}

	/**
	 * Get all spoiler settings for the current user
	 *
	 * @return array{trigger_labels: string[], placeholder_file_id: int|null}
	 */
	public function getSettings(): array {
		$userId = $this->getUserId();

		return [
			'trigger_labels' => $this->getTriggerLabels(),
			'placeholder_file_id' => $this->getPlaceholderFileId(),
		];
	}

	/**
	 * Get the configured trigger labels for the current user
	 *
	 * @return string[] Array of "key=value" strings
	 */
	public function getTriggerLabels(): array {
		$userId = $this->getUserId();

		$json = $this->config->getUserValue(
			$userId,
			self::APP_ID,
			self::KEY_TRIGGER_LABELS,
			''
		);

		if ($json === '') {
			return self::DEFAULT_TRIGGER_LABELS;
		}

		$decoded = json_decode($json, true);
		if (!is_array($decoded)) {
			$this->logger->warning('Invalid trigger_labels JSON for user {user}, using defaults', [
				'user' => $userId,
				'app' => self::APP_ID,
			]);
			return self::DEFAULT_TRIGGER_LABELS;
		}

		return $decoded;
	}

	/**
	 * Set the trigger labels for the current user
	 *
	 * @param string[] $labels Array of "key=value" strings
	 * @throws \InvalidArgumentException if any label is invalid
	 */
	public function setTriggerLabels(array $labels): void {
		// Validate each label
		foreach ($labels as $label) {
			if (!is_string($label)) {
				throw new \InvalidArgumentException('Each label must be a string');
			}
			if (!preg_match('/^[a-z0-9_:.-]+=.+$/', $label)) {
				throw new \InvalidArgumentException(
					"Invalid label format: '$label'. Expected 'key=value' where key matches [a-z0-9_:.-]+"
				);
			}
		}

		$userId = $this->getUserId();
		$json = json_encode(array_values($labels));

		$this->config->setUserValue(
			$userId,
			self::APP_ID,
			self::KEY_TRIGGER_LABELS,
			$json
		);

		$this->logger->debug('Updated trigger labels for user {user}', [
			'user' => $userId,
			'labels' => $labels,
			'app' => self::APP_ID,
		]);
	}

	/**
	 * Get the custom placeholder file ID for the current user
	 *
	 * @return int|null File ID or null if using default placeholder
	 */
	public function getPlaceholderFileId(): ?int {
		$userId = $this->getUserId();

		$fileId = $this->config->getUserValue(
			$userId,
			self::APP_ID,
			self::KEY_PLACEHOLDER_FILE_ID,
			''
		);

		if ($fileId === '') {
			return null;
		}

		return (int)$fileId;
	}

	/**
	 * Set a custom placeholder file for the current user
	 *
	 * @param int $fileId The file ID of the placeholder image
	 * @throws \InvalidArgumentException if file doesn't exist or user can't access it
	 */
	public function setPlaceholderFileId(int $fileId): void {
		$userId = $this->getUserId();

		// Verify user has access to this file
		try {
			$userFolder = $this->rootFolder->getUserFolder($userId);
			$nodes = $userFolder->getById($fileId);

			if (empty($nodes)) {
				throw new \InvalidArgumentException('File not found or access denied');
			}

			$node = $nodes[0];

			// Verify it's an image file
			$mimeType = $node->getMimeType();
			if (!str_starts_with($mimeType, 'image/')) {
				throw new \InvalidArgumentException('File must be an image');
			}
		} catch (NotFoundException $e) {
			throw new \InvalidArgumentException('File not found or access denied');
		}

		$this->config->setUserValue(
			$userId,
			self::APP_ID,
			self::KEY_PLACEHOLDER_FILE_ID,
			(string)$fileId
		);

		$this->logger->debug('Set placeholder file for user {user}', [
			'user' => $userId,
			'fileId' => $fileId,
			'app' => self::APP_ID,
		]);
	}

	/**
	 * Remove the custom placeholder file (use default)
	 */
	public function clearPlaceholderFileId(): void {
		$userId = $this->getUserId();

		$this->config->deleteUserValue(
			$userId,
			self::APP_ID,
			self::KEY_PLACEHOLDER_FILE_ID
		);

		$this->logger->debug('Cleared placeholder file for user {user}', [
			'user' => $userId,
			'app' => self::APP_ID,
		]);
	}

	/**
	 * Check if a file should be spoilered based on its labels
	 *
	 * @param array<string, string> $fileLabels Labels from files_labels app
	 * @return bool True if the file should show a spoiler placeholder
	 */
	public function isSpoilered(array $fileLabels): bool {
		$triggerLabels = $this->getTriggerLabels();

		foreach ($triggerLabels as $trigger) {
			// Parse "key=value" format
			$parts = explode('=', $trigger, 2);
			if (count($parts) !== 2) {
				continue;
			}

			[$key, $value] = $parts;

			// Check if file has this label with matching value
			if (isset($fileLabels[$key]) && $fileLabels[$key] === $value) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Check spoiler status for multiple files
	 *
	 * @param array<int, array<string, string>> $filesLabels Map of fileId => labels
	 * @return array<int, bool> Map of fileId => isSpoilered
	 */
	public function checkBulkSpoilerStatus(array $filesLabels): array {
		$result = [];
		foreach ($filesLabels as $fileId => $labels) {
			$result[$fileId] = $this->isSpoilered($labels);
		}
		return $result;
	}

	/**
	 * Parse a trigger label string into key and value
	 *
	 * @return array{key: string, value: string}|null
	 */
	public static function parseTriggerLabel(string $trigger): ?array {
		$parts = explode('=', $trigger, 2);
		if (count($parts) !== 2) {
			return null;
		}
		return [
			'key' => $parts[0],
			'value' => $parts[1],
		];
	}
}
