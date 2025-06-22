# Agent Instructions

## App Overview

This repository contains a real-time Mahjong point calculator and point tracking app for four players. The application uses Next.js 14 with TypeScript and Tailwind CSS on the frontend, Zustand for state management, Socket.io for real-time communication, and PostgreSQL via Prisma. The app supports accurate score calculation, full rule handling (dealer rotation, honba and kyotaku tracking), responsive UI, and settlement features including Uma and Oka. Architecture and feature details are documented under `docs/`　and `CLAUDE.md`.

## Development Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Launch the PostgreSQL container:

   ```bash
   docker-compose up -d postgres
   ```

3. Copy the environment file:

   ```bash
   cp .env.example .env.local
   ```

4. Set up the database:

   ```bash
   npx prisma generate
   npx prisma db push
   npm run db:seed
   ```

5. Start the development server:

   ```bash
   npm run dev
   ```

   The app runs on <http://localhost:3000>.

## Testing

- The project includes example unit tests in the documentation for core services (score calculation, reach/kyotaku, round management, settlement). Implement tests accordingly when developing.
- Recommended checks:

  ```bash
  npm run lint
  npm run type-check
  ```
