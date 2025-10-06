# GitHub Actions Deployment Workflow

This directory contains the automated deployment workflow for the Discharge Summary Generator.

## Workflow: `deploy.yml`

### Purpose
Automatically builds and deploys the React application to GitHub Pages whenever changes are pushed to the `main` branch.

### Trigger Events
- **Automatic**: Every push to `main` branch
- **Manual**: Via GitHub Actions UI (workflow_dispatch)

### Workflow Steps

#### 1. Build Job
1. **Checkout**: Clones the repository
2. **Setup Node.js**: Installs Node.js v20 with npm caching
3. **Install Dependencies**: Runs `npm ci` in `/files` directory
4. **Build**: Creates production build with `npm run build`
   - Sets `CI=false` to treat warnings as non-blocking
5. **Setup Pages**: Configures GitHub Pages settings
6. **Upload Artifact**: Uploads build directory for deployment

#### 2. Deploy Job
1. **Deploy to GitHub Pages**: Uses official GitHub Pages action
   - Runs after build job completes
   - Publishes to `github-pages` environment
   - Provides deployment URL

### Configuration

```yaml
Triggers: 
  - push (main branch)
  - workflow_dispatch (manual)

Permissions:
  - contents: read
  - pages: write
  - id-token: write

Node Version: 20.x
Working Directory: ./files
Build Output: ./files/build
```

### Usage

#### Automatic Deployment
Simply push to main branch:
```bash
git push origin main
```

#### Manual Deployment
1. Go to: https://github.com/ramihatou97/discharge-summary-ultimate/actions
2. Select "Deploy to GitHub Pages" workflow
3. Click "Run workflow"
4. Select branch and confirm

### Monitoring

View workflow runs at:
https://github.com/ramihatou97/discharge-summary-ultimate/actions/workflows/deploy.yml

### Build Time
- Typical duration: 2-3 minutes
- Cached builds: 1-2 minutes

### Requirements

#### Repository Settings
**GitHub Pages must be enabled:**
1. Go to Settings → Pages
2. Source: **GitHub Actions**
3. Save changes

#### Workflow Permissions
**May need to enable in Settings → Actions → General:**
- Workflow permissions: "Read and write permissions"
- Allow Actions to create/approve PRs: Enabled

### Troubleshooting

#### Build Fails
- Check Node.js version compatibility
- Verify all dependencies in package.json
- Review build logs in Actions tab

#### Deployment Fails
- Verify Pages source is set to "GitHub Actions"
- Check workflow permissions
- Ensure no conflicting workflows

#### App Doesn't Load
- Wait 2-3 minutes after deployment
- Clear browser cache
- Verify homepage in package.json matches GitHub Pages URL

### Cost
- **Free**: 2,000 workflow minutes per month (more than enough)
- **Build time**: ~2 minutes per deployment
- **Estimated monthly usage**: < 100 minutes

### Security
- No secrets required for public repositories
- Uses official GitHub Actions
- Read-only access to repository
- Write access only to GitHub Pages

### Maintenance
- Actions are pinned to major versions (@v4)
- Node.js version specified (20.x)
- Dependencies cached for performance
- Automatically handles concurrency

---

## Other Workflows

### `npm-publish-github-packages.yml`
- Purpose: Publishes npm package on release
- Trigger: When a release is created
- Status: Optional, not related to app deployment

---

**For full deployment instructions, see:**
- `QUICK_DEPLOYMENT_GUIDE.md` - Quick start guide
- `DEPLOYMENT_INSTRUCTIONS.md` - Detailed instructions
- `DEPLOYMENT_COMPLETION_SUMMARY.md` - Technical overview
