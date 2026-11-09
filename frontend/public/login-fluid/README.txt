Standalone Toolcraft fluid export, imported 2026-11-08 from
StatO_Design/toolcraft/public/embed (user-provided local project).

assets/index-s315-pjK.js and the grain texture are the original export.
No CDN, editor server, credentials, or external runtime is required.
The renderer pauses when hidden and respects prefers-reduced-motion.

StatO integration:
- LoginBackground.tsx contains the user's exported preset and flow clock.
- index.html uses centered cover sizing and a 2.6x visual zoom so the artwork
  fills the login background. The renderer and preset remain unchanged.
- The transparent export sits over the active theme's --app-bg color.
- Only this HTML document permits same-origin framing in Nginx.
- The PWA navigation fallback excludes /login-fluid/.

To update the renderer, replace the complete assets directory and script URL
from a new Toolcraft website export. Preserve the cover/zoom in index.html.
