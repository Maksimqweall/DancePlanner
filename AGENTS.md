/@AGENTS.md
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

## Project Structure & Architecture
- **Dependency Graph:** Current codebase architecture and index are maintained in `graphify-out/GRAPH_REPORT.md` and `graphify-out/graph.json`. Always refer to these files to understand state, hooks (like `useC`, `useT`), and component relations before making architectural changes.