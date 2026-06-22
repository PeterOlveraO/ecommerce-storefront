# Visibilidad de Productos: `featured` e `is_active`

Esta guía explica los dos campos que controlan cómo y cuándo un producto aparece en la tienda pública.

---

## Los dos campos de visibilidad

| Campo | Tipo | Default | Propósito |
|---|---|---|---|
| `is_active` | `boolean` | `true` | **Publicar / Ocultar** el producto de la tienda |
| `featured` | `boolean` | `false` | **Destacar** el producto en secciones especiales |

---

## 1. `is_active` — Publicar u Ocultar un Producto

Este es el interruptor principal de visibilidad. Cuando un producto tiene `is_active = false`, **desaparece completamente de la tienda pública**: no aparece en listados, ni es accesible por su ID.

- `GET /products` → Solo devuelve productos con `is_active = 1`. El query tiene el filtro `WHERE p.is_active = 1` de forma fija.
- El `DELETE /products/:id` del CMS hace un **soft delete**, es decir, no borra el registro sino que cambia `is_active` a `0`.

**Cómo ocultarlo desde el CMS:**
```http
DELETE /products/{id}
Authorization: Bearer <admin_token>
```

**Para "reactivar" un producto oculto**, se usa el `PUT` enviando `is_active` explícitamente:

> [!WARNING]
> El schema de `PUT /products/:id` actualmente **no expone `is_active`** como campo actualizable directamente. Si necesitas reactivar un producto oculto por soft delete, habría que añadirlo al `update_product_schema` o manejarlo con una ruta específica.

---

## 2. `featured` — Destacar un Producto

Este campo sirve para que el frontend sepa cuáles productos mostrar en secciones especiales de la tienda: un carrusel de inicio, una sección "Lo más vendido", "Nuevos", etc. El producto sigue apareciendo en el catálogo normal, adicionalmente se puede pinear en cualquier sección destacada.

**Cómo marcar un producto como destacado desde el CMS:**
```http
PUT /products/{id}
Authorization: Bearer <admin_token>
Content-Type: application/json

{ "featured": true }
```

**Cómo quitarlo de destacados:**
```json
{ "featured": false }
```

---

## 3. Cómo consumirlo desde el Frontend

El endpoint `GET /products` devuelve **todos los productos activos** incluyendo el campo `featured` en cada objeto. La tienda decide qué hacer con él.

### Ejemplo de respuesta
```json
[
  { "id": "...", "name": "Vape Pro Max", "featured": true,  "is_active": 1 },
  { "id": "...", "name": "Vape Mini",    "featured": false, "is_active": 1 }
]
```

### Estrategia recomendada en el Frontend

**Para la sección de "Destacados"** (ej. carrusel del home):
```js
const featured_products = products.filter(p => p.featured === true);
```

**Para el catálogo general**: usa todos los productos tal como llegan (ya vienen filtrados por `is_active` desde el backend).

> [!NOTE]
> La API actualmente **no acepta `?featured=true`** como query param en `GET /products`. El filtrado de destacados se hace en el Frontend sobre la lista completa que devuelve el backend. Si el catálogo crece mucho y esto se vuelve ineficiente, se puede añadir ese filtro en el backend.

---

## 4. Resumen de comportamiento

```
is_active = 0 → Producto oculto. No aparece en ningún listado de la tienda.
is_active = 1 + featured = false → Producto visible en el catálogo general.
is_active = 1 + featured = true  → Producto visible en catálogo Y en secciones destacadas.
```
