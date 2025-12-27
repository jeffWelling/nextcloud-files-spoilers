# End-to-End Test Scenarios for Nextcloud files_spoilers

Comprehensive test specifications for the files_spoilers Nextcloud app that hides file previews based on labels from the files_labels app.

## Test Environment Setup

### Prerequisites
- Nextcloud instance with files_spoilers app installed and enabled
- files_labels app installed and enabled
- Test user accounts: `testuser1`, `testuser2`
- Sample files: images (JPG, PNG), documents (PDF), videos
- Test framework: Playwright (recommended) or Cypress

### Test Data
```javascript
const TEST_DATA = {
  files: {
    image1: 'test-image-1.jpg',
    image2: 'test-image-2.png',
    spoilerImage: 'spoiler-placeholder.png',
    document: 'test-doc.pdf',
  },
  labels: {
    sensitive: 'sensitive=true',
    nsfw: 'nsfw=true',
    spoiler: 'spoiler=yes',
    work: 'category=work',
  },
}
```

---

## 1. Settings Flow Tests

### 1.1: Add Trigger Label - Valid Input

**Test ID**: `settings-001`

**Description**: User successfully adds a new trigger label through the settings interface.

**Pre-conditions**:
- User is logged in as `testuser1`
- No custom trigger labels configured (default: `sensitive=true`)

**Test Steps**:
1. Navigate to Settings → Personal → File Spoilers
2. Verify default trigger label `sensitive=true` is displayed
3. In the "Add trigger" section:
   - Enter `nsfw` in the key field
   - Enter `true` in the value field
4. Click the "Add" button
5. Wait for success notification

**Expected Results**:
- Success notification appears: "Settings saved"
- New trigger `nsfw=true` appears in the trigger list
- Both triggers are now listed:
  - `sensitive=true`
  - `nsfw=true`
- API call to `/apps/files_spoilers/api/v1/settings/trigger-labels` is successful (status 200)

**Playwright Selectors**:
```javascript
const selectors = {
  settingsSection: '[data-test-id="files-spoilers-settings"]',
  keyInput: 'input[placeholder*="Label key"]',
  valueInput: 'input[placeholder*="Value"]',
  addButton: 'button:has-text("Add")',
  triggerList: '.trigger-list',
  triggerItem: (label) => `.trigger-item:has-text("${label}")`,
  successNotification: '.toastify.toast-success',
}
```

---

### 1.2: Add Trigger Label - Duplicate Prevention

**Test ID**: `settings-002`

**Description**: Prevent adding duplicate trigger labels.

**Pre-conditions**:
- User is logged in
- Trigger label `sensitive=true` already exists

**Test Steps**:
1. Navigate to Settings → Personal → File Spoilers
2. Attempt to add duplicate:
   - Enter `sensitive` in key field
   - Enter `true` in value field
3. Click "Add" button

**Expected Results**:
- Error message displayed: "This trigger already exists"
- Trigger list remains unchanged (only one `sensitive=true`)
- No API call is made

**Playwright Selectors**:
```javascript
const selectors = {
  errorMessage: '.message.error:has-text("This trigger already exists")',
}
```

---

### 1.3: Add Trigger Label - Invalid Format

**Test ID**: `settings-003`

**Description**: Validate input format for trigger labels.

**Pre-conditions**:
- User is logged in

**Test Steps**:
1. Navigate to Settings → Personal → File Spoilers
2. Test invalid key formats:
   - Try `UPPERCASE` (should fail - only lowercase allowed)
   - Try `has spaces` (should fail - no spaces)
   - Try `special@chars` (should fail - only [a-z0-9_:.-]+)
3. Test valid key format:
   - Try `valid-key_123` (should succeed)

**Expected Results**:
- Invalid inputs trigger HTML5 validation error
- Error notification from backend: "Invalid label format"
- Only valid format triggers are saved

**Playwright Selectors**:
```javascript
const selectors = {
  keyInput: 'input[pattern="[a-z0-9_:.-]+"]',
}
```

