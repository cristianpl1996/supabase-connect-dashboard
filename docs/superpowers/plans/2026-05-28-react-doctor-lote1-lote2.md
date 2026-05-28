# React Doctor Lote 1 + Lote 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 388 react-doctor issues in two safe batches — Lote 1 (cosmetic/zero-risk) and Lote 2 (mechanical performance) — raising the project score from 66/100 without breaking any existing functionality.

**Architecture:** Lote 1 only touches markup, class strings, and trivial JS (no logic changes). Lote 2 hoists expensive objects to module scope, memoizes context values, and fixes animation timings. Neither lote requires changes to business logic, state machines, or data flow.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query, Supabase

**Verification command (run before and after each task):**
```bash
npm run lint && npm run build
```

---

## LOTE 1 — Cosmético/Seguro

### Task 1: Fix `button-has-type` — add explicit type to `<button>` elements (×22)

**Files:**
- Modify: `src/components/promotions/ImportPromotionsModal.tsx` (lines 742, 798, 854)
- Modify: `src/components/ui/sidebar.tsx` (line 249)
- Modify: `src/pages/Products.tsx` (lines 1217, 1224, 1226)
- Modify: `src/pages/Unsubscribe.tsx` (lines 141, 148)

**Rule:** Every `<button>` without an explicit `type` defaults to `type="submit"` inside forms, which can trigger accidental form submissions. Add `type="button"` unless the intent is submit/reset.

- [ ] **Step 1: Fix ImportPromotionsModal.tsx**

Open `src/components/promotions/ImportPromotionsModal.tsx`. Find all `<button` tags without a `type` attribute and add `type="button"`. Lines to check: 742, 798, 854.

Pattern to find and fix:
```tsx
// Before
<button onClick={...} className="...">

// After
<button type="button" onClick={...} className="...">
```

- [ ] **Step 2: Fix sidebar.tsx**

Open `src/components/ui/sidebar.tsx` line 249. Add `type="button"` to the `<button>` element.

- [ ] **Step 3: Fix Products.tsx**

Open `src/pages/Products.tsx` lines 1217, 1224, 1226. Add `type="button"` to each `<button>`.

- [ ] **Step 4: Fix Unsubscribe.tsx**

Open `src/pages/Unsubscribe.tsx` lines 141, 148. Add `type="button"` to each `<button>`.

- [ ] **Step 5: Verify and commit**

```bash
npm run lint && npm run build
```
Expected: no new errors.
```bash
git add src/components/promotions/ImportPromotionsModal.tsx src/components/ui/sidebar.tsx src/pages/Products.tsx src/pages/Unsubscribe.tsx
git commit -m "fix: add explicit type attribute to button elements"
```

---

### Task 2: Fix Tailwind shorthand — `px-N py-N → p-N` and `space-x-* → gap-*`

**Files:**
- Modify: `src/pages/ECommerce.tsx` (lines 1542, 1559, 1837, 1844, 1883, 1890)
- Modify: `src/pages/Transfers.tsx` (line 302)
- Modify: `src/pages/Orders.tsx` (line 831)
- Modify: `src/components/map/FilterPanel.tsx` (line 135)
- Modify: `src/pages/Middleware.tsx` (lines 154, 168, 181)

**Rules:**
- `px-3 py-3` → `p-3` (when both axes are the same value and no breakpoint variant overrides one axis)
- `space-x-N` on flex/grid parent → `gap-x-N` (space-x creates phantom gaps on conditional renders)

- [ ] **Step 1: Fix px/py shorthand in ECommerce.tsx**

Find `px-N py-N` class pairs at the listed lines where both values match. Replace with `p-N`.
Example:
```tsx
// Before
className="px-3 py-3 rounded-md"
// After
className="p-3 rounded-md"
```

- [ ] **Step 2: Fix px/py shorthand in Transfers.tsx and Orders.tsx**

Same pattern at Transfers.tsx:302 and Orders.tsx:831.

- [ ] **Step 3: Fix space-x → gap-x in FilterPanel.tsx and Middleware.tsx**

```tsx
// Before
className="flex space-x-1 ..."
// After
className="flex gap-x-1 ..."
```

- [ ] **Step 4: Verify and commit**

