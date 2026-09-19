# ROLE

You are now acting as the **Principal Enterprise Product Designer + Staff Frontend Engineer performing a visual refinement pass on the already-implemented RetailOps Ads Intelligence page.**

The first implementation is complete.

DO NOT redesign the page from scratch.

DO NOT replace the current architecture.

DO NOT change the backend.

This is a **precision refinement pass**.

The goal is to take the current implementation from:

> clean enterprise dashboard

to:

> premium, dense, data-driven enterprise advertising intelligence workspace.

The supplied original reference image remains the visual target.

The currently implemented screenshot is the starting point.

---

# CURRENT IMPLEMENTATION STATUS

The following already exists and is working:

* Ads Manager header
* Dataset context
* Seller / Brand / Category filters
* Daily / Monthly controls
* Date presets
* Refresh
* Export
* Performance / Efficiency / ASIN Table / Report / Analyst navigation
* 8 KPI cards
* Performance Trend chart
* Performance Health
* Existing Ads Manager data/API
* Existing metric calculations

DO NOT rebuild these.

Refine them.

---

# MOST IMPORTANT RULE

The current implementation is visually clean but **too flat and too generic in places**.

Do not respond by adding:

* gradients
* more shadows
* larger cards
* more colors
* more rounded corners
* decorative illustrations
* AI graphics
* unnecessary icons

Instead increase richness through:

* information hierarchy
* data context
* micro-analytics
* better grouping
* stronger visual relationships
* better chart communication
* meaningful states
* better density

The design principle is:

> **Make the interface richer by making the data more legible, not by making the UI more decorative.**

---

# 1. RESTORE THE ADS INTELLIGENCE IDENTITY

The current page jumps directly from the application header into:

```text
Daily rows
20 Aug – 19 Sept
...
```

This is too abrupt.

Add a compact module heading before the context row.

Use:

```text
Ads Intelligence
Advertising performance and optimization workspace.
```

Hierarchy:

```text
Ads Intelligence
↓
dataset/context metadata
↓
filters
```

Do NOT make this a large hero section.

Target:

```text
Title: 20–24px
Weight: 650–700

Description: 12–13px
```

The heading should occupy only the space necessary to establish module identity.

---

# 2. REMOVE THE EMPTY GAP

The current implementation has a noticeable empty horizontal region between the filter toolbar and the Performance / Efficiency tabs.

This looks like an unfinished component.

Do not leave reserved whitespace.

There are only two acceptable outcomes:

### Option A — preferred

Populate that area with the real intelligence signal rail.

### Option B

If no valid signals exist:

Remove the reserved height completely.

Never leave:

```text
large empty white/gray area
```

between meaningful sections.

---

# 3. ADD THE INTELLIGENCE SIGNAL RAIL

Use the existing real rule/data findings.

Example:

```text
● Ads data ends 2026-09-15
  4 days before selected window

● 24 day(s) have no ad rows

● Conversion rate 4.56%
  on 241 clicks

● 124 key(s) sell ₹1.9K organically
  with no ad spend

● DOXIC carries 100% of ad sales
```

These are examples only.

Use actual data.

Never hardcode them.

---

# SIGNAL DESIGN

The signal rail should be:

```text
horizontal
compact
single-line dominant
scrollable if necessary
```

Each signal should look like an enterprise status indicator, not a card.

Approximate:

```text
height: 28–34px
padding: 6px 10px
radius: 999px
border: 1px
```

Use:

```text
warning → amber
positive → green
information → blue
neutral → gray
```

Do not make the entire signal background strongly colored.

Use mostly white/light surfaces with a small semantic indicator.

---

# 4. IMPROVE THE KPI STRIP

The current KPI strip is good structurally.

Do not change the 8-metric model:

```text
Ad Spend
Ad Sales
Total Sales
ACOS
TACOS
ROAS
Orders
Traffic
```

But refine the cards.

---

# KPI CARD TARGET

Each card should communicate:

```text
WHAT
↓
HOW MUCH
↓
WHAT CONTEXT
↓
HOW IS IT MOVING
```

Example:

```text
AD SPEND

₹1.1K

No comparable prior period

[sparkline]

CPC ₹5 · 241 clicks
```

---

# 5. REDUCE REPETITION

Currently every KPI card contains:

```text
No comparable previous period
```

This creates visual noise.

Change the visual treatment to:

```text
AD SPEND                    No prior data

₹1.1K

[sparkline]

CPC ₹5 · 241 clicks
```

The `No prior data` label should be:

* 10–11px
* muted
* aligned to the right of the metric label
* visually subordinate

Do not repeat a full sentence in every card.

---

# 6. KPI LABELS

Improve metric labels slightly.

Current:

```text
AD SPEND
```

Preferred:

```text
AD SPEND                         No prior data
```