---

### 1.4: Remove Trigger Label

**Test ID**: `settings-004`

**Description**: User removes an existing trigger label.

**Pre-conditions**:
- User is logged in
- Two trigger labels exist: `sensitive=true`, `nsfw=true`

**Test Steps**:
1. Navigate to Settings → Personal → File Spoilers
2. Click the close/remove icon next to `nsfw=true`
3. Wait for confirmation

**Expected Results**:
- Success notification: "Settings saved"
- `nsfw=true` is removed from the trigger list
- Only `sensitive=true` remains
- API PUT request updates the labels array
- Files previously hidden by `nsfw=true` become visible immediately

**Playwright Selectors**:
```javascript
const selectors = {
  removeTriggerButton: (label) => `.trigger-item:has-text("${label}") button[aria-label*="Remove"]`,
}
```

---

### 1.5: Set Custom Placeholder Image - Valid File

**Test ID**: `settings-005`

**Description**: User sets a custom placeholder image to replace the default eye-off icon.

**Pre-conditions**:
- User is logged in
- User has uploaded `spoiler-placeholder.png` (fileId: 12345)

**Test Steps**:
1. Navigate to Settings → Personal → File Spoilers
2. Verify default state shows "Choose image" button
3. Click "Choose image" button
4. Enter file ID `12345` in the prompt (temporary UI)
5. Confirm

**Expected Results**:
- Success notification: "Placeholder updated"
- Custom placeholder preview appears (64x64 thumbnail)
- "Remove custom placeholder" button is displayed
- API PUT to `/apps/files_spoilers/api/v1/settings/placeholder` succeeds
- All spoilered files now show the custom placeholder image instead of the eye icon

**Playwright Selectors**:
```javascript
const selectors = {
  chooseImageButton: 'button:has-text("Choose image")',
  placeholderPreview: '.placeholder-preview img',
  removePlaceholderButton: 'button:has-text("Remove custom placeholder")',
}
```

---

### 1.6: Set Custom Placeholder - Invalid File ID

**Test ID**: `settings-006`

**Description**: Handle invalid file ID when setting custom placeholder.

**Pre-conditions**:
- User is logged in

**Test Steps**:
1. Navigate to Settings → Personal → File Spoilers
2. Click "Choose image"
3. Test cases:
   - Enter non-existent file ID `999999`
   - Enter file ID of non-image file (e.g., PDF)
   - Enter file ID of file user doesn't own

**Expected Results**:
- Error notification displayed:
  - "File not found or access denied"
  - "File must be an image"
- No placeholder is set
- API returns 400 Bad Request or 401 Unauthorized
- Settings remain unchanged

**Playwright Selectors**:
```javascript
const selectors = {
  errorNotification: '.toastify.toast-error',
}
```

---

### 1.7: Clear Custom Placeholder

**Test ID**: `settings-007`

**Description**: User removes custom placeholder and reverts to default.

**Pre-conditions**:
- User is logged in
- Custom placeholder is set (fileId: 12345)

**Test Steps**:
1. Navigate to Settings → Personal → File Spoilers
2. Verify custom placeholder preview is visible
3. Click "Remove custom placeholder" button
4. Wait for confirmation

**Expected Results**:
- Success notification: "Using default placeholder"
- Placeholder preview disappears
- "Choose image" button reappears
- API DELETE to `/apps/files_spoilers/api/v1/settings/placeholder` succeeds
- All spoilered files now show default eye-off icon

**Playwright Selectors**:
```javascript
const selectors = {
  removePlaceholderButton: 'button:has-text("Remove custom placeholder")',
  chooseImageButton: 'button:has-text("Choose image")',
}
```

---

## 2. File List Behavior Tests

### 2.1: File with Matching Label Shows Spoiler

**Test ID**: `filelist-001`

**Description**: File with a label matching the trigger shows spoiler placeholder instead of preview.

**Pre-conditions**:
- User is logged in
- Trigger label configured: `sensitive=true`
- File `test-image-1.jpg` exists with label `sensitive=true`
- File `test-image-2.png` exists without labels

