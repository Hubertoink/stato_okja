Mobile-first modal notes

- Keep modal headers fixed while the content scrolls. Action buttons belong at the end of the scrolling content instead of in a fixed footer.
- Use the utility classes added in src/index.css:
  - pb-safe: adds padding-bottom respecting env(safe-area-inset-bottom) and a minimum of 16px.
  - mb-safe: adds bottom margin to the scrolling modal container so the footer isn’t clipped.
  - pt-safe: top safe-area padding when needed.
- For modal layouts:
  - Overlay container: add pb-safe.
  - Card container: limit height to ~80–85vh and add mb-safe.
  - Keep action buttons in normal document flow so the keyboard does not require layout toggles.
- Tooltips: use the tooltip-wrapper + tooltip-bubble classes around icon-only buttons for immediate hover/focus hints.

These patterns are applied to Projects, Categories, Tags, Cohorts, and Team modals.