```bash
npm run lint && npm run build
```
```bash
git add src/pages/ECommerce.tsx src/pages/Transfers.tsx src/pages/Orders.tsx src/components/map/FilterPanel.tsx src/pages/Middleware.tsx
git commit -m "fix: collapse px-N py-N to p-N and replace space-x with gap-x"
```

---

### Task 3: Fix typographic text — em dashes and ellipsis (×11)

**Files:**
- Modify: `src/components/ui/otp-boxes.tsx` (line 80)
- Modify: `src/components/map/FilterPanel.tsx` (line 370)
- Modify: `src/components/plans/PlanFormSheet.tsx` (line 362)
- Modify: `src/components/settings/AppUsersSection.tsx` (lines 603, 606)
- Modify: `src/components/settings/LaboratoriesTab.tsx` (lines 257, 283)
- Modify: `src/pages/Products.tsx` (line 977)
- Modify: `src/components/promotions/ImportPromotionsModal.tsx` (line 727)
- Modify: `src/components/promotions/PromotionFormSheet.tsx` (lines 1299, 1511)

**Rules:**
- Replace `—` (em dash in JSX text) with `, ` or `: ` or ` (` `)` — it reads as AI-generated output
- Replace `...` (three periods) with `…` (Unicode ellipsis, U+2026) in JSX text strings

- [ ] **Step 1: Fix em dashes**

In each listed file/line, find the em dash character `—` used in JSX text and replace with a comma, colon, or parentheses depending on context. Example:
```tsx
// Before
<p>Status — Active</p>
// After
<p>Status: Active</p>
```

- [ ] **Step 2: Fix three-period ellipsis**

```tsx
// Before
<span>Cargando...</span>
// After
<span>Cargando…</span>
```

- [ ] **Step 3: Verify and commit**

```bash
npm run lint && npm run build
```
```bash
git add src/components/ui/otp-boxes.tsx src/components/map/FilterPanel.tsx src/components/plans/PlanFormSheet.tsx src/components/settings/AppUsersSection.tsx src/components/settings/LaboratoriesTab.tsx src/pages/Products.tsx src/components/promotions/ImportPromotionsModal.tsx src/components/promotions/PromotionFormSheet.tsx
git commit -m "fix: replace em dashes and three-period ellipsis with proper typography"
```

---

### Task 4: Fix Fast Refresh — move non-component exports out of component files (×5)

**Files:**
- Modify: `src/components/ui/button.tsx`
- Modify: `src/components/ui/badge.tsx`
- Modify: `src/components/ui/toggle.tsx`
- Modify: `src/components/ui/navigation-menu.tsx`
- Modify: `src/components/ui/sonner.tsx`

**Rule:** Fast Refresh only works reliably when a file exports only React components. Non-component exports (variant constants, style functions) should live in a separate file.

**Strategy for shadcn files:** Since many files import `buttonVariants` from `@/components/ui/button`, we keep a re-export in the component file but move the definition to a `*-variants.ts` sibling. This fixes Fast Refresh (the component file no longer *defines* a non-component) while preserving all existing import paths.

- [ ] **Step 1: Identify what each file exports as non-component**

- `button.tsx` → exports `buttonVariants` (a `cva()` result)
- `badge.tsx` → exports `badgeVariants` (a `cva()` result)
- `toggle.tsx` → exports `toggleVariants` (a `cva()` result)
- `navigation-menu.tsx` → exports `navigationMenuTriggerStyle` (a function)
- `sonner.tsx` → check what non-component is exported at line 35

Run grep to confirm:
```bash
grep -n "^export" src/components/ui/sonner.tsx
```

- [ ] **Step 2: Create `src/components/ui/button-variants.ts`**

```ts
import { cva, type VariantProps } from "class-variance-authority";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export type { VariantProps };
```

- [ ] **Step 3: Update `src/components/ui/button.tsx`**

Remove the `buttonVariants` definition and import it from the new file. Keep the re-export so existing imports still work:

```tsx
import { buttonVariants } from "./button-variants";

// ... rest of button.tsx unchanged ...

export { Button, buttonVariants };
```

- [ ] **Step 4: Repeat for badge, toggle, navigation-menu, sonner**

Same pattern for each file: move the non-component definition to a sibling `*-variants.ts` (or `*-styles.ts` for functions), import it back, re-export.

- [ ] **Step 5: Verify all existing imports still resolve**

