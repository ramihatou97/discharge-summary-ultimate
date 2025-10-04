# Vercel Configuration

## Current Setup: Create React App

This `vercel.json` is configured for the **current project setup** which uses Create React App (react-scripts).

### Key Settings

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "build",  // CRA outputs to 'build/'
  "installCommand": "npm install"
}
```

### Deployment

Simply push your code to GitHub and import the repository in Vercel. This configuration will work automatically.

**No migration needed** - Deploy as-is! ✓

---

## After Migrating to Vite (Optional)

If you follow the Vite migration guide in `VERCEL_DEPLOYMENT_GUIDE.md`, update this file to:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",  // Vite outputs to 'dist/'
  "installCommand": "npm install"
}
```

Or simply remove `vercel.json` entirely - Vercel auto-detects Vite projects correctly.

---

## Security Headers

The configuration includes security headers for all deployments:
- `X-Content-Type-Options: nosniff` - Prevents MIME sniffing
- `X-Frame-Options: DENY` - Prevents clickjacking
- `X-XSS-Protection: 1; mode=block` - Enables XSS protection
- `Referrer-Policy: strict-origin-when-cross-origin` - Controls referrer information

## Cache Optimization

Static assets (JS, CSS, images) are cached for 1 year with `immutable` flag for optimal performance.

---

## Need Help?

See `VERCEL_DEPLOYMENT_GUIDE.md` for comprehensive deployment instructions and framework comparison.
