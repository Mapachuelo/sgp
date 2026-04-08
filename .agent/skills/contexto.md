- Tecnologías a usar: Nodejs, postgresql, docker.
- No utilizar frameworks de css, solo css puro.
- utilizar css separado de todos los archivos.
- Requisitos:
  - El proyecto debe ser desarrollado utilizando Nodejs.
  - La base de datos debe ser postgresql.
  - El proyecto debe ser dockerizado para facilitar su despliegue y ejecución.
  - siempre utilizar javascript, no usar typescript.
  - El proyecto debe ser desarrollado siguiendo las mejores prácticas de desarrollo de software, incluyendo la modularidad, la reutilización de código y la documentación adecuada.
  - Utilizando docker para facilitar el despliegue y la gestión de dependencias, asegurando que el entorno de desarrollo sea consistente y fácil de configurar para todos los miembros del equipo.


- A lo ultimo verificar si funciona la ejecución de docker.
Ejecutar el docker con los nuevos cambios:
``bash
docker compose up --build -d
``
y para parar el servicio:
```bash
docker compose stop
```
no borrarlo.

- Flujo funcional obligatorio actual:
  - La ruta `/` es el dashboard principal en blanco y solo muestra dos acciones: `Ver calendario` e `Iniciar sesion`.
  - El login es unificado en `/ui/login` con selector de rol (`client`, `empleado`, `admin`).
  - Los formularios de login antiguos embebidos en vistas de cliente, empleado y administrador no se deben volver a crear.
  - El registro de nueva cuenta solo aplica para `client` y pide: nombre, apellido, numero, correo y password.
  - `empleado` y `admin` solo ingresan con cuentas asignadas.
  - Usar token de sesion unificado en frontend: `sgp_token`.
  - Mantener estilos existentes; solo cambios minimos de CSS para soportar nuevas vistas o campos requeridos.