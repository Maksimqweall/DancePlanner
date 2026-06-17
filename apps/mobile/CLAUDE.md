@AGENTS.md
# Project Initialization: Dance Planner (Mobile App & Backend Server)

## Role & Context
You are a senior full-stack engineer building "Dance Planner" – a mobile SaaS for competitive dancesport athletes to manage finances, logistics, partner synchronization, and tournament performance analytics.

## Technical Stack
- **Frontend (Mobile):** React Native, TypeScript, Expo (with Expo Router - file-based routing), NativeWind v4 (Tailwind CSS for styling), Zustand (state management), AsyncStorage (local persistence).
- **Backend (Server):** Node.js, Express.js (TypeScript), PostgreSQL, Prisma ORM, JWT (authentication).
- **Infrastructure:** npm, EAS (Expo Application Services).

## Project Structure
We will use a monorepo structure (or split folders) within this directory:
- `/apps/mobile` - Expo Router application
- `/apps/server` - Express.js backend API

## Immediate Objective (Step 1)
Do NOT write application code yet. Your only tasks for this step are:
1. Create the workspace directory layout (`/apps/mobile` and `/apps/server`).
2. Generate a robust `schema.prisma` file inside `/apps/server/prisma/` based on the 4 core modules (Finance, Smart Calendar, Partner Sync with Approve/Decline flows, and Performance Analytics supporting WDSF/DTV structures and skating system histories).
3. Create a master `CLAUDE.md` file in the root, and specific `CLAUDE.md` files in `/apps/mobile/` and `/apps/server/` to guide code styling and commands.

Stop and wait for my instructions once the directory structure, Prisma schema, and CLAUDE.md files are generated.