Keep the uppercase enterprise style.

Do not make labels larger.

---

# 7. KPI PRIMARY VALUES

Primary values should remain the strongest element.

Target approximately:

```text
24–28px
font-weight: 650–700
letter-spacing: -0.02em
```

Do not use oversized 32–40px dashboard numbers.

---

# 8. KPI SECONDARY CONTEXT

The bottom context is one of the strongest aspects of this design.

Make it intelligent.

Examples:

### Spend

```text
CPC ₹5 · 241 clicks
```

### Sales

```text
11 orders · AOV ₹483
```

### Total Sales

```text
Organic ₹12.3K · 69.9%
```

### ACOS

```text
ROAS 4.79×
```

### TACOS

```text
Ad share 30.1%
```

### ROAS

```text
Cost/order ₹101
```

### Orders

```text
CVR 4.6%
```

### Traffic

```text
CTR 0.71% · 241 clicks
```

Use existing real calculations.

---

# 9. KPI SPARKLINES

The current sparklines are good in concept.

Make them slightly more sophisticated.

They should communicate:

```text
direction
volatility
activity
```

without becoming full charts.

Requirements:

* 70–100px width
* 28–34px height
* no axis
* no labels
* subtle baseline if useful
* data-driven
* consistent stroke weight

Do not use random decorative sparkline paths.

---

# 10. CHART IS THE PRIMARY ANALYTICAL SURFACE

The Performance Trend panel currently occupies the correct general area.

Keep it.

But improve the chart itself.

The chart should answer:

> What happened to advertising performance across this period?

without requiring the user to decode overlapping lines.

---

# 11. FIX SERIES VISUAL DISTINCTION

The current chart has:

```text
Total Sales
Ad Sales
Organic
```

but visually these can overlap and become difficult to distinguish.

Use a clear hierarchy.

Preferred:

```text
Total Sales
→ primary line

Ad Sales
→ secondary line/bar

Organic Sales
→ lighter secondary series
```

Use existing corporate colors/tokens.

Do NOT introduce random colors.

If three series are mathematically overlapping, their visualization must still remain understandable through:

* line weight
* opacity
* fill
* dash style
* chart type

not through excessive colors.

---

# 12. CHART HEADER

Make the chart header more analytical.

Left:

```text
PERFORMANCE TREND

Daily trend of advertising performance · 31 days
```

Right:

```text
SALES
SPEND
EFFICIENCY
TRAFFIC
ORDERS
```

and:

```text
AUTO
DAY
WEEK
MONTH
```

The controls already exist.

Refine spacing and grouping rather than replacing them.

---

# 13. CHART DATA CONTEXT

Show a subtle period descriptor in the header:

```text
20 Aug – 19 Sep · 31 days · daily buckets
```

This is much more useful than generic text.

It must be dynamically generated.

---

# 14. CHART TOOLTIP

The tooltip should provide enough information for actual analysis.

Example:

```text
01 Sep 2026

Total Sales      ₹8,420
Ad Sales         ₹2,180
Organic Sales    ₹6,240

Ad Spend         ₹680
ACOS             31.2%
Orders           5
Clicks           82
```

Only show available metrics.

Never show fabricated values.

---

# 15. CHART GRID

The current chart has large areas of empty space because most dates have no activity.

Do not hide those dates.

That is meaningful information.

Instead improve the interpretation.

For example:

```text
No ad activity
```

can appear in the tooltip for a date with no row.

Do not replace missing data with fake values.

---

# 16. CHART FOOTER

Current:

```text
No comparable previous window exists yet — comparison deltas are intentionally left blank.
```

This is correct behavior.

Make it visually quieter.

Use:

```text
font-size: 10.5–11px
color: var(--ops-ink-3)
```

Place it near the chart legend.

---

# 17. PERFORMANCE HEALTH

The current Performance Health panel is structurally good but visually too flat.

Keep the horizontal analytical structure.

Current:

```text
Paid Sales
Organic Sales
Total Sales
Paid Contribution
AOV
CVR
```

Improve it to feel like a **summary instrument**, not six unrelated labels.

Use:

```text
PERFORMANCE HEALTH
                                      From the same scoped rows

Paid Sales       Organic Sales       Total Sales
₹5.3K            ₹12.3K              ₹17.6K

Paid Contribution    AOV             CVR
30.1%                ₹483            4.6%
```

Create two subtle analytical rows or use an aligned grid.

Do not turn each metric into a giant card.

---

# 18. ADD RELATIONSHIP CONTEXT

Where meaningful, use small secondary explanations.

Example:

```text
Paid Sales
₹5.3K
30.1% of ₹17.6K
```

```text
Organic Sales
₹12.3K
69.9% of ₹17.6K
```