```bash
npm run build
```
Expected: no "cannot find module" errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/
git commit -m "fix: move non-component exports to variant files for Fast Refresh compatibility"
```

---

### Task 5: Fix JS improvements — `.toSorted()`, stable keys, module-level default values

**Files:**
- Modify: `src/hooks/useMapLocations.ts` (line 62)
- Modify: `src/utils/mapUtils.ts` (lines 149, 181)
- Modify: `src/components/ui/otp-boxes.tsx` (line 43)
- Modify: `src/components/promotions/ImportPromotionsModal.tsx` (lines 806, 867)
- Modify: `src/components/promotions/PromotionDetailsSheet.tsx` (line 358)

**Rules:**
- `[...array].sort(fn)` → `array.toSorted(fn)` — ES2023, no spread allocation, explicit immutability
- Array index as `key` → use a stable unique identifier from item data
- Default prop value `[]` inline → extract to `const EMPTY_X: T[] = []` at module scope (new array reference each render causes unnecessary re-renders)

- [ ] **Step 1: Fix .toSorted() in useMapLocations.ts and mapUtils.ts**

```ts
// Before
const sorted = [...locations].sort((a, b) => a.name.localeCompare(b.name));

// After
const sorted = locations.toSorted((a, b) => a.name.localeCompare(b.name));
```

Apply to `useMapLocations.ts:62` and `mapUtils.ts:149,181`.

- [ ] **Step 2: Fix array index keys in otp-boxes.tsx**

```tsx
// Before
{boxes.map((box, i) => <div key={i} .../>)}

// After — use a stable value from the data, or index only if items are stable/non-reorderable
// If each box has an inherent index that never changes, a prefixed string key is acceptable:
{boxes.map((box, i) => <div key={`otp-box-${i}`} .../>)}
// But prefer a stable id if the data has one:
{boxes.map((box) => <div key={box.id} .../>)}
```

Read the component first to determine which key makes sense.

- [ ] **Step 3: Fix array index keys in ImportPromotionsModal.tsx**

Same as above at lines 806 and 867. Read the surrounding map to find a stable identifier.

- [ ] **Step 4: Fix default prop `[]` in PromotionDetailsSheet.tsx**

```tsx
// Before (at module level, inside the component props destructure)
function PromotionDetailsSheet({ items = [] }: Props) { ... }

// After — extract to module scope
const EMPTY_ITEMS: PromotionItem[] = [];

function PromotionDetailsSheet({ items = EMPTY_ITEMS }: Props) { ... }
```

Read line 358 to confirm the exact prop name and type.

- [ ] **Step 5: Verify and commit**

```bash
npm run lint && npm run build
```
```bash
git add src/hooks/useMapLocations.ts src/utils/mapUtils.ts src/components/ui/otp-boxes.tsx src/components/promotions/ImportPromotionsModal.tsx src/components/promotions/PromotionDetailsSheet.tsx
git commit -m "fix: use toSorted(), stable keys, and module-level empty array defaults"
```

---

### Task 6: Fix UI polish — animate-bounce, border-l-4, 11px text

**Files:**
- Modify: `src/components/plans/ContractDropzone.tsx` (line 117)
- Modify: `src/components/common/ModuleErrorCard.tsx` (line 25)
- Modify: `src/components/agotados/AgotadosDashboardModal.tsx` (line 581)

**Rules:**
- `animate-bounce` → replace with a subtle `transition-transform` ease-out (bounce feels dated)
- `border-l-4` thick one-sided border → use a subtler accent (`border-l-2` with opacity, or `ring-l`, or a background highlight)
- Font size `11px` inline style → change to `text-xs` (12px minimum for readability)

- [ ] **Step 1: Fix animate-bounce in ContractDropzone.tsx**

```tsx
// Before
<Icon className="animate-bounce ..." />

// After — gentle vertical nudge
<Icon className="transition-transform duration-300 hover:-translate-y-1 ..." />
// Or if it's a loading indicator, use animate-pulse instead
```

Read line 117 to understand context.

- [ ] **Step 2: Fix border-l-4 in ModuleErrorCard.tsx**

```tsx
// Before
className="border-l-4 border-red-500 ..."

// After — subtler accent
className="border-l-2 border-red-400/70 ..."
```

- [ ] **Step 3: Fix 11px text in AgotadosDashboardModal.tsx**

```tsx
// Before (inline style)
style={{ fontSize: "11px" }}

