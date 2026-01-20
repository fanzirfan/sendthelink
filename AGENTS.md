# AGENTS.md

## Overview
SendTheLink is a Next.js App Router project (Next 16, React 19) that stores links in Firebase and runs security scans. The codebase is JavaScript-first with API routes in `app/api` and shared utilities in `lib`.

## Commands
- Dev server: `npm run dev`
- Production build: `npm run build`
- Start production server: `npm run start`
- Lint: `npm run lint`

### Tests
- No test runner is configured (no jest/vitest/playwright configs found).
- Single-test command: not applicable until a test runner is added.
- When adding tests, document `npm test` and the single-test invocation here.

## Project Structure
- `app/`: App Router pages, layouts, and route handlers
- `app/api/`: Server-only API route handlers (moderate, scan, submit, admin, preview)
- `lib/`: Shared utilities (firebase, scanning, sanitization, auth, rate limiting)
- `public/`: Static assets

## Runtime & Framework Notes
- App Router uses React Server Components by default; keep client components isolated.
- API routes that require Firebase or Node-only libraries should set:
  - `export const runtime = 'nodejs';`
  - `export const dynamic = 'force-dynamic';`
- Prefer `NextResponse.json()` for all JSON responses.

## Import Conventions
- Use ES module imports.
- Prefer named imports from Next and Firebase packages.
- Path alias is configured in `jsconfig.json`: use `@/` for root imports when helpful.
- Keep import order: built-ins, external packages, internal modules.
- Avoid unused imports; keep imports close to actual usage.

## Formatting & Style
- JavaScript only (no TypeScript config present). Avoid adding TS unless requested.
- Indentation: 4 spaces (match existing files).
- Quotes: single quotes for strings; double quotes only when required.
- Semicolons are used throughout; keep them consistent.
- Prefer `const` by default; use `let` only when reassignment is needed.
- Use `async/await` for asynchronous flows; avoid promise chaining in new code.
- Keep helper functions small and focused; move shared logic into `lib/`.

## Types & Documentation
- Prefer JSDoc comments for exported helpers with non-obvious inputs/outputs.
- Keep JSDoc concise; document object shapes only when they are reused.
- Avoid introducing TypeScript types or interfaces unless explicitly requested.
- Keep public APIs (exports, route responses) stable and well described.

## Client/Server Boundaries
- Treat `app/api` as server-only; avoid using browser APIs there.
- In `app/` components, add `'use client'` only when interactivity is required.
- Never import server-only utilities (Firebase admin, Node `crypto`, etc.) into client components.
- Use `NEXT_PUBLIC_*` env vars only when values are safe for the browser.

## Naming Conventions
- App Router file names: `page.js`, `layout.js`, `route.js`.
- Utility modules: lowerCamelCase filenames (`urlScanner.js`, `rateLimit.js`).
- Functions: concise, verb-driven names that match intent (`checkURLSecurity`).
- Constants: `UPPER_SNAKE_CASE` for shared constants, `lowerCamelCase` for locals.

## API Route Conventions
- Export `async function POST(request)` or `GET` as needed.
- Validate inputs early; return 4xx for client errors.
- Read JSON via `await request.json()`; use `request.clone()` if you need to re-read.
- Avoid mixing business logic in routes; offload shared logic to `lib/`.
- Use `NextResponse.json()` with explicit status codes and minimal payloads.
- Avoid exposing secrets, stack traces, or internal details in production responses.

## API Response Patterns
- Success responses use `{ success: true, ... }` or a minimal payload when possible.
- Error responses include an `error` message; add `details` only in development.
- Prefer consistent field names across endpoints (e.g., `securityStatus`, `linkId`).
- Keep payloads small; do not return full Firestore documents unless necessary.

## Error Handling & Logging
- Wrap API handlers in `try/catch` and return a safe response payload.
- Log errors with `console.error` and a clear, searchable prefix.
- Avoid empty catches; return a fallback response or rethrow.
- In production responses, hide sensitive details; use env-gated details only in dev.

## Security & Validation Patterns
- Always validate URL inputs and enforce `http`/`https`.
- Use SSRF protections when fetching remote URLs (see `app/api/preview/route.js`).
- Sanitize and truncate user input before storing in Firestore.
- Maintain moderation flow order: regex filter -> Safe Browsing -> Gemini.
- Treat external fetches as untrusted; set timeouts and user agents.

## Moderation & Scanning Flow
- Submissions default to `securityStatus: 'pending'` and `status: 'approved'`.
- Background scans run via `app/api/scan/route.js` and update Firestore.
- If scans mark `malicious` or `suspicious`, set status to `pending_review`.
- Keep scan metadata under `securityScan` and include timestamps.

## Firebase Usage
- Firestore access is in `lib/firebase.js` and used in API routes.
- Prefer server-only access for writes; keep client exposure minimal.
- Use collection names consistently (`shared_links`).
- Avoid initializing Firebase multiple times; reuse `getApps()` guard.

## Data Model Notes
- `shared_links` documents typically include `from`, `message`, `url`, `tags`.
- Metadata fields include `metaTitle`, `metaImage`, `createdAt`, `reportCount`.
- Status fields include `status`, `securityStatus`, and `securityScan`.
- When adding fields, update admin views and any derived totals accordingly.

## Auth & Rate Limiting
- Admin auth tokens are generated in `lib/adminAuth.js` using HMAC signatures.
- Passwords come from env vars; use local defaults only for dev.
- Rate limiting is in-memory (`lib/rateLimit.js`); keep limits conservative.
- Return `retryAfter` for rate-limit rejections to aid clients.

## Environment Variables
- `NEXT_PUBLIC_FIREBASE_*` for Firebase client config.
- `ADMIN_PASSWORD` for admin auth token generation.
- `VERIFIED_USER_PASSWORD` for verified user flows.
- `VIRUSTOTAL_API_KEY` and `URLSCAN_API_KEY` for security scanning.
- `NEXT_PUBLIC_SITE_URL` or `VERCEL_URL` for base URL in API callbacks.
- Never commit secrets or real credentials to source control.

## Linting Rules
- ESLint config extends `next/core-web-vitals` via `eslint-config-next`.
- Run `npm run lint` before finalizing changes when feasible.
- Do not introduce new lint tooling unless requested.

## Frontend & UI Notes
- Use functional components and React hooks in `app/`.
- Prefer server components unless client-side interactivity is required.
- Keep UI logic slim; move heavy logic to `lib/` or server routes.
- Align with existing Tailwind conventions if adjusting styles.

## Files & Assets
- Keep static assets in `public/`.
- Prefer storing shared constants in `lib/` to avoid duplication.

## Cursor/Copilot Rules
- No `.cursor/rules`, `.cursorrules`, or `.github/copilot-instructions.md` found.

## Notes for Agents
- Keep changes minimal and aligned with existing patterns.
- Avoid refactors while fixing bugs unless explicitly requested.
- No tests available; rely on lint/build for verification when requested.
