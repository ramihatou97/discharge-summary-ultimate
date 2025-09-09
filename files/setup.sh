#!/bin/bash

echo "🚀 Setting up Ultimate Discharge Summary Generator..."

# Install dependencies
npm install

# Create necessary directories
mkdir -p src/{components,data,utils}

# Set up Git
git config --global user.email "ramihatou97@github.com"
git config --global user.name "ramihatou97"

# Create initial commit
git add .
git commit -m "Initial setup of discharge summary generator"
git push origin main

# Start the development server
echo "✅ Setup complete! Starting development server..."
npm start