# Project Creation & Upload Requirements

## Overview
This document outlines the requirements for creating and uploading IoT projects to the iotivate.dev platform. Projects are comprehensive packages that include hardware descriptions, firmware, documentation, and optional companion apps.

## Required Fields

### Basic Information
- **Slug** (Required): URL-friendly identifier (max 100 chars, lowercase letters, numbers, hyphens only)
  - Pattern: `^[a-z0-9-]+$`
  - Auto-generated from name if not manually edited
  - Cannot be changed after creation
- **Name** (Required): Project display name (1-200 characters)
- **Description** (Required): Brief summary for project cards (1-2000 characters)

### Optional Core Fields
- **Tags**: Comma-separated keywords for filtering (max 500 chars)
  - Example: "ESP32,WiFi,IoT,Home Automation"
- **YouTube Video ID**: 11-character YouTube video identifier
  - Extract from: `youtube.com/watch?v=VIDEO_ID`
  - Pattern: `^[a-zA-Z0-9_-]{11}$`
- **Overview**: Detailed project description in HTML (max 100,000 chars)

## Project Components

### Parts List
Optional list of required components:
- **Name** (Required): Component name (max 200 chars)
- **Quantity** (Required): Number needed (1-10,000)
- **Description**: Additional details (max 1,000 chars)
- **Buy Link**: Purchase URL (max 2,000 chars)
- **Price**: Cost estimate (max 50 chars)

### Downloads
File attachments for project resources:
- **Name** (Required): Display name (max 200 chars)
- **URL** (Required): File download link (max 2,000 chars)
- **Size**: File size display (max 50 chars)
- **Type**: File category (`stl`, `pdf`, `zip`, `other`)

**Supported File Types**:
- 3D Models: `.stl`
- Documentation: `.pdf`
- Archives: `.zip`, `.rar`, `.7z`
- Firmware: `.bin`, `.hex`
- Images: `.png`, `.jpg`, `.jpeg`
- Maximum file size: 100MB per file

### Circuit Diagram
Optional wiring/schematic diagram:
- **Image URL** (Required): Diagram image location
- **Alt Text**: Accessibility description (max 500 chars)
- **Download URL**: Link to downloadable version

**Supported Formats**: PNG, JPG, SVG, PDF

### Build Guide
Step-by-step assembly instructions:
- **Title** (Required): Step name (max 500 chars)
- **Content** (Required): HTML instructions (max 50,000 chars)
- **Warning**: Safety/important notices (max 2,000 chars)

**HTML Support**: Rich text with images, lists, links, code blocks
**Image Insertion**: Upload directly into step content

### Firmware (Optional)
Paid/free firmware offerings:
- **Name** (Required): Firmware display name (max 200 chars)
- **Version** (Required): Version number (max 50 chars)
- **Price** (Required): Cost in USD (0-99,999.99)
- **Currency**: Always "USD" (max 10 chars)
- **Features**: List of capabilities
- **Binary URL**: Compiled firmware file (.bin/.hex)
- **Source Code URL**: GitHub repo or ZIP download
- **Variant ID**: Lemon Squeezy product variant for payments

### Companion App (Optional)
Mobile/desktop application information:
- **Name** (Required): App name (max 200 chars)
- **Description**: App summary (max 2,000 chars)
- **Play Store URL**: Android app store link
- **iOS URL**: Apple App Store link
- **APK URL**: Direct Android install file
- **APK Version**: Version number (max 50 chars)
- **APK Size**: File size (auto-calculated on upload)
- **Features**: List of app capabilities

### Support Information
Help resources and links:
- **Text**: Support description (max 5,000 chars)
- **Links**: Array of support resources
  - **Label**: Link display name (max 200 chars)
  - **URL**: Link destination (max 2,000 chars)

## File Upload Process

### Storage Structure
```
projects/{project-slug}/
├── downloads/           # General project files
├── circuit/            # Circuit diagrams
├── guide/              # Build guide images
├── firmware/           # Firmware binaries
└── app/               # APK files
```

### Upload Workflow
1. **Stage Files**: Select files in UI (preview before upload)
2. **Validate**: Check file types, sizes, naming
3. **Upload**: Batch upload to Cloudflare R2
4. **Save Project**: Create/update database record
5. **Cleanup**: Remove staged files on success

### File Processing
- **Auto-size Calculation**: File sizes calculated during upload
- **Type Detection**: Based on file extension
- **URL Generation**: Cloudflare R2 public URLs
- **Progress Tracking**: Real-time upload status

## Validation Rules

### Content Sanitization
- **HTML Fields**: Sanitized using `bleach` library
- **Allowed Tags**: `p`, `h1-h6`, `ul`, `ol`, `li`, `a`, `strong`, `em`, `code`, `pre`, `img`, `br`, `blockquote`, `table`, `thead`, `tbody`, `tr`, `th`, `td`, `span`, `div`, `hr`
- **Allowed Attributes**:
  - `a`: `href`, `title`, `target`, `rel`
  - `img`: `src`, `alt`, `width`, `height`
  - `td`, `th`: `colspan`, `rowspan`

### Input Validation
- **String Lengths**: Enforced at schema level
- **Patterns**: Regex validation for slugs, YouTube IDs
- **Required Fields**: Validated before save
- **JSON Structure**: Complex objects validated via Pydantic

### Security Measures
- **Authentication**: Admin-only project creation
- **File Type Restrictions**: Only approved extensions
- **HTML Sanitization**: Prevent XSS attacks
- **URL Validation**: Proper URL formatting required

## API Endpoints

### Create Project
```
POST /api/admin/projects
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "slug": "smart-relay",
  "name": "Smart WiFi Relay",
  "description": "Control relays remotely via WiFi",
  "tags": "ESP32,WiFi,Relay",
  "is_published": false,
  // ... other optional fields
}
```

### Update Project
```
PUT /api/admin/projects/{project_id}
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "name": "Updated Project Name",
  "is_published": true
  // ... fields to update
}
```

### File Upload
```
POST /api/files/upload
Authorization: Bearer {token}
Content-Type: multipart/form-data

folder: projects/smart-relay
files: [file1, file2, ...]
```

## Access Control

### Permissions
- **Project Creation**: Admin users only
- **File Upload**: Authenticated users
- **Project Viewing**: Public (published projects)
- **Project Editing**: Admin users only

### Publishing
- **Draft Mode**: `is_published: false` (admin-only access)
- **Published**: `is_published: true` (public access)
- **Instant Publishing**: Can be enabled during creation

## File Management

### Cleanup Policy
- **Project Deletion**: All associated R2 files removed
- **File Replacement**: Old files deleted when new ones uploaded
- **Orphaned Files**: Automatic cleanup via background jobs

### URL Structure
- **Format**: `https://pub-{bucket}.r2.dev/projects/{slug}/{category}/{filename}`
- **Public Access**: All uploaded files publicly accessible
- **CDN Integration**: Cloudflare R2 with global distribution

## Best Practices

### Project Organization
1. Use descriptive, SEO-friendly slugs
2. Include comprehensive parts lists with buy links
3. Provide clear, step-by-step build guides
4. Test all download links before publishing
5. Include safety warnings where appropriate

### File Management
1. Keep file sizes reasonable for download speed
2. Use descriptive filenames
3. Provide accurate file size information
4. Include alt text for images (accessibility)
5. Compress large files when possible

### Content Quality
1. Use proper HTML formatting in guides
2. Include high-quality circuit diagrams
3. Test all external links regularly
4. Provide multiple support channels
5. Keep firmware and apps updated