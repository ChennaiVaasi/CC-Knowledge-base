---
name: Backend auth expectations
description: Completion review requirements for any persistent API in this project
---
Any new persistent API must ship with session auth and server-side role enforcement, and must not use shared/default seeded passwords.
**Why:** Completion code review twice rejected the backend task — first for an unauthenticated API, then for a universal seeded password documented in replit.md.
**How to apply:** Seed users get unique random passwords printed once to the server log at first start; all `/api` routes sit behind express-session (SESSION_SECRET) with role checks (Admin, Knowledge Architect, Peer Reviewer, Builder). Keep this pattern for new endpoints.
