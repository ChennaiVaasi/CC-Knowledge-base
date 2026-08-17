# CC Knowledge Base

A chess instructional knowledge pipeline for CircleChess. Teams use it to import chess positions (PGN/FEN), assign them to content builders, detect duplicate/similar positions, run peer review, and publish approved curriculum knowledge.

## Stack

- **React 18 + TypeScript** — single-page app, all UI in `src/App.tsx`
- **Vite** — dev server on port 5000
- **chess.js** — FEN/PGN parsing
- **Stockfish** — chess engine (referenced in UI, not yet wired live)

## Running the app

```
npm run dev
```

Starts the Vite dev server on port 5000. The "Start application" workflow does this automatically.

## Known gaps

- Chess piece SVG images (`/public/pieces/*.svg`) are missing from the repo — boards render empty squares.
- All data (positions, users, taxonomy) is hardcoded in `src/App.tsx`; there is no backend or database.
- Stockfish analysis shown in the Builder Workspace is static mock data.

## User preferences

_None recorded yet._
