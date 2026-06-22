# Guía de Gestión de Métodos de Pago

Esta guía detalla la estructura y el uso de los endpoints relacionados con los Métodos de Pago en la API de Ecommerce Angel.

Los métodos de pago en esta plataforma se basan en transferencias manuales (por ejemplo, depósitos bancarios, SPEI, OXXO, etc.), donde el administrador proporciona las cuentas a las que el cliente debe depositar para que posteriormente el pago sea validado de forma externa/manual.

---

## 1. Estructura de Datos (Esquema)

Cada método de pago contiene los siguientes campos:

- `id`: Identificador único (UUID generado por la base de datos).
- `method`: El tipo o nombre del método de pago (Ej. `"Transferencia SPEI"`, `"Depósito en OXXO"`).
- `bank`: Nombre del banco o institución receptora (Ej. `"BBVA"`, `"Banamex"`, `"OXXO"`).
- `account_number`: Número de cuenta, tarjeta o CLABE interbancaria (Ej. `"012345678901234567"`).
- `account_holder`: Nombre completo del titular de la cuenta (Ej. `"Juan Pérez"` o `"Empresa SA de CV"`).
- `is_active`: Estado lógico (`1` para activo, `0` para inactivo/eliminado).

---

## 2. Tienda Pública (Solo Lectura)

Estas rutas son utilizadas por el Frontend al momento de realizar un *Checkout*, para que el cliente pueda elegir a dónde va a transferir o depositar. **No requieren autenticación.**

### Obtener los métodos de pago activos
- **Ruta:** `GET /payment-methods`
- **Uso:** Retorna una lista con todos los métodos de pago que tienen `is_active = 1` ordenados alfabéticamente por su nombre (`method`).

### Obtener detalles de un método de pago
- **Ruta:** `GET /payment-methods/:id`
- **Uso:** Obtiene la información de un método de pago en específico proporcionando su UUID.

---

## 3. Administración CMS (Gestión)

Estas rutas permiten añadir, modificar o dar de baja las cuentas bancarias de la empresa. **Requieren enviar el Header `Authorization: Bearer <token>` y que el usuario tenga rol de `admin`.**

### Crear un nuevo Método de Pago
- **Ruta:** `POST /payment-methods`
- **Body (JSON):**
  Todos los campos son obligatorios y deben ser enviados como texto.
  ```json
  {
    "method": "Depósito en OXXO",
    "bank": "Spin by OXXO",
    "account_number": "4234 5678 9012 3456",
    "account_holder": "Comercializadora VZ"
  }
  ```

### Actualizar un Método de Pago
- **Ruta:** `PUT /payment-methods/:id`
- **Body (JSON):**
  Todos los campos son **opcionales**. Solo necesitas enviar los que desees modificar.
  ```json
  {
    "account_number": "098765432109876543"
  }
  ```

### Dar de baja un Método de Pago (Soft Delete)
- **Ruta:** `DELETE /payment-methods/:id`
- **Uso:** No borra el registro de la base de datos de manera definitiva (para mantener la integridad histórica en caso de que facturas antiguas o recibos lo referencien). Únicamente cambia el campo `is_active` a `0`, con lo cual dejará de mostrarse en la tienda al público.
