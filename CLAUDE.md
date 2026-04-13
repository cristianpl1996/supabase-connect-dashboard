# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Dev server on http://localhost:8080
npm run build        # Production build
npm run build:dev    # Development build
npm run lint         # ESLint (TypeScript + React rules)
npm run preview      # Preview production build
npm run test         # Run tests once (Vitest)
npm run test:watch   # Vitest in watch mode
```

Run a single test file:
```bash
npx vitest run src/test/example.test.ts
```

## Architecture

**Ivanagro Backoffice** — an admin dashboard for managing agricultural/pharmaceutical marketing plans, promotions, and budgets. Built with React 18 + TypeScript + Vite, using Supabase (PostgreSQL) as backend.

### Key Libraries
- **Routing**: React Router DOM v6
- **Server state**: TanStack React Query v5
- **Forms**: React Hook Form + Zod validation
- **UI**: shadcn/ui (Radix UI primitives) + Tailwind CSS
- **Database**: Supabase client (`src/lib/supabase.ts`)
- **AI**: Google Gemini (`src/services/gemini.ts`) for PDF contract analysis
- **Export**: xlsx (Excel), jspdf (PDF generation)

### Data Flow

```
Supabase Auth → PromoterContext (src/contexts/PromoterContext.tsx)
                     ↓
             PromoterRouteGuard (src/components/layout/PromoterRouteGuard.tsx)
                     ↓
              Protected Pages (Calendar, Wallet, Index)
```

Custom hooks in `src/hooks/` encapsulate all Supabase queries with React Query (useUsers, useLaboratories, useBudgetRules). Most pages query Supabase directly via inline React Query calls rather than through these hooks.

### Role-Based Access
- **Promoters** (external_promoters table): Access to Calendar, Wallet, Dashboard
- **Admins**: Full access including Settings (budget rules, user management, labs)
- Non-promoter users are redirected away from restricted routes via `PromoterRouteGuard`

### Path Alias
`@/*` maps to `src/*` — use this for all imports (configured in tsconfig.json and vite.config.ts).

### Database Types
All Supabase table interfaces are defined in [src/types/database.ts](src/types/database.ts). This is the source of truth for data shapes.

### AI Contract Analysis
`src/services/gemini.ts` uses Gemini flash to extract structured financial terms (funds, discounts, rebates) from uploaded PDF contracts. This feeds the annual plans feature in `src/pages/Plans.tsx`.

### Environment Variables
The Supabase URL/anon key and Gemini API key are currently hardcoded in `src/lib/supabase.ts` and `src/services/gemini.ts`. When refactoring to use env vars, use `import.meta.env.VITE_*` (Vite convention).
