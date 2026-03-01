# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Chinese Comprehensible Input app — an AI conversation partner that speaks only using words from an active word bank, grounded in Krashen's comprehensible input theory. The learner replies in English; Claude scores comprehension per word and the word bank auto-expands as mastery grows.

## Repository

- GitHub: https://github.com/cannyter123/chinese
- Branch: `main`

## Stack

- **Next.js 16** (App Router, TypeScript) — full-stack
- **Prisma 5 + SQLite** — `prisma/dev.db`
- **Tailwind CSS 4** — styling
- **Claude API** (`claude-sonnet-4-6`) — generation + comprehension analysis

## Commands

```bash
npm run dev          # start dev server (requires ANTHROPIC_API_KEY in .env.local)
npm run build        # production build
npm run db:push      # push Prisma schema to SQLite
npm run db:seed      # seed 302 Chinese words
npm run db:reset     # force-reset DB then reseed
npx tsc --noEmit     # type-check without building
```

## Architecture

```
prisma/
  schema.prisma       # Word, Conversation, Turn, WordEvent, AppState
  seed.ts             # 302 words; 20 non-gram + all grammatical activated
lib/
  prisma.ts           # singleton PrismaClient
  anthropic.ts        # singleton Anthropic client
  word-bank.ts        # EMA update, comprehension rate, auto-expansion
  claude/
    generate-message.ts      # Call 1: generate AI sentence
    analyze-comprehension.ts # Call 2: score user reply per word
    validate-chinese.ts      # character-level output validation
app/
  page.tsx            # redirects to /chat
  chat/page.tsx       # main conversation UI (Client Component)
  word-bank/page.tsx  # word bank table (Server Component)
  api/
    conversation/     # POST: create session + first AI turn
    ai-message/       # POST: generate next AI sentence
    turn/             # POST: submit reply, update scores, expand bank
    words/            # GET: word list (?filter=active|inactive|all)
    stats/            # GET: comprehension rate + expansion info
components/
  chat/               # ChatWindow, MessageBubble, InputBar, ScoreUpdatePanel, StatsBar
  word-bank/          # WordTable, WordRow
```

## Key Algorithms

- **EMA score**: `new = old * 0.8 + delta*100 * 0.2`, clamped [0, 100]
- **Word weight**: `max(0.1, 1 - (score/100) * 0.9)` (grammatical always 1.0)
- **Expansion trigger**: comprehension rate ≥ 85% → add `round(N * 0.10 / 0.75)` words
- **Comprehension rate**: mean score of active non-grammatical words / 100

## Critical: SQLite Path Resolution

Prisma 5 CLI resolves SQLite URLs **relative to `prisma/schema.prisma`**; Next.js resolves from **project root**. Two different env vars point to the same physical file:

- `.env` (used by CLI/seed): `DATABASE_URL="file:./dev.db"` → `prisma/dev.db`
- `.env.local` (used by Next.js): `DATABASE_URL="file:./prisma/dev.db"` → `prisma/dev.db`

Do **not** use Prisma 7 — it removed `url` from `schema.prisma` and is incompatible.

## Environment

`.env.local` requires:
```
ANTHROPIC_API_KEY=sk-ant-...
DATABASE_URL="file:./prisma/dev.db"
```
