# Portfolio — Said Serbouti

## Theme

A gothic-vaudeville / jazz-age playbill identity, built from your own stated
aesthetic affinities (gothic whimsy, jazz-age carnival, fin-de-siècle
vaudeville) rather than a generic dark portfolio look:

- **Palette** — ink-black stage (`#14110d`), an oxblood curtain red, a brass
  marquee gold, and warm parchment text. Defined as CSS variables in
  `css/base.css`.
- **Type** — Fraunces (an ornate display serif with old-style character) for
  headlines and titles, paired with Inter (a clean, highly legible sans) for
  all body text, labels and UI — so the site stays characterful without
  sacrificing readability.
- **Signature shapes** —
  - project cards are styled as **ticket stubs**, with a dashed perforation
    and punched notches between the artwork and the details (`.thumb-tear`)
  - a **marquee rule** (brass line, small bulbs, oxblood line) marks section
    breaks instead of a plain hairline
  - case study covers get brass **corner brackets**, like framed playbill art
  - the homepage hero has a single, restrained curtain-fold texture and a
    soft rise-in animation — the one deliberate motion moment on the site

## Structure

```
index.html                  → Home
pages/
  game-design.html           → Game Design section (carousel + grid)
  narrative-design.html       → Narrative Design section
  other.html                  → Other section
  about.html                  → About Me
  contacts.html                → Contact (with a form)
casestudies/                  → One page per project, case-study structure
css/                           → One file per area (base, layout, sidebar, home, projects, pages)
js/nav.js                      → Sidebar submenu toggles + carousel arrows
images/                        → Generated placeholders, TO REPLACE with real screenshots/gifs
assets/                        → Put your CV PDF here
```

## Before you publish

1. **Images** — everything in `images/` is a generated placeholder (a framed
   card with a label, in the site's palette). Swap in real screenshots/gifs
   under the same filename, or update the `src` path in the HTML.
2. **CV** — add your CV as `assets/cv-said-serbouti.pdf` (the "Download CV"
   buttons already point there).
3. **Contact info** — in `pages/contacts.html`, replace the placeholder
   email and the LinkedIn / itch.io links with your real ones.
4. **"Other" case studies** (Il Tratto, Blood Tree, Wolverine, Morocco Short
   Film) are shorter because those projects are still at concept stage —
   feel free to expand them as the work develops.
5. The contact form is client-side only (it shows "Message sent" on submit
   without actually sending anything). Wire it to something like Formspree
   or a backend if you want it to work for real.

## Adding a screenshot/gif to a case study gallery

In any case study's `.cs-gallery` block, replace:
```html
<div class="cs-gallery-img"><span>Placeholder description</span></div>
```
with:
```html
<div class="cs-gallery-img"><img src="../images/file-name.gif" alt="Description"></div>
```
