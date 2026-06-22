# Guía de Clientes (`customer`)

Esta guía explica la estructura, los endpoints y cómo manejar correctamente la información de los clientes en Ecommerce Angel.

---

## 1. Concepto Clave: `auth` vs `customer`

Es muy importante entender que en esta API el usuario está separado en **dos tablas distintas**:

| Tabla | Propósito | Contiene |
|---|---|---|
| `auth` | Credenciales de acceso | `email`, `phone`, `password` (hash), `role` |
| `customer` | Perfil y datos de envío | Nombre, dirección, teléfono de contacto |

Un cliente no puede existir sin su `auth` correspondiente. El campo `auth_id` en la tabla `customer` es la llave que los une. Ambos registros se crean juntos y de forma atómica al usar `POST /register`.

---

## 2. Estructura del Perfil de Cliente

Campos disponibles en la tabla `customer`:

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `id` | UUID | Auto | Identificador único del perfil |
| `auth_id` | UUID | Sí | FK hacia la tabla `auth` |
| `first_name` | string | Sí | Nombre(s) del cliente |
| `last_name` | string | Sí | Apellido(s) del cliente |
| `country` | string | No | País. Default: `"México"` |
| `street_address` | string | Sí | Nombre de la calle |
| `exterior_number` | string | Sí | Número exterior |
| `interior_number` | string | No | Número interior (ej. `"Depto 3B"`) |
| `neighborhood` | string | No | Colonia |
| `postal_code` | string | Sí | Código postal (mín. 4 chars) |
| `city` | string | Sí | Ciudad o municipio |
| `state` | string | Sí | Estado o provincia |
| `phone` | string | Sí | Teléfono de contacto para envíos (mín. 7 chars) |
| `is_active` | 0 o 1 | Auto | `1` = activo, `0` = dado de baja (soft delete) |

> **Nota:** El campo `phone` del perfil de cliente es para el **contacto de envío** y puede ser distinto al `phone` de las credenciales en la tabla `auth` (que se usa para login).

---

## 3. Endpoints Disponibles

### Para el Cliente Autenticado

La forma recomendada para que un usuario gestione su propio perfil es a través de las rutas `/me`, que extraen automáticamente su identidad desde el JWT.

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/me` | ✅ Token | Obtiene el perfil propio del usuario autenticado |
| `PUT` | `/me` | ✅ Token | Actualiza los datos propios (dirección, nombre, teléfono) |

> **¿Por qué usar `/me` y no `/customers/:id`?**  
> Usando `/me` el backend determina a qué cliente pertenece la petición gracias al JWT. Así el cliente nunca necesita conocer ni enviar su propio `customer_id`, lo que evita suplantaciones (IDOR).

### Para el CMS (Solo Admin)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/customers` | ✅ Admin | Lista todos los clientes activos |
| `GET` | `/customers/:id` | ✅ Token | Obtiene un cliente por su ID |
| `PUT` | `/customers/:id` | ✅ Token | Actualiza datos de un cliente por su ID |
| `DELETE` | `/customers/:id` | ✅ Admin | Soft delete (pone `is_active = 0`) |

---

## 4. Actualizar el Perfil (`PUT /me`)

Solo se envían los campos que se desean cambiar. Todos son opcionales.

**Ejemplo: actualizar solo la dirección de envío**
```json
{
  "street_address": "Av. Reforma",
  "exterior_number": "500",
  "neighborhood": "Juárez",
  "postal_code": "06600",
  "city": "Cuauhtémoc",
  "state": "Ciudad de México"
}
```

**Ejemplo: actualizar solo el nombre**
```json
{
  "first_name": "Carlos",
  "last_name": "Ramírez"
}
```

---

## 5. Comportamiento del Soft Delete

Cuando un admin ejecuta `DELETE /customers/:id`, el registro **no se borra físicamente** de la base de datos. Únicamente se actualiza `is_active = 0`.

Esto es intencional para preservar la **integridad del historial de órdenes**: si se borrara el cliente, todas las órdenes asociadas perderían la referencia a quién las hizo.

- `GET /customers` → Solo devuelve clientes con `is_active = 1`.
- `GET /customers/:id` → Devuelve el cliente sin importar si está activo o no.

---

## 6. Relación con Órdenes

Al momento del checkout, el backend necesita el `customer_id` para asociar la orden. Sin embargo, el frontend **nunca debe enviarlo manualmente**. El servicio de órdenes lo obtiene automáticamente buscando el perfil vinculado al `auth_id` del Token JWT:

```
Token JWT → auth_id → customer.auth_id → customer.id → shop_order.customer_id
```

Esto garantiza que un cliente nunca pueda crear una orden en nombre de otro.
