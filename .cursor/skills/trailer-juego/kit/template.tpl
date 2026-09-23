<!DOCTYPE html>
<html lang="es" data-resolution="landscape">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width={{W}}, height={{H}}">
    <title>{{TITLE}}</title>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      /* Plantilla de trailer — generada por build.py (no editar index.html). */
      @font-face { font-family: "Pixel"; src: url("fonts/pixelify-sans.woff2") format("woff2"); font-weight: 400 700; font-display: block; }

      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: {{W}}px; height: {{H}}px; overflow: hidden; background: #000; }
      body { font-family: "Pixel", monospace; color: #faf3e1; }
      #root { position: relative; width: {{W}}px; height: {{H}}px; overflow: hidden; background: #000; }

      /* Tomas: el juego ya viene escalado sin suavizar; el zoom mueve el marco interior. */
      #stage { position: absolute; inset: 0; }
      .shot { position: absolute; inset: 0; overflow: hidden; }
      .inner { position: absolute; inset: 0; transform-origin: 50% 50%; will-change: transform; }
      .inner video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; image-rendering: pixelated; }

      /* Viñeta suave para dar aire de cine sin tapar el pixel art. */
      .vignette { position: absolute; inset: 0; pointer-events: none;
        background: radial-gradient(ellipse 75% 70% at 50% 50%, rgba(0,0,0,0) 55%, rgba(8,6,12,0.55) 100%); }

      /* Texto grande entre tomas: pixel, con contorno duro y sombra. */
      .caption { position: absolute; left: 0; right: 0; top: 400px; text-align: center; font-weight: 700; font-size: 150px; letter-spacing: 0.06em;
        color: #fff5c1; will-change: transform, opacity;
        text-shadow: 6px 0 #1b1422, -6px 0 #1b1422, 0 6px #1b1422, 0 -6px #1b1422, 6px 6px #1b1422, -6px 6px #1b1422, 6px -6px #1b1422, -6px -6px #1b1422, 0 14px 0 rgba(27,20,34,0.6); }

      /* Cierre: logo del juego, lema y llamado. */
      .cap-in { display: inline-block; will-change: transform, opacity; }
      .title { position: absolute; inset: 0; }
      .t-box { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
      .title .veil { position: absolute; inset: 0; background: radial-gradient(ellipse 70% 60% at 50% 45%, rgba(18,14,23,0.35), rgba(18,14,23,0.85)); }
      .title .logo { position: relative; width: 1308px; image-rendering: pixelated; will-change: transform, opacity; }
      .title .logo-text { position: relative; font-size: 190px; font-weight: 700; letter-spacing: 0.08em; color: #fff5c1; will-change: transform, opacity;
        text-shadow: 8px 0 #1b1422, -8px 0 #1b1422, 0 8px #1b1422, 0 -8px #1b1422, 8px 8px #1b1422, -8px 8px #1b1422, 8px -8px #1b1422, -8px -8px #1b1422, 0 18px 0 rgba(27,20,34,0.6); }
      .title .tagline { position: relative; margin-top: 40px; font-size: 54px; color: #f7df6f;
        text-shadow: 4px 0 #1b1422, -4px 0 #1b1422, 0 4px #1b1422, 0 -4px #1b1422, 4px 4px #1b1422; }
      .title .cta { position: relative; margin-top: 70px; font-size: 64px; font-weight: 700; letter-spacing: 0.3em; color: #faf3e1;
        text-shadow: 4px 0 #1b1422, -4px 0 #1b1422, 0 4px #1b1422, 0 -4px #1b1422, 4px 4px #1b1422; }

      #flash { position: absolute; inset: 0; background: #fff5e0; opacity: 0; pointer-events: none; }
      #dip { position: absolute; inset: 0; background: #000; opacity: 0; pointer-events: none; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{{TOTAL}}" data-width="{{W}}" data-height="{{H}}" data-fps="{{FPS}}">
      <div id="stage">
{{CLIPS}}
      </div>
      <div class="vignette"></div>
{{CAPTIONS}}
{{TITLECARD}}
      <div id="flash"></div>
      <div id="dip"></div>
{{AUDIO}}
    </div>
    <script>
      const tl = gsap.timeline({ paused: true });
{{JS}}
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
