# Diseño del mundo completo — Stones

Estado: **diseño cerrado para la muestra completa** (5 pueblos, 4 rutas, barca). 2026-09-23.
Pedido de Leo: hacer todas las ciudades, meter lo que le dé valor (herrero que te arma un sistema
para guardar, escondites en los caminos tipo base secreta de Pokémon, caballo, arquero) y dejar
analizado cómo funciona todo — economía y piedras incluidas — para que tenga sentido.

## 1. La idea en una frase

Las cinco piedras forman **un círculo alrededor del golfo**: cada pueblo produce la piedra que
necesita el siguiente. El negocio es dar vueltas al golfo, y cada vuelta se complica o se facilita
según cómo te prepares (caballo, alijos, escolta, fondo falso, tónicos) y cuánto calor levantes.

```
            Valkeep ──Ruta 2── Verdelume
          (montaña)  Paso Alto  (selva)
              │                     │
           Ruta 1                 Ruta 3
      Calzada del Ámbar      Selva del Tránsito
              │                     │
           Ashfen                Duneshade
          (campos)               (desierto)
              │                     │
              └─ barca ─ GOLFO ─ Ruta 4 ─ Frostholm
                                Paso del Hielo  (nieve)
```

## 2. Las piedras y por qué el orden

| Pueblo | Produce | Precio base | Necesita | Paga base | Margen base |
|---|---|---:|---|---:|---:|
| Ashfen | Ámbar de sello | 8 | Cristal de escarcha | 40 | — |
| Valkeep | Vidrio rúnico | 12 | Ámbar | 17 | ámbar +9 |
| Verdelume | Perla de lluvia | 15 | Vidrio rúnico | 26 | rúnico +14 |
| Duneshade | Piedra solar | 18 | Perla de lluvia | 32 | perla +17 |
| Frostholm | Cristal de escarcha | 22 | Piedra solar | 39 | solar +21 |
| (barca) | | | | | escarcha +18 |

El ámbar es barato y de poco margen: es la piedra de **aprender** (se compran 2–3 con los 40 de
oro del inicio). Cada paso del círculo vale más. La escarcha cierra el círculo en Ashfen, así que
**la barca Frostholm ↔ Ashfen es obligatoria**: sin ella, volver de Frostholm son cuatro rutas a pie.

## 3. Reglas del mercado (ajustadas con simulación)

Simulé el círculo completo con las reglas de `state.js` (script en la sesión del 2026-09-23).
Con las reglas viejas **el caballo no servía**: cada pueblo compraba 4 y el precio caía 3 por
unidad, así que con 4 o con 6 lugares se ganaba exactamente lo mismo.

| Regla | Antes | Ahora | Por qué |
|---|---:|---:|---|
| Existencias máximas por pueblo | 5 | **8** | que haya para llenar un caballo |
| Pedido máximo por pueblo | 4 | **6** | ídem |
| Sube el precio por cada compra | +2 | **+1** | comprar volumen no se come todo el margen |
| Baja el pago por cada venta | −3 | **−2** | vender 6 sigue siendo negocio en piedras caras |
| Se recupera por viaje (otros pueblos) | +1 | **+2** | una vuelta al golfo (5 viajes) repone casi todo |
| Calor por venta / por compra | +6 / +2 | **+5 / +1** | con volumen, el calor no se come la ganancia |

Resultado simulado (3 vueltas, sin robos ni sobornos):

| Carga | Patrimonio vuelta 1 → 2 → 3 | Piedras vendidas | Calor máximo |
|---|---|---:|---:|
| 4 (a pie) | 206 → 432 → 658 | 53 | ~30 |
| 6 (caballo) | 217 → 472 → 720 | 70 | ~45 |
| 8 | igual que 6 | 70 | ~45 |

Lectura: el caballo da **~10 % más por vuelta y 30 % más volumen**, y más calor. Más de 6 no
sirve (el pedido es 6): el techo de volumen es el caballo; lo demás son mejoras de **seguridad**.
Lo que el simulador no cuenta (sobornos, confiscaciones, robos, K.O.) es justo lo que pagan los
alijos, la escolta y el fondo falso.

## 4. Riesgo en el camino

