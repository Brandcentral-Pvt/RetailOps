# Phase 4 production filter-height correction

Baseline 6cf5356. Production screenshot showed Brand, Category, Marketplace and Currency selects occupying approximately 148px of height. Legacy .ads-filter-select used flex:1 1 148px (130px at small widths). Phase 4 nested those controls inside a flex column, so flex-basis became vertical. Remove the legacy class and explicitly constrain direct single-select controls to 32px with no flex growth/shrink; preserve wrapping date labels and responsive grid. Align labels and controls. No global CSS, filter behavior or backend changes.

The existing empty-view browser regression now measures rendered select/input/button heights and field heights at all four viewport widths, in addition to containment. No production access or deployment performed.