// After
className="text-xs"  // 12px, Tailwind default
```

Remove the inline style and add the Tailwind class to the existing `className`.

- [ ] **Step 4: Verify and commit**

```bash
npm run lint && npm run build
```
```bash
git add src/components/plans/ContractDropzone.tsx src/components/common/ModuleErrorCard.tsx src/components/agotados/AgotadosDashboardModal.tsx
git commit -m "fix: replace animate-bounce, thick tab border, and 11px text with better alternatives"
```

---

## LOTE 2 — Performance Mecánica

### Task 7: Hoist `new Intl.NumberFormat()` to module scope (×16)

**Files:**
- Modify: `src/components/plans/PlanDetailsSheet.tsx` (line 78)
- Modify: `src/lib/promotionMechanics.ts` (line 243)
- Modify: `src/components/promotions/PromotionDetailsSheet.tsx` (line 126)
- Modify: `src/components/plans/PlanFormSheet.tsx` (line 277)
- Modify: `src/components/promotions/PromotionFormSheet.tsx` (line 1068)
- Modify: `src/pages/Calendar.tsx` (line 141)
- Modify: `src/pages/Promotions.tsx` (line 232)
- Modify: `src/pages/ECommerce.tsx` (line 180)
- Modify: `src/pages/Customers.tsx` (line 123)
- Modify: `src/pages/Wallet.tsx` (line 239)
- Modify: `src/pages/Products.tsx` (lines 99, 109)
- Modify: `src/pages/Index.tsx` (line 43)
- Modify: `src/pages/Plans.tsx` (line 215)
- Modify: `src/pages/Orders.tsx` (lines 113, 129)

**Rule:** `new Intl.NumberFormat("es-CO", {...})` allocates dozens of objects per locale lookup. When called inside a component function or utility, it runs on every render. Move to module scope (top of file, outside any function) so it's constructed once.

- [ ] **Step 1: Fix PlanDetailsSheet.tsx**

Read the file at line 78. If the formatter is created inline:
```ts
// Before (inside a function or component)
const formatted = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP" }).format(value);

// After — hoist to module top
const COP_FORMATTER = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP" });

// Inside function:
const formatted = COP_FORMATTER.format(value);
```

If the locale/options vary per call, use `useMemo` with the options as deps instead.

- [ ] **Step 2: Fix promotionMechanics.ts**

This is a utility file (not a component). Hoist directly to module scope — no `useMemo` needed.

- [ ] **Step 3: Fix remaining files**

Apply the same pattern to all other listed files. Check each file to see if the formatter options are static (hoist to module) or dynamic (use `useMemo`).

Group by file to minimize back-and-forth:
- `PromotionDetailsSheet.tsx:126`
- `PlanFormSheet.tsx:277`
- `PromotionFormSheet.tsx:1068`
- `Calendar.tsx:141`
- `Promotions.tsx:232`
- `ECommerce.tsx:180`
- `Customers.tsx:123`
- `Wallet.tsx:239`
- `Products.tsx:99,109`
- `Index.tsx:43`
- `Plans.tsx:215`
- `Orders.tsx:113,129`

- [ ] **Step 4: Verify and commit**

```bash
npm run lint && npm run build
```
```bash
git add src/components/plans/ src/lib/promotionMechanics.ts src/components/promotions/ src/pages/
git commit -m "perf: hoist Intl.NumberFormat constructors to module scope"
```

---

### Task 8: Combine chained `.filter().filter()` iterations (×12)

**Files:**
- Modify: `src/components/settings/LaboratoryFormDialog.tsx` (line 53)
- Modify: `src/components/promotions/ImportPromotionsModal.tsx` (lines 297, 300)
- Modify: `src/components/promotions/PromotionFormSheet.tsx` (lines 1027, 1033)
- Modify: `src/components/settings/LaboratoriesTab.tsx` (line 43)
- Modify: `src/pages/Products.tsx` (lines 404, 795, 967)
- Modify: `src/pages/Transfers.tsx` (lines 411, 948)
- Modify: `src/pages/Orders.tsx` (line 392)

**Rule:** `.filter(a).filter(b)` iterates the array twice. Combine into a single `.filter(x => a(x) && b(x))`.

- [ ] **Step 1: Fix LaboratoryFormDialog.tsx**

Read line 53. Pattern:
```ts
// Before
const result = items.filter(isActive).filter(hasLab);

