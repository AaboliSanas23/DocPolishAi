# DocPolishAI

React app that uploads Word documents (`.docx`), extracts structured blocks for editing, applies consistent typography from the sidebar, and exports back to Word. Optional **Auto Fix** uses a local Ollama endpoint when configured.

## Project layout

```
src/
  app/                 # Root screen: App + smoke test
  components/
    layout/            # Navbar
    editor/            # Document preview, search bar, rich paragraph field
    sidebar/           # Formatting rules panel
  hooks/               # Shared hooks (e.g. useMatchMedia)
  store/               # Redux Toolkit + redux-persist
  types/               # DocumentBlock, StyleConfig, ambient types
  utils/
    docx/              # Ingest, classify blocks, export .docx, Word labels
    formatting/        # applyStylesToHtml (preview/export styling)
    editor/            # Rich text, search highlights, code/output sections
    ai/                # Ollama Auto Fix
  index.tsx            # Entry: Provider, PersistGate, CSS
  index.css
  setupTests.ts
```

## Prerequisites

- **Node.js** 18+ (LTS recommended)
- **npm** 9+

## Setup

```bash
git clone <your-repo-url>
cd docpolishai
npm install
```

Copy environment defaults if you use Auto Fix:

```bash
cp .env.example .env
```

Edit `.env` if your Ollama URL or model differs.

## Scripts

| Command        | Description                                      |
|----------------|--------------------------------------------------|
| `npm start`    | Development server at http://localhost:3000      |
| `npm test`     | Jest test suite (`CI=true npm test` for CI)      |
| `npm run build`| Optimized production bundle in `build/`          |

## Publishing to GitHub

1. Create an empty repository on GitHub (no README/license if you already have them locally).

2. From this project folder:

   ```bash
   git remote add origin https://github.com/<your-user>/<your-repo>.git
   git branch -M main
   git add .
   git commit -m "Initial commit"
   git push -u origin main
   ```

3. **Security:** Do **not** commit SSH private keys, `.env` files with secrets, or API keys. This repo’s `.gitignore` excludes common patterns; move personal keys (e.g. `aabolisanasKey`) **outside** the project or rely on `.gitignore`. If you ever pushed a secret by mistake, rotate it and use [GitHub guidance on removing sensitive data](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository).

## Environment variables

Defined in `.env.example`:

| Variable                  | Purpose                                      |
|---------------------------|----------------------------------------------|
| `REACT_APP_OLLAMA_URL`    | Ollama generate API URL                      |
| `REACT_APP_OLLAMA_MODEL`  | Model name for Auto Fix                      |

CRA only exposes variables prefixed with `REACT_APP_`.

## Documentation (`docs/`)

| Doc | Contents |
|-----|----------|
| [PERFORMANCE.md](docs/PERFORMANCE.md) | **Two tracks:** (1) earlier **`src/`** folder layout; (2) typing lag — root cause, debouncing, verification, interview Q&A |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Data flow, Redux, layers |
| [CODEBASE.md](docs/CODEBASE.md) | File-by-area guide |

## Stack

Create React App (TypeScript), Tailwind-style utility classes, Mammoth (DOCX→HTML), export via html-docx-js / docx. Tests use React Testing Library.

## Learn More

- [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started)
- [React documentation](https://react.dev/)
