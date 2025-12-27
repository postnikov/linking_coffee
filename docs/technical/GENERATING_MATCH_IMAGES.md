# How to Generate Match Images on Server

This guide explains how to run the `generate-match-images.js` script to create personalized social cards for matched users.

## 1. Prerequisites

Ensure the server has the necessary environment variables in `.env`:

```bash
GOOGLE_AI_API_KEY=your_key_here
AIRTABLE_API_KEY=...
AIRTABLE_BASE_ID=...
```

## 2. Dependencies

The script uses `sharp` for image processing. If running on a new server deployment, ensure dependencies are installed:

```bash
cd backend
npm install
```

## 3. Usage

Run the script from the `backend` directory (or root, adjusting paths).

### A. Dry Run (Test Mode)
Checks which matches need images and generates one as a test (without saving to Airtable, currently saves to disk).

```bash
# Process 1 match to test
node scripts/generate-match-images.js --max-matches=1 --dry-run
```

### B. Generate Specific Match
If you know the Airtable `Num` ID (e.g., 29):

```bash
node scripts/generate-match-images.js --match-num=29
```

### C. Process All Pending Matches
This finds all records where `Status='Matched'` and `Intro_Image` is empty.

```bash
node scripts/generate-match-images.js
```

## 4. Output

The script currently saves generated images to:
`backend/generated_images/`

Filename format: `match_{RECORD_ID}_{TIMESTAMP}.png`

### Note on Airtable Upload
Currently, the script does **not** automatically upload to Airtable because the API requires a public URL.
**Process:**
1. Run the script.
2. Download the relevant images from `backend/generated_images/` (via SCP or SFTP).
3. Drag and drop them into the `Intro_Image` field in Airtable.

*(Future improvement: Expose `generated_images` via the web server to automate upload)*
