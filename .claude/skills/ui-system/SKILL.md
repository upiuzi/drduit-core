---
name: ui-system
description: Standards and invariants for all UI components and screens — fluid wide layouts (edge-to-edge, never boxed with max-width/margin auto), strict system theme token usage (var(--surface), var(--line), var(--ink), var(--muted)), and tabular numerics. Use whenever creating or modifying UI screens, tabs, modals, or CSS styles.
---

# UI System Standards & Theming Invariants

Every UI, tab, screen, modal, and widget across this application must strictly adhere to the following design system invariants. Never introduce ad-hoc styles, custom background values, or arbitrary container width caps.

## 1. Wide Fluid Layout (Never Boxed)
- **Edge-to-Edge Layout**: All top-level screens and sub-tabs (such as Cashflow, Budget, Track, and Outlook inside `.pl-page--wide`) must span the full available width.
- **Never Box Tabs**: Never apply artificial constraints like `max-width: 1200px; margin: 0 auto;` on page or tab container roots (`.csp-track-container`, `.cfx`, `.pl-sub`). Doing so creates awkward gutters and islands that break visual consistency with sibling tabs.
- **Sub-Tab Container**: Sub-tabs inside the Plan screen should use `className="pl-sub <tab-container>"` and define `width: 100%; max-width: none; margin: 0;` in their CSS.

## 2. System Design Tokens (Theme Palette)
Always use the design system tokens defined in `:root`. Never hardcode hex codes or use random palette colors for core components.

### Surfaces & Elevation
- Primary Cards & Banners: `background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-xl);` (16px) or `var(--radius-lg)` (12px).
- Inset Wells / Secondary Boxes / Inputs: `background: var(--bg-2)` or `var(--surface2); border: 1px solid var(--line);`
- Hover States: `border-color: var(--line-strong);`

### Typography Hierarchy
- Primary Headings & Bold Metric Totals: `color: var(--ink);`
- Standard Body Text: `color: var(--text);` (aliases `--ink` in dark theme)
- Secondary Labels & Supporting Prose: `color: var(--muted);`
- Captions, Meta, & Table Headers: `color: var(--faint);` (note: contrast floors alias this to `--muted` where needed)

### State Indicators
- Success / Positive / Surplus: `var(--good)` (green `#34b08a`)
- Warning / Attention: `var(--warn)` (amber `#e0a032`)
- Danger / Negative / Deficit: `var(--bad)` (red `#e2554f`)
- Primary Action / Highlight: `var(--primary)` (blue `#3b86dd`)
- Specialty Accents: `var(--violet)` (purple `#7C6CF5`)

## 3. Tabular Numerics on All Financial Data
- Every financial amount, currency figure (`fBase`, `fBaseWhole`), percentage, count, timestamp, and table number MUST have:
  ```css
  font-variant-numeric: tabular-nums;
  ```
- This guarantees numbers do not jitter, column widths stay consistent across updates, and alignments remain pixel-precise.

## 4. Tables & Lists
- Tables must take `width: 100%` inside a `.csp-table-wrap` (or `.cfx-table-wrap`) with `overflow-x: auto`.
- Headers (`th`): uppercase, small (`font-size: 11px`), tracking (`letter-spacing: 0.05em`), `font-weight: 700`, `color: var(--faint)`.
- Rows (`td`): clean row borders (`border-bottom: 1px solid var(--line)`), tabular numbers right-aligned or left-aligned matching the column header.

## 5. CSS Guard Registration
- When creating or modifying a new stylesheet, ensure classes follow project prefixes (e.g. `csp-*`, `cfx-*`, `pl-*`) and register in `check-css-classes.mjs` if participating in the bidirectional check.
