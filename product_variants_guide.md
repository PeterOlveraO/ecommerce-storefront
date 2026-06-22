# Guía de Variantes de Producto

Esta guía explica cómo están estructuradas las variantes, cómo impactan en el stock al comprar y cómo el Frontend debe manejarlas para deshabilitar las opciones sin inventario.

---

## 1. ¿Qué es una Variante?

Una variante representa una combinación específica de atributos de un producto. Por ejemplo, un vape puede tener variantes por **sabor**, **resistencia** o **color**. Cada variante tiene su propio inventario independiente.

La tabla `product_variant` tiene esta estructura:

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | Identificador único de la variante |
| `product_id` | UUID | FK al producto padre |
| `variante1` | string | Primer atributo (ej. `"Mango"`, `"Rojo"`, `"0.8Ω"`) |
| `variante2` | string \| null | Segundo atributo opcional (ej. `"Grande"`, `"3mg"`) |
| `stock` | integer | Inventario exclusivo de esta combinación |
| `is_active` | boolean | Si está disponible para la venta |

---

## 2. Cómo obtiene el Frontend las Variantes

Las variantes **solo se devuelven en el detalle individual** del producto (`GET /products/:id`). El listado general (`GET /products`) no las incluye para no sobrecargar la respuesta.

### Respuesta de `GET /products/:id`
```json
{
  "id": "uuid-del-producto",
  "name": "Vape Pro Max",
  "price": 350.00,
  "stock": 45,
  "variants": [
    { "id": "v-uuid-1", "variante1": "Mango",    "variante2": null,    "stock": 20, "is_active": true },
    { "id": "v-uuid-2", "variante1": "Sandía",   "variante2": null,    "stock": 15, "is_active": true },
    { "id": "v-uuid-3", "variante1": "Tabaco",   "variante2": null,    "stock": 0,  "is_active": true },
    { "id": "v-uuid-4", "variante1": "Menta",    "variante2": null,    "stock": 10, "is_active": false }
  ]
}
```

> **Nota sobre el `stock` del producto padre**: Cuando un producto tiene variantes, el campo `stock` del objeto raíz es la **suma de todas las variantes activas** (calculado en el backend con `COALESCE + SUM`). Nunca es un valor manual en ese caso.

---

## 3. Lógica de Visualización en el Frontend

Al entrar al detalle de un producto, el Frontend debe recorrer el arreglo `variants` y renderizar cada opción aplicando estas reglas:

| Condición | Estado visual |
|---|---|
| `is_active = false` | Ocultar o deshabilitar permanentemente (el admin la desactivó) |
| `is_active = true` y `stock = 0` | Mostrar como **Agotada** y deshabilitar la selección |
| `is_active = true` y `stock > 0` | Mostrar como seleccionable normalmente |

### Ejemplo en JavaScript/React

```js
// Al renderizar los botones de variante:
{product.variants.map(variant => {
  const out_of_stock = variant.stock === 0;
  const hidden       = !variant.is_active;

  if (hidden) return null; // No renderizar variantes inactivas

  return (
    <button
      key={variant.id}
      disabled={out_of_stock}
      className={out_of_stock ? 'variant-disabled' : 'variant-available'}
      onClick={() => setSelectedVariant(variant)}
    >
      {variant.variante1}
      {out_of_stock && ' — Agotado'}
    </button>
  );
})}
```

---

## 4. Cómo se Envía al Hacer la Compra

Cuando el usuario selecciona una variante y finaliza el checkout, el `variant_id` debe incluirse en el arreglo `items` del `POST /orders`. Si no se envía `variant_id`, el sistema descuenta del stock general del producto.

```json
{
  "payment_method_id": "uuid-metodo",
  "items": [
    {
      "product_id": "uuid-del-producto",
      "variant_id": "v-uuid-1",
      "quantity": 2
    }
  ]
}
```

> [!IMPORTANT]
> El `variant_id` es obligatorio si el producto tiene variantes. Si el usuario intenta comprar sin seleccionar una, el Frontend debe bloquearlo antes de enviar la petición.

---

## 5. Qué Pasa en el Backend al Comprar

Al recibir el `POST /orders` con un `variant_id`:

1. El backend bloquea la fila de la variante (`SELECT ... FOR UPDATE`) para evitar que dos usuarios compren la misma variante al mismo tiempo.
2. Verifica que `variant.is_active = true`.
3. Verifica que `variant.stock >= quantity`. Si no hay suficiente, responde con **400** y el mensaje: `"Stock insuficiente para la variante de {nombre}. Disponible: {stock}"`.
4. Si todo está bien, descuenta: `stock = stock - quantity` únicamente sobre esa variante.
5. El stock del producto padre se recalcula automáticamente en la siguiente consulta.

---

## 6. Cancelación y Devolución de Stock

Si una orden con variantes es cancelada (`PUT /orders/:id/status` con `status: "cancelled"`), el backend automáticamente regresa el stock a cada variante involucrada en esa orden.
