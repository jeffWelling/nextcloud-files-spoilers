<?php

declare(strict_types=1);

/**
 * SPDX-FileCopyrightText: 2024 Jeff <jeff@example.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

namespace OCA\FilesSpoilers\Tests\Unit\Service;

use OCA\FilesSpoilers\Service\SpoilerService;
use OCP\Files\IRootFolder;
use OCP\IConfig;
use OCP\IUser;
use OCP\IUserSession;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;

class SpoilerServiceTest extends TestCase {
	private SpoilerService $service;
	private IConfig&MockObject $config;
	private IUserSession&MockObject $userSession;
	private IRootFolder&MockObject $rootFolder;
	private LoggerInterface&MockObject $logger;
	private IUser&MockObject $user;

	protected function setUp(): void {
		parent::setUp();

		$this->config = $this->createMock(IConfig::class);
		$this->userSession = $this->createMock(IUserSession::class);
		$this->rootFolder = $this->createMock(IRootFolder::class);
		$this->logger = $this->createMock(LoggerInterface::class);
		$this->user = $this->createMock(IUser::class);

		$this->user->method('getUID')->willReturn('testuser');
		$this->userSession->method('getUser')->willReturn($this->user);

		$this->service = new SpoilerService(
			$this->config,
			$this->userSession,
			$this->rootFolder,
			$this->logger
		);
	}

	// ==================== getTriggerLabels Tests ====================

	public function testGetTriggerLabelsReturnsDefaultWhenEmpty(): void {
		$this->config->method('getUserValue')
			->with('testuser', 'files_spoilers', 'trigger_labels', '')
			->willReturn('');

		$result = $this->service->getTriggerLabels();

		$this->assertEquals(['sensitive=true'], $result);
	}

	public function testGetTriggerLabelsReturnsStoredValue(): void {
		$this->config->method('getUserValue')
			->with('testuser', 'files_spoilers', 'trigger_labels', '')
			->willReturn('["nsfw=true","spoiler=yes"]');

		$result = $this->service->getTriggerLabels();

		$this->assertEquals(['nsfw=true', 'spoiler=yes'], $result);
	}

	public function testGetTriggerLabelsReturnsDefaultOnInvalidJson(): void {
		$this->config->method('getUserValue')
			->with('testuser', 'files_spoilers', 'trigger_labels', '')
			->willReturn('not valid json');

		$this->logger->expects($this->once())
			->method('warning')
			->with($this->stringContains('Invalid trigger_labels JSON'));

		$result = $this->service->getTriggerLabels();

		$this->assertEquals(['sensitive=true'], $result);
	}

	// ==================== setTriggerLabels Tests ====================

	public function testSetTriggerLabelsSuccess(): void {
		$labels = ['sensitive=true', 'nsfw=true'];

		$this->config->expects($this->once())
			->method('setUserValue')
			->with(
				'testuser',
				'files_spoilers',
				'trigger_labels',
				'["sensitive=true","nsfw=true"]'
			);

		$this->service->setTriggerLabels($labels);
	}

	public function testSetTriggerLabelsRejectsInvalidFormat(): void {
		$this->expectException(\InvalidArgumentException::class);
		$this->expectExceptionMessage("Invalid label format");

		$this->service->setTriggerLabels(['invalid-no-equals']);
	}

	public function testSetTriggerLabelsRejectsInvalidKey(): void {
		$this->expectException(\InvalidArgumentException::class);
		$this->expectExceptionMessage("Invalid label format");

		$this->service->setTriggerLabels(['UPPERCASE=value']);
	}

	public function testSetTriggerLabelsRejectsNonString(): void {
		$this->expectException(\InvalidArgumentException::class);
		$this->expectExceptionMessage("Each label must be a string");

		$this->service->setTriggerLabels([123]);
	}

	public function testSetTriggerLabelsAcceptsValidFormats(): void {
		$validLabels = [
			'simple=value',
			'with-dash=ok',
			'with_underscore=ok',
			'with.dot=ok',
			'with:colon=ok',
			'numbers123=456',
		];

		$this->config->expects($this->once())
			->method('setUserValue');

		$this->service->setTriggerLabels($validLabels);
	}

	// ==================== getPlaceholderFileId Tests ====================

	public function testGetPlaceholderFileIdReturnsNullWhenEmpty(): void {
		$this->config->method('getUserValue')
			->with('testuser', 'files_spoilers', 'placeholder_file_id', '')
			->willReturn('');

		$result = $this->service->getPlaceholderFileId();

		$this->assertNull($result);
	}

	public function testGetPlaceholderFileIdReturnsStoredValue(): void {
		$this->config->method('getUserValue')
			->with('testuser', 'files_spoilers', 'placeholder_file_id', '')
			->willReturn('12345');

		$result = $this->service->getPlaceholderFileId();

		$this->assertEquals(12345, $result);
	}

	// ==================== setPlaceholderFileId Tests ====================

	public function testSetPlaceholderFileId(): void {
		$this->config->expects($this->once())
			->method('setUserValue')
			->with('testuser', 'files_spoilers', 'placeholder_file_id', '12345');

		$this->service->setPlaceholderFileId(12345);
	}

	// ==================== clearPlaceholderFileId Tests ====================

	public function testClearPlaceholderFileId(): void {
		$this->config->expects($this->once())
			->method('deleteUserValue')
			->with('testuser', 'files_spoilers', 'placeholder_file_id');

		$this->service->clearPlaceholderFileId();
	}

	// ==================== isSpoilered Tests ====================

	public function testIsSpoileredReturnsTrueWhenMatchesTrigger(): void {
		$this->config->method('getUserValue')
			->with('testuser', 'files_spoilers', 'trigger_labels', '')
			->willReturn('["sensitive=true"]');

		$fileLabels = ['sensitive' => 'true'];

		$result = $this->service->isSpoilered($fileLabels);

		$this->assertTrue($result);
	}

	public function testIsSpoileredReturnsFalseWhenNoMatch(): void {
		$this->config->method('getUserValue')
			->with('testuser', 'files_spoilers', 'trigger_labels', '')
			->willReturn('["sensitive=true"]');

		$fileLabels = ['category' => 'work'];

		$result = $this->service->isSpoilered($fileLabels);

		$this->assertFalse($result);
	}

	public function testIsSpoileredReturnsFalseWhenValueDoesntMatch(): void {
		$this->config->method('getUserValue')
			->with('testuser', 'files_spoilers', 'trigger_labels', '')
			->willReturn('["sensitive=true"]');

		$fileLabels = ['sensitive' => 'false'];

		$result = $this->service->isSpoilered($fileLabels);

		$this->assertFalse($result);
	}

	public function testIsSpoileredReturnsTrueWhenAnyTriggerMatches(): void {
		$this->config->method('getUserValue')
			->with('testuser', 'files_spoilers', 'trigger_labels', '')
			->willReturn('["sensitive=true","nsfw=yes","spoiler=1"]');

		$fileLabels = ['nsfw' => 'yes'];

		$result = $this->service->isSpoilered($fileLabels);

		$this->assertTrue($result);
	}

	public function testIsSpoileredReturnsFalseForEmptyLabels(): void {
		$this->config->method('getUserValue')
			->with('testuser', 'files_spoilers', 'trigger_labels', '')
			->willReturn('["sensitive=true"]');

		$result = $this->service->isSpoilered([]);

		$this->assertFalse($result);
	}

	// ==================== checkBulkSpoilerStatus Tests ====================

	public function testCheckBulkSpoilerStatus(): void {
		$this->config->method('getUserValue')
			->with('testuser', 'files_spoilers', 'trigger_labels', '')
			->willReturn('["sensitive=true"]');

		$filesLabels = [
			1 => ['sensitive' => 'true'],
			2 => ['category' => 'work'],
			3 => ['sensitive' => 'false'],
			4 => ['sensitive' => 'true', 'other' => 'label'],
		];

		$result = $this->service->checkBulkSpoilerStatus($filesLabels);

		$this->assertEquals([
			1 => true,
			2 => false,
			3 => false,
			4 => true,
		], $result);
	}

	// ==================== getSettings Tests ====================

	public function testGetSettings(): void {
		$this->config->method('getUserValue')
			->willReturnMap([
				['testuser', 'files_spoilers', 'trigger_labels', '', '["sensitive=true"]'],
				['testuser', 'files_spoilers', 'placeholder_file_id', '', '999'],
			]);

		$result = $this->service->getSettings();

		$this->assertEquals([
			'trigger_labels' => ['sensitive=true'],
			'placeholder_file_id' => 999,
		], $result);
	}

	// ==================== Authentication Tests ====================

	public function testThrowsWhenNotAuthenticated(): void {
		$userSession = $this->createMock(IUserSession::class);
		$userSession->method('getUser')->willReturn(null);

		$service = new SpoilerService(
			$this->config,
			$userSession,
			$this->rootFolder,
			$this->logger
		);

		$this->expectException(\RuntimeException::class);
		$this->expectExceptionMessage('Not authenticated');

		$service->getTriggerLabels();
	}

	// ==================== parseTriggerLabel Tests ====================

	public function testParseTriggerLabelValid(): void {
		$result = SpoilerService::parseTriggerLabel('key=value');

		$this->assertEquals(['key' => 'key', 'value' => 'value'], $result);
	}

	public function testParseTriggerLabelWithEqualsInValue(): void {
		$result = SpoilerService::parseTriggerLabel('key=value=with=equals');

		$this->assertEquals(['key' => 'key', 'value' => 'value=with=equals'], $result);
	}

	public function testParseTriggerLabelInvalid(): void {
		$result = SpoilerService::parseTriggerLabel('no-equals-sign');

		$this->assertNull($result);
	}
}
