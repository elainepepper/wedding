# Cinematic landing page fix — 3 August 2026

## What was broken on iPhone/iPad

The story used a very large `preserve-3d` world translated thousands of pixels through a CSS perspective camera. Mobile Safari can cull that parent after it crosses the perspective plane. The sticky stage was also nested inside ancestors using vertical `overflow: hidden/clip`, a long-standing source of sticky failures on iOS.

## What changed

- Replaced the fragile giant-camera transform with an iOS-safe 2.5D chapter engine. The nearest two chapters use only `translate3d`, scale and opacity.
- Preserved scroll scrubbing, illustrated parallax, touch-follow motion, chapter background changes and video scrubbing.
- Added illustrated paper-ribbon previous/next controls for mobile and desktop.
- Removed the modern glass chapter dock while the story landing page is active.
- Added subtle tap sound and supported haptic feedback where the browser permits it.
- Reworked the visual direction toward rough paper, pencil, watercolor, irregular borders and pastel pink/blue storybook art.
- Re-composed all seven chapters using the strongest existing sticker assets.
- Reduced GPU pressure: no giant 3D parent, fewer permanent `will-change` layers, no backdrop blur on the music control, lazy image decoding and metadata-only video preload.
- Added long-lived caching for story artwork while keeping `config.json` uncached.
- Preloaded the two opening illustrations.

## iOS audio rule

Safari does not permit websites to start music with sound before a guest taps a control. The existing music button remains visible and works after a tap. This is a browser privacy rule, not a code defect; trying to bypass it would make playback unreliable.

## Deploy

Upload this complete folder/ZIP to the same Netlify project and trigger a fresh production deploy. Do not copy only `StoryPrologue.tsx`: the fix also changes `globals.css`, `WeddingExperience.tsx`, the story config, layout preloads and Netlify caching headers.

After deployment, test in a Private Safari tab once so an older cached production bundle cannot mask the update.
