#!/bin/bash

# Complete setup for ramihatou97
echo "🏥 Setting up Ultimate Discharge Summary Generator..."
echo "👤 Author: ramihatou97"
echo "📅 Date: $(date)"

# Clone and setup
gh repo create discharge-summary-ultimate --public --clone \
  --description "Ultimate AI-Powered Neurosurgery Discharge Summary Generator"

cd discharge-summary-ultimate

# Initialize React app
npx create-react-app . --use-npm --template typescript

# Install all dependencies
npm install lucide-react recharts date-fns
npm install -D gh-pages tailwindcss autoprefixer postcss

# Setup Tailwind
npx tailwindcss init -p

# Configure Tailwind
cat > tailwind.config.js << 'EOL'
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: '#667eea',
        secondary: '#764ba2'
      }
    }
  },
  plugins: []
}
EOL

# Create GitHub Actions workflow
mkdir -p .github/workflows
cat > .github/workflows/deploy.yml << 'EOL'
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
        env:
          CI: false
      - run: npm run deploy
EOL

# Configure git
git config user.name "ramihatou97"
git config user.email "ramihatou97@users.noreply.github.com"

# Initial commit and push
git add .
git commit -m "🚀 Initial setup: Ultimate Discharge Summary Generator v3.0"
git branch -M main
git push -u origin main

# Enable GitHub Pages
gh repo edit --enable-pages --pages-branch gh-pages

echo "✅ Setup complete!"
echo "🌐 Your app will be available at: https://ramihatou97.github.io/discharge-summary-ultimate"
echo "📝 Codespace URL: https://github.com/codespaces"
echo "🚀 Run 'npm start' to begin development"