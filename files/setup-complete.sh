#!/bin/bash

echo "🚀 Setting up Ultimate Discharge Summary Generator for ramihatou97..."

# Initialize React app with all dependencies
npx create-react-app . --template typescript --use-npm
npm install lucide-react recharts date-fns
npm install --save-dev gh-pages tailwindcss autoprefixer postcss @types/react @types/react-dom

# Initialize Tailwind
npx tailwindcss init -p

# Clean up default files
rm -f src/App.test.* src/logo.svg src/setupTests.* src/App.css src/App.tsx

# Create project structure
mkdir -p src/components
mkdir -p src/data  
mkdir -p src/utils
mkdir -p .github/workflows

echo "✅ Dependencies installed, creating application files..."