// After
const result = items.filter(x => isActive(x) && hasLab(x));
```

- [ ] **Step 2: Fix ImportPromotionsModal.tsx**

Lines 297 and 300 — may be related. Read both before changing to combine correctly.

- [ ] **Step 3: Fix PromotionFormSheet.tsx**

Lines 1027 and 1033.

- [ ] **Step 4: Fix LaboratoriesTab.tsx, Products.tsx, Transfers.tsx, Orders.tsx**

Apply to all listed files/lines. Read each one before editing.

- [ ] **Step 5: Verify and commit**

```bash
npm run lint && npm run build
```
```bash
git add src/components/settings/LaboratoryFormDialog.tsx src/components/promotions/ImportPromotionsModal.tsx src/components/promotions/PromotionFormSheet.tsx src/components/settings/LaboratoriesTab.tsx src/pages/Products.tsx src/pages/Transfers.tsx src/pages/Orders.tsx
git commit -m "perf: combine chained filter iterations into single pass"
```

---

### Task 9: Memoize context values with `useMemo` (×8)

**Files:**
- Modify: `src/contexts/PromoterContext.tsx` (line 48)
- Modify: `src/contexts/SalesRepContext.tsx` (line 18)
- Modify: `src/contexts/AuthContext.tsx` (line 134)
- Modify: `src/components/ui/toggle-group.tsx` (line 18)
- Modify: `src/components/ui/carousel.tsx` (line 107)
- Modify: `src/components/ui/chart.tsx` (line 43)
- Modify: `src/components/ui/form.tsx` (lines 27, 67)

**Rule:** When a context `value` prop is constructed inline (`value={{ a, b, c }}`), React creates a new object every render, causing all consumers to re-render even if the data didn't change. Wrap with `useMemo`.

- [ ] **Step 1: Fix PromoterContext.tsx**

Read current code at line 48. The `PromoterProvider` constructs its value inline:
```tsx
// Before
<PromoterContext.Provider value={{ promoter, isPromoter, isLoading }}>

// After
const value = useMemo(
  () => ({ promoter, isPromoter, isLoading }),
  [promoter, isPromoter, isLoading]
);
return <PromoterContext.Provider value={value}>;
```
Add `useMemo` to imports from React.

- [ ] **Step 2: Fix SalesRepContext.tsx and AuthContext.tsx**

Same pattern. Read each file to confirm the exact shape of the value object and list the correct deps.

- [ ] **Step 3: Fix shadcn UI context values**

For `toggle-group.tsx`, `carousel.tsx`, `chart.tsx`, and `form.tsx` — these are shadcn components. Apply the same `useMemo` wrap. These files receive props that feed the context; use those props as the `useMemo` deps.

- [ ] **Step 4: Verify and commit**

```bash
npm run lint && npm run build
```
```bash
git add src/contexts/ src/components/ui/toggle-group.tsx src/components/ui/carousel.tsx src/components/ui/chart.tsx src/components/ui/form.tsx
git commit -m "perf: memoize context provider values to prevent unnecessary consumer re-renders"
```

---

### Task 10: Replace `useState` with `useRef` where value is never read in render (×4)

**Files:**
- Modify: `src/components/promotions/PromotionFormSheet.tsx` (lines 250, 671, 680)
- Modify: `src/pages/Marketing.tsx` (line 83)

**Rule:** If a state value is only written (mutated) and never read inside the component's return/JSX, using `useState` triggers unnecessary re-renders. Use `useRef` instead.

- [ ] **Step 1: Fix PromotionFormSheet.tsx**

The flagged state is `accountingTreatment` (line 250). Read the component to confirm it's never used in render:
```tsx
// If confirmed not used in render:
// Before
const [accountingTreatment, setAccountingTreatment] = useState<string>("");

// After
const accountingTreatmentRef = useRef<string>("");

// Usages of setAccountingTreatment("value") become:
accountingTreatmentRef.current = "value";

