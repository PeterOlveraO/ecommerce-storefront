# Documentación de Rutas API - Ecommerce Angel

Esta documentación detalla los endpoints disponibles, los métodos soportados, la autenticación requerida y cómo interactuar con cada módulo del backend.

## 1. Consideraciones Generales

- **Base URL**: Normalmente `http://localhost:3000` (o el puerto configurado en tu servidor).
- **Formato de Peticiones**: Todas las peticiones `POST` y `PUT` (excepto subida de archivos) deben enviar el header `Content-Type: application/json`.
- **Formato de Respuestas**: Las respuestas exitosas devuelven `{ data: ... }` o `{ success: true, data: ... }`. Los errores devuelven `{ success: false, message: ... }` y el código HTTP correspondiente.
- **Autenticación (JWT)**: Para acceder a rutas protegidas, se debe enviar el Access Token en el header `Authorization`:
  ```http
  Authorization: Bearer <tu_access_token>
  ```
- **Validación**: Todos los endpoints que mutan datos (`POST`, `PUT`) están protegidos por **Zod** schemas, asegurando que el payload sea correcto.

---

## 2. Autenticación y Perfil

Endpoints base para inicio de sesión, registro y gestión de la propia cuenta.

### Registro y Perfil (`/`)
- `POST /register`
  - **Uso**: Registro unificado (crea cuenta en `auth` y perfil en `customer` en una sola transacción).
  - **Body**: `{ email, password, first_name, last_name, phone }`
- `GET /me`
  - **Auth**: Requerido (`authMiddleware`).
  - **Uso**: Obtiene los datos del usuario autenticado actual.
- `PUT /me`
  - **Auth**: Requerido (`authMiddleware`).
  - **Uso**: Actualiza los datos del cliente autenticado.

### Auth (`/auth`)
- `POST /auth/login`
  - **Uso**: Iniciar sesión. Devuelve Access Token y Refresh Token.
- `POST /auth/refresh`
  - **Uso**: Obtener un nuevo Access Token usando el Refresh Token.
- `POST /auth/logout`
  - **Uso**: Invalida el Refresh Token.

---

## 3. Catálogo y Tienda (Público)

Estas rutas son de solo lectura y **no requieren autenticación**. Son consumidas por la tienda pública.

### Categorías (`/categories`)
- `GET /categories` - Lista todas las categorías.
- `GET /categories/:id` - Detalles de una categoría por ID.

### Productos (`/products`)
- `GET /products` - Lista todos los productos (soporta paginación/filtros si están implementados).
- `GET /products/:id` - Detalles de un producto por ID.

### Métodos de Pago (`/payment-methods`)
- `GET /payment-methods` - Métodos de pago disponibles.
- `GET /payment-methods/:id` - Detalle del método de pago.

### Imágenes de Cabecera (`/header-images`)
- `GET /header-images` - Lista las imágenes usadas en banners o carruseles.
- `GET /header-images/:id`

### Atributos (`/attributes`)
- `GET /attributes` - Lista de atributos (ej. Tallas, Colores).
- `GET /attributes/:id`

---

## 4. Clientes y Órdenes (Tienda Privada)

Rutas para el flujo de compras del cliente.

### Órdenes (`/orders`)
- `GET /orders`
  - **Auth**: Requerido.
  - **Uso**: Lista las órdenes del usuario (o todas si es admin).
- `GET /orders/:id`
  - **Auth**: Requerido.
  - **Uso**: Ver detalles de una orden específica.
- `POST /orders`
  - **Auth**: Requerido.
  - **Uso**: Crear una nueva orden (Checkout).

---

## 5. Administración CMS (Solo Admin)

Estas rutas requieren tanto estar autenticado como tener el rol de administrador (`authMiddleware` + `requireAdmin`).

### Gestión del Catálogo (`/categories`, `/products`, `/attributes`, `/payment-methods`, `/header-images`)
Para cada uno de estos módulos aplican los siguientes métodos protegidos:
- `POST /<entidad>` - Crear un nuevo registro.
- `PUT /<entidad>/:id` - Actualizar un registro existente.
- `DELETE /<entidad>/:id` - Eliminar un registro (usualmente un *soft delete*).

*Ejemplos:* 
- `POST /products` (Crear producto)
- `PUT /categories/:id` (Modificar categoría)

### Gestión de Clientes (`/customers` y `/auth`)
- `GET /customers` - Listar todos los clientes (Solo Admin).
- `DELETE /customers/:id` - Borrar cliente (Solo Admin).
- `GET /auth`, `GET /auth/:id`, `POST /auth`, `PUT /auth/:id`, `DELETE /auth/:id` - CRUD completo de credenciales (Solo Admin).

### Subida de Archivos (`/upload`)
- `POST /upload`
  - **Auth**: Requerido + Admin.
  - **Uso**: Subir imágenes al servidor (se guardan en `public/uploads`).
  - **Body**: `multipart/form-data`, enviar archivo en el campo `image`.
  - **Respuesta**: Retorna la URL de la imagen que luego se puede usar para crear productos o banners.

---

## Resumen de Flujo Típico (CMS)
1. **Login**: `POST /auth/login` (Admin) para obtener token.
2. **Subir imagen**: `POST /upload` adjuntando imagen. Extraer URL.
3. **Crear categoría/producto**: `POST /products` incluyendo la URL de la imagen y los datos validados por Zod.

## Resumen de Flujo Típico (Tienda)
1. **Ver productos**: `GET /products` (Público).
2. **Registro**: `POST /register`.
3. **Login**: `POST /auth/login` para obtener token.
4. **Checkout**: `POST /orders` usando el Access Token para asociar la orden al cliente.