**Test Steps**:
1. Navigate to Files app
2. Locate `test-image-1.jpg` in the file list
3. Observe the preview/icon area

**Expected Results**:
- `test-image-1.jpg` shows spoiler placeholder (gray background with eye-off icon or custom image)
- Original image preview is hidden
- `test-image-2.png` shows normal preview (not spoilered)
- Spoiler placeholder has CSS class `.spoiler-placeholder`
- Tooltip on hover: "Click to reveal"

**Playwright Selectors**:
```javascript
const selectors = {
  fileRow: (filename) => `[data-cy-files-list-row]:has-text("${filename}")`,
  fileIcon: (filename) => `[data-cy-files-list-row]:has-text("${filename}") [data-cy-files-list-row-icon]`,
  spoilerPlaceholder: '.spoiler-placeholder',
  normalPreview: 'img.files-list__row-icon-preview',
}
```

---

### 2.2: File without Matching Label Shows Normally

**Test ID**: `filelist-002`

**Description**: Files without trigger labels display normal previews.

**Pre-conditions**:
- User is logged in
- Trigger labels: `sensitive=true`, `nsfw=true`
- File `test-image-2.png` has label `category=work` (not a trigger)

**Test Steps**:
1. Navigate to Files app
2. Locate `test-image-2.png`
3. Observe preview

**Expected Results**:
- File shows normal image preview
- No spoiler placeholder visible
- Preview image is displayed normally

**Playwright Selectors**:
```javascript
const selectors = {
  normalPreview: (filename) => `[data-cy-files-list-row]:has-text("${filename}") img.files-list__row-icon-preview`,
}
```

---

### 2.3: Clicking Spoiler Reveals the File

**Test ID**: `filelist-003`

**Description**: User clicks on spoiler placeholder to reveal the actual file preview.

**Pre-conditions**:
- User is logged in
- File `test-image-1.jpg` is spoilered

**Test Steps**:
1. Navigate to Files app
2. Locate spoilered file `test-image-1.jpg`
3. Click on the spoiler placeholder
4. Wait for transition

**Expected Results**:
- Spoiler placeholder is removed
- Original image preview is revealed
- File remains revealed even when scrolling away and back
- Revealed state persists for the session (until page reload)
- File ID is added to `spoilerState.revealedFiles` set

**Playwright Selectors**:
```javascript
const selectors = {
  spoilerPlaceholder: (filename) => `[data-cy-files-list-row]:has-text("${filename}") .spoiler-placeholder`,
  revealedPreview: (filename) => `[data-cy-files-list-row]:has-text("${filename}") img[style*="display"]`,
}
```

---

### 2.4: Multiple Files with Spoilers

**Test ID**: `filelist-004`

**Description**: Multiple files with matching labels all show spoilers independently.

**Pre-conditions**:
- User is logged in
- Trigger: `sensitive=true`
- Files:
  - `image1.jpg` with `sensitive=true` (spoilered)
  - `image2.png` with `nsfw=true` (not spoilered)
  - `image3.jpg` with `sensitive=true` (spoilered)
  - `document.pdf` with `sensitive=true` (spoilered)

**Test Steps**:
1. Navigate to Files app
2. Observe all four files in the list
3. Click to reveal `image1.jpg`
4. Observe state of other files

**Expected Results**:
- `image1.jpg` and `image3.jpg` and `document.pdf` show spoiler placeholders initially
- `image2.png` shows normal preview
- After revealing `image1.jpg`:
  - `image1.jpg` shows normal preview
  - `image3.jpg` and `document.pdf` remain spoilered
- Each file can be revealed independently

**Playwright Selectors**:
```javascript
const selectors = {
  spoileredFiles: '.files-list__row:has(.spoiler-placeholder)',
  revealedFiles: '.files-list__row [data-spoiler-revealed="true"]',
}
```

---

### 2.5: Folder Navigation Maintains State

