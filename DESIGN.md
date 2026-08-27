---
name: SIGMA Fatec
description: Portal institucional da Fatec Ivaiporã para submissão, avaliação e certificação de trabalhos acadêmicos
colors:
  navy-950: "#071d30"
  navy-900: "#0a2c47"
  navy-800: "#0e3a5e"
  navy-700: "#164a72"
  navy-100: "#dbe7ef"
  navy-50: "#f0f5f8"
  orange-600: "#da6d1a"
  orange-500: "#ea741c"
  orange-400: "#f2934f"
  orange-100: "#fce4d1"
  sky-600: "#2376b9"
  sky-100: "#d9edfb"
  ink: "#142433"
  muted: "#5b6b78"
  line: "#e2e8ee"
  background: "#f5f7f9"
typography:
  body:
    fontFamily: "var(--font-poppins), sans-serif"
    fontWeight: 400
  label:
    fontFamily: "var(--font-poppins), sans-serif"
    fontWeight: 600
    fontSize: "0.875rem"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  full: "9999px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.orange-500}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "10px 24px"
  button-primary-hover:
    backgroundColor: "{colors.orange-600}"
  button-secondary:
    backgroundColor: "#ffffff"
    textColor: "{colors.navy-900}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  input:
    backgroundColor: "#ffffff"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  card:
    backgroundColor: "#ffffff"
    rounded: "{rounded.lg}"
    padding: "20px"
---

# Design System: SIGMA Fatec

## Overview

**Creative North Star: "The Institutional Portal"**

SIGMA Fatec is infrastructure, not a product pitch. It exists so the Fatec Ivaiporã events committee can run MAC/MOPI submissions without a spreadsheet, and so a student can see exactly where their work stands. The system reads as official and dependable first, modern second — closer to a government or university records system than a startup dashboard. Navy owns every structural region (hero, header, sidebar) at full institutional strength, never diluted to a pastel tint. Orange is scarce and deliberate: one primary action per screen, nothing more. Sky blue is reserved for secondary links, informational accents, and focus states — it never competes with orange for attention.

The system explicitly rejects generic AI-generated interface tells: no gradients, no glassmorphism, no purple-accent SaaS default, no decorative color for its own sake. Every color carries a role.

**Key Characteristics:**
- Navy-dominant structure, orange as the single scarce accent, sky as the quiet secondary
- Flat cards (border only, no shadow) — shadow is reserved for elevated/interactive elements
- Soft radii throughout (8–16px), never sharp corners, never fully pill-shaped except true pills (badges, avatars)
- Poppins as the only typeface, carrying both institutional formality and screen legibility
- Solid and confiável: components favor clarity and restraint over ornamentation

## Colors

The palette is extracted directly from Fatec Ivaiporã's own institutional site (fatecivaipora.com.br), not invented for the app — it is a brand commitment, not a design choice up for revision without cause.

### Primary
- **Fatec Navy** (`#0e3a5e`, scale 950→50: `#071d30` / `#0a2c47` / `#0e3a5e` / `#164a72` / `#dbe7ef` / `#f0f5f8`): owns every structural region — sidebar background (`navy-900`), hero sections, headers, primary headings (`navy-900`/`navy-800` on white). It is the institution's identity; it never appears as a small accent.

### Secondary
- **Fatec Orange** (`#ea741c`, scale 600→100: `#da6d1a` / `#ea741c` / `#f2934f` / `#fce4d1`): the single call-to-action color. Reserved for the one primary action on a screen — submit, confirm, "Entrar", the active step in a progress trail. **The One Action Rule.** If a screen has two orange buttons, one of them is wrong — demote it to `button-secondary` or `sky`.

### Tertiary
- **Fatec Sky** (`#2376b9` / `sky-100` `#d9edfb`): secondary links, informational badges, focus rings (`focus:border-fatec-sky-600`), and hover states on interactive cards. It signals "you can go here" without competing with orange's "do this now."

### Neutral
- **Ink** (`#142433`): default body text color.
- **Muted** (`#5b6b78`): secondary text, placeholders, captions.
- **Line** (`#e2e8ee`): all borders and dividers — cards, inputs, table rows.
- **Background** (`#f5f7f9`): page background behind white cards/panels.
- **White** (`#ffffff`): card and modal surfaces, sits on top of the background.

### Named Rules
**The One Voice Rule.** Orange appears at most once per screen as a filled background — everywhere else it is text, an icon, or a border tint. Its rarity is what makes it read as an action.

## Typography

**Body & Display Font:** Poppins (weights 400–800), with `sans-serif` fallback — loaded via `next/font/google`, no secondary typeface anywhere in the system.

**Character:** Geometric, rounded letterforms read as approachable but structured — appropriate for an institution that wants to feel modern without feeling informal.

### Hierarchy
- **Headline** (700, `text-xl`/`text-2xl`, tight tracking `-0.01em`): page titles ("Relatórios", "Usuários").
- **Title** (600, `text-base`): card and section headings, modal titles.
- **Body** (400–500, `text-sm`): default UI text, table cells, form labels.
- **Label** (600, `text-xs`–`text-sm`): buttons, badges, nav items, stat captions.

## Layout

