# Canvas PNG Download for Share Cards

**Date:** 2026-04-07
**Status:** Approved

## Problem

The app currently relies on the browser print dialog for exporting share cards as PDFs. This works but introduces friction: users must navigate the print dialog, choose "Save as PDF," and configure settings. On iOS Safari, this is especially unreliable. We want to add a one-click download option that bypasses the print dialog entirely.

## Decision

Add PNG download buttons alongside the existing print buttons. Use the native Canvas 2D API to render share cards — zero new dependencies. For bulk download, pack PNGs into a ZIP file using a minimal inline ZIP writer (STORE method, no compression needed since PNGs are already compressed).

## Scope

**In scope:**
- "Download" button on each individual share card (next to "Print Share N")
- "Download All" button in the output header (next to "Print All")
- Canvas rendering function that reproduces the print layout
- Minimal ZIP writer for bulk downloads

**Out of scope:**
- No changes to existing print functionality (Print All, Print Share N stay as-is)
- No external dependencies
- No PDF generation

## Design

### UI Changes

**Output header** (`#split-output .output-header`):
- Existing: `[Print All]`
- New: `[Print All] [Download All]`

**Individual share cards** (`.share-card`):
- Existing: `[Print Share N]`
- New: `[Print Share N] [Download N]`

Both download buttons use the same `btn-small` / `btn-secondary` styling as existing buttons.

### Canvas Rendering

A function `renderShareCard(card, callback)` that:

1. Creates an offscreen canvas sized to US Letter proportions (~816x1056px at 96dpi)
2. Fills white background
3. Reads data from the share card DOM element:
   - Share name (`.share-name`, if present) — bold, centered, near top
   - Share label (`.share-label`) — bold, uppercase, gray, centered
   - Info text (`.share-print-info`) — gray, centered, multi-line
   - QR code (`.share-qr img` src) — centered, ~80% canvas width
   - Base64 text (`.share-text`) — monospace, centered, word-wrapped at ~88% width
4. Draws each element onto the canvas matching the print.css layout
5. Exports via `canvas.toBlob('image/png')` and passes blob to callback

Font sizes and spacing should match print.css proportions (scaled to the canvas pixel dimensions rather than using `cqi` units).

### Download Flow

**Single share ("Download N"):**
1. Call `renderShareCard()` for that card
2. Create object URL from blob
3. Trigger download via `<a download="filename.png">` click
4. Revoke object URL

**All shares ("Download All"):**
1. Render each share card to PNG blob sequentially
2. Pack all blobs into a ZIP using the inline ZIP writer
3. Trigger download of the ZIP file
4. Filename: `{timestampedName}.zip` using existing `printPrefix()` logic

### Minimal ZIP Writer

A self-contained function `createZip(files)` where `files` is an array of `{name, blob}`. Produces a ZIP using STORE method (no compression — PNGs are already deflate-compressed). This is ~80-100 lines of vanilla JS covering:

- Local file headers
- File data (raw bytes)
- Central directory
- End of central directory record

Returns a Blob of type `application/zip`.

### File Naming

Reuses existing `SSS.timestampedName()` and `printPrefix()`:

- Single: `SecretShards.com[-name]-share1-YYYYMMDD-HHMMSS-xxx.png`
- Bulk ZIP: `SecretShards.com[-name]-YYYYMMDD-HHMMSS-xxx.zip`
- Files inside ZIP: `share-1.png`, `share-2.png`, etc.

### Code Location

New file `js/download.js` — a self-contained module exposing `SSS.Download`:

- `SSS.Download.renderCard(card, callback)` — canvas rendering
- `SSS.Download.downloadBlob(blob, filename)` — trigger download
- `SSS.Download.createZip(files)` — minimal ZIP writer
- `SSS.Download.downloadCard(card, filename)` — render + download single card
- `SSS.Download.downloadAll(cards, filenamePrefix)` — render all + ZIP + download

`js/split.js` changes are minimal: button creation in the `shares.forEach()` loop and "Download All" button wiring, calling into `SSS.Download`.

`index.html` gets a `<script src="js/download.js">` tag alongside the other scripts.

### Error Handling

- If canvas rendering fails (e.g., tainted canvas from cross-origin QR image — unlikely since QR is generated locally), fall back gracefully with an alert
- If ZIP creation fails, fall back to sequential individual PNG downloads
