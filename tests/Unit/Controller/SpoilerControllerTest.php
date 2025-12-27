<?php

declare(strict_types=1);

/**
 * SPDX-FileCopyrightText: 2024 Jeff <jeff@example.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

namespace OCA\FilesSpoilers\Tests\Unit\Controller;

use OCA\FilesSpoilers\Controller\SpoilerController;
use OCA\FilesSpoilers\Service\SpoilerService;
use OCP\AppFramework\Http;
use OCP\Files\Folder;
use OCP\Files\IRootFolder;
use OCP\Files\Node;
use OCP\IRequest;
use OCP\IUser;
use OCP\IUserSession;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

class SpoilerControllerTest extends TestCase {
	private SpoilerController $controller;
	private SpoilerService&MockObject $spoilerService;
	private IRootFolder&MockObject $rootFolder;
	private IUserSession&MockObject $userSession;
	private IRequest&MockObject $request;
	private IUser&MockObject $user;
	private Folder&MockObject $userFolder;

	protected function setUp(): void {
		parent::setUp();

		$this->spoilerService = $this->createMock(SpoilerService::class);
		$this->rootFolder = $this->createMock(IRootFolder::class);
		$this->userSession = $this->createMock(IUserSession::class);
		$this->request = $this->createMock(IRequest::class);
		$this->user = $this->createMock(IUser::class);
		$this->userFolder = $this->createMock(Folder::class);

		$this->user->method('getUID')->willReturn('testuser');
		$this->userSession->method('getUser')->willReturn($this->user);
		$this->rootFolder->method('getUserFolder')->with('testuser')->willReturn($this->userFolder);

		$this->controller = new SpoilerController(
			'files_spoilers',
			$this->request,
			$this->spoilerService,
			$this->rootFolder,
			$this->userSession
		);
	}

	// ==================== Authorization Tests ====================

	public function testCheckDeniesAccessWhenUserCannotAccessFile(): void {
		$fileId = 123;

		// User cannot access the file
		$this->userFolder->method('getById')
			->with($fileId)
			->willReturn([]);

		$response = $this->controller->check($fileId);

		$this->assertEquals(Http::STATUS_NOT_FOUND, $response->getStatus());

		$data = $response->getData();
		$this->assertArrayHasKey('message', $data);
		$this->assertEquals('File not found or access denied', $data['message']);
	}

	public function testCheckAllowsAccessWhenUserCanAccessFile(): void {
		$fileId = 123;

		// User can access the file
		$node = $this->createMock(Node::class);
		$this->userFolder->method('getById')
			->with($fileId)
			->willReturn([$node]);

		$this->spoilerService->method('isSpoilered')
			->willReturn(true);

		$response = $this->controller->check($fileId);

		$this->assertEquals(Http::STATUS_OK, $response->getStatus());

		$data = $response->getData();
		$this->assertArrayHasKey('fileId', $data);
		$this->assertArrayHasKey('spoilered', $data);
		$this->assertEquals($fileId, $data['fileId']);
		$this->assertTrue($data['spoilered']);
	}

	public function testCheckBulkFiltersInaccessibleFiles(): void {
		$fileIds = [123, 456, 789];

		// User can only access files 123 and 789
		$node1 = $this->createMock(Node::class);
		$node3 = $this->createMock(Node::class);

		$this->userFolder->method('getById')
			->willReturnCallback(function ($fileId) use ($node1, $node3) {
				return match ($fileId) {
					123 => [$node1],
					456 => [],       // No access
					789 => [$node3],
					default => [],
				};
			});

		$this->spoilerService->method('checkBulkSpoilerStatus')
			->willReturn([
				123 => true,
				789 => false,
			]);

		$response = $this->controller->checkBulk($fileIds);

		$this->assertEquals(Http::STATUS_OK, $response->getStatus());

		$data = $response->getData();
		$files = $data['files'];

		// Should only contain accessible files
		$this->assertArrayHasKey(123, $files);
		$this->assertArrayHasKey(789, $files);
		$this->assertArrayNotHasKey(456, $files); // Filtered out

		$this->assertTrue($files[123]);
		$this->assertFalse($files[789]);
	}

	public function testCheckBulkReturnsEmptyWhenNoAccessibleFiles(): void {
		$fileIds = [123, 456];

		// User cannot access any files
		$this->userFolder->method('getById')
			->willReturn([]);

		$response = $this->controller->checkBulk($fileIds);

		$this->assertEquals(Http::STATUS_OK, $response->getStatus());

		$data = $response->getData();
		$this->assertEmpty($data['files']);
	}

	public function testCheckBulkRejectsEmptyArray(): void {
		$response = $this->controller->checkBulk([]);

		$this->assertEquals(Http::STATUS_BAD_REQUEST, $response->getStatus());

		$data = $response->getData();
		$this->assertArrayHasKey('message', $data);
		$this->assertEquals('No file IDs provided', $data['message']);
	}

	public function testCheckBulkRejectsTooManyFileIds(): void {
		$fileIds = range(1, 1001); // 1001 IDs, exceeds limit

		$response = $this->controller->checkBulk($fileIds);

		$this->assertEquals(Http::STATUS_BAD_REQUEST, $response->getStatus());

		$data = $response->getData();
		$this->assertArrayHasKey('message', $data);
		$this->assertEquals('Too many file IDs (max 1000)', $data['message']);
	}

	// ==================== Unauthenticated User Tests ====================

	public function testCheckDeniesUnauthenticatedUser(): void {
		// Create controller with no user
		$userSession = $this->createMock(IUserSession::class);
		$userSession->method('getUser')->willReturn(null);

		$controller = new SpoilerController(
			'files_spoilers',
			$this->request,
			$this->spoilerService,
			$this->rootFolder,
			$userSession
		);

		$response = $controller->check(123);

		$this->assertEquals(Http::STATUS_NOT_FOUND, $response->getStatus());
	}

	// ==================== Exception Handling Tests ====================

	public function testCheckHandlesRuntimeException(): void {
		$fileId = 123;

		$node = $this->createMock(Node::class);
		$this->userFolder->method('getById')
			->with($fileId)
			->willReturn([$node]);

		$this->spoilerService->method('isSpoilered')
			->willThrowException(new \RuntimeException('Not authenticated'));

		$response = $this->controller->check($fileId);

		$this->assertEquals(Http::STATUS_UNAUTHORIZED, $response->getStatus());
	}

	public function testCheckHandlesGenericException(): void {
		$fileId = 123;

		$node = $this->createMock(Node::class);
		$this->userFolder->method('getById')
			->with($fileId)
			->willReturn([$node]);

		$this->spoilerService->method('isSpoilered')
			->willThrowException(new \Exception('Something went wrong'));

		$response = $this->controller->check($fileId);

		$this->assertEquals(Http::STATUS_INTERNAL_SERVER_ERROR, $response->getStatus());
	}
}
