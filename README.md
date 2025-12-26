# File Spoilers for Nextcloud

Hide file previews based on labels, with click-to-reveal functionality.

## Requirements

**This app requires the [File Labels](https://github.com/your-repo/nextcloud-files-labels) app to be installed and enabled.** File Spoilers uses the labels system to determine which files should have their previews hidden.

## Features

- **Label-based triggers**: Configure which label values trigger preview hiding (e.g., `sensitive=true`, `nsfw=yes`)
- **Click to reveal**: Users can click (or press Enter/Space) on hidden previews to reveal them for the session
- **Custom placeholders**: Optionally use a custom image instead of the default icon
- **Per-user settings**: Each user configures their own trigger labels
- **Live updates**: Previews update immediately when labels change

## How It Works

1. Install and enable the `files_labels` app
2. Install and enable this app (`files_spoilers`)
3. Go to **Settings > Personal > File Spoilers** to configure trigger labels
4. Add labels to files using the Labels sidebar tab in the Files app
5. Files matching your triggers will show a placeholder instead of preview
6. Click the placeholder to reveal the actual preview (session only)

## Configuration

### Trigger Labels

By default, files with `sensitive=true` are spoilered. You can add additional triggers like:
- `nsfw=true`
- `spoiler=yes`
- `content-warning=violence`

### Custom Placeholder

You can set a custom image to display instead of the default eye icon. Enter the file ID of any image in your files.

## API

### OCS REST API

```bash
# Get user settings
curl -u user:pass "http://localhost:8080/ocs/v2.php/apps/files_spoilers/api/v1/settings" \
  -H "OCS-APIREQUEST: true"

# Update trigger labels
curl -u user:pass -X PUT "http://localhost:8080/ocs/v2.php/apps/files_spoilers/api/v1/settings/trigger-labels" \
  -H "OCS-APIREQUEST: true" \
  -H "Content-Type: application/json" \
  -d '{"labels": ["sensitive=true", "nsfw=yes"]}'

# Set custom placeholder
curl -u user:pass -X PUT "http://localhost:8080/ocs/v2.php/apps/files_spoilers/api/v1/settings/placeholder" \
  -H "OCS-APIREQUEST: true" \
  -d "fileId=12345"
```

## Installation

### Development

```bash
# Install dependencies
npm install

# Build the frontend
npm run build

# Enable the app (after files_labels is enabled)
occ app:enable files_spoilers
```

### Production

1. Ensure `files_labels` app is installed and enabled
2. Download from Nextcloud App Store (once published)
3. Or clone to `custom_apps/files_spoilers` and enable via admin UI

## License

AGPL-3.0-or-later