**Test ID**: `filelist-005`

**Description**: Revealed state persists when navigating between folders.

**Pre-conditions**:
- User is logged in
- Folder structure:
  - `/Photos/image1.jpg` (spoilered)
  - `/Documents/doc1.pdf` (not spoilered)

**Test Steps**:
1. Navigate to `/Photos`
2. Reveal `image1.jpg` by clicking spoiler
3. Navigate to `/Documents`
4. Navigate back to `/Photos`
5. Observe `image1.jpg`

**Expected Results**:
- When returning to `/Photos`, `image1.jpg` remains revealed
- State is maintained in `spoilerState.revealedFiles` Set
- No duplicate API calls for the same file

**Playwright Selectors**:
```javascript
const selectors = {
  folderLink: (name) => `[data-cy-files-list-row]:has-text("${name}")`,
  breadcrumb: (path) => `.breadcrumb:has-text("${path}")`,
}
```

---

## 3. Real-time Updates Tests

### 3.1: Adding Label Immediately Hides Preview

**Test ID**: `realtime-001`

**Description**: Adding a trigger label to a file immediately hides its preview without page reload.

**Pre-conditions**:
- User is logged in
- Trigger: `sensitive=true`
- File `test-image-1.jpg` has no labels (showing normal preview)
- files_labels app is enabled

**Test Steps**:
1. Navigate to Files app
2. Verify `test-image-1.jpg` shows normal preview
3. Open label editor for `test-image-1.jpg` (via files_labels app)
4. Add label `sensitive=true`
5. Save label
6. Observe file preview (without reloading page)

**Expected Results**:
- Within 1-2 seconds, preview is replaced with spoiler placeholder
- No page reload required
- Event bus receives `files_labels:label-changed` event
- `spoilerState.labelCache` is updated
- Transition is smooth and immediate

**Playwright Selectors**:
```javascript
const selectors = {
  fileActions: (filename) => `[data-cy-files-list-row]:has-text("${filename}") [data-cy-files-list-row-actions]`,
  labelEditor: '.labels-editor-modal',
  labelCheckbox: (label) => `input[type="checkbox"][value="${label}"]`,
  saveButton: 'button:has-text("Save")',
}
```

---

### 3.2: Removing Label Immediately Shows Preview

**Test ID**: `realtime-002`

**Description**: Removing a trigger label from a file immediately reveals its preview.

**Pre-conditions**:
- User is logged in
- Trigger: `sensitive=true`
- File `test-image-1.jpg` has label `sensitive=true` (currently spoilered, not revealed)

**Test Steps**:
1. Navigate to Files app
2. Verify `test-image-1.jpg` shows spoiler placeholder
3. Open label editor for `test-image-1.jpg`
4. Remove label `sensitive=true`
5. Save changes
6. Observe file preview

