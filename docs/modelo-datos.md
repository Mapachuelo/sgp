# Modelo de datos — SGP

Correspondencia entre el modelo entidad-relación (`docs/modelos-uml.drawio`, página **Modelo ER**) y el esquema real en `db/init.sql`. La verificación automática está en `tests/esquema.sh`.

## 1. Diagrama entidad-relación

Ver `docs/modelos-uml.drawio` → página **Modelo ER**.

```
ubicacion 1───N jornada
ubicacion 1───N reserva
ubicacion 1───N empleado_disponibilidad
app_user 1───1 empleado_perfil
app_user 1───1 preferencia_usuario
app_user 1───N reserva (cliente y empleado)
app_user 1───N empleado_disponibilidad
app_user 1───N empleado_tiempo_servicio
servicio_catalogo 1───N empleado_tiempo_servicio
servicio_catalogo 1───N reserva
reserva 1───0..1 cobro
reserva 1───N pago
app_user 1───N cobro (registrado_por)
```

## 2. Diccionario de datos

### 2.1 `ubicacion`
| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | serial | PK |
| nombre | varchar(200) | NOT NULL |
| direccion | text | NOT NULL |
| latitud | double precision | NOT NULL |
| longitud | double precision | NOT NULL |

### 2.2 `app_user`
| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | serial | PK |
| email | varchar(255) | UNIQUE, NOT NULL |
| password_hash | text | NOT NULL (bcrypt 12) |
| rol | varchar(20) | NOT NULL, CHECK `cliente|empleado|admin` |
| nombre / apellido | varchar(100) | NOT NULL |
| telefono | text | Cifrado AES-256-CBC en aplicación (`iv:hex`), validación `+57` en servicio |
| esta_bloqueado | boolean | DEFAULT false |
| motivo_bloqueo / bloqueado_por / bloqueado_en | text / int / timestamptz | Trazabilidad de moderación |
| verificado | boolean | DEFAULT false (empleados del admin nacen en true) |
| token_verificacion | text | Hash SHA-256 del OTP |
| token_verificacion_expiracion | timestamptz | 15 minutos |
| creado_en / actualizado_en | timestamptz | DEFAULT now() |

Índice: `idx_app_user_rol_bloqueado (rol, esta_bloqueado)`.

### 2.3 `empleado_perfil`
| Columna | Tipo | Restricciones |
|---------|------|---------------|
| usuario_id | integer | PK, FK `app_user(id)` ON DELETE CASCADE |
| identificacion | varchar(30) | — |
| password_asignada_hash | text | Hash de la contraseña asignada por el admin |
| ubicacion_base_id | integer | FK `ubicacion(id)` ON DELETE SET NULL |

### 2.4 `servicio_catalogo`
| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | serial | PK |
| nombre | varchar(200) | NOT NULL |
| descripcion | text | — |
| precio_base | decimal(10,2) | NOT NULL |
| duracion_base_minutos | integer | NOT NULL |

### 2.5 `empleado_tiempo_servicio`
| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | serial | PK |
| empleado_id | integer | NOT NULL, FK `app_user(id)` CASCADE |
| servicio_id | integer | NOT NULL, FK `servicio_catalogo(id)` CASCADE |
| duracion_minutos | integer | NOT NULL |

UNIQUE `(empleado_id, servicio_id)`.

### 2.6 `jornada`
| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | serial | PK |
| ubicacion_id | integer | NOT NULL, FK `ubicacion(id)` CASCADE |
| fecha | date | NOT NULL |
| hora_inicio / hora_fin | time | NOT NULL |

UNIQUE `(ubicacion_id, fecha)`.

### 2.7 `empleado_disponibilidad`
| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | serial | PK |
| empleado_id | integer | NOT NULL, FK `app_user(id)` CASCADE |
| ubicacion_id | integer | NOT NULL, FK `ubicacion(id)` CASCADE |
| dia_semana | integer | NOT NULL, CHECK 1..7 (ISO: lunes=1) |
| hora_inicio / hora_fin | time | NOT NULL |

UNIQUE `(empleado_id, ubicacion_id, dia_semana)`. La regla **una sede por día** se garantiza en el servicio (`disponibilidad.service.js`) y en el planificador del administrador; el generador de datos también la respeta.

### 2.8 `reserva`
| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | serial | PK |
| cliente_id | integer | NOT NULL, FK `app_user(id)` CASCADE |
| empleado_id | integer | NOT NULL, FK `app_user(id)` CASCADE |
| servicio_id | integer | NOT NULL, FK `servicio_catalogo(id)` CASCADE |
| ubicacion_id | integer | NOT NULL, FK `ubicacion(id)` CASCADE |
| inicia_en / termina_en | timestamptz | NOT NULL |
| cantidad_personas | integer | NOT NULL DEFAULT 1, CHECK 1..5 |
| estado | varchar(20) | NOT NULL DEFAULT `pendiente`, CHECK `pendiente|confirmada|en_curso|cobrado|cancelada` |
| qr_token | uuid | DEFAULT `gen_random_uuid()` |
| qr_data_url | text | PNG en base64 (se genera para reservas activas) |
| motivo_cancelacion | text | `no-show`, `Cancelada por el cliente`, `El empleado cambió de sede` |
| creado_en | timestamptz | DEFAULT now() |

Índices: `idx_reserva_inicia_en`, `idx_reserva_cliente_id`, `idx_reserva_empleado_id`, `idx_reserva_estado`, `idx_reserva_ubicacion_id`.

### 2.9 `cobro`
| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | serial | PK |
| reserva_id | integer | **UNIQUE**, NOT NULL, FK `reserva(id)` CASCADE |
| monto | decimal(10,2) | NOT NULL |
| metodo | varchar(10) | NOT NULL, CHECK `fisico|online` |
| cobrado_en | timestamptz | DEFAULT now() |
| registrado_por | integer | FK `app_user(id)` |

Índice: `idx_cobro_cobrado_en`. El UNIQUE garantiza un solo cobro por reserva.

### 2.10 `pago`
Transacción de pago digital con Wompi (sandbox/producción). Una reserva puede tener varios intentos; solo un pago `aprobado` confirma la reserva.

| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | serial | PK |
| reserva_id | integer | NOT NULL, FK `reserva(id)` CASCADE |
| proveedor | varchar(20) | NOT NULL, DEFAULT `wompi` |
| referencia | varchar(100) | **UNIQUE**, NOT NULL (referencia propia `SGP-<reserva>-<aleatorio>`) |
| transaction_id | varchar(100) | **UNIQUE** (id de la transacción en Wompi) |
| monto | decimal(10,2) | NOT NULL (calculado en el servidor: `precio_base × cantidad_personas`) |
| moneda | varchar(3) | NOT NULL, DEFAULT `COP` |
| metodo | varchar(30) | `CARD`, `NEQUI`, `PSE`, `BANCOLOMBIA_TRANSFER`, ... (lo reporta Wompi) |
| estado | varchar(20) | NOT NULL, CHECK `pendiente|aprobado|declinado|error|anulado` |
| payload | jsonb | Objeto completo de la transacción de Wompi |
| creado_en / actualizado_en | timestamptz | DEFAULT now() |

Índices: `idx_pago_reserva_id`, `idx_pago_estado`, `idx_pago_referencia`.

### 2.11 `preferencia_usuario`
| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | serial | PK |
| usuario_id | integer | UNIQUE, NOT NULL, FK `app_user(id)` CASCADE |
| rango_hora_desde / rango_hora_hasta | time | DEFAULT `06:00` / `22:00` |
| granularidad_calendario | integer | DEFAULT 30 |
| tema | varchar(10) | DEFAULT `claro` |
| idioma | varchar(5) | DEFAULT `es` (ES/EN) |

## 3. Reglas de integridad

- Un cobro por reserva (UNIQUE + transacción del check-in).
- Un pago aprobado mueve la reserva a `confirmada`; al validar el QR, el check-in registra el `cobro` con `metodo='online'` y el monto real del pago (sin pedir monto adicional). Referencias de pago únicas; webhook idempotente por `transaction_id`/estado final.
- Estados válidos de reserva restringidos por CHECK.
- Cantidad de personas entre 1 y 5.
- Eliminaciones en cascada coherentes: borrar usuario elimina sus reservas y perfiles; borrar reserva elimina su cobro y sus pagos.
- Migraciones idempotentes: `ALTER ... IF NOT EXISTS` para `verificado`, `token_verificacion`, `idioma` y `telefono` a TEXT; el teléfono en claro se cifra al arrancar (`database-init.js`).

## 4. Seeds

- **Base (`db/init.sql`):** Sede Centro, 4 servicios, admin/empleado con credenciales conocidas, jornadas y disponibilidad del empleado semilla, tiempos de servicio.
- **Masivo (`backend/src/utils/semillar-demo.js`):** 6 sedes, 10 servicios, 15 empleados, 80 clientes, ~1270 reservas y ~725 cobros en ±30 días, con rotación multi-sede y validaciones.