| Amenaza | Dónde | Qué te quita | Cómo se evita |
|---|---|---|---|
| Guardia en patrulla | calzadas de las 4 rutas | revisión: confiscan lo visible, o soborno | esconderse (agachado en pasto), no cruzar su cono, fondo falso |
| Retén | Ruta 1 (calzada), Ruta 2 (aduana del paso), Ruta 4 (puerta de la escarcha) | igual | rodear por el camino alterno de cada ruta |
| Bandido | campamentos y emboscadas en pasto | te tumba una piedra y huye con ella | pelear, arquera, caballo |
| Jabalí / lobo | pradera y montaña / nieve | vida | esquivar la embestida, que se estrelle |
| Escorpión | desierto | vida (se esconde en la arena) | mirar dónde tiembla la arena |
| K.O. | cualquier parte | mitad de la carga y 20 % del oro | tónicos, alijos (lo guardado no se pierde) |
| Redada de alijo | ruta con calor ≥ 60 | lo guardado en ese alijo | no calentar la zona, repartir alijos |

**Calor**: sube al comerciar y al pelear con la Corona, baja al viajar. Con calor alto hay más
patrullas (una extra desde 20 y otra desde 45), ven 20 % más lejos (desde 45), sube el soborno y
pueden encontrar tus alijos (desde 60).

## 5. Qué ofrece cada pueblo (cada uno tiene un porqué para volver)

| Pueblo | Mercado | Servicio | Qué da |
|---|---|---|---|
| Ashfen | ámbar ↔ escarcha | **Herrero Oskar**: *herrajes de alijo* (fama 3, 40 oro) y *fondo falso* (fama 14, 240) | poder guardar piedras en los caminos; 2 ocultas a la Corona |
| Valkeep | rúnico ↔ ámbar | **Establo de Nella**: caballo (fama 4, 90) | +2 carga, 10 % más rápido, salva piedras de los bandidos |
| Verdelume | perla ↔ rúnico | **Curandera Ama**: tónicos de raíz (12 oro, máx. 3) | con Q recuperas 2 corazones en plena pelea |
| Duneshade | solar ↔ perla | **Arquera Sahra**: escolta (fama 8, 150) | te sigue en las rutas y le dispara a bandidos y bestias; salva piedras |
| Frostholm | escarcha ↔ solar | **Barquero Ceno**: cruce del golfo (15 oro) | Frostholm ↔ Ashfen sin ruta; cierra el círculo |

La barca de Ashfen sólo sale **después de conocer a Ceno en Frostholm**: la primera vuelta se
camina entera.

## 6. Alijos (el "sistema de guardado")

La idea de Leo: el herrero te arma algo para guardar cosas, y en el campo hay escondites como las
bases secretas de Pokémon.

- En cada ruta hay **huecos marcados**: tronco hueco (bosque/selva), roca partida (montaña,
  desierto) y grieta en la nieve. Sin herrajes sólo dicen "aquí cabría un alijo".
- Con los **herrajes del herrero** (fama 3, 40 oro) cada hueco se vuelve tu **alijo**: guardas o
  sacas piedras (hasta 6 por alijo) con ← →.
- Lo guardado **no se pierde** en K.O., robos ni revisiones, y no ocupa carga.
- Para qué sirve: dejar lo que sobra cuando el pedido de un pueblo se agotó, comprar barato ahora y
  vender en la vuelta siguiente, y no cruzar un retén con todo encima.
- Riesgo: si el calor de esa ruta llega a 60, al entrar puede haber **redada** y la Corona se lleva
  lo de un alijo. El cartel del alijo lo avisa.

## 7. Las rutas (cada una enseña algo)

| Ruta | Mapa | Lo que enseña | Camino alterno |
|---|---|---|---|
| 1 · Calzada del Ámbar | 36×100, sur→norte | pelear, esconderse, retén, atajo con palanca, bordes | sendero del bosque por el campamento |
| 2 · Paso Alto | 36×80, sur→norte | montaña → selva; **aduana** en el paso; lobos | cornisa del oeste (bordes de ida, sin guardias) |
| 3 · Selva del Tránsito | 96×36, oeste→este | selva cerrada (cortar, pasto, emboscadas) y desierto abierto (la vista de los guardias llega lejos; cubrirse tras las rocas) | la selva misma: el desierto se cruza de roca en roca |
| 4 · Paso del Hielo | 36×90, norte→sur | desierto → nieve; **puerta de la escarcha** (retén); **lago helado** donde te deslizas hasta chocar | cruzar el lago helado (acertijo de deslizarse) |

## 8. Lo que queda fuera de la muestra (a propósito)

- Atajo de montaña Ashfen ↔ Verdelume (sigue el derrumbe del oeste).
- Encargos con nombre, rumores y el motivo personal del caminante (ver `story.md`).
- Monedas por región y trueque.
- Música propia de Verdelume, Duneshade y Frostholm (reusan los tres loops).
