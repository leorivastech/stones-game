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

      /* Viñeta y un leve tono cálido de cine, sin tapar el pixel art. */
      .vignette { position: absolute; inset: 0; pointer-events: none;
        background: radial-gradient(ellipse 78% 72% at 50% 50%, rgba(0,0,0,0) 55%, rgba(8,6,12,0.6) 100%); }
      .grade { position: absolute; inset: 0; pointer-events: none; background: linear-gradient(180deg, rgba(40,20,60,0.10), rgba(0,0,0,0) 40%, rgba(60,30,10,0.10)); mix-blend-mode: multiply; }

      /* Barras de cine (se abren en los momentos grandes). */
      .lb { position: absolute; left: 0; right: 0; height: 0; background: #000; pointer-events: none; }
      #lb-top { top: 0; } #lb-bot { bottom: 0; }

      /* Texto grande: palabra en pixel, contorno duro, sombra; arriba un rótulo chico. */
      .caption { position: absolute; left: 0; right: 0; top: 150px; text-align: center; }
      .cap-in { display: inline-flex; flex-direction: column; align-items: center; will-change: transform, opacity; }
      .cap-word { font-weight: 700; font-size: 160px; letter-spacing: 0.06em; color: #fff5c1; line-height: 1;
        text-shadow: 7px 0 #1b1422, -7px 0 #1b1422, 0 7px #1b1422, 0 -7px #1b1422, 7px 7px #1b1422, -7px 7px #1b1422, 7px -7px #1b1422, -7px -7px #1b1422, 0 16px 0 rgba(27,20,34,0.65); }
      .kicker { font-size: 44px; letter-spacing: 0.35em; color: #f7df6f; margin-bottom: 18px; padding: 6px 22px 8px 30px; background: rgba(18,14,23,0.82);
        text-shadow: 4px 0 #1b1422, -4px 0 #1b1422, 0 4px #1b1422, 0 -4px #1b1422, 4px 4px #1b1422, -4px -4px #1b1422; }

      /* Rótulo del pueblo: abajo a la izquierda, con la gema de su piedra. */
      .lower { position: absolute; left: 90px; bottom: 120px; }
      .lower-in { display: flex; align-items: center; gap: 26px; padding: 18px 40px 18px 22px; will-change: transform, opacity;
        background: linear-gradient(90deg, rgba(27,20,34,0.92), rgba(27,20,34,0.72) 70%, rgba(27,20,34,0)); border-left: 8px solid #e6b736; }
      .lower .gem { width: 88px; height: 88px; image-rendering: pixelated; will-change: transform; }
      .lower-name { font-size: 78px; font-weight: 700; color: #fff5c1; line-height: 1;
        text-shadow: 5px 0 #1b1422, -5px 0 #1b1422, 0 5px #1b1422, 0 -5px #1b1422; }
      .lower-sub { font-size: 36px; color: #f7df6f; margin-top: 8px; letter-spacing: 0.08em; }

      /* Tarjeta: texto solo sobre negro. */
      .card { position: absolute; inset: 0; background: #07050a; display: flex; align-items: center; justify-content: center; }
      .card-in { display: flex; flex-direction: column; align-items: center; will-change: transform, opacity; }
      .card-text { font-size: 104px; font-weight: 700; letter-spacing: 0.08em; color: #faf3e1; text-align: center; max-width: 1600px; line-height: 1.1;
        text-shadow: 0 10px 0 rgba(140, 94, 19, 0.55); }

      /* Cierre: rayos, logo, lema, llamado, créditos. */
      .title { position: absolute; inset: 0; }
      .t-box { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
      .title .veil { position: absolute; inset: 0; background: radial-gradient(ellipse 70% 60% at 50% 45%, rgba(18,14,23,0.35), rgba(18,14,23,0.9)); }
      .rays { position: absolute; left: 50%; top: 42%; width: 2600px; height: 2600px; margin: -1300px 0 0 -1300px; opacity: 0;
        background: repeating-conic-gradient(from 0deg, rgba(230,183,54,0.20) 0deg 7deg, rgba(230,183,54,0) 7deg 20deg);
        -webkit-mask-image: radial-gradient(circle, #000 0%, rgba(0,0,0,0.6) 30%, transparent 62%); mask-image: radial-gradient(circle, #000 0%, rgba(0,0,0,0.6) 30%, transparent 62%); }
      .title .logo { position: relative; width: 1308px; image-rendering: pixelated; will-change: transform, opacity; }
      .title .logo-text { position: relative; font-size: 190px; font-weight: 700; letter-spacing: 0.08em; color: #fff5c1; will-change: transform, opacity;
        text-shadow: 8px 0 #1b1422, -8px 0 #1b1422, 0 8px #1b1422, 0 -8px #1b1422, 8px 8px #1b1422, -8px 8px #1b1422, 8px -8px #1b1422, -8px -8px #1b1422, 0 18px 0 rgba(27,20,34,0.6); }
      .title .tagline { position: relative; margin-top: 40px; font-size: 56px; color: #f7df6f; letter-spacing: 0.06em;
        text-shadow: 4px 0 #1b1422, -4px 0 #1b1422, 0 4px #1b1422, 0 -4px #1b1422, 4px 4px #1b1422; }
      .title .cta { position: relative; margin-top: 64px; font-size: 66px; font-weight: 700; letter-spacing: 0.3em; color: #faf3e1;
        text-shadow: 4px 0 #1b1422, -4px 0 #1b1422, 0 4px #1b1422, 0 -4px #1b1422, 4px 4px #1b1422; }
      .title .credits { position: absolute; bottom: 44px; left: 0; right: 0; text-align: center; font-size: 26px; color: #b9ab98; letter-spacing: 0.04em; opacity: 0; }

      #flash { position: absolute; inset: 0; background: #fff5e0; opacity: 0; pointer-events: none; }
      #dip { position: absolute; inset: 0; background: #000; opacity: 0; pointer-events: none; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{{TOTAL}}" data-width="{{W}}" data-height="{{H}}" data-fps="{{FPS}}">
      <div id="stage">
{{CLIPS}}
      </div>
      <div class="grade"></div>
      <div class="vignette"></div>
{{CAPTIONS}}
{{TITLECARD}}
      <div id="lb-top" class="lb"></div>
      <div id="lb-bot" class="lb"></div>
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