```text
Paid Contribution
30.1%
₹5.3K / ₹17.6K
```

This is exactly the kind of information density the interface needs.

---

# 19. APPLICATION BACKGROUND

The current page is too uniformly white.

Use the existing Ops background.

Target:

```text
page
→ light neutral gray

panels
→ white

controls
→ white

active controls
→ subtle blue tint

borders
→ very light gray-blue
```

This creates separation without shadows.

Do not make the background dark.

---

# 20. CONTENT WIDTH

Keep a consistent content grid.

All of these should share the same left/right boundaries:

```text
module header
context
filters
signals
tabs
KPI strip
chart
performance health
```

No section should randomly extend farther than another.

---

# 21. VERTICAL RHYTHM

Use:

```text
Header
↓ 12–16px
Context
↓ 10–12px
Filters
↓ 8–12px
Signals
↓ 14–18px
Tabs
↓ 8–12px
KPIs
↓ 16–20px
Chart
↓ 16px
Performance Health
```

Avoid large unexplained gaps.

---

# 22. TABS

Current:

```text
PERFORMANCE
EFFICIENCY
ASIN TABLE
REPORT
AI ANALYST
```

Keep them.

Refine them into a compact enterprise navigation strip.

Active:

```text
blue text
light blue background
```

Inactive:

```text
muted gray
white background
```

Avoid heavy borders around every individual tab if the Ops system already has a better primitive.

---

# 23. VISUAL HIERARCHY

The page should now read visually as:

```text
1. Ads Intelligence
2. What dataset am I looking at?
3. What needs attention?
4. What are the headline numbers?
5. What happened over time?
6. What is the overall health?
```

That is the desired cognitive sequence.

---

# 24. DO NOT ADD DECORATION

Do not solve visual emptiness with:

* illustrations
* gradients
* large icons
* giant numbers
* decorative lines
* shadows
* glowing effects
* animated backgrounds

Solve it through information architecture.

---

# 25. PRESERVE EXISTING DATA CONTRACT

Do not modify:

```text
API
database
backend
metric formulas
permissions
authentication
existing filters
import
export
table
ASIN detail
```

The task is visual refinement.

---

# 26. PRESERVE OPS CENTER DESIGN SYSTEM

Continue using:

```css
var(--ops-ink-1)
var(--ops-ink-2)
var(--ops-ink-3)
var(--ops-line)
var(--ops-line-soft)
var(--ops-accent)
var(--ops-pos)
var(--ops-neg)
var(--ops-warn)
```

and existing `.ops-*` components.

Do not create a parallel Ads design system.

---

# 27. CSS QUALITY

Fix any invalid CSS encountered.

For example:

```css
transition: *background* 0.12s ease;
```

must be:

```css
transition: background 0.12s ease;
```

Never use:

```css
!important
```

unless there is no clean alternative.

Scope all Ads-specific overrides:

```css
.ads-page ...
```

Never accidentally modify Ops Center globally.

---

# 28. RESPONSIVE

At desktop:

```text
8 KPI cards
```

At medium:

```text
4 × 2
```

At smaller:

```text
2 × N
```

or horizontal KPI rail where appropriate.

The chart should remain readable.

The signal rail can horizontally scroll.

No page-level horizontal overflow.

---

# 29. FINAL VISUAL TARGET

After this pass, the page should feel like:

```text
RetailOps
+
Operations Command Center
+
Amazon Advertising Intelligence
+
Enterprise Financial Analytics
```

It should look like a mature internal platform used by:

* Brand Managers
* Ads Managers
* Operations Managers
* Marketplace teams
* Leadership

The interface should communicate serious operational software.

---

# 30. FINAL ACCEPTANCE CRITERIA

Do not finish until all of these are true:

```text
[ ] Ads Intelligence title restored
[ ] No unexplained empty vertical region
[ ] Real intelligence signal rail visible
[ ] Signals are data-driven
[ ] KPI cards remain compact
[ ] KPI repetition reduced
[ ] KPI secondary context improved
[ ] Sparkline alignment improved
[ ] Chart series visually distinguishable
[ ] Chart tooltip is analytically useful
[ ] Chart period context visible
[ ] Performance Health feels analytical
[ ] Page background has proper surface separation
[ ] All sections share the same content grid
[ ] Existing Ops Center visual system preserved
[ ] No new unnecessary design system
[ ] No fake data
[ ] No fake comparisons
[ ] No fake trends
[ ] No backend changes
[ ] No broken existing functionality
[ ] No console errors
[ ] No CSS errors
[ ] No horizontal overflow
```

## FINAL INSTRUCTION

Do NOT make the page “more beautiful.”

Make it **more intelligent, more legible, more information-dense, and more enterprise-grade**.

The data should be the visual hero.

The UI should get out of the way and help the operator understand what is happening.