**Expected Results**:
- Spoiler placeholder is immediately removed
- Original preview is revealed
- File is also removed from `spoilerState.revealedFiles` (since it's no longer a spoiler)
- Event handled by `handleLabelChange()` function
- No API call to check spoiler status (uses cached label data)

**Playwright Selectors**:
```javascript
// Same as realtime-001
```

---

### 3.3: Label Changes from Another Tab/Session

**Test ID**: `realtime-003`

**Description**: Label changes made in another browser tab are reflected in the current tab.

**Pre-conditions**:
- User is logged in in two browser tabs
- Trigger: `sensitive=true`
- File `test-image-1.jpg` visible in both tabs

**Test Steps**:
1. Tab 1: Navigate to Files, observe `test-image-1.jpg` (normal preview)
2. Tab 2: Navigate to Files, add label `sensitive=true` to `test-image-1.jpg`
3. Observe Tab 1 without any interaction

**Expected Results**:
- **Note**: This depends on Nextcloud's event bus implementation
- If event bus supports cross-tab events: Preview updates in Tab 1 immediately
- If not supported: Preview updates after Tab 1 reload or re-navigation
- Current implementation: Likely requires manual refresh (limitation documented)

**Test Configuration**:
```javascript
// Launch two browser contexts
const context1 = await browser.newContext({ storageState: 'testuser1-auth.json' })
const context2 = await browser.newContext({ storageState: 'testuser1-auth.json' })
```

---

## 4. Error Scenarios Tests

### 4.1: Invalid Placeholder File ID

**Test ID**: `error-001`

**Description**: Handle case where configured placeholder file is deleted or becomes inaccessible.

**Pre-conditions**:
- User is logged in
- Custom placeholder configured (fileId: 12345)
- File 12345 is then deleted

**Test Steps**:
1. Configure custom placeholder (fileId: 12345)
2. Delete the placeholder file
3. Navigate to Files app
4. Observe spoilered files

**Expected Results**:
- Spoilered files show broken image or fallback to default eye-off icon
- No JavaScript errors in console
- Settings still show the placeholder fileId (not auto-cleared)
- User can clear the invalid placeholder through settings

**Playwright Selectors**:
```javascript
const selectors = {
  spoilerPlaceholder: '.spoiler-placeholder',
  brokenImage: 'img[src*="preview"][alt="Spoiler"]',
}

// Check console errors
page.on('console', msg => {
  if (msg.type() === 'error') {
    console.error('Console error:', msg.text())
  }
})
```

---

### 4.2: Network Errors During Settings Save

**Test ID**: `error-002`

**Description**: Handle network failures when saving settings.

**Pre-conditions**:
- User is logged in

**Test Steps**:
1. Navigate to Settings → Personal → File Spoilers
2. Intercept and block the API request
3. Attempt to add trigger label `nsfw=true`
4. Observe result

**Expected Results**:
- Error notification displayed: "Failed to save settings"
- Trigger label is NOT added to the UI
- Settings remain in previous state
- User can retry the operation

**Playwright Test Code**:
```javascript
// Block API request
await page.route('**/apps/files_spoilers/api/v1/settings/trigger-labels', route => {
  route.abort('failed')
})

// Attempt to add label
await page.fill('input[placeholder*="Label key"]', 'nsfw')
await page.fill('input[placeholder*="Value"]', 'true')
await page.click('button:has-text("Add")')

// Verify error
await expect(page.locator('.toastify.toast-error')).toBeVisible()
await expect(page.locator('.trigger-item:has-text("nsfw=true")')).not.toBeVisible()
```

---

### 4.3: files_labels App Disabled

**Test ID**: `error-003`

**Description**: Gracefully handle when files_labels app is disabled or unavailable.

**Pre-conditions**:
- User is logged in
- files_labels app is disabled in Nextcloud admin settings
- Trigger labels configured in files_spoilers

**Test Steps**:
1. Disable files_labels app
2. Navigate to Files app
3. Observe file previews

**Expected Results**:
- No files are spoilered (all show normal previews)
- No JavaScript errors in console
- `getFileLabels()` catches exception and returns empty array
- files_spoilers degrades gracefully
- Optional: Warning message in settings: "files_labels app is required"

**Playwright Selectors**:
```javascript
const selectors = {
  allFiles: '.files-list__row',
  spoilerPlaceholders: '.spoiler-placeholder',
  warningMessage: '.message.warning:has-text("files_labels app is required")',
}
```

---

### 4.4: Large Number of Files Performance

**Test ID**: `error-004`

**Description**: Ensure performance is acceptable with many files and labels.

**Pre-conditions**:
- User is logged in
- Folder contains 500+ files
- 50% of files have trigger labels

**Test Steps**:
1. Navigate to folder with 500+ files
2. Measure page load time
3. Scroll through entire file list
4. Measure rendering performance

**Expected Results**:
- Initial page load < 3 seconds
- Scroll performance remains smooth (60 FPS)
- Label checks use caching (`spoilerState.labelCache`)
- No duplicate API calls (`spoilerState.pendingChecks` prevents duplicates)
- Virtual scrolling works correctly with spoilers

**Performance Metrics**:
```javascript
// Measure performance
const metrics = await page.metrics()
console.log('Page load time:', metrics.TaskDuration)

// Monitor network calls
const apiCalls = new Set()
page.on('request', request => {
  if (request.url().includes('/api/v1/labels/')) {
    apiCalls.add(request.url())
  }
})

// Verify caching
expect(apiCalls.size).toBeLessThan(fileCount) // Should use cache
```

---

## 5. Multi-user Scenarios Tests

### 5.1: Different Users Have Different Trigger Labels

**Test ID**: `multiuser-001`

**Description**: Each user can configure their own trigger labels independently.

**Pre-conditions**:
- Two users: `testuser1`, `testuser2`
- Shared folder with file `shared-image.jpg` having label `sensitive=true`

**Test Steps**:
1. As `testuser1`:
   - Configure trigger: `sensitive=true`
   - Navigate to shared folder
   - Observe `shared-image.jpg`
2. As `testuser2`:
   - Configure trigger: `nsfw=true` (NOT sensitive)
   - Navigate to shared folder
   - Observe `shared-image.jpg`

**Expected Results**:
- `testuser1` sees `shared-image.jpg` as spoilered
- `testuser2` sees `shared-image.jpg` with normal preview
- Settings are user-specific (stored per user)
- No interference between user configurations

**Playwright Test Code**:
```javascript
// Test with two contexts
const user1Context = await browser.newContext({ storageState: 'testuser1-auth.json' })
const user2Context = await browser.newContext({ storageState: 'testuser2-auth.json' })

const page1 = await user1Context.newPage()
const page2 = await user2Context.newPage()

// Configure and verify independently
```

---

### 5.2: Shared Files with Spoilers

**Test ID**: `multiuser-002`

**Description**: Shared files respect each user's individual spoiler settings.

**Pre-conditions**:
- Two users: `testuser1` (owner), `testuser2` (shared with)
- File `private-photo.jpg` owned by `testuser1` with label `personal=true`
- File shared with `testuser2` (read-only)

**Test Steps**:
1. `testuser1` configures trigger: `personal=true`
2. `testuser2` configures trigger: `nsfw=true`
3. Both navigate to shared file location

**Expected Results**:
- `testuser1` sees file spoilered (matches `personal=true`)
- `testuser2` sees normal preview (doesn't match `nsfw=true`)
- Labels are visible to both users (files_labels permission model)
- Spoiler logic is client-side, per-user

**Playwright Selectors**:
```javascript
const selectors = {
  sharedWithYou: '[data-cy-files-list-filter="shared-with-you"]',
  sharedFile: (filename) => `[data-cy-files-list-row]:has-text("${filename}")`,
}
```

---

### 5.3: User Cannot See Other Users' Custom Placeholders

**Test ID**: `multiuser-003`

**Description**: Custom placeholder settings are private to each user.

**Pre-conditions**:
- Two users: `testuser1`, `testuser2`
- `testuser1` has custom placeholder (fileId: 111)
- `testuser2` has custom placeholder (fileId: 222)

**Test Steps**:
1. Both users have spoilered files visible
2. Check which placeholder each sees

**Expected Results**:
- `testuser1` sees placeholder from fileId 111
- `testuser2` sees placeholder from fileId 222
- Placeholder settings stored per-user in `oc_preferences` table

**Database Verification**:
```sql
SELECT userid, configkey, configvalue
FROM oc_preferences
WHERE appid = 'files_spoilers'
  AND configkey = 'placeholder_file_id';
```

---

## Test Utilities and Helpers

### Setup Functions

```javascript
// Playwright test helper functions

async function loginAsUser(page, username, password) {
  await page.goto('http://nextcloud.local/login')
  await page.fill('input[name="user"]', username)
  await page.fill('input[name="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/apps/dashboard')
}

async function uploadTestFile(page, filepath, targetFolder = '/') {
  await page.goto(`http://nextcloud.local/apps/files/?dir=${targetFolder}`)
  const fileInput = await page.locator('input[type="file"]')
  await fileInput.setInputFiles(filepath)
  await page.waitForSelector(`[data-cy-files-list-row]:has-text("${path.basename(filepath)}")`)
}

async function addLabelToFile(page, filename, labelKey, labelValue) {
  // Open file actions menu
  const fileRow = page.locator(`[data-cy-files-list-row]:has-text("${filename}")`)
  await fileRow.locator('[data-cy-files-list-row-actions]').click()

  // Find "Edit labels" option
  await page.click('button:has-text("Edit labels")')

  // Add label
  await page.fill('input[placeholder="Label key"]', labelKey)
  await page.fill('input[placeholder="Label value"]', labelValue)
  await page.click('button:has-text("Add label")')
  await page.click('button:has-text("Save")')
}

async function configureTriggerLabel(page, labelKey, labelValue) {
  await page.goto('http://nextcloud.local/settings/user/files_spoilers')
  await page.fill('input[placeholder*="Label key"]', labelKey)
  await page.fill('input[placeholder*="Value"]', labelValue)
  await page.click('button:has-text("Add")')
  await page.waitForSelector('.toastify.toast-success')
}

async function getFilePreviewState(page, filename) {
  const fileRow = page.locator(`[data-cy-files-list-row]:has-text("${filename}")`)
  const hasSpoiler = await fileRow.locator('.spoiler-placeholder').count() > 0
  const hasPreview = await fileRow.locator('img.files-list__row-icon-preview').count() > 0

  return {
    isSpoilered: hasSpoiler,
    hasNormalPreview: hasPreview && !hasSpoiler,
    isRevealed: await fileRow.locator('[data-spoiler-revealed="true"]').count() > 0,
  }
}
```

### API Test Helpers

```javascript
// Direct API testing functions

async function apiGetSettings(authToken) {
  const response = await fetch('http://nextcloud.local/ocs/v2.php/apps/files_spoilers/api/v1/settings', {
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'OCS-APIRequest': 'true',
    },
  })
  return response.json()
}

async function apiSetTriggerLabels(authToken, labels) {
  const response = await fetch('http://nextcloud.local/ocs/v2.php/apps/files_spoilers/api/v1/settings/trigger-labels', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'OCS-APIRequest': 'true',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ labels }),
  })
  return response.json()
}

async function apiCheckSpoilerStatus(authToken, fileId) {
  const response = await fetch(`http://nextcloud.local/ocs/v2.php/apps/files_spoilers/api/v1/spoiler/${fileId}`, {
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'OCS-APIRequest': 'true',
    },
  })
  return response.json()
}
```

### Cleanup Functions

```javascript
async function cleanupTestData(page) {
  // Remove test files
  await page.goto('http://nextcloud.local/apps/files')
  const testFiles = await page.locator('[data-cy-files-list-row]:has-text("test-")').all()
  for (const file of testFiles) {
    await file.locator('[data-cy-files-list-row-actions]').click()
    await page.click('button:has-text("Delete")')
  }

  // Reset settings to defaults
  await page.goto('http://nextcloud.local/settings/user/files_spoilers')
  // Remove all custom triggers
  const triggers = await page.locator('.trigger-item button[aria-label*="Remove"]').all()
  for (const trigger of triggers) {
    await trigger.click()
  }
  // Clear custom placeholder if set
  const removePlaceholder = page.locator('button:has-text("Remove custom placeholder")')
  if (await removePlaceholder.count() > 0) {
    await removePlaceholder.click()
  }
}
```

---

## Test Execution Strategy

### Test Grouping

```javascript
// Playwright test organization

