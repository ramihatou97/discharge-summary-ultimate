# Discharge Summary Generator

A professional medical documentation tool for generating discharge summaries from clinical notes.

## Features

- **Pattern-based extraction**: Works offline without API requirements
- **Optional AI integration**: Enhanced extraction with Google Gemini API
- **Auto-save**: Never lose your work
- **Multiple templates**: Standard, detailed, and brief formats
- **Dark mode support**: Reduce eye strain
- **Print-ready**: Professional formatting for medical records
- **Data validation**: Automatic checking for missing information

## Quick Start

### Option 1: Deploy to Vercel (Recommended)
1. Fork this repository to your GitHub account
2. Go to [vercel.com](https://vercel.com)
3. Import your forked repository
4. Deploy with one click

### Option 2: Deploy to Netlify
1. Fork this repository
2. Go to [netlify.com](https://netlify.com)
3. Connect your GitHub and select the repository
4. Deploy automatically

### Option 3: Local Development
```bash
# Clone the repository
git clone https://github.com/ramihatou97/discharge-summary-generator.git

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Usage

1. **Input Clinical Notes**
   - Paste admission/consult note in the first tab
   - Add progress notes (optional) in the second tab
   - Add final/discharge note in the third tab

2. **Extract Information**
   - Click "Extract Information" to process the notes
   - Review and edit the extracted data

3. **Generate Summary**
   - Click "Generate Summary" to create the discharge document
   - Copy, download, or print the final summary

## AI Integration (Optional)

To enable AI-powered extraction:
1. Get a free API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Enable "Use AI Extraction" in settings
3. Enter
