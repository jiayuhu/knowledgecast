# KnowledgeCast

## Project Goal

KnowledgeCast is a small SaaS for turning fragmented knowledge into structured content and generating shareable internal training pages.

## Current MVP Scope

- Text input
- Voice-to-text input
- Link import
- Simple text or Markdown file upload
- AI deduplication, clustering, key point extraction, outline generation
- AI follow-up questions to fill gaps
- Lightweight editing of generated content
- Private share links
- Email OTP access control
- Draft / processing / ready / shared state tracking
- Basic search

## Security and Sharing Rules

- Do not expose raw HTML source downloads
- Do not add export features unless explicitly requested
- Treat copy restriction as friction, not absolute security
- Prefer server-side or controlled rendering for share pages
- Support link expiration and revocation
- Keep access logs and basic audit trails

## Working Rules

- Keep changes scoped to the user's current request
- Prefer simple, shippable implementations over broad platform work
- Do not add extra product surfaces without approval
- Use snake_case for database tables and columns; keep TypeScript identifiers in camelCase/PascalCase
- Preserve existing user changes; do not revert unrelated work
- Use `apply_patch` for file edits
- Use non-destructive git commands only

## Notes

- The repository starts empty by design
- The design spec lives at `docs/superpowers/specs/2026-04-25-knowledgecast-design.md`
- If a future decision conflicts with this file, update this file first