describe('files_spoilers E2E Tests', () => {
  describe('1. Settings Flow', () => {
    test('1.1: Add valid trigger label', async ({ page }) => { /* ... */ })
    test('1.2: Prevent duplicate trigger', async ({ page }) => { /* ... */ })
    test('1.3: Validate label format', async ({ page }) => { /* ... */ })
    test('1.4: Remove trigger label', async ({ page }) => { /* ... */ })
    test('1.5: Set custom placeholder', async ({ page }) => { /* ... */ })
    test('1.6: Invalid placeholder file', async ({ page }) => { /* ... */ })
    test('1.7: Clear custom placeholder', async ({ page }) => { /* ... */ })
  })

  describe('2. File List Behavior', () => {
    test('2.1: File with label shows spoiler', async ({ page }) => { /* ... */ })
    test('2.2: File without label shows normally', async ({ page }) => { /* ... */ })
    test('2.3: Click to reveal', async ({ page }) => { /* ... */ })
    test('2.4: Multiple spoilered files', async ({ page }) => { /* ... */ })
    test('2.5: Navigation maintains state', async ({ page }) => { /* ... */ })
  })

  describe('3. Real-time Updates', () => {
    test('3.1: Add label hides preview', async ({ page }) => { /* ... */ })
    test('3.2: Remove label shows preview', async ({ page }) => { /* ... */ })
    test('3.3: Cross-tab updates', async ({ page }) => { /* ... */ })
  })

  describe('4. Error Scenarios', () => {
    test('4.1: Invalid placeholder file', async ({ page }) => { /* ... */ })
    test('4.2: Network error on save', async ({ page }) => { /* ... */ })
    test('4.3: files_labels disabled', async ({ page }) => { /* ... */ })
    test('4.4: Large file count performance', async ({ page }) => { /* ... */ })
  })

  describe('5. Multi-user Scenarios', () => {
    test('5.1: Different trigger configs', async ({ page }) => { /* ... */ })
    test('5.2: Shared files', async ({ page }) => { /* ... */ })
    test('5.3: Private placeholders', async ({ page }) => { /* ... */ })
  })
})
```

### Continuous Integration

```yaml
# .github/workflows/e2e-tests.yml

