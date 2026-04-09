# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**やすめし (YasuMeshi)** — A mobile app that finds the cheapest restaurants and cafes near your current location in Japan. Core differentiator: price-sorted results using Google Places API `priceRange` data. Restaurants without price data are excluded entirely (not shown as "no price info").

- **Platform**: iOS / Android (single codebase)
- **Stage**: Greenfield MVP — planning docs in `docs/`

## Tech Stack

- **Mobile**: React Native (Expo)
- **Data**: Google Places API (New) — sole data source for MVP
- **Ads**: Google AdMob
- **Analytics**: Firebase Analytics → BigQuery export
- **Maps**: Google Maps deep links for navigation

## Key Architecture Decisions

- **Google Places API is the only data source.** No HotPepper/Tabelog in MVP. Only restaurants with `priceRange` field are displayed; others are silently filtered out.
- **Data flywheel strategy**: Low-ranked priceless restaurants incentivize owners/visitors to add prices on Google Maps, improving coverage over time without the app collecting data directly.
- **Analytics events are designed for future data monetization** — all events must be anonymized (station/ward-level location only, no individual identification). Firebase events: `category_tap`, `walk_filter_select`, `shop_card_tap`, `map_navigate`, `session_time`.
- **Three category tabs**: 🍜 Meals / ☕ Drinks / 🍱 Takeout — switchable with a single tap.
- **Walk-time radius filter** (5min / 10min / 15min) instead of distance in meters.
- **Default sort**: price ascending. Secondary: distance.

## Build & Development Commands

```bash
# Install dependencies
npm install

# Start Expo dev server
npx expo start

# Run on iOS simulator
npx expo run:ios

# Run on Android emulator
npx expo run:android

# Run tests
npx jest

# Run a single test file
npx jest path/to/file.test.ts

# Lint
npx expo lint

# TypeScript check
npx tsc --noEmit
```

## Project Language

Planning documents in `docs/` are written in Korean. The app UI targets Japanese users (primary language: Japanese), with potential multi-language support later.
