# Guía de Autenticación: Registro y Login

Esta guía detalla los campos requeridos, reglas de validación y flujos necesarios para implementar el registro de usuarios y el inicio de sesión en la API de Ecommerce Angel.

---

## 1. Registro de Usuario

El registro se realiza a través de un endpoint unificado que se encarga de crear simultáneamente las credenciales de autenticación (para el login) y el perfil del cliente (para compras y envíos). Todo ocurre en una transacción atómica; si algo falla, no se crea ningún registro incompleto.

### Endpoint
`POST /register`

### Payload Requerido (JSON)
El cuerpo de la petición debe cumplir con las siguientes reglas (validadas por Zod):

#### Credenciales (Cuenta)
Se requiere proveer **al menos el email o el teléfono** como identificadores de acceso.
- `email` (Opcional si se provee teléfono): Formato de correo electrónico válido.
- `phone` (Opcional si se provee email): Cadena de texto, mínimo 7 caracteres.
- `password` (Obligatorio): Mínimo 6 caracteres.

#### Datos del Perfil (Envío y Contacto)
- `first_name` (Obligatorio): Nombre(s), max 100 caracteres.
- `last_name` (Obligatorio): Apellidos, max 100 caracteres.
- `country` (Opcional): País. Por defecto es `'México'`.
- `street_address` (Obligatorio): Nombre de la calle.
- `exterior_number` (Obligatorio): Número exterior.
- `interior_number` (Opcional): Número interior.
- `neighborhood` (Opcional): Colonia o barrio.
- `postal_code` (Obligatorio): Código postal, max 10 caracteres.
- `city` (Obligatorio): Ciudad.
- `state` (Obligatorio): Estado o provincia.
- `phone_contact` (Obligatorio): Teléfono de contacto para el perfil (mínimo 7 caracteres).

### Ejemplo de Petición
```json
{
  "email": "juan.perez@example.com",
  "password": "Password123!",
  "first_name": "Juan",
  "last_name": "Pérez",
  "street_address": "Av. Insurgentes Sur",
  "exterior_number": "123",
  "neighborhood": "Roma Norte",
  "postal_code": "06700",
  "city": "Cuauhtémoc",
  "state": "Ciudad de México",
  "phone_contact": "5512345678"
}
```

### Respuestas Posibles
- **200 OK**: Retorna el ID de autenticación, ID de cliente, email, y rol asignado (`customer`).
- **400 Bad Request**: Si falta algún campo obligatorio o la validación Zod falla.
- **409 Conflict**: Si el `email` o el `phone` ya se encuentran registrados.

---

## 2. Inicio de Sesión (Login)

El sistema utiliza JWT (JSON Web Tokens) sin estado. Al iniciar sesión exitosamente, se devuelve un par de tokens: un **Access Token** (corta duración) y un **Refresh Token** (larga duración).

### Endpoint
`POST /auth/login`

### Payload Requerido (JSON)
El login soporta el uso de correo electrónico o número de teléfono en un solo campo dinámico llamado `identifier`.

- `identifier` (Obligatorio): Puede ser el `email` o el `phone` con el que se registró el usuario.
- `password` (Obligatorio): La contraseña del usuario.

### Ejemplo de Petición
```json
{
  "identifier": "juan.perez@example.com",
  "password": "Password123!"
}
```

### Respuestas Posibles
- **200 OK**: Retorna los tokens y la información básica del usuario.
  ```json
  {
    "data": {
      "access_token": "eyJhbGciOiJIUz...",
      "refresh_token": "eyJhbGciOiJIUz...",
      "user": {
        "id": "uuid-del-auth",
        "email": "juan.perez@example.com",
        "role": "customer"
      }
    }
  }
  ```
- **401 Unauthorized**: Credenciales inválidas (usuario no encontrado o contraseña incorrecta).
- **400 Bad Request**: Formato de petición inválido.

---

## 3. Uso y Mantenimiento de la Sesión

### Realizar Peticiones Autenticadas
Una vez obtenido el `access_token` en el Login, se debe adjuntar en las llamadas a rutas protegidas (ej. `GET /me`, `POST /orders`) usando el Header `Authorization`:
```http
Authorization: Bearer <tu_access_token>
```

### Refrescar el Token (`POST /auth/refresh`)
Cuando el Access Token expira, en lugar de pedirle al usuario que inicie sesión nuevamente, puedes usar el `refresh_token` para obtener un nuevo par de tokens.
**Body:**
```json
{
  "refresh_token": "<tu_refresh_token_aqui>"
}
```

### Cerrar Sesión (`POST /auth/logout`)
Para cerrar sesión y evitar que un Refresh Token siga siendo útil en caso de robo, envíalo a esta ruta. El servidor lo añadirá a una lista negra temporal en memoria, invalidando su uso futuro.
**Body:**
```json
{
  "refresh_token": "<tu_refresh_token_aqui>"
}
```
