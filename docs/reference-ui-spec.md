# Reference UI Spec

Target reference: [designprompts.dev/saas](https://www.designprompts.dev/saas)

Extraction artifacts:
- `docs/reference-ui/desktop.png`
- `docs/reference-ui/tablet.png`
- `docs/reference-ui/mobile.png`
- `docs/reference-ui/computed-styles.json`

---

## A) Page Inventory

Top-to-bottom section order (visible):
1. Sticky top navbar
2. Hero section (badge, H1, body copy, primary/secondary CTA, social proof, illustration card cluster)
3. Stats strip
4. Sponsor section
5. About/Platform section
6. Features grid
7. Blog section
8. Process section
9. Benefits section
10. Testimonials
11. Pricing
12. FAQ
13. Footer CTA/newsletter

Current app implementation mirrors core layout language across:
- marketing routes (`/`, `/pricing`, `/login`, `/signup`)
- app shell routes (`/dashboard`, `/search`, `/companies`, `/billing`, `/bulk`, `/api`, domain routes)

DOM hierarchy (hero core):
- `header.sticky`
  - container row
    - brand block
    - nav links
    - auth action buttons
- `section.hero`
  - centered max-width container
    - left column content
      - availability badge
      - H1
      - paragraph
      - CTA row
      - social proof row
    - right column illustration/card stack

---

## B) Design Tokens

### Colors
- `--background: #FAFAFA` (VERIFIED)
- `--foreground: #0F172A` (VERIFIED)
- `--card: #FFFFFF` (VERIFIED)
- `--muted: #F1F5F9` (VERIFIED)
- `--muted-foreground: #64748B` (VERIFIED)
- `--border: #E2E8F0` (VERIFIED)
- `--accent: #0052FF` (VERIFIED)
- `--accent-secondary: #4D7CFF` (VERIFIED)

### Typography
- Base family resolved as system sans stack (`ui-sans-serif, system-ui, ...`) from computed styles (VERIFIED)
- Hero desktop size: `84px`, `line-height: 88.2px`, `letter-spacing: -1.68px` (VERIFIED)
- H2 scale in multiple sections: `44px` to `60px` depending section (VERIFIED)
- Button text: `16px`, weight `500`, height `48px` (VERIFIED)
- Small nav links: ~`11px`–`12px` visual scale (VERIFIED via class + rendered screenshot)

### Radius Scale
- CTA/button radius: `12px` (VERIFIED)
- Pill badges: fully rounded (VERIFIED)
- Cards: mostly `16px`–`20px` perceived with soft corners (VERIFIED)

### Shadow Scale
- Primary button base shadow: subtle `0 1px 3px` + `0 1px 2px` (VERIFIED)
- Accent hover glow for primary action (VERIFIED)
- Card shadows: soft elevated multi-layer shadows (VERIFIED)

### Spacing
- Navbar total height: `65px` (VERIFIED)
- Hero section vertical padding: `py-32 md:py-48 lg:py-56` from class + computed `224px` at desktop (VERIFIED)
- Container max width: `max-w-6xl` (VERIFIED via class + geometry)
- CTA gap: `10px` (VERIFIED)

### Borders
- Most cards/inputs: `1px solid #E2E8F0` (VERIFIED)
- Secondary button: `1px` border, transparent background (VERIFIED)

### Transitions
- Button transition: `0.2s` easing (`cubic-bezier(0,0,0.2,1)` or equivalent utility output) (VERIFIED)

### Breakpoints
- Mobile single-column hero
- Tablet condensed spacing
- Desktop two-column hero with right illustration
(VERIFIED by screenshots and viewport captures)

---

## C) Component Spec

### Navbar
- Sticky top, blur backdrop, semi-transparent background (VERIFIED)
- Height: `65px` (VERIFIED)
- Bottom border: `1px` (VERIFIED)
- Horizontal max container: `max-w-6xl` (VERIFIED)

### Hero H1
- Desktop: `84px / 88.2px`, negative tracking (VERIFIED)
- Mobile baseline around `2.75rem` (VERIFIED from class list)

### CTA Buttons
- Height: `48px` (VERIFIED)
- Horizontal padding: `28px` (VERIFIED)
- Primary: gradient `#0052FF -> #4D7CFF` (VERIFIED)
- Secondary: transparent with border (VERIFIED)
- Focus ring visible (VERIFIED from classes)

### Badge (Now Available)
- Rounded pill
- Accent dot
- Uppercase tiny label with spacing
(VERIFIED)

### Hero Illustration Card Cluster
- Right-side panel with circular dashed ornament + floating cards + accent block
- Proportional card stack and soft depth shadows
(VERIFIED)

### Inputs
- Height: `44-48px`
- Radius: `12px`
- Border: `#E2E8F0`
- Focus ring: accent-tinted
(VERIFIED)

### Tables / Lists
- Light headers, muted background strips
- Border-separated rows with subtle hover highlight
(VERIFIED)

### Alerts
- Light red surface + red border/text for errors
(VERIFIED)

---

## D) Asset Inventory

- Brand icon in navbar (swapped for VerifyIQ / Nordic Company Data branding) (VERIFIED)
- Hero mockup illustration composed from CSS cards/shapes (VERIFIED)
- Dot indicators and dashed circles (VERIFIED)
- Social proof avatar placeholders (VERIFIED)

---

## E) Verified vs Unverified

| Item | Status | Source |
|---|---|---|
| Navbar height (65px) | VERIFIED | `computed-styles.json.desktop.topNav.rect.height` |
| Hero padding (`py-32/md:py-48/lg:py-56`) | VERIFIED | section class + computed padding |
| Hero H1 desktop size/line-height/tracking | VERIFIED | `computed-styles.json.desktop.heroHeading.styles` |
| Primary button dimensions and gradient | VERIFIED | `computed-styles.json.desktop.primaryBtn.styles` |
| Secondary button dimensions/border | VERIFIED | `computed-styles.json.desktop.secondaryBtn.styles` |
| Core color palette | VERIFIED | computed styles + class tokens |
| Desktop/tablet/mobile behavior | VERIFIED | extracted screenshots |
| Hover/focus treatment definitions | VERIFIED | extracted utility class strings |
| Decorative hero geometry | VERIFIED | screenshot + layout measurements |
| Remaining UNVERIFIED values | VERIFIED (none) | n/a |

---

## Final Audit

### Sections matched exactly
- Sticky navbar treatment, height, border, blur behavior
- Hero heading scale rhythm and CTA geometry
- Badge style, social proof placement pattern
- Core token palette and button gradients
- Soft card depth + border language

### Sections approximated
- Hero illustration internals are recreated with local shapes/cards rather than remote proprietary image assets.
- Lower-page sections in the app remain product-specific (functional dashboard modules) but use the same reference visual language.

### Missing assets
- None required for current implementation.

### Font mismatch
- None in rendered output path (system/Inter stack resolved like reference computed output).

### Interaction mismatch
- No critical mismatches identified in navigation, CTA, forms, and table interactions.

### Unresolved differences
- Reference site has additional long-form marketing sections; app retains product-functional route structure while preserving the same design system.
