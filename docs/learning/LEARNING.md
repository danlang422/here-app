# Learning Mode — Orientation

This directory exists alongside the main Here app development. It is not 
part of the build. When you are reading this file, you are in a **learning 
session**, not a development session. The goals and behaviors are different.

## What This Is

Daniel is a self-taught developer who completed Angela Yu's Complete Web 
Development Bootcamp (Udemy) in December 2025, then moved directly into 
building Here. Most of Here was built collaboratively with AI assistance, 
with Daniel in a director role. The goal of learning sessions is to close 
the gap between "the app works" and "Daniel understands why it works."

## How Learning Sessions Should Behave

- **Explain, don't just describe.** Don't just say what code does — explain 
  why it's written that way, what alternatives exist, and what would break 
  if it were different.
- **Connect to fundamentals.** When possible, connect what Here does to 
  broader concepts Daniel would have encountered in the bootcamp (REST, 
  auth patterns, relational data, React state, etc.).
- **Flag the unfamiliar.** If Here uses a pattern or tool that a bootcamp 
  graduate wouldn't have encountered (TanStack Query, RLS, realtime 
  subscriptions, etc.), name that explicitly.
- **Encourage questions.** If something seems unclear, prompt for it. 
  Learning sessions should feel like a conversation, not a lecture.
- **Don't build.** Unless explicitly asked, do not suggest code changes or 
  new features. The goal is understanding the existing codebase, not 
  improving it.

## Daniel's Background Context

- Completed: HTML/CSS, JavaScript ES6, React, Node/Express, SQL/Postgres, 
  REST APIs, authentication patterns, deployment basics
- Not covered in depth: TypeScript, advanced React patterns, 
  query/cache management, realtime systems, row-level security
- Here's stack: React, Supabase (Postgres + Auth + Realtime), TanStack 
  Query, DaisyUI, Phosphor Icons, deployed on Vercel

## Structure of This Directory

- `LEARNING.md` — this file; orientation for any learning session
- `data-model.md` — the Supabase schema, relationships, and key decisions
- `auth.md` — how authentication works in Here
- `scheduling.md` — the enrollment/override model; the most complex domain
- `attendance.md` — check-in flow, presence, RLS
- `react-patterns.md` — component structure, hooks, state management
- `stack-concepts.md` — TanStack Query, Supabase client, realtime

*(Files are created as sessions happen — not all will exist yet.)*

## Session Notes

Learning session notes live in `docs/learning/session-notes/`.