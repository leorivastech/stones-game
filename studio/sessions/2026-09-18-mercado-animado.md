# Mercado más claro y dinámico

Fecha: 2026-09-18

## Decisión de Leo

La compra y la venta no deben depender sólo del texto pequeño del HUD. Al acercarse al
mercado tienen que aparecer claramente las teclas `E` y `Q`, y pulsarlas debe producir una
animación que confirme la operación.

## Implementado

- `E` y `Q` aparecen con entrada y pulso mientras el personaje está dentro de la zona del puesto.
- Cada botón muestra mercancía, precio o la razón concreta por la que está bloqueado.
- Comprar anima una piedra desde el puesto hasta el personaje y muestra carga/oro.
- Vender anima la piedra desde el personaje al puesto y muestra el oro recibido.
- Una acción imposible hace temblar su botón, además del mensaje explicativo existente.
