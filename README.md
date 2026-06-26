# PDF Editor

A fully client-side, browser-based PDF editor for inline document editing, annotation, and redaction — documents never leave the user's machine.

## Overview

Built with React 19 and TypeScript on a dual-canvas rendering architecture: **pdf.js** renders the original document at native fidelity on a background canvas, while a separate **Fabric.js** overlay canvas handles every interactive edit — text, shapes, freehand drawing, highlights, redactions — as an independent, undoable layer per page. The original render is never mutated; edits compose on top of it and are flattened into the final document on export via **pdf-lib**.

## Key Features

- **Inline text editing** — click any existing text run to edit it in place. The editor reads the run's font metadata directly from the PDF and matches family, weight, and style automatically, with an optional local Python microservice for exact embedded-font extraction when pixel-level fidelity matters.
- **Annotation toolkit** — freehand drawing, highlighter, rectangles, redaction blocks, and free text, each with independent per-page undo/redo history.
- **Track Changes / Compare View** — a side-by-side red/green diff view that visually isolates additions and deletions, with per-change and bulk accept/reject controls.
- **Font Panel** — surfaces the fonts actually embedded in the document, distinct from a curated fallback list, with live extraction status.
- **No server dependency for core editing** — all parsing, rendering, and editing run entirely in-browser; the Python service is an optional enhancement, never a requirement.

## Architecture Notes

- Background (pdf.js) and overlay (Fabric.js) canvases are synchronized through a shared zoom/coordinate system, keeping rendering and interaction concerns strictly decoupled.
- Edit state is normalized per page index (`Record<pageIndex, FabricJSON>`), enabling independent undo stacks and efficient re-renders across multi-page documents.
- Styled with Tailwind CSS v4; icons via Lucide.

## Stack

`React 19` · `TypeScript` · `Vite` · `Tailwind CSS v4` · `pdf.js` · `Fabric.js` · `pdf-lib` · optional Python font-extraction service

## Run Locally

**Prerequisites:** Node.js (Python 3 is optional, only needed for exact embedded-font extraction)

1. Install dependencies:
   ```
   npm install
   ```
2. Run the app:
   ```
   npm run dev
   ```
   This starts the Vite dev server and the optional Python font service together. If you don't have Python installed, the editor still runs fully — font matching just falls back to heuristic detection instead of exact extraction.

   Other available scripts:
   - `npm run dev:react-only` — frontend only, no Python service
   - `npm run dev:python-only` — Python font service only
   - `npm run build` — production build
   - `npm run preview` — preview a production build locally
   - `npm run lint` — TypeScript type-check
