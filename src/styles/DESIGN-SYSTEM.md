# RetailOps Design System — Enterprise Audit & Architecture

**Version**: 3.0  
**Author**: Design System Architect  
**Date**: July 2026

---

## Step 1: Current CSS Audit

### 1.1 Inventory Summary

| File | Lines | Role |
|------|-------|------|
| `src/index.css` | 3465 | Monolith: base reset, CSS vars, Bootstrap grid, utilities, KPI, alerts, forms, tables, modals, animations |
| `src/App.css` | 689 | Duplicate base: forms, buttons, tables, pagination, alerts, upload, responsive |
| `src/styles/tokens.css` | 196 | Token foundation: colors, typography, spacing, radius, shadows, transitions, z-index |
| `src/styles/global-overrides.css` | 288 | Z-index hierarchy, Ant Design popup overrides, scroll styling |
| `src/styles/rsuite-overrides.css` | 109 | RSuite date picker + button overrides |
| `src/styles/header.css` | 562 | Global header, search, command palette, notifications |
| `src/components/Header.css` | 221 | Alternate topbar redesign (different from styles/header.css) |
| `src/components/Sidebar.css` | 331 | Legacy sidebar (Bootstrap-based, uses tokens.css vars) |
| `src/components/common/Sidebar.css` | 373 | Active sidebar (Ant Design Sider-based, uses index.css vars) |
| `src/pages/Alerts.css` | 148 | iOS-glassmorphism notification styles |
| `src/pages/AdsReport.css` | 287 | Ads page: uses Zinc primitives directly, not tokens |
| `src/pages/UsersPage.css` | TBD | Page-specific |
| `src/pages/WebhookSettingsPage.css` | TBD | Page-specific |
| `src/components/actions/ActionModal.css` | 176 | Action modal: hardcoded hex everywhere |
| `src/components/actions/ActionChatWhatsApp.css` | 222 | WhatsApp chat: brand-specific hex (#128c7e, #dcf8c6) |
| `src/components/common/DateRangePicker.css` | TBD | Date picker |
| `src/components/ui/skeleton/Skeleton.css` | TBD | Skeleton |
| `src/CometChat/styles/` | 15 files | Third-party — EXCLUDE |

**Total**: ~5,700 lines of custom CSS (excluding CometChat)

### 1.2 Critical Findings

#### A. Three Competing Variable Systems

| System | Prefix | Source File | Used By |
|--------|--------|-------------|---------|
| tokens.css | `--color-brand-*`, `--color-neutral-*`, `--text-*` | tokens.css | Sidebar.css (components/), App.css |
| index.css | `--color-primary`, `--color-gray-*`, `--font-size-*`, `--bg-*`, `--text-*` | index.css | index.css utilities, common/Sidebar.css, header.css |
| global-overrides | `--z-*`, `--border`, `--bg-*`, `--text-*` | global-overrides.css, rsuite-overrides.css | global-overrides.css, Header.css, common/Sidebar.css |

**Conflict**: `--text-primary` exists in both tokens.css (`#121b1e`) and index.css (`#111827`). `--transition-fast` is `150ms ease` in tokens but `150ms cubic-bezier(0.4, 0, 0.2, 1)` in index.css.

#### B. Massive Hardcoded Color Violations

| Pattern | Count | Example Files |
|---------|-------|---------------|
| `#1976D2` (primary) | 40+ | global-overrides, index, common/Sidebar |
| `#E3F2FD` (brand-50) | 15+ | common/Sidebar, index |
| `#E5E7EB` / `#e2e8f0` (border) | 30+ | index, ActionModal, AdsReport |
| `#F8FAFC` / `#f8fafc` (surface) | 20+ | index, global-overrides |
| `#ffffff` / `white` | 50+ | All files |
| `#64748B` / `#94A3B8` (muted) | 25+ | index, AdsReport |
| `#D32F2F` / `#dc2626` (danger) | 15+ | header, index, Sidebar |
| `#128c7e` (WhatsApp) | 5 | ActionChatWhatsApp |
| `#007aff` (iOS blue) | 3 | Alerts.css |

#### C. Duplicated Definitions

| Selector | File 1 | File 2 | Conflict |
|----------|--------|--------|----------|
| `.btn` | App.css:213 | index.css:3213 | Different padding, font-size, border-radius |
| `.btn-primary` | App.css:228 (brand-600) | index.css:3234 (secondary purple!) | Different colors |
| `.btn-secondary` | App.css:239 (surface-2) | index.css:3248 (white) | Different backgrounds |
| `.table` | App.css:344 | index.css:1427 | Different definitions |
| `@keyframes spin` | index.css:1475 | index.css:1549 | Duplicate |
| `@keyframes pulse` | index.css:2892 | index.css:3191 | Duplicate, different implementations |
| `.kpi-grid` responsive | index.css:1731 | index.css:1883 | Contradictory: `repeat(3, 1fr)` vs `repeat(2, 1fr)` |
| `.form-group` | App.css:551 | index.css:3284 | Different margins |

#### D. Missing Design Tokens

| Category | Missing |
|----------|---------|
| Info color | No token in tokens.css |
| Marketplace colors | None (Amazon #ff9900, Flipkart #2874f0, etc.) |
| Module accents | None for 16 modules |
| Opacity tokens | None |
| Animation keyframes | None standardized |
| Component tokens | None (every component redefines colors inline) |
| Breakpoints | None as tokens |
| Shadow-card | None |
| Surface-elevated | None |

#### E. Naming Inconsistencies

| Concept | tokens.css | index.css | global-overrides |
|---------|------------|-----------|------------------|
| Background | `--color-surface-0/1/2` | `--bg-primary/secondary/tertiary`, `--bg-app` | `--bg-sidebar`, `--bg-topbar` |
| Text | `--color-text-primary/secondary/muted` | `--text-primary/secondary/tertiary`, `--text-muted` | Same |
| Border | `--color-border`, `--color-border-strong` | `--border-color` | `--border` |
| Radius | `--radius-sm/md/lg/xl` | `--border-radius-sm/md/lg/xl` | None |
| Transition | `--transition-fast/base/slow` | `--transition-fast/base/slow` (different values!) | None |

#### F. Performance Issues

1. **3465-line monolith** (`index.css`) — parse time, cache invalidation
2. **Duplicate grid system** — Bootstrap `.col-*` classes alongside Tailwind (already imported via `@import "tailwindcss"`)
3. **Zinc utility classes** (100+ lines) — Tailwind already provides these
4. **`!important` overuse** — 60+ `!important` declarations to override Ant Design

#### G. Accessibility Issues

1. No focus-visible styles (only `:focus` with box-shadow)
2. No `prefers-reduced-motion` media query
3. No `prefers-color-scheme` media query (dark mode commented out)
4. No high-contrast mode support
5. Low contrast in some muted text colors (e.g., `#94A3B8` on `#ffffff` = 3.03:1, fails WCAG AA)

#### H. Responsiveness Issues

1. Conflicting responsive breakpoints for `.kpi-grid` (defined 3 times with different column counts)
2. No container queries
3. Inconsistent breakpoint usage: 992px, 768px, 576px, 400px mixed

---

## Step 2: Design System Architecture

### 2.1 Layer Model

```
┌─────────────────────────────────────────────────┐
│                 COMPONENTS                       │
│  Button, Card, Table, Input, Modal, Badge, ...  │
│  (consume component tokens, never primitives)    │
├─────────────────────────────────────────────────┤
│              COMPONENT TOKENS                    │
│  --btn-primary-bg, --card-padding, --input-radius│
│  (semantic tokens per component)                 │
├─────────────────────────────────────────────────┤
│              SEMANTIC TOKENS                     │
│  --bc-primary-600, --bc-surface-card,            │
│  --bc-text-heading, --bc-border-default,         │
│  --bc-status-success, --bc-accent-gms            │
│  (purpose-based aliases of primitives)           │
├─────────────────────────────────────────────────┤
│              PRIMITIVE TOKENS                    │
│  --bc-blue-50..900, --bc-slate-50..900,          │
│  --bc-green-*, --bc-red-*, --bc-amber-*           │
│  (raw palette — never used directly)             │
├─────────────────────────────────────────────────┤
│              PLATFORM                            │
│  Tailwind CSS, Ant Design, React, Vite           │
└─────────────────────────────────────────────────┘
```

### 2.2 File Architecture

```
src/styles/
├── tokens.css              → Primitive + Semantic + Layout tokens (THE source of truth)
├── antd-overrides.css      → Ant Design component token overrides (using BC tokens)
├── animations.css          → Keyframes + animation utilities
├── components.css          → Component token definitions (Button, Card, Table, etc.)
├── global.css              → Reset, base styles, typography, scrollbar
├── utilities.css           → Minimal utility classes (not duplicating Tailwind)
└── index.css               → @import all above in order
```

### 2.3 Naming Convention

```
--bc-{category}-{variant}

Categories:
  primitive colors: --bc-blue-500, --bc-slate-200
  semantic:        --bc-primary-600, --bc-surface-card, --bc-text-body
  status:          --bc-status-success, --bc-status-danger-bg
  marketplace:     --bc-market-amazon, --bc-market-flipkart
  module:          --bc-accent-gms, --bc-accent-pems
  component:       --bc-btn-primary-bg, --bc-card-padding
```

---

## Step 3–10: Token Systems (Generated in `tokens.css`)

Already created at `src/styles/design-tokens.css` with:
- **Primitives**: Blue, Slate, Green, Red, Amber, Violet, Indigo, Cyan, Pink (40+ swatches)
- **Semantic**: Primary, Surface, Text, Border, Status (25+ tokens)
- **Module Accents**: 11 module-specific colors
- **Marketplace**: Amazon, Flipkart, Ajio, Myntra (4 tokens)
- **Typography**: 11 sizes, 4 weights, 5 line-heights, 5 letter-spacings, 3 font stacks
- **Spacing**: 16 steps on 4px grid
- **Radius**: 7 steps
- **Shadows**: 6 levels + focus ring
- **Transitions**: 3 durations, 4 easings
- **Z-index**: 7-level scale
- **Layout**: Sidebar, topbar, content, card padding
- **Dark mode**: Full override set ready to activate

---

## Step 11: Component Standards

### Button
```css
/* Usage: Use Ant Design Button with CSS token overrides */
.ant-btn-primary {
  background: var(--bc-primary-600) !important;
  border-color: var(--bc-primary-600) !important;
}
```

### Card
```css
.bc-card {
  background: var(--bc-surface-card);
  border: 1px solid var(--bc-border-subtle);
  border-radius: var(--bc-radius-lg);
  padding: var(--bc-card-padding);
  box-shadow: var(--bc-shadow-card);
}
```

### Table (Ant Design)
```css
.ant-table-thead > tr > th {
  background: var(--bc-surface-subtle) !important;
  color: var(--bc-text-secondary) !important;
  font-size: var(--bc-text-xs) !important;
  font-weight: var(--bc-weight-semibold) !important;
  border-bottom: 2px solid var(--bc-border-default) !important;
}
```

### Input (Ant Design)
```css
.ant-input, .ant-input-affix-wrapper {
  border-color: var(--bc-border-default) !important;
  border-radius: var(--bc-radius-md) !important;
}
.ant-input:focus, .ant-input-affix-wrapper-focused {
  border-color: var(--bc-primary-500) !important;
  box-shadow: var(--bc-shadow-focus) !important;
}
```

### Badge
```css
.bc-badge {
  display: inline-flex;
  padding: 2px 8px;
  border-radius: var(--bc-radius-full);
  font-size: var(--bc-text-xs);
  font-weight: var(--bc-weight-semibold);
  line-height: 1.4;
}
.bc-badge-success { background: var(--bc-status-success-bg); color: var(--bc-green-700); }
.bc-badge-danger  { background: var(--bc-status-danger-bg);  color: var(--bc-red-700); }
.bc-badge-warning { background: var(--bc-status-warning-bg); color: var(--bc-amber-700); }
.bc-badge-info    { background: var(--bc-status-info-bg);    color: var(--bc-primary-700); }
```

---

## Step 12: Folder Structure

```
src/styles/
├── tokens.css              ← THE single source of truth
├── antd-overrides.css      ← Ant Design theme + component overrides
├── animations.css          ← @keyframes + animation utilities  
├── global.css              ← Reset, base, typography, scrollbar
├── utilities.css           ← Minimal helpers (not duplicating Tailwind)
└── index.css               ← Import order: tokens → global → antd → animations → utilities
```

Component-level CSS files (scoped) are acceptable for:
- WhatsApp chat (brand-specific, excluded from token system)
- CometChat (third-party, excluded entirely)
- Complex page-specific layouts (AdsReport drawer, etc.)

---

## Step 13: Migration Strategy

### Phase 1: Token Foundation (NOW)
1. Replace `tokens.css` with `design-tokens.css` — unified token file
2. Update `index.css` to import new tokens
3. Remove duplicate variable definitions from `index.css`

### Phase 2: Semantic Bridge (Week 1)
4. Add compatibility aliases in `tokens.css`:
   ```css
   /* Backward compat — map old names to new */
   --color-primary: var(--bc-primary-600);
   --color-success: var(--bc-status-success);
   --text-primary: var(--bc-text-heading);
   --border-color: var(--bc-border-default);
   ```
5. Run grep to find all hardcoded colors, replace with token references

### Phase 3: Ant Design Overrides (Week 2)
6. Create `antd-overrides.css` — all `!important` overrides centralized
7. Remove `!important` from component CSS files
8. Set Ant Design theme via ConfigProvider (CSS-in-JS) + CSS variable fallback

### Phase 4: Cleanup (Week 3)
9. Delete duplicate grid system (Bootstrap `.col-*` → use Tailwind)
10. Delete Zinc utility classes (use Tailwind)
11. Delete duplicate `.btn`, `.table`, `@keyframes` from App.css
12. Consolidate sidebar CSS (remove legacy `components/Sidebar.css`)

### Phase 5: Dark Mode (Future)
13. Activate `body.bc-dark` override set
14. Test all components
15. Add theme toggle to Header

---

## Step 14: Best Practices

### Rules
1. **Never use primitive tokens directly** — always use semantic (`--bc-primary-600` not `--bc-blue-600`)
2. **Never hardcode hex colors** — use `var(--bc-*)` everywhere
3. **Never use `!important` in component CSS** — fix specificity with proper selectors
4. **Always use 4px grid** — all spacing must be multiples of `--bc-space-*`
5. **All Ant Design overrides go in `antd-overrides.css`** — one file, one place
6. **Component CSS uses scoped class names** — `bc-{component}` prefix
7. **Animations use `prefers-reduced-motion`** — respect user preferences
8. **Test dark mode** — every new component must work in both themes

### Performance
- CSS custom properties enable runtime theme switching without style recalculation
- Single token file = single cache invalidation point
- No inline styles for colors (always token references)
- Tailwind for layout utilities, custom CSS only for Ant Design overrides and components

### Accessibility
- All text colors must meet WCAG AA (4.5:1 for body, 3:1 for large text)
- Focus rings visible on all interactive elements via `--bc-shadow-focus`
- `prefers-reduced-motion` disables animations
- High-contrast mode fallbacks via `forced-colors` media query
