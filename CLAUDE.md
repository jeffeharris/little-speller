# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Little Speller is a mobile web app for kids (ages 2-6) to learn spelling through a drag-and-drop word scramble game. Built with SvelteKit 2 and Svelte 5.

## Commands

```bash
# Development (local)
npm run dev -- --host          # Start with network access for mobile testing

# Development (Docker)
docker compose up --build -d   # Build and run on port 5180
docker compose logs -f         # Watch logs/HMR updates
PORT=3000 docker compose up -d # Custom port via env var

# Testing
npx playwright test                        # Run all tests
npx playwright test tests/speech.spec.js   # Run single test file
npx playwright test --project=chromium     # Run specific browser

# Build
npm run build                  # Production build to ./build
npm run preview                # Preview production build
```

## Architecture

### Game Flow
1. **Tap to Start** → Unlocks iOS audio/speech (required for mobile Safari)
2. **Word Display** → Word appears, spoken aloud via Web Speech API
3. **Scatter Animation** → Letters animate to random positions above/below word
4. **Drag & Drop** → User drags colored letters to matching gray slots
5. **Feedback** → Correct: pop sound + wiggle animation; Wrong: thud + letter moves below word
6. **Celebration** → All letters placed triggers celebration, auto-advances to next word

### Key Components

- **Game.svelte** - Main orchestrator: handles game phases, drag-end detection, slot matching
- **Letter.svelte** - Draggable letter with spring physics, touch handling, wiggle animation on placement
- **WordSlots.svelte** - Gray silhouette word display, reports slot positions to Game
- **Celebration.svelte** - Star animation overlay when word completed

### State Management

- **stores/game.js** - Writable store with methods: `initWord()`, `scatterLetters()`, `placeLetter()`, `nextWord()`
- Letters match slots by character (not position) - e.g., either "L" in "ball" can fill either L slot
- Exports `LETTER_SIZE` constant (70px) used across components

### Audio (iOS Compatibility)

- **utils/sounds.js** - Uses HTML5 Audio with base64 WAV for iOS compatibility (Web Audio API oscillators failed on Safari)
- **utils/speech.js** - Web Speech API wrapper; requires user gesture to unlock on iOS
- `resumeAudio()` must be called from a user tap event before sounds will play on iOS

### Mobile Considerations

- Viewport locked via meta tags in app.html (no zoom/scroll)
- Touch events use pointer capture for smooth dragging
- `allowedHosts: true` in vite.config.js for network access
- Docker uses `usePolling: true` for HMR with volume mounts
