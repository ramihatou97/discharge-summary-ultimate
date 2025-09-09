#!/bin/bash

# Create all necessary files
cat > package.json << 'EOL'
{
  "name": "discharge-summary-ultimate",
  "version": "3.0.0",
  "private": true,
  "homepage": "https://ramihatou97.github.io/discharge-summary-ultimate",
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "lucide-react": "^0.263.1",
    "recharts": "^2.8.0",
    "date-fns": "^2.30.0"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "eject": "react-scripts eject",
    "predeploy": "npm run build",
    "deploy": "gh-pages -d build"
  },
  "eslintConfig": {
    "extends": ["react-app"]
  },
  "browserslist": {
    "production": [">0.2%", "not dead", "not op_mini all"],
    "development": ["last 1 chrome version", "last 1 firefox version", "last 1 safari version"]
  },
  "devDependencies": {
    "react-scripts": "5.0.1",
    "gh-pages": "^5.0.0",
    "tailwindcss": "^3.3.0",
    "autoprefixer": "^10.4.14",
    "postcss": "^8.4.24",
    "@types/react": "^18.0.0",
    "@types/react-dom": "^18.0.0",
    "typescript": "^4.9.5"
  }
}
EOL

# Install dependencies
npm install

echo "✅ Package.json created and dependencies installed"