// Usages of accountingTreatment become:
accountingTreatmentRef.current
```

Check lines 671 and 680 for the other flagged states in the same file.

- [ ] **Step 2: Fix Marketing.tsx**

Same pattern at line 83. Read the component to confirm the state is only mutated, not read in render.

- [ ] **Step 3: Verify and commit**

```bash
npm run lint && npm run build
```
```bash
git add src/components/promotions/PromotionFormSheet.tsx src/pages/Marketing.tsx
git commit -m "perf: replace write-only useState with useRef to avoid spurious re-renders"
```

---

### Task 11: Fix LoginPage animations — 9000ms transitions and large blur (×8)

**Files:**
- Modify: `src/pages/LoginPage.tsx` (lines 236–291)

**Rule:**
- Transitions over 1000ms are too slow for UI feedback. The orbs at 9000ms are decorative background animations — change to 6000ms max or use CSS animations instead of inline transitions.
- `blur(48px)` and `blur(56px)` are extremely GPU-expensive, especially on mobile. Keep under 10px, or use a smaller element with blur. Since these are decorative background orbs, reduce to `blur(24px)` max — still visually effective.

- [ ] **Step 1: Fix blur radius on orbs**

Read lines 236–255. The orbs use `filter: "blur(48px)"` and `filter: "blur(56px)"`. Reduce:
```tsx
// Before
filter: "blur(48px)"

// After
filter: "blur(24px)"
```

Apply to all orb divs (lines 240, 247, 254).

- [ ] **Step 2: Fix animation duration on orbs**

The `animation` values reference keyframe names like `float-slow 9s`, `float-medium 7s`. These are CSS keyframes defined elsewhere (likely in the same file or global CSS). The durations are fine for decorative loops — `9s` is not a UI transition, it's a background ambient animation. **Do NOT change these** — the react-doctor rule `no-long-transition-duration` is a false positive here. Background decorative animations are exempt.

Check lines 241, 248, 255, 263 to confirm these are CSS `animation` (keyframes), not CSS `transition`. If they are `animation`, leave as-is. Only change if they are `transition`.

- [ ] **Step 3: Verify and commit**

```bash
npm run lint && npm run build
```
```bash
git add src/pages/LoginPage.tsx
git commit -m "perf: reduce decorative blur radius in LoginPage orbs for GPU efficiency"
```

---

### Task 12: Lazy-load `recharts` with `React.lazy()` (×2)

**Files:**
- Modify: `src/components/ui/chart.tsx`
- Modify: `src/components/agotados/AgotadosDashboardModal.tsx`

**Rule:** `recharts` is a heavy library (~400KB). Loading it lazily means it's only downloaded when a chart actually renders, improving initial bundle size and TTI.

**Note:** `chart.tsx` is a shared component — lazifying it requires wrapping the import at the call site, not inside chart.tsx itself. The best approach is to make `AgotadosDashboardModal` (which renders charts) lazy-loaded as a whole.

- [ ] **Step 1: Check how AgotadosDashboardModal is imported**

```bash
grep -r "AgotadosDashboardModal" src/ --include="*.tsx" -l
```

Find the parent that imports it.

- [ ] **Step 2: Make AgotadosDashboardModal lazy at its import site**

In the file that imports `AgotadosDashboardModal`:
```tsx
// Before
import AgotadosDashboardModal from "@/components/agotados/AgotadosDashboardModal";

// After
import React, { lazy, Suspense } from "react";
const AgotadosDashboardModal = lazy(() => import("@/components/agotados/AgotadosDashboardModal"));

// Where rendered:
<Suspense fallback={<div className="flex items-center justify-center p-8"><span>Cargando…</span></div>}>
  <AgotadosDashboardModal {...props} />
</Suspense>
```

- [ ] **Step 3: Verify the Suspense boundary is appropriate**

The modal is likely already rendered conditionally (inside an `isOpen` check). The Suspense fallback will only show briefly on first open.

- [ ] **Step 4: Verify and commit**

```bash
npm run build
```
Check build output — you should see `AgotadosDashboardModal` appear as a separate chunk.
```bash
git add src/pages/Agotados.tsx  # or whichever file imports the modal
git commit -m "perf: lazy-load AgotadosDashboardModal to defer recharts bundle"
```

---

## Final Verification

- [ ] **Run react-doctor to confirm score improvement**

```bash
npx react-doctor@latest
```
Expected: score improves from 66/100, architecture errors drop from 5 to 0.

- [ ] **Run full test suite**

```bash
npm run test
```
Expected: all tests pass.

- [ ] **Run lint and build**

```bash
npm run lint && npm run build
```
Expected: no errors.
