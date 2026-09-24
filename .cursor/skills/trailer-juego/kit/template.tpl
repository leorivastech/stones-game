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
      .caption { position: absolute; left: 0; right: 0; top: 110px; padding: 40px 0 60px; text-align: center;
        background: radial-gradient(ellipse 42% 58% at 50% 55%, rgba(12,9,16,0.72), rgba(12,9,16,0.35) 55%, rgba(12,9,16,0) 100%); }
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
      .title .logo { position: relative; width: 100%; image-rendering: pixelated; will-change: transform, opacity; }
      .title .logo-text { position: relative; font-size: 190px; font-weight: 700; letter-spacing: 0.08em; color: #fff5c1; will-change: transform, opacity;
        text-shadow: 8px 0 #1b1422, -8px 0 #1b1422, 0 8px #1b1422, 0 -8px #1b1422, 8px 8px #1b1422, -8px 8px #1b1422, 8px -8px #1b1422, -8px -8px #1b1422, 0 18px 0 rgba(27,20,34,0.6); }
      .title .tagline { position: relative; margin-top: 40px; font-size: 56px; color: #f7df6f; letter-spacing: 0.06em;
        text-shadow: 4px 0 #1b1422, -4px 0 #1b1422, 0 4px #1b1422, 0 -4px #1b1422, 4px 4px #1b1422; }
      .title .cta { position: relative; margin-top: 64px; font-size: 66px; font-weight: 700; letter-spacing: 0.3em; color: #faf3e1;
        text-shadow: 4px 0 #1b1422, -4px 0 #1b1422, 0 4px #1b1422, 0 -4px #1b1422, 4px 4px #1b1422; }
      .title .credits { position: absolute; bottom: 44px; left: 0; right: 0; text-align: center; font-size: 26px; color: #b9ab98; letter-spacing: 0.04em; opacity: 0; }


      /* Letras sueltas (caen una por una). */
      .ch { display: inline-block; will-change: transform, opacity; }
      .ch.sp { width: 0.38em; }

      /* Tomas partidas: varios videos a la vez en paneles inclinados. */
      .split { background: #07050a; }
      .panel { position: absolute; inset: 0; overflow: hidden; will-change: transform; }
      .panel .p-inner { position: absolute; inset: 0; }
      .panel video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; image-rendering: pixelated; }
      .p-label { position: absolute; bottom: 150px; transform: translateX(-50%); font-size: 64px; font-weight: 700; color: #fff5c1; white-space: nowrap;
        padding: 4px 22px 8px; background: rgba(18,14,23,0.82); border-bottom: 6px solid #e6b736;
        text-shadow: 4px 0 #1b1422, -4px 0 #1b1422, 0 4px #1b1422, 0 -4px #1b1422; }

      /* Palabras en orden, al centro, grandes. */
      .words { position: absolute; inset: 0; display: flex; align-items: flex-start; justify-content: center; padding-top: 130px; perspective: 900px; }
      .w-in { display: flex; flex-direction: column; align-items: center; gap: 18px; }
      .w-line { font-size: 150px; font-weight: 700; color: #fff5c1; line-height: 1; letter-spacing: 0.04em;
        text-shadow: 7px 0 #1b1422, -7px 0 #1b1422, 0 7px #1b1422, 0 -7px #1b1422, 7px 7px #1b1422, -7px 7px #1b1422, 7px -7px #1b1422, -7px -7px #1b1422, 0 16px 0 rgba(27,20,34,0.65); }
      .w-line.w1 { color: #ff5a4e; }

      /* Sello rojo que cae de golpe. */
      .stamp { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; padding-top: 330px; }
      .stamp-in { font-size: 140px; font-weight: 700; letter-spacing: 0.12em; color: #ff3b3b; padding: 10px 50px 18px; border: 14px solid #ff3b3b;
        background: rgba(40,6,10,0.7); text-shadow: 0 8px 0 rgba(0,0,0,0.5); will-change: transform, opacity; }

      /* Contador (deuda) arriba a la derecha. */
      .counter { position: absolute; right: 100px; top: 110px; }
      .count-in { text-align: right; padding: 16px 34px 20px; background: rgba(18,14,23,0.86); border-right: 10px solid #ff5a4e; will-change: transform, opacity; }
      .count-label { font-size: 42px; letter-spacing: 0.3em; color: #f7df6f; }
      .count-num { font-size: 150px; font-weight: 700; color: #ff5a4e; line-height: 1.15; margin-top: 12px; transform-origin: 100% 50%;
        text-shadow: 6px 0 #1b1422, -6px 0 #1b1422, 0 6px #1b1422, 0 -6px #1b1422; }

      /* Cinta de precios, como la bolsa. */
      .ticker { position: absolute; left: 0; right: 0; bottom: 0; height: 104px; background: rgba(12,9,16,0.92); border-top: 5px solid #e6b736; overflow: hidden; }
      .t-track { position: absolute; left: 0; top: 0; height: 100%; display: flex; align-items: center; white-space: nowrap; will-change: transform; }
      .t-cell { display: inline-flex; align-items: center; gap: 14px; font-size: 50px; color: #faf3e1; margin-right: 70px; }
      .t-cell img { width: 62px; height: 62px; image-rendering: pixelated; }
      .t-cell b { color: #fff5c1; }
      .t-cell .up { color: #6ee06a; } .t-cell .dn { color: #ff5a4e; }

      /* Gemas en fila bajo una tarjeta. */
      .c-gems { display: flex; gap: 60px; margin-top: 60px; }
      .c-gem { width: 150px; height: 150px; image-rendering: pixelated; will-change: transform, opacity; }

      /* Cierre: anillo de choque, esquirlas, barrido de luz en el logo. */
      .ring { position: absolute; left: 50%; top: 45%; width: 220px; height: 220px; margin: -110px 0 0 -110px; border-radius: 50%;
        border: 10px solid rgba(255,240,190,0.9); opacity: 0; }
      .shard { position: absolute; left: 50%; top: 45%; width: 150px; height: 150px; margin: -75px 0 0 -75px; image-rendering: pixelated; opacity: 0; }
      .logo-wrap { position: relative; width: 1308px; will-change: transform, opacity; }
      .logo-wrap .logo { display: block; }
      .sweep-mask { position: absolute; inset: 0; -webkit-mask-size: 100% 100%; mask-size: 100% 100%; overflow: hidden; }
      .sweep { position: absolute; top: -20%; left: 50%; width: 260px; height: 140%; margin-left: -130px; transform: skewX(-20deg);
        background: linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,240,0.85), rgba(255,255,255,0)); }

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
