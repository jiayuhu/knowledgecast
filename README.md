# KnowledgeCast

KnowledgeCast is a small SaaS for capturing fragmented knowledge, organizing it with AI, and turning it into private internal training pages.

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create a local environment file:

```bash
cp .env.example .env
```

3. Run the app:

```bash
npm run dev
```

4. Run the tests:

```bash
npm test
```

5. Build for production:

```bash
npm run build
```

## Privacy Model

- Share pages are private by default.
- Access uses a private link plus email verification code.
- Raw HTML source downloads are not exposed.
- The share page adds a visible access watermark.
- Links can be revoked and expire.
- Copy blocking is treated as friction, not as absolute security.

## Stack

- Next.js
- React
- TypeScript
- Drizzle ORM
- SQLite
- Tailwind CSS
