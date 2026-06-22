# Flujo del Carrito de Compras y Checkout

Este documento detalla la lógica y el flujo de información desde que un usuario añade un producto a su carrito en la tienda pública, hasta que la compra se procesa exitosamente en el backend.

---

## 1. Gestión del Carrito (Frontend)

El carrito de compras **no se guarda en la base de datos** mientras el usuario está navegando. Se gestiona completamente del lado del cliente (Frontend).

1. **Exploración**: El usuario consulta el catálogo mediante `GET /products`.
2. **Añadir al carrito**: El usuario selecciona un producto, elige una variante (si aplica, ej. Talla M) y una cantidad.
3. **Almacenamiento Local**: Esta información se guarda en el estado de la aplicación (por ejemplo, usando Zustand, Context API o `localStorage`).
   - *Estructura típica de un ítem en el Frontend:*
     ```json
     {
       "product_id": "123e4567-e89b-12d3...",
       "variant_id": "987e6543-e21b-34d1...", // Opcional
       "quantity": 2,
       "price": 250.00
     }
     ```

---

## 2. Preparación del Checkout (Frontend)

Cuando el usuario decide finalizar su compra y entra a la pantalla de Checkout:

1. **Autenticación**: El usuario debe estar autenticado. Si no lo está, debe hacer `POST /auth/login` o `POST /register`.
2. **Selección de Datos**: 
   - La dirección de envío se obtiene del perfil del usuario (`GET /me`).
   - Selecciona un método de pago (`GET /payment-methods`).
   - Se calcula un costo de envío (si aplica).

---

## 3. Procesamiento de la Orden (Backend)

El Frontend envía el carrito finalizado mediante una petición **`POST /orders`**. El payload luce así:

```json
{
  "payment_method_id": "uuid-del-metodo",
  "shipping_cost": 150.00,
  "notes": "Dejar el paquete en recepción",
  "items": [
    {
      "product_id": "uuid-del-producto-1",
      "quantity": 1
    },
    {
      "product_id": "uuid-del-producto-2",
      "variant_id": "uuid-de-la-variante",
      "quantity": 2
    }
  ]
}
```

> **Nota de Seguridad**: El Frontend *no* envía el `customer_id`. El backend lo extrae de forma segura a partir del Token JWT (`req.user.id`) para evitar ataques de suplantación (IDOR). Tampoco envía los precios finales, ya que estos se calculan desde la base de datos.

### 4. Transacción Segura y Descuento de Stock

Una vez que el backend recibe la petición, inicia una **Transacción Atómica en SQL**. Si cualquier paso falla, todo el proceso se revierte (*rollback*) para evitar inconsistencias.

El proceso ocurre en este orden:

1. **Iteración de Ítems**: Por cada artículo enviado en el arreglo `items`, el sistema consulta la base de datos.
2. **Bloqueo (FOR UPDATE)**: El sistema realiza un bloqueo de lectura en esa fila de la base de datos (`SELECT ... FOR UPDATE`). Esto previene que dos usuarios compren el mismo artículo en el mismo milisegundo causando un inventario negativo (Race Condition).
3. **Validación**:
   - Revisa que el producto/variante exista y esté activo (`is_active`).
   - **Descuento de Stock**: Verifica que el inventario (`stock`) sea mayor o igual a la cantidad solicitada. Si hay stock, lo descuenta inmediatamente en la misma transacción llamando a `updateProductStock` o `updateProductVariantStock`.
4. **Cálculo de Precios**: Toma el precio actual de la base de datos (usando `sale_price` si el producto está en rebaja, de lo contrario `price`) y lo multiplica por la cantidad para obtener el `line_total`.

### 5. Finalización y Confirmación

1. **Sumatorias**: El backend suma los totales de cada línea para obtener el `subtotal` y le añade el `shipping_cost` para obtener el `total` final a pagar.
2. **Inserción**: 
   - Guarda el registro general en la tabla `shop_order`.
   - Guarda los detalles de cada producto en la tabla `order_item`.
3. **Commit**: Si todo fue exitoso, se ejecuta el *commit* de la transacción. Los cambios en el stock y las nuevas órdenes se vuelven permanentes.
4. **Respuesta**: El servidor responde con HTTP `201 Created` y envía la orden final (incluyendo el total calculado y el número de orden) de regreso al Frontend para mostrar la pantalla de "Gracias por tu compra".

---

## ¿Qué pasa si se cancela la orden después?
El sistema tiene preparado un mecanismo de resiliencia. Si un administrador (o el sistema de pagos) cambia el estado de la orden a `"cancelled"` a través de `PUT /orders/:id/status`, el backend lee automáticamente todos los ítems de esa orden y **devuelve el stock descontado** al inventario correspondiente (ya sea al producto principal o a la variante).
