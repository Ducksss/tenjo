# Tenjō presentation assets

Cobalt (`#3851F5`), navy (`#101637`), ice white (`#F6F8FF`) and pale blue (`#EDF1FF`), with Manrope geometric sans typography. The existing stylised 天 mark and perforated ticket remain the identity; layered blue ticket forms now connect the website, README and share card.

The user-selected [Invstor X reference](https://invstortemplate.webflow.io/) informed the spacious split composition, medium-weight geometric headlines, cool palette and pill actions. No template code, artwork or font files were reused. See [the design rationale](../../DESIGN.md#reference-taste-invstor-x).

| File                                               | Size         | Purpose                                                               |
| -------------------------------------------------- | ------------ | --------------------------------------------------------------------- |
| [logo.svg](logo.svg)                               | 80 × 80      | Compact mark on a pale tile for light and dark backgrounds            |
| [wordmark.svg](wordmark.svg)                       | 360 × 100    | Full wordmark on ice white                                            |
| [hero.svg](hero.svg)                               | 1280 × 640   | Editable README banner artwork                                        |
| [social-preview.png](social-preview.png)           | 1280 × 640   | README hero and website Open Graph card; source in social-preview.svg |
| [favicon.svg](favicon.svg)                         | 80 × 80      | Same mark installed as src/app/icon.svg                               |
| [discover-desktop.png](discover-desktop.png)       | 1440 px wide | Actual first-visit discovery page                                     |
| [discover-mobile.png](discover-mobile.png)         | 390 px wide  | Actual mobile discovery page                                          |
| [walkthrough-desktop.png](walkthrough-desktop.png) | 1440 px wide | Scripted browser-only walkthrough after example entry                 |
| [walkthrough-mobile.png](walkthrough-mobile.png)   | 390 px wide  | Same example entry on mobile                                          |
| [drop-desktop.png](drop-desktop.png)               | 1440 px wide | Real local test-identity drop and public record                       |
| [drop-mobile.png](drop-mobile.png)                 | 390 px wide  | Same local drop on mobile                                             |
| [diagram-flow.svg](diagram-flow.svg)               | 760 × 508    | README flow from entry to pickup                                      |
| [diagram-system.svg](diagram-system.svg)           | 760 × 400    | README map of how the pieces connect; Sui dashed as planned           |
| [diagram-entry.svg](diagram-entry.svg)             | 760 × 704    | README decision tree for entry, in code order                         |
| [diagram-pickup.svg](diagram-pickup.svg)           | 760 × 704    | README decision tree for pickup, in code order                        |

The four diagrams are plain SVG in the palette above, drawn from the shared PRD and the checks in `src/lib/service.ts` and `src/lib/world.ts`. Edit them directly, and update them when those checks change.

Screenshots come from the running Next.js app. Discovery and walkthrough captures use an empty local database matching the hosted first-visit experience; drop captures use labelled local test identities. They contain no real World proofs, personal details or real-money transactions. The ticket and console illustrations are CSS. None of the screenshots is a generated mockup.

Vector marks and ticket art are original project artwork, with no stock photography or third-party logos. The social PNG renders its editable SVG using the bundled [Manrope font](https://github.com/google/fonts/tree/main/ofl/manrope), licensed under [SIL OFL](../../src/app/fonts/OFL.txt). SVG text falls back to Helvetica/sans-serif if Manrope is unavailable; the PNG preserves the exact typography everywhere.

The favicon and Open Graph card are installed in application metadata. GitHub's separate social preview setting has **not** been changed; social-preview.png is ready for manual upload. GitHub description, topics and homepage are managed separately by the polish workflow.
