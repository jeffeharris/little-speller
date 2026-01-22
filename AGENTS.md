# Repository Guidelines

## Project Structure & Module Organization
SvelteKit sources live under `src/`: `routes/` handles pages/actions and `lib/` stores reusable components. `app.html` provides the base document, `app.css` global styles, and `npm run build` writes the deployable bundle to `build/`. Static audio cues and icons live in `static/` and are referenced with `/audio/...` paths. Automation helpers belong in `scripts/`, while end-to-end specs sit in `tests/` and are named after the user journeys they cover.

## Build, Test, and Development Commands
- `npm install`: set up SvelteKit, Vite, and Playwright dependencies.
- `npm run dev`: start Vite with hot reload on port 5173.
- `npm run build`: create an optimized static bundle via `svelte-kit build`.
- `npm run preview`: serve the production bundle locally for smoke tests.
- `npx playwright test`: run all browser specs headlessly; add `--ui` or `--headed` when debugging.

## Coding Style & Naming Conventions
Use Svelte single-file components with two-space indentation and focused script/style blocks. Name components `PascalCase.svelte`, utility modules `camelCase.js`, and exported stores/actions with descriptive nouns (`useSpeechQueue`). Favor `const`, derived stores, and isolated helpers over cross-file state. Keep CSS scoped via component `<style>` blocks; place shared tokens or resets in `app.css` using BEM-like class names such as `.board__tile`.

## Testing Guidelines
Playwright specs live in `tests/*.spec.js` and should read as behavior stories ("speech", "pop-sound"). Add a spec whenever you ship a new interaction or audio cue, asserting both visible state and sound playback. While iterating, run `npx playwright test tests/speech.spec.js --headed` to watch the scenario, and use resilient selectors (`getByRole`, `data-testid`).

## Commit & Pull Request Guidelines
Follow the repo’s short, imperative commit style (`Add CLAUDE.md instructions`). Keep each commit focused, reference related issues in the body (`Fixes #12`), and explain user-facing changes plus test coverage in the PR description. Attach screenshots or brief recordings for layout or animation tweaks to speed up review.

## Assets & Configuration Tips
Compress audio before adding files to `static/audio/` to keep downloads kid-friendly. Keep configuration tweaks in `svelte.config.js` or `vite.config.js`, and pass secrets through `$env/static/private` rather than baking them into components.
