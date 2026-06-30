# Lista de cambios — Precios de delivery

**Proyecto:** Koi POS (Infinito)
**Fecha:** 29 de junio de 2026
**Estado:** Listo para revisión y aprobación del cliente

---

## Resumen

A partir de estos cambios, **cada producto y cada extra tiene dos precios distintos e independientes: precio de local y precio de delivery**. Cuando se marca una venta como delivery, el sistema cambia **automáticamente** todos los precios a la tarifa de delivery.

---

## ¿Qué cambió?

1. **Dos precios por producto.** Cada producto del menú ahora tiene un **precio de local** y un **precio de delivery** que se manejan por separado.

2. **Dos precios por extra.** Cada topping o extra también tiene su **precio de local** y su **precio de delivery**.

3. **El switch "Pedido por delivery" aplica los precios automáticamente.** En la pantalla de cobro, al activar el botón de delivery:
   - Los precios de los productos, de los extras y el **total a pagar** cambian solos a la tarifa de delivery.
   - Al desactivarlo, todo vuelve a la tarifa de local.
   - El cajero no tiene que hacer ningún cálculo ni cambiar precios a mano.

4. **El cobro de delivery se mantiene como ya estaba.** La venta se sigue registrando como Delivery y **no entra al efectivo de la caja** (la plataforma liquida en su horario), tal como funciona hoy.

5. **Edición desde Administración → Catálogo.** El administrador puede definir el **precio de local** y el **precio de delivery** de cada producto y de cada extra. Si se deja el campo de delivery vacío, arranca igual al precio de local.

6. **Nada cambia para el cliente final hasta que ustedes definan los precios.** Los productos existentes arrancan con **precio de delivery igual al precio de local**, hasta que ustedes nos pasen las tarifas de delivery por producto.

---

## Precios de delivery de extras (ya cargados)

| Extra | Precio delivery |
| --- | --- |
| Toppings (Oreo, Lotus, Marshmallow, Coco, Almendra, Kataifi, Granola) | Q6 |
| Pistacho | Q8 |
| Extra Chocolate con Leche | Q20 |
| Extra Chocolate Blanco | Q20 |
| Extra Crema Clásica | Q15 |
| Cremas gourmet (Ferrero, Raffaello, Lotus) | Q25 |

> Estos valores se pueden ajustar en cualquier momento desde el Catálogo.

---

## Cómo ingresar los precios de delivery (desde la app)

Los precios de delivery por producto los ingresa **el cliente directamente en la app**. Por ahora cada producto arranca con el precio de delivery igual al de local; para ajustarlo:

1. Entrar a **Administración → Catálogo**.
2. En cada producto, llenar el campo **"Precio delivery"** (junto a "Precio local").
3. Presionar **Guardar**. El nuevo precio queda activo de inmediato.

> Lo mismo aplica para los extras: cada uno tiene "Extra local" y "Extra delivery" editables en el Catálogo.
>
> Si un producto no tiene precio de delivery propio, se cobra su precio de local.

Productos actuales (precio de local de referencia):

| Producto | Precio local |
| --- | --- |
| Fresas con Crema | Q36 |
| Fresas con Chocolate con Leche | Q39 |
| Fresas con Chocolate Blanco | Q39 |
| Gourmet Ferrero | Q55 |
| Gourmet Raffaello | Q55 |
| Gourmet Lotus | Q55 |
| Gourmet Oreo | Q50 |
| Parfait de Yogurt | Q45 |

---

## Aprobación

- [x] **Cambios aprobados por el cliente.**
- [x] El cliente ingresará los precios de delivery por producto directamente en la app.
