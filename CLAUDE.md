# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A public notice management system organized as a **Turborepo monorepo** with three apps:

- **apps/web** — Next.js 16 (React 19) frontend with App Router, Tailwind CSS v4, shadcn/ui components
- **apps/api** — NestJS backend (auth, notices, RAG proxy modules)
- **apps/ai** — Python AI service using raw ASGI (uvicorn), handles document ingestion and RAG queries

The web app currently runs in **local-only mode**: auth via localStorage, notices managed client-side, RAG UI present but not wired to backends. The API and AI services are scaffolds with placeholder endpoints.

## Commands

```bash
# Install dependencies (pnpm workspaces)
pnpm install

# Run all apps in parallel
pnpm dev

# Run individual apps
pnpm dev:web          # Next.js on :3000
pnpm dev:api          # NestJS with --watch
pnpm dev:ai           # uvicorn on :8000 with --reload

# Build all
pnpm build

# Lint all
pnpm lint
```

### AI service setup (Python)
```bash
cd apps/ai
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Architecture

### Web (apps/web)
- **App Router** pages: `app/` — routes include `/`, `/login`, `/signup`, `/dashboard`, `/admin/*`, `/rag`, `/about`
- **Components**: `components/ui/` (shadcn primitives), `components/admin/`, `components/notices/`, `components/rag/`, `components/alerts/`, `components/layout/`
- **State/Lib**: `lib/` — `auth-context.tsx`, `alerts-context.tsx`, `language-context.tsx` (React contexts); `local-store.ts` and `mock-data.ts` (localStorage persistence); `local-rag.ts` (client-side RAG stub)
- Uses `class-variance-authority` + `tailwind-merge` for component variants (`lib/utils.ts`)
- TypeScript build errors are suppressed in `next.config.mjs` (`ignoreBuildErrors: true`)

### API (apps/api)
- NestJS module structure: `src/auth/`, `src/notices/`, `src/rag/` — each has a module and controller file
- Entry point: `src/main.ts`, root module: `src/app.module.ts`

### AI (apps/ai)
- Pure ASGI app (no framework dependencies) in `app/main.py`
- Endpoints: `GET /`, `GET /health`, `GET /documents`, `POST /documents`, `POST /query`
- Run via uvicorn: `.venv/bin/python -m uvicorn app.main:app --reload --port 8000`

## Environment

Each app has a `.env.example` showing required variables:
- `apps/web/.env.local`
- `apps/api/.env`
- `apps/ai/.env`

## Key Patterns

- Package manager: **pnpm** (v10.18+) with workspace protocol
- The web app's UI components follow shadcn/ui conventions — add new ones via the shadcn CLI pattern (components live in `components/ui/`)
- i18n is handled via `lib/language-context.tsx` with translation files in `lib/translations/`
- Alert system uses `lib/alerts-context.tsx` with components in `components/alerts/`

## Agents (`.agents/agents/`)

Custom agents available for specialized tasks:

### Debugger (`debugger.md`)
- Expert at identifying and fixing bugs, analyzing error logs, and troubleshooting
- Follows a structured process: understand → reproduce → isolate → analyze → fix → verify
- Covers JS/TS, React/Next.js, API/backend, and CSS debugging
- Aware of project-specific issues: localStorage sync, CORS between apps, suppressed TS errors, context re-renders

### Refactorer (`refactorer.md`)
- Improves code structure, readability, and maintainability while preserving behavior
- Applies SOLID principles, modern JS/TS patterns, React composition patterns
- Handles: extract function/component/hook, simplify conditionals, remove dead code
- Project-aware: Server Components by default, CVA for variants, context for app-wide state

### Git Commit Writer (`git-commit.md`)
- Writes conventional commit messages (`type(scope): subject`)
- Project scopes: `web`, `api`, `ai`, `ui`, `auth`, `notices`, `rag`, `admin`, `deps`, `config`
- Supports multi-scope for cross-app changes: `feat(web,api): ...`
- Follows: imperative mood, 50-char subject max, body explains WHY not WHAT

## Skills (`.agents/skills/`)

### UI/UX Pro Max (`ui-ux-pro-max/`)
- Comprehensive design intelligence: 50+ styles, 161 color palettes, 57 font pairings, 99 UX guidelines
- Use when designing pages, creating/refactoring UI components, choosing colors/typography, or reviewing UX
- CLI: `python3 .agents/skills/ui-ux-pro-max/scripts/search.py "<query>" --design-system`
- Domains: `product`, `style`, `color`, `typography`, `landing`, `chart`, `ux`, `google-fonts`, `react`, `web`, `prompt`
- Quick Reference covers: Accessibility, Touch/Interaction, Performance, Style, Layout, Typography, Animation, Forms, Navigation, Charts

### shadcn (`shadcn/`)
- Manages shadcn/ui components: adding, searching, fixing, debugging, styling, composing
- CLI: `pnpm dlx shadcn@latest` (uses pnpm for this project)
- Critical rules: use `gap-*` not `space-*`, semantic colors not raw values, `cn()` for conditionals, `size-*` for equal dimensions
- Forms use `FieldGroup` + `Field` pattern; icons use `data-icon` attribute
- Always run `npx shadcn@latest docs <component>` before using/fixing a component

### GSAP (`gsap/`)
- Animation reference for GSAP timelines and tweens
- HyperFrames contract: paused timeline on `window.__timelines` keyed by `data-composition-id`
- Prefer transform aliases (`x`, `y`, `scale`, `rotation`) over CSS properties
- Performance: animate only transform/opacity, use `will-change`, prefer `stagger` over many tweens

## Mandatory: Present Options Before Implementing UI/Design Changes

When redesigning, restyling, or significantly changing any section, feature, or component (e.g. hero section, features grid, footer, color scheme, layout), you MUST:

1. **Present 2–3 distinct approach options** before writing any code. Each option should include:
   - A short name/label (e.g. "Option A: Glassmorphism Cards")
   - A brief description of the visual style, animation approach, or layout
   - Key differences from the other options

2. **Ask which option to implement** — wait for the user's choice before proceeding.

3. **Coordinate deeply** — if the user picks an option but wants tweaks, confirm the tweaks before coding.

This applies to any request like "redesign this section", "make this look better", "change the style of X", or "use advanced animations here". It does NOT apply to small fixes (typo, color tweak, spacing adjustment) where the intent is unambiguous.

### Remotion Best Practices (`remotion-best-practices/`)
- Video creation in React using Remotion
- CSS transitions/animations are FORBIDDEN — use `useCurrentFrame()` + `interpolate()`
- Assets in `public/`, referenced via `staticFile()`
- Covers: captions, FFmpeg, audio visualization, 3D, text animations, transitions, and more
- Rules in `rules/` subdirectory for specific topics (subtitles, timing, sequencing, etc.)
