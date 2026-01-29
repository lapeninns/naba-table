# Sentry-GitHub Integration (Error-to-Insight Pipeline)

Last updated: 2026-01-29

## Overview

This document describes how to configure the Sentry-GitHub integration for automatic issue creation from production errors.

## Prerequisites

- Admin access to Sentry organization
- Admin access to GitHub repository
- Sentry project already configured

## Setup Steps

### 1. Install Sentry GitHub App

1. Go to **Sentry** → **Settings** → **Integrations** → **GitHub**
2. Click **Install** and authorize for your organization
3. Select repositories to connect (include `lapeninns/nabatable`)

### 2. Configure Source Code Management

1. In Sentry project settings → **Source Code**
2. Connect the GitHub repository
3. Map repository paths:
   ```
   / → lapeninns/nabatable
   ```

### 3. Enable Commit Tracking

1. Go to **Settings** → **Release** → **Commits**
2. Enable "Track commits"
3. Configure release association in `sentry.server.config.ts`:
   ```typescript
   Sentry.init({
     release: process.env.VERCEL_GIT_COMMIT_SHA,
     // ...
   });
   ```

### 4. Configure Issue Linking

1. **Settings** → **Integrations** → **Issue Tracking**
2. Enable GitHub Issues
3. Set default repository: `lapeninns/nabatable`

### 5. Set Up Auto-Issue Creation (Optional)

For high-severity errors to automatically create GitHub issues:

1. **Alerts** → **Create Alert**
2. Configure trigger:
   - Condition: "New issue seen"
   - Filter: `level:error OR level:fatal`
   - Action: "Create a GitHub issue"
3. Set issue template:

   ```markdown
   ## Sentry Error

   **Title**: {{ issue.title }}
   **URL**: {{ issue.url }}
   **First seen**: {{ issue.first_seen }}
   **Events**: {{ issue.count }}

   ### Stack Trace

   {{ issue.stacktrace }}
   ```

### 6. Verify Integration

1. Trigger a test error:
   ```typescript
   throw new Error('Test Sentry-GitHub integration');
   ```
2. Check Sentry for the error
3. Click "Link GitHub Issue" and verify connection works

## Using the Integration

### Linking Issues

When viewing an error in Sentry:

1. Click **Link GitHub Issue** in the sidebar
2. Search or create a new issue
3. Issue will be linked and status synced

### Resolving via Commits

Include issue ID in commit messages:

```bash
git commit -m "fix: resolve null pointer in booking flow

Fixes NABATABLE-123"
```

Sentry will:

1. Associate commit with the issue
2. Mark issue as resolved when deployed

## Monitoring Dashboard

After setup, the following integrations will be active:

| Feature             | Status | Notes                         |
| ------------------- | ------ | ----------------------------- |
| Source maps         | ✅     | Uploaded via build            |
| Commit tracking     | ✅     | Via VERCEL_GIT_COMMIT_SHA     |
| Issue linking       | ✅     | Manual linking available      |
| Auto-resolution     | ⚙️     | Configure via commit messages |
| Auto-issue creation | ⚙️     | Configure alert rules         |

## Troubleshooting

### Issues Not Linking

1. Verify GitHub App has access to repository
2. Check repository mapping in Source Code settings
3. Ensure release matches deployed version

### Stack Traces Not Mapping

1. Verify source maps are uploaded
2. Check `.sentryclirc` or build configuration
3. Run `sentry-cli releases files <release> list`

## Related Documentation

- [Observability Overview](./observability.md)
- [Architecture](./architecture.md)
- [Sentry Documentation](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
