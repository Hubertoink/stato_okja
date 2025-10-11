Mobile-first modal notes

- Always use sticky modal footers on mobile and ensure they are above the bottom navigation.
- Use the utility classes added in src/index.css:
  - pb-safe: adds padding-bottom respecting env(safe-area-inset-bottom) and a minimum of 16px.
  - mb-safe: adds bottom margin to the scrolling modal container so the footer isn’t clipped.
  - pt-safe: top safe-area padding when needed.
- For modal layouts:
  - Overlay container: add pb-safe.
  - Card container: limit height to ~80–85vh and add mb-safe.
  - Footer: sticky bottom-0 with py-2 and pb-safe.
- Tooltips: use the tooltip-wrapper + tooltip-bubble classes around icon-only buttons for immediate hover/focus hints.

These patterns are applied to Projects, Categories, Tags, Cohorts, and Team modals.