Two dominant shells: a **fixed navy sidebar** (`w-64` desktop, slide-over drawer under `md:`) for every authenticated role, and a **centered card** for auth screens (login/cadastro). Content areas use a light `background` (`#f5f7f9`) with white cards floating on top. Grids of cards default to `grid-cols-1 md:grid-cols-2` (2-per-row from tablet up) rather than 3+ columns — density stays low, cards stay legible. Spacing rhythm is generous and consistent: `p-5`/`p-6` card padding, `gap-3`/`gap-4` between siblings, `px-6 md:px-10` page gutters.

## Elevation & Depth

Mostly flat. Cards, tables, and list rows carry a 1px `border-fatec-line` and **no shadow** — depth comes from the border and the white-on-`#f5f7f9` contrast, not from elevation. Shadow is reserved for two cases: primary buttons (a soft tinted glow in the button's own color, e.g. `shadow-md shadow-fatec-orange-500/25`) and modals (`shadow-2xl`, with a `bg-fatec-navy-950/60 backdrop-blur-sm` scrim behind them — the one deliberate blur in the system, confined to modal overlays).

### Shadow Vocabulary
- **Button glow** (`shadow-md shadow-fatec-orange-500/25`): under filled primary buttons only, tinted to match the fill.
- **Modal elevation** (`shadow-2xl`): the modal panel itself, floating above the blurred scrim.

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest — borders carry structure, not shadows. Shadow appears only under something the user is about to press or that has physically lifted above the page (a modal).

## Shapes

Rounded throughout, scaled by role: `rounded-xl` (12px) for buttons, inputs, and nav items; `rounded-2xl` (16px) for cards, panels, and modals; `rounded-lg` (8px) for small icon-only buttons; `rounded-full` for avatars, status dots, and pill badges. No sharp corners anywhere in the system, and no fully-pill buttons — the pill shape is reserved for badges/avatars so it keeps a distinct meaning.

## Components

Solid and confiável: every interactive element has a clear default, hover, and disabled state; nothing floats free of a border or a fill.

### Buttons
- **Shape:** `rounded-xl` (12px).
- **Primary:** `bg-fatec-orange-500` fill, white text, `font-semibold text-sm`, `px-6 py-2.5`–`py-3`, paired shadow glow. **Hover:** `bg-fatec-orange-600`. **Disabled:** `bg-fatec-navy-100 text-fatec-muted`, shadow removed.
- **Secondary/Ghost:** white or transparent fill, `border border-fatec-line`, `text-fatec-navy-900`, hover `bg-fatec-navy-50`. No shadow.
- **Icon-only:** `rounded-lg`, `h-8 w-8`–`h-9 w-9`, transparent until hover (`hover:bg-fatec-navy-50` on light surfaces, `hover:bg-white/10` on navy surfaces).

### Badges / Pills
- **Style:** `rounded-full`, small dot (`h-1.5 w-1.5`) + label, tinted background at ~10% + matching darker text (e.g. `bg-emerald-50 text-emerald-700`). One semantic color family per status; never gray-only for a meaningful state.

### Cards / Containers
- **Corner Style:** `rounded-2xl` (16px).
- **Background:** white on the `#f5f7f9` page background.
- **Shadow Strategy:** none at rest (see Elevation & Depth); an interactive card gets a border-color shift on hover (`hover:border-fatec-sky-600`), never a shadow.
- **Border:** `border border-fatec-line` always present — this is what separates the card from the page, not a shadow.
- **Internal Padding:** `p-5` (20px) standard, `p-6` (24px) for denser content like stat panels.

### Inputs / Fields
- **Style:** white fill, `border border-fatec-line`, `rounded-xl`, `px-4 py-2.5`, `text-sm`.
- **Focus:** border color shifts to `focus:border-fatec-sky-600` — no ring, no glow, just the border.
- **Placeholder:** `text-fatec-muted/70`.

### Navigation (Sidebar)
- **Style:** fixed `bg-fatec-navy-900` panel, white/translucent-white text (`text-fatec-navy-50/70` default, full white when active).
- **Active state:** `bg-white/10 text-white` — a subtle wash, not a colored highlight bar.
- **Hover:** `hover:bg-white/5 hover:text-white`.
- **Mobile:** collapses to a top bar + slide-over drawer (`w-72 max-w-[80vw]`) with a dark scrim.

### Progress Trail (signature component)
Segmented status indicator used on the student's event card (`TrilhaInscricao`): a row of `h-1.5 flex-1 rounded-full` bars, gray by default, colored only up to the current step (red = not registered, yellow = paid, green = work submitted). Communicates pipeline position without a table or a paragraph of status text.

## Do's and Don'ts

### Do:
- **Do** keep orange to one filled button per screen (The One Voice Rule / The One Action Rule).
- **Do** use borders, not shadows, to separate flat surfaces (cards, table rows, list items).
- **Do** reuse the exact extracted hex values for navy/orange/sky — they come from the institution's own site, not from this app.
- **Do** keep radii role-consistent: `rounded-xl` for interactive controls, `rounded-2xl` for containers, `rounded-full` only for pills/avatars/dots.

### Don't:
- **Don't** use gradients anywhere — flat fills only.
- **Don't** use glassmorphism/frosted-glass panels — the one exception is the modal overlay scrim, which is a full-screen dark blur behind an opaque white modal, not a translucent panel itself.
- **Don't** introduce a second typeface. Poppins only.
- **Don't** give cards a shadow at rest — depth reads through the border and background contrast instead.
- **Don't** use a generic purple/violet as an accent — it doesn't exist anywhere in this system.