name: E2E Tests
on: [push, pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest
    services:
      nextcloud:
        image: nextcloud:latest
        ports:
          - 8080:80
        env:
          NEXTCLOUD_ADMIN_USER: admin
          NEXTCLOUD_ADMIN_PASSWORD: admin

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright
        run: npx playwright install --with-deps

      - name: Setup Nextcloud
        run: |
          # Install apps
          docker exec nextcloud-container occ app:install files_labels
          docker exec nextcloud-container occ app:install files_spoilers
          # Create test users
          docker exec nextcloud-container occ user:add --password-from-env testuser1
          docker exec nextcloud-container occ user:add --password-from-env testuser2
        env:
          OC_PASS: testpass123

      - name: Run E2E tests
        run: npx playwright test

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
```

---

## Coverage Matrix

| Category | Test Count | Critical | High | Medium | Low |
|----------|-----------|----------|------|--------|-----|
| Settings Flow | 7 | 3 | 3 | 1 | 0 |
| File List Behavior | 5 | 4 | 1 | 0 | 0 |
| Real-time Updates | 3 | 2 | 1 | 0 | 0 |
| Error Scenarios | 4 | 1 | 2 | 1 | 0 |
| Multi-user | 3 | 1 | 2 | 0 | 0 |
| **Total** | **22** | **11** | **9** | **2** | **0** |

---

## Notes and Limitations

### Known Limitations
1. **Cross-tab real-time updates**: Depends on Nextcloud event bus cross-tab support (may not work)
2. **File picker UI**: Currently uses prompt(), needs proper Nextcloud file picker integration
3. **Double-click to reveal**: Current implementation uses `event.detail === 2`, may need adjustment
4. **Performance with 1000+ files**: Not yet tested at scale

### Testing Environment Requirements
- Nextcloud 25+ with files_labels app
- Modern browser (Chrome 90+, Firefox 88+, Safari 14+)
- Network latency < 100ms for real-time update tests
- Database with test data isolation

### Future Test Scenarios
- Accessibility (WCAG 2.1 compliance)
- Mobile responsive behavior
- Keyboard navigation
- Screen reader compatibility
- Performance under high load
- Database migration testing
