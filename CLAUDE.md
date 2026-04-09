# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**やすめし (YasuMeshi)** — A web app that finds the cheapest restaurants and cafes near your current location in Japan. Core differentiator: price-sorted results using Google Places API `priceRange` data. Inspired by Korean "거지맵".

- **Platform**: Web (PWA) first, native app later if validated
- **Stage**: Greenfield — planning docs in `docs/`, design doc v2 approved

## Tech Stack

- **Web**: Next.js + TypeScript + Vercel
- **Data**: Google Places API (New) — sole data source for MVP
- **Ads**: AdMob (deferred to post-prototype)
- **Analytics**: Firebase Analytics → BigQuery export
- **Maps**: Google Maps deep links for navigation (no embedded map)
- **API Protection**: Vercel Edge Middleware rate limiting (10 req/min per IP)

## Key Architecture Decisions

- **Google Places API is the only data source.** No HotPepper/Tabelog in MVP. No crowdsourcing. Google Maps ecosystem IS the crowdsourcing (data flywheel). In the prototype phase, restaurants without `priceRange` are shown in a separate "price unknown" section to measure coverage. In the final MVP, they will be silently filtered out.
- **Zero personal data storage.** No auth, no accounts, no server-side user data. Location is client-side only. Minimize operations overhead.
- **Web-first, app later.** Validate with web (Next.js + Vercel), add native app only after web proves demand.
- **Analytics events are designed for future data monetization** — all events must be anonymized (station/ward-level location only, no individual identification). Firebase events: `category_tap`, `walk_filter_select`, `shop_card_tap`, `map_navigate`, `session_time`.
- **Three category tabs**: 🍜 Meals / ☕ Drinks / 🍱 Takeout — switchable with a single tap.
- **Walk-time radius filter** (5min / 10min / 15min) instead of distance in meters.
- **Default sort**: price ascending. Secondary: distance.

## Build & Development Commands

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build
npm run build

# Run tests
npx jest

# Run a single test file
npx jest path/to/file.test.ts

# Lint
npm run lint

# TypeScript check
npx tsc --noEmit

# Deploy (via Vercel Git integration, or manual)
npx vercel
```

## Project Language

Planning documents in `docs/` are written in Korean. The app UI targets Japanese users (primary language: Japanese), with potential multi-language support later.

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health
