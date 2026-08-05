# Canvas 2D Pipeline

Canvas 2D is the first non-GLSL pipeline.

The browser sample uses only the Canvas API:

- ring sweeps
- orbiting glow particles
- scanline mesh
- deterministic date/title seed
- integer-period animation for looping

Daily entries use `"pipeline": "canvas2d"` in `data/drops.json`.

The current site renderer is meant as the live preview. The production path should later add fixed-FPS rendering on the Mac mini for clean MP4 / alpha MOV delivery.
