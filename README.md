# martinjason.com

Personal site for Jason Martin — AI Product Gallery Designer · DACH · DTC.

Plain HTML/CSS/JS. No build step. Deployed via GitHub Pages on `martinjason.com`.

## Files

- `index.html` — content & structure
- `styles.css` — design tokens, layout, glass surfaces, animations
- `script.js` — reveal-on-scroll, hero parallax, year stamp
- `CNAME` — custom domain for GitHub Pages
- `01_strategic_plan.md` — internal planning doc (not linked from site)

## Preview locally

From this folder, run any of:

```bash
# Python (built-in on macOS)
python3 -m http.server 5173

# OR Node (if you have it)
npx serve .
```

Then open <http://localhost:5173>.

## Deploy

GitHub Pages serves from this folder's branch. To ship a change:

```bash
git add .
git commit -m "describe the change"
git push
```

Pages typically updates within ~30 seconds.

## Theming

All colors, spacing, type scale, and motion live as CSS custom properties in
`styles.css` under the `:root { ... }` block at the top. Change a token there
and the whole site re-themes — no other edits needed.

Common tweaks:

- **Accent color** → `--color-accent` (currently iOS blue `#0A84FF`)
- **Page background** → `--color-bg` (warm off-white `#F7F5F1`)
- **Glass strength** → `--glass-blur` and `--glass-saturation`
- **Animation speed** → `--dur-fast` / `--dur-base` / `--dur-slow`

## Swapping the hero background to a video

Replace the `.bg-blobs` element in `index.html` with:

```html
<video class="bg-video" autoplay muted loop playsinline poster="assets/hero-poster.jpg">
  <source src="assets/hero.mp4" type="video/mp4" />
</video>
```

And add to `styles.css` (inside the `.bg` rule area):

```css
.bg-video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
```

The grain layer (`.bg-grain`) keeps adding texture on top.
