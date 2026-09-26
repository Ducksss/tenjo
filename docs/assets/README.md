# Tenjō presentation assets

The Capsule palette is plum (`#481427`), tangerine (`#EF5E36`), lime (`#D2DD5C`), periwinkle (`#D1DCFA`), forest (`#2B6D36`) and oat/cream grounds (`#EFEAE0`, `#F9EDE2`, paper `#F8F3EB`). Headlines use Space Grotesk and body text uses Geist. The stylised 天 mark sits on a tangerine tile. The capsule machine, whose dome holds up to six chances, is the signature illustration. The full rationale and the Kidrise (Nurtiva) reference are in [DESIGN.md](../../DESIGN.md#reference-taste-kidrise-nurtiva).

| File                                               | Size         | Purpose                                                                |
| -------------------------------------------------- | ------------ | ---------------------------------------------------------------------- |
| [logo.svg](logo.svg)                               | 80 × 80      | Compact 天 mark on the tangerine tile                                  |
| [wordmark.svg](wordmark.svg)                       | 360 × 100    | Tile and wordmark on paper                                             |
| [social-preview.png](social-preview.png)           | 1280 × 640   | README hero and Open Graph card; source in social-preview.html         |
| [social-preview.html](social-preview.html)         | 1280 × 640   | Editable card source (loads Space Grotesk and Geist from Google Fonts) |
| [favicon.svg](favicon.svg)                         | 80 × 80      | Same mark installed as src/app/icon.svg                                |
| [discover-desktop.png](discover-desktop.png)       | 1440 px wide | Actual first-visit discovery page                                      |
| [discover-mobile.png](discover-mobile.png)         | 390 px wide  | Actual mobile discovery page                                           |
| [walkthrough-desktop.png](walkthrough-desktop.png) | 1440 px wide | Scripted browser-only walkthrough after example entry                  |
| [walkthrough-mobile.png](walkthrough-mobile.png)   | 390 px wide  | Same example entry on mobile                                           |
| [drop-desktop.png](drop-desktop.png)               | 1440 px wide | Real local test-identity drop and public record                        |
| [drop-mobile.png](drop-mobile.png)                 | 390 px wide  | Same local drop on mobile                                              |
| [diagram-flow.svg](diagram-flow.svg)               | 760 × 508    | README flow from entry to pickup                                       |
| [diagram-system.svg](diagram-system.svg)           | 760 × 400    | README map of how the pieces connect                                   |
| [diagram-entry.svg](diagram-entry.svg)             | 760 × 704    | README decision tree for entry, in code order                          |
| [diagram-pickup.svg](diagram-pickup.svg)           | 760 × 704    | README decision tree for pickup, in code order                         |

The four diagrams are plain SVG in the palette above, drawn from the shared PRD and the checks in `src/lib/service.ts` and `src/lib/world.ts`. Edit them directly, and update them when those checks change.

Screenshots come from the running Next.js app. Discovery and walkthrough captures use an empty or seeded local database; drop captures use labelled local test identities. They contain no real World proofs, personal details or real-money transactions. The capsule machine, capsules and console art are original SVG and CSS; none of the screenshots is a generated mockup.

Vector marks and illustrations are original project artwork, with no stock photography or third-party logos. Space Grotesk and Geist are SIL OFL fonts, self-hosted by `next/font/google` at build time.

The favicon and Open Graph card are installed in application metadata. GitHub's separate social preview setting has **not** been changed; social-preview.png is ready for manual upload.
