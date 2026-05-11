# Suite QA Caos - Kiosco POS

Matriz de pruebas logicas para flujo kiosco: orden personalizada -> pago -> preparacion.

## 1. Logica de negocio y vueltos

| Caso | Descripcion del caos | Entrada maliciosa/erronea | Resultado esperado | Cobertura |
| --- | --- | --- | --- | --- |
| Vuelto decimal | Cliente paga total decimal con billete grande. | Total `Q35.50`, efectivo aplicado `35.50`, recibido `100`. | Vuelto `Q64.50`; desglose minimo: `Q50 x1`, `Q10 x1`, `Q1 x4`, `Q0.50 x1`. | `cart.test.ts` |
| Pago menor | Operador intenta cobrar aunque falta dinero. | Total `Q60.00`, pago efectivo `59.99`, recibido `100`. | Bloquear cobro y mostrar `El monto pagado es menor al total.` | `cart.test.ts` |
| Total cero con carrito | Producto de precio cero entra al carrito e intenta cobrarse. | `itemCount=1`, `total=0`, recibido `100`. | Bloquear cobro y mostrar `El total debe ser mayor a cero para cobrar.` | `cart.test.ts`, UI/server |
| Vuelto sin efectivo aplicado | Operador escribe solo `Recibido=100` y deja `Efectivo=0`. | Efectivo `0`, recibido `100`, total `60`. | Vuelto mostrado `Q0.00`; no sugerir dinero a devolver si no hay efectivo aplicado. | UI |

## 2. Input sanitization

| Caso | Descripcion del caos | Entrada maliciosa/erronea | Resultado esperado | Cobertura |
| --- | --- | --- | --- | --- |
| Pago basura | Usuario manipula el payload o intenta meter texto. | `amount=NaN`, `amount=Infinity`, metodo `BITCOIN`. | Bloquear con error amigable de numero/metodo invalido; no crear orden. | `cart.test.ts`, server |
| Nota XSS | Cliente pide nota con script. | `<script>alert('x')</script> sin crema`. | Guardar texto sanitizado, sin etiquetas HTML ejecutables. | `cart.test.ts`, UI/server |
| Nota gigante | Operador pega texto basura. | `"a"` repetida 5000 veces. | Recortar nota a 250 caracteres. | `cart.test.ts`, UI/server |
| Dedos gordos | Operador presiona `Cobrar` muchas veces. | 10 clicks rapidos sobre el boton. | Boton pasa a `Cobrando...` y queda deshabilitado en el primer submit valido. | UI |

## 3. What if y workarounds

| Caso | Descripcion del caos | Entrada maliciosa/erronea | Resultado esperado | Cobertura |
| --- | --- | --- | --- | --- |
| Cliente indeciso | Agrega productos, elimina varios y cobra. | 5 items -> borrar 3 -> cobrar los 2 restantes. | Total se recalcula desde el carrito actual; backend recalcula precios antes de crear la orden. | `cart.test.ts`, server |
| Preparacion fuera de orden | Intentan entregar antes de preparar/listar. | Estado actual `PAID`, estado solicitado `DELIVERED`. | Bloquear con `La orden debe estar lista antes de entregarse.` | `order-status.test.ts`, server |
| Orden cerrada mutada | Intentan revivir orden cancelada o entregada. | `CANCELLED -> PREPARING`, `DELIVERED -> READY`. | Bloquear con `No se puede cambiar una orden cerrada.` | `order-status.test.ts`, server |
| Stock negativo | Venden mas vasos que inventario disponible. | Inventario `10`, venta de `100`. | Permitir venta; inventario queda negativo y se muestra como bajo/negativo. | `inventory.test.ts` |

## 4. Hardware y entorno

| Caso | Descripcion del caos | Entrada maliciosa/erronea | Resultado esperado | Cobertura |
| --- | --- | --- | --- | --- |
| Conexion perdida al cobrar | Red cae durante submit. | Corte de conexion durante `createPaidOrderAction`. | La transaccion de servidor es atomica: crea orden/pagos/inventario juntos o no crea nada. | server transaction |
| Cierre de pestana | Usuario cierra la app con carrito activo. | Cerrar pestana antes del submit. | No existe orden hasta que el servidor confirma el cobro; carrito local se pierde sin afectar caja/inventario. | arquitectura actual |
| JSON corrupto | Cliente manipula hidden inputs. | `items="{"`, `payments="{]"`. | Bloquear con `Carrito invalido.` o `Pagos invalidos.` | server |
