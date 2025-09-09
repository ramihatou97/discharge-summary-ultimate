#!/bin/bash

# Clone the repository
git clone https://github.com/ramihatou97/discharge-summary-ultimate.git
cd discharge-summary-ultimate

# Initialize React app
npx create-react-app . --template typescript

# Install dependencies
npm install lucide-react recharts date-fns
npm install --save-dev gh-pages tailwindcss autoprefixer postcss

# Initialize Tailwind CSS
npx tailwindcss init -p

# Create project structure
mkdir -p src/components
mkdir -p src/data
mkdir -p src/utils
mkdir -p public/assets

# Clean up default React files
rm -f src/App.test.js src/logo.svg src/setupTests.js

echo "Project structure created successfully!"