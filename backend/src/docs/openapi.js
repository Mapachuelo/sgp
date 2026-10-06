const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'SGP — API Sistema de Gestion de Peluqueria',
    version: '1.0.0',
    description:
      'API REST del SGP. Autenticacion por JWT (Bearer, expiracion 30 minutos). Roles: cliente, empleado, admin.',
  },
  servers: [{ url: '/api', description: 'API proxeada por Nginx' }],
  tags: [
    { name: 'Auth' },
    { name: 'Clientes' },
    { name: 'Ubicaciones' },
    { name: 'Reservas' },
    { name: 'Checkin' },
    { name: 'Reportes' },
    { name: 'Disponibilidad' },
    { name: 'Logs' },
    { name: 'Preferencias' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      RespuestaOK: {
        type: 'object',
        properties: {
          ok: { type: 'boolean', example: true },
          data: { type: 'object' },
        },
      },
      RespuestaError: {
        type: 'object',
        properties: {
          ok: { type: 'boolean', example: false },
          error: { type: 'string' },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/healthcheck': {
      get: {
        tags: ['Auth'],
        summary: 'Estado del servicio',
        security: [],
        responses: { 200: { description: 'Servicio activo' } },
      },
    },
    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Registro de cliente (envia OTP por correo, no emite JWT)',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['nombre', 'apellido', 'email', 'password', 'telefono'],
                properties: {
                  nombre: { type: 'string' },
                  apellido: { type: 'string' },
                  email: { type: 'string' },
                  password: { type: 'string' },
                  telefono: { type: 'string', example: '+573001112233' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Cuenta creada, OTP enviado' },
          400: { description: 'Datos invalidos' },
          409: { description: 'Correo ya registrado' },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login unificado (correo + password), responde token y rol',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string' },
                  password: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'JWT emitido' },
          401: { description: 'Credenciales invalidas' },
          403: { description: 'Cuenta bloqueada o no verificada' },
        },
      },
    },
    '/auth/verificar': {
      post: {
        tags: ['Auth'],
        summary: 'Verifica la cuenta con el codigo OTP y emite JWT',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'codigo'],
                properties: {
                  email: { type: 'string' },
                  codigo: { type: 'string', example: '123456' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Cuenta verificada' }, 400: { description: 'Codigo invalido o expirado' } },
      },
    },
    '/auth/reenviar-codigo': {
      post: {
        tags: ['Auth'],
        summary: 'Reenvia el codigo OTP (max 3 cada 15 min)',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', required: ['email'], properties: { email: { type: 'string' } } },
            },
          },
        },
        responses: { 200: { description: 'Codigo reenviado' }, 429: { description: 'Demasiados intentos' } },
      },
    },
    '/auth/me': {
      get: { tags: ['Auth'], summary: 'Perfil del usuario autenticado', responses: { 200: { description: 'Perfil' } } },
    },
    '/auth/empleados': {
      get: { tags: ['Auth'], summary: 'Lista empleados (admin)', responses: { 200: { description: 'Empleados' } } },
      post: {
        tags: ['Auth'],
        summary: 'Crea empleado (admin, nace verificado)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'nombre', 'apellido'],
                properties: {
                  email: { type: 'string' },
                  nombre: { type: 'string' },
                  apellido: { type: 'string' },
                  telefono: { type: 'string' },
                  password: { type: 'string' },
                  identificacion: { type: 'string' },
                  ubicacion_base_id: { type: 'integer' },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Empleado creado' } },
      },
    },
    '/auth/empleados/{id}': {
      put: { tags: ['Auth'], summary: 'Actualiza empleado (admin)', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Empleado actualizado' } } },
      delete: { tags: ['Auth'], summary: 'Elimina empleado sin cobros (admin)', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Empleado eliminado' }, 409: { description: 'Tiene cobros asociados' } } },
    },
    '/clientes/me': {
      get: { tags: ['Clientes'], summary: 'Perfil propio (cliente/empleado)', responses: { 200: { description: 'Perfil' } } },
      put: { tags: ['Clientes'], summary: 'Actualiza perfil propio (incluye identificacion del empleado)', responses: { 200: { description: 'Perfil actualizado' } } },
      delete: { tags: ['Clientes'], summary: 'Elimina la propia cuenta (cliente)', responses: { 200: { description: 'Cuenta eliminada' } } },
    },
    '/clientes': {
      get: { tags: ['Clientes'], summary: 'Lista clientes (admin)', responses: { 200: { description: 'Clientes' } } },
    },
    '/clientes/{id}/bloquear': {
      put: { tags: ['Clientes'], summary: 'Bloquea cliente (admin)', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Cliente bloqueado' } } },
    },
    '/clientes/{id}/desbloquear': {
      put: { tags: ['Clientes'], summary: 'Desbloquea cliente (admin)', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Cliente desbloqueado' } } },
    },
    '/clientes/{id}': {
      delete: { tags: ['Clientes'], summary: 'Elimina cliente con 3+ no-shows (admin)', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Cliente eliminado' }, 409: { description: 'No cumple la regla de no-shows' } } },
    },
    '/ubicaciones': {
      get: { tags: ['Ubicaciones'], summary: 'Lista sedes (publico)', security: [], responses: { 200: { description: 'Sedes' } } },
      post: {
        tags: ['Ubicaciones'],
        summary: 'Crea sede (admin)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['nombre', 'direccion', 'latitud', 'longitud'],
                properties: {
                  nombre: { type: 'string' },
                  direccion: { type: 'string' },
                  latitud: { type: 'number' },
                  longitud: { type: 'number' },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Sede creada' } },
      },
    },
    '/ubicaciones/{id}': {
      put: { tags: ['Ubicaciones'], summary: 'Actualiza sede (admin)', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Sede actualizada' } } },
      delete: { tags: ['Ubicaciones'], summary: 'Elimina sede (admin)', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Sede eliminada' } } },
    },
    '/reservas/servicios': {
      get: { tags: ['Reservas'], summary: 'Catalogo de servicios (publico)', security: [], responses: { 200: { description: 'Servicios' } } },
      post: { tags: ['Reservas'], summary: 'Crea servicio (admin)', responses: { 201: { description: 'Servicio creado' } } },
    },
    '/reservas/servicios/{id}': {
      put: { tags: ['Reservas'], summary: 'Actualiza servicio (admin)', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Servicio actualizado' } } },
      delete: { tags: ['Reservas'], summary: 'Elimina servicio (admin)', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Servicio eliminado' } } },
    },
    '/reservas/disponibilidad': {
      get: {
        tags: ['Reservas'],
        summary: 'Disponibilidad de un empleado en una sede/fecha',
        parameters: [
          { name: 'fecha', in: 'query', required: true, schema: { type: 'string', format: 'date' } },
          { name: 'empleado_id', in: 'query', required: true, schema: { type: 'integer' } },
          { name: 'ubicacion_id', in: 'query', required: true, schema: { type: 'integer' } },
        ],
        responses: { 200: { description: 'Jornada y slots ocupados' } },
      },
    },
    '/reservas/jornada': {
      get: { tags: ['Reservas'], summary: 'Jornadas de una sede (publico)', security: [], parameters: [{ name: 'ubicacion_id', in: 'query', schema: { type: 'integer' } }], responses: { 200: { description: 'Jornadas' } } },
      put: { tags: ['Reservas'], summary: 'Configura jornadas (admin)', responses: { 200: { description: 'Jornadas actualizadas' } } },
    },
    '/reservas/empleado-tiempos-servicio': {
      get: { tags: ['Reservas'], summary: 'Duraciones de servicios por empleado', responses: { 200: { description: 'Tiempos' } } },
      put: { tags: ['Reservas'], summary: 'Asigna servicios y duraciones a empleado (admin/empleado)', responses: { 200: { description: 'Tiempos actualizados' } } },
    },
    '/reservas/empleados-disponibles': {
      get: { tags: ['Reservas'], summary: 'Empleados disponibles por sede/fecha (publico)', security: [], parameters: [{ name: 'ubicacion_id', in: 'query', required: true, schema: { type: 'integer' } }, { name: 'fecha', in: 'query', required: true, schema: { type: 'string', format: 'date' } }], responses: { 200: { description: 'Empleados' } } },
    },
    '/reservas/agenda': {
      get: {
        tags: ['Reservas'],
        summary: 'Agenda de citas por rango de fechas (admin)',
        parameters: [
          { name: 'desde', in: 'query', required: true, schema: { type: 'string', format: 'date' } },
          { name: 'hasta', in: 'query', required: true, schema: { type: 'string', format: 'date' } },
          { name: 'empleado_id', in: 'query', schema: { type: 'integer' } },
        ],
        responses: { 200: { description: 'Citas del rango' }, 400: { description: 'Fechas invalidas' } },
      },
    },
    '/reservas': {
      post: {
        tags: ['Reservas'],
        summary: 'Crea reserva (cliente): valida 5 activas, 60 min de anticipacion, solape y disponibilidad; genera QR',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['empleado_id', 'servicio_id', 'ubicacion_id', 'inicia_en'],
                properties: {
                  empleado_id: { type: 'integer' },
                  servicio_id: { type: 'integer' },
                  ubicacion_id: { type: 'integer' },
                  inicia_en: { type: 'string', format: 'date-time' },
                  cantidad_personas: { type: 'integer', minimum: 1, maximum: 5 },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Reserva creada con qr_data_url' }, 409: { description: 'Solape o limite de reservas' } },
      },
      get: { tags: ['Reservas'], summary: 'Lista reservas con filtros (empleado/admin)', parameters: [{ name: 'fecha', in: 'query', schema: { type: 'string', format: 'date' } }, { name: 'ubicacion_id', in: 'query', schema: { type: 'integer' } }, { name: 'estado', in: 'query', schema: { type: 'string' } }], responses: { 200: { description: 'Reservas' } } },
    },
    '/reservas/me': {
      get: { tags: ['Reservas'], summary: 'Reservas del cliente autenticado', responses: { 200: { description: 'Reservas' } } },
    },
    '/reservas/me/{id}': {
      delete: { tags: ['Reservas'], summary: 'Cancela una reserva propia (cliente)', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Reserva cancelada' } } },
    },
    '/checkin/validar': {
      post: {
        tags: ['Checkin'],
        summary: 'Valida QR y registra check-in + cobro en una transaccion; deja la reserva en cobrado',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['qr_token'],
                properties: {
                  qr_token: { type: 'string', format: 'uuid' },
                  monto: { type: 'number', minimum: 0, description: '0 = pago online; >0 = pago fisico' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Check-in y cobro registrados' },
          400: { description: 'Fuera de la ventana +-120 min o monto invalido' },
          409: { description: 'Reserva cancelada o ya cobrada' },
        },
      },
    },
    '/reportes/ventas-diarias': {
      get: { tags: ['Reportes'], summary: 'Ventas por dia (admin)', parameters: [{ name: 'fecha', in: 'query', schema: { type: 'string', format: 'date' } }], responses: { 200: { description: 'Ventas' } } },
    },
    '/reportes/ocupacion': {
      get: { tags: ['Reportes'], summary: 'Ocupacion por sede (admin)', parameters: [{ name: 'fecha', in: 'query', schema: { type: 'string', format: 'date' } }], responses: { 200: { description: 'Ocupacion' } } },
    },
    '/reportes/clientes-recurrentes': {
      get: { tags: ['Reportes'], summary: 'Clientes recurrentes (admin)', responses: { 200: { description: 'Clientes' } } },
    },
    '/empleados/disponibilidad': {
      get: { tags: ['Disponibilidad'], summary: 'Disponibilidad semanal propia (empleado)', responses: { 200: { description: 'Bloques' } } },
      put: { tags: ['Disponibilidad'], summary: 'Actualiza disponibilidad semanal; cancela reservas futuras del dia cambiado en la sede anterior', responses: { 200: { description: 'Disponibilidad actualizada' } } },
    },
    '/empleados/{empleadoId}/disponibilidad': {
      get: { tags: ['Disponibilidad'], summary: 'Disponibilidad de un empleado (admin)', parameters: [{ name: 'empleadoId', in: 'path', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Bloques' } } },
      put: { tags: ['Disponibilidad'], summary: 'Actualiza disponibilidad de un empleado (admin)', parameters: [{ name: 'empleadoId', in: 'path', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Disponibilidad actualizada' } } },
    },
    '/empleados/disponibilidad/todas': {
      get: { tags: ['Disponibilidad'], summary: 'Disponibilidad semanal de todos los empleados (admin)', responses: { 200: { description: 'Bloques con empleado y sede' } } },
    },
    '/logs/actividad': {
      get: { tags: ['Logs'], summary: 'logs.txt con filtros (admin)', parameters: [{ name: 'filtro', in: 'query', schema: { type: 'string' } }, { name: 'fecha', in: 'query', schema: { type: 'string', format: 'date' } }, { name: 'severidad', in: 'query', schema: { type: 'string', enum: ['info', 'warn', 'error'] } }], responses: { 200: { description: 'Lineas de log' } } },
    },
    '/logs/errores': {
      get: { tags: ['Logs'], summary: 'errores.txt con filtros (admin)', responses: { 200: { description: 'Lineas de error' } } },
    },
    '/logs/exportar': {
      get: { tags: ['Logs'], summary: 'Exporta lineas filtradas a .txt (admin)', parameters: [{ name: 'tipo', in: 'query', schema: { type: 'string', enum: ['actividad', 'errores'] } }, { name: 'desde', in: 'query', schema: { type: 'integer' } }, { name: 'hasta', in: 'query', schema: { type: 'integer' } }], responses: { 200: { description: 'Archivo .txt', content: { 'text/plain': {} } } } },
    },
    '/preferencias': {
      get: { tags: ['Preferencias'], summary: 'Preferencias del usuario (rango horario, granularidad, tema, idioma)', responses: { 200: { description: 'Preferencias' } } },
      put: { tags: ['Preferencias'], summary: 'Actualiza preferencias', responses: { 200: { description: 'Preferencias actualizadas' } } },
    },
  },
};

module.exports = openapi;