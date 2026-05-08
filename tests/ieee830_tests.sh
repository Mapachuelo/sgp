#!/bin/bash
# =============================================================================
# SGP - Plan de Pruebas (IEEE 830)
# =============================================================================
# Propósito: Validar conexión a BD, autenticación y disponibilidad de citas.
# Alcance: MVP del Sistema de Gestión de Peluquería (SGP).
# =============================================================================

BASE_URL="${BASE_URL:-http://localhost:3000}"
PASS=0
FAIL=0
TOTAL=0

# Colores para salida
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_result() {
  local test_id="$1"
  local description="$2"
  local expected="$3"
  local actual="$4"
  local status="$5"

  TOTAL=$((TOTAL + 1))

  if [ "$status" = "PASS" ]; then
    PASS=$((PASS + 1))
    echo -e "${GREEN}[PASS]${NC} $test_id - $description"
  else
    FAIL=$((FAIL + 1))
    echo -e "${RED}[FAIL]${NC} $test_id - $description"
    echo -e "       Esperado: $expected"
    echo -e "       Obtenido: $actual"
  fi
}

# =============================================================================
# SECCIÓN 1: Conexión a Base de Datos (RNF6 - Portabilidad)
# =============================================================================
echo -e "\n${YELLOW}=== SECCIÓN 1: Conexión a Base de Datos ===${NC}"

# TC-DB-01: Health Check del servicio
echo -e "\n--- TC-DB-01: Health Check del servicio ---"
HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/health" 2>/dev/null)
if [ "$HEALTH_RESPONSE" = "200" ]; then
  log_result "TC-DB-01" "Health Check responde 200" "200" "$HEALTH_RESPONSE" "PASS"
else
  log_result "TC-DB-01" "Health Check responde 200" "200" "$HEALTH_RESPONSE" "FAIL"
fi

# TC-DB-02: Health Check devuelve JSON válido
echo -e "\n--- TC-DB-02: Health Check devuelve JSON válido ---"
HEALTH_BODY=$(curl -s "$BASE_URL/health" 2>/dev/null)
HEALTH_OK=$(echo "$HEALTH_BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('ok',''))" 2>/dev/null)
if [ "$HEALTH_OK" = "True" ]; then
  log_result "TC-DB-02" "Health Check devuelve ok=true" "True" "$HEALTH_OK" "PASS"
else
  log_result "TC-DB-02" "Health Check devuelve ok=true" "True" "$HEALTH_OK" "FAIL"
fi

# TC-DB-03: Conexión directa a PostgreSQL
echo -e "\n--- TC-DB-03: Conexión directa a PostgreSQL ---"
DB_CHECK=$(podman exec podman-db-1 psql -U sgp_user -d sgp -p 5432 -c "SELECT 1;" 2>&1)
if echo "$DB_CHECK" | grep -q "1 row"; then
  log_result "TC-DB-03" "PostgreSQL acepta conexiones" "1 row" "conexión exitosa" "PASS"
else
  log_result "TC-DB-03" "PostgreSQL acepta conexiones" "1 row" "$DB_CHECK" "FAIL"
fi

# TC-DB-04: Tablas existen en la BD
echo -e "\n--- TC-DB-04: Tablas esenciales existen ---"
TABLES=$(podman exec podman-db-1 psql -U sgp_user -d sgp -p 5432 -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('app_user','reservation','service_catalog','work_schedule');" 2>&1 | tr -d ' ')
if [ "$TABLES" = "4" ]; then
  log_result "TC-DB-04" "4 tablas esenciales existen" "4" "$TABLES" "PASS"
else
  log_result "TC-DB-04" "4 tablas esenciales existen" "4" "$TABLES" "FAIL"
fi

# =============================================================================
# SECCIÓN 2: Autenticación (RF0 - Login Unificado)
# =============================================================================
echo -e "\n${YELLOW}=== SECCIÓN 2: Autenticación (RF0) ===${NC}"

# TC-AUTH-01: Login admin exitoso
echo -e "\n--- TC-AUTH-01: Login admin exitoso ---"
ADMIN_LOGIN=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@sgp.local","password":"admin123"}' 2>/dev/null)
ADMIN_OK=$(echo "$ADMIN_LOGIN" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('ok',''))" 2>/dev/null)
if [ "$ADMIN_OK" = "True" ]; then
  log_result "TC-AUTH-01" "Login admin devuelve ok=true" "True" "$ADMIN_OK" "PASS"
  ADMIN_TOKEN=$(echo "$ADMIN_LOGIN" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['token'])" 2>/dev/null)
else
  log_result "TC-AUTH-01" "Login admin devuelve ok=true" "True" "$ADMIN_OK" "FAIL"
  ADMIN_TOKEN=""
fi

# TC-AUTH-02: Login empleado exitoso
echo -e "\n--- TC-AUTH-02: Login empleado exitoso ---"
EMP_LOGIN=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"empleado@sgp.local","password":"empleado123"}' 2>/dev/null)
EMP_OK=$(echo "$EMP_LOGIN" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('ok',''))" 2>/dev/null)
if [ "$EMP_OK" = "True" ]; then
  log_result "TC-AUTH-02" "Login empleado devuelve ok=true" "True" "$EMP_OK" "PASS"
  EMP_TOKEN=$(echo "$EMP_LOGIN" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['token'])" 2>/dev/null)
else
  log_result "TC-AUTH-02" "Login empleado devuelve ok=true" "True" "$EMP_OK" "FAIL"
  EMP_TOKEN=""
fi

# TC-AUTH-03: Login con credenciales inválidas
echo -e "\n--- TC-AUTH-03: Login con credenciales inválidas ---"
BAD_LOGIN=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"fake@test.com","password":"wrong"}' 2>/dev/null)
BAD_OK=$(echo "$BAD_LOGIN" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('ok',''))" 2>/dev/null)
if [ "$BAD_OK" = "False" ]; then
  log_result "TC-AUTH-03" "Login inválido devuelve ok=false" "False" "$BAD_OK" "PASS"
else
  log_result "TC-AUTH-03" "Login inválido devuelve ok=false" "False" "$BAD_OK" "FAIL"
fi

# TC-AUTH-04: Token JWT contiene rol
echo -e "\n--- TC-AUTH-04: Token JWT contiene rol ---"
if [ -n "$ADMIN_TOKEN" ]; then
  ADMIN_ROLE=$(echo "$ADMIN_LOGIN" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['user']['role'])" 2>/dev/null)
  if [ "$ADMIN_ROLE" = "admin" ]; then
    log_result "TC-AUTH-04" "Token admin contiene rol=admin" "admin" "$ADMIN_ROLE" "PASS"
  else
    log_result "TC-AUTH-04" "Token admin contiene rol=admin" "admin" "$ADMIN_ROLE" "FAIL"
  fi
else
  log_result "TC-AUTH-04" "Token admin contiene rol=admin" "admin" "sin token" "FAIL"
fi

# TC-AUTH-05: Endpoint /api/auth/me con token válido
echo -e "\n--- TC-AUTH-05: Endpoint /api/auth/me con token válido ---"
if [ -n "$ADMIN_TOKEN" ]; then
  ME_RESPONSE=$(curl -s "$BASE_URL/api/auth/me" \
    -H "Authorization: Bearer $ADMIN_TOKEN" 2>/dev/null)
  ME_OK=$(echo "$ME_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('ok',''))" 2>/dev/null)
  if [ "$ME_OK" = "True" ]; then
    log_result "TC-AUTH-05" "/api/auth/me devuelve ok=true" "True" "$ME_OK" "PASS"
  else
    log_result "TC-AUTH-05" "/api/auth/me devuelve ok=true" "True" "$ME_OK" "FAIL"
  fi
else
  log_result "TC-AUTH-05" "/api/auth/me devuelve ok=true" "True" "sin token" "FAIL"
fi

# =============================================================================
# SECCIÓN 3: Disponibilidad de Citas (RF2 - Reserva de Cita)
# =============================================================================
echo -e "\n${YELLOW}=== SECCIÓN 3: Disponibilidad de Citas (RF2) ===${NC}"

# TC-AVAIL-01: Endpoint de disponibilidad responde
echo -e "\n--- TC-AVAIL-01: Endpoint de disponibilidad responde ---"
if [ -n "$ADMIN_TOKEN" ]; then
  TODAY=$(date +%Y-%m-%d)
  AVAIL_RESPONSE=$(curl -s "$BASE_URL/api/reservations/availability?date=$TODAY" \
    -H "Authorization: Bearer $ADMIN_TOKEN" 2>/dev/null)
  AVAIL_OK=$(echo "$AVAIL_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('ok',''))" 2>/dev/null)
  if [ "$AVAIL_OK" = "True" ]; then
    log_result "TC-AVAIL-01" "Disponibilidad responde ok=true" "True" "$AVAIL_OK" "PASS"
  else
    log_result "TC-AVAIL-01" "Disponibilidad responde ok=true" "True" "$AVAIL_OK" "FAIL"
  fi
else
  log_result "TC-AVAIL-01" "Disponibilidad responde ok=true" "True" "sin token" "FAIL"
fi

# TC-AVAIL-02: Endpoint de servicios responde
echo -e "\n--- TC-AVAIL-02: Endpoint de servicios responde ---"
if [ -n "$ADMIN_TOKEN" ]; then
  SVC_RESPONSE=$(curl -s "$BASE_URL/api/reservations/services" \
    -H "Authorization: Bearer $ADMIN_TOKEN" 2>/dev/null)
  SVC_OK=$(echo "$SVC_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('ok',''))" 2>/dev/null)
  if [ "$SVC_OK" = "True" ]; then
    log_result "TC-AVAIL-02" "Servicios responde ok=true" "True" "$SVC_OK" "PASS"
  else
    log_result "TC-AVAIL-02" "Servicios responde ok=true" "True" "$SVC_OK" "FAIL"
  fi
else
  log_result "TC-AVAIL-02" "Servicios responde ok=true" "True" "sin token" "FAIL"
fi

# TC-AVAIL-03: Endpoint de empleados responde
echo -e "\n--- TC-AVAIL-03: Endpoint de empleados responde ---"
if [ -n "$ADMIN_TOKEN" ]; then
  EMP_RESPONSE=$(curl -s "$BASE_URL/api/auth/stylists" \
    -H "Authorization: Bearer $ADMIN_TOKEN" 2>/dev/null)
  EMP_OK=$(echo "$EMP_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('ok',''))" 2>/dev/null)
  if [ "$EMP_OK" = "True" ]; then
    log_result "TC-AVAIL-03" "Empleados responde ok=true" "True" "$EMP_OK" "PASS"
  else
    log_result "TC-AVAIL-03" "Empleados responde ok=true" "True" "$EMP_OK" "FAIL"
  fi
else
  log_result "TC-AVAIL-03" "Empleados responde ok=true" "True" "sin token" "FAIL"
fi

# TC-AVAIL-04: Work schedule responde
echo -e "\n--- TC-AVAIL-04: Work schedule responde ---"
if [ -n "$ADMIN_TOKEN" ]; then
  TODAY=$(date +%Y-%m-%d)
  WS_RESPONSE=$(curl -s "$BASE_URL/api/reservations/work-schedule?start=$TODAY&days=7" \
    -H "Authorization: Bearer $ADMIN_TOKEN" 2>/dev/null)
  WS_OK=$(echo "$WS_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('ok',''))" 2>/dev/null)
  if [ "$WS_OK" = "True" ]; then
    log_result "TC-AVAIL-04" "Work schedule responde ok=true" "True" "$WS_OK" "PASS"
  else
    log_result "TC-AVAIL-04" "Work schedule responde ok=true" "True" "$WS_OK" "FAIL"
  fi
else
  log_result "TC-AVAIL-04" "Work schedule responde ok=true" "True" "sin token" "FAIL"
fi

# =============================================================================
# RESUMEN
# =============================================================================
echo -e "\n${YELLOW}=== RESUMEN DE PRUEBAS ===${NC}"
echo -e "Total: $TOTAL"
echo -e "${GREEN}Pasaron: $PASS${NC}"
echo -e "${RED}Fallaron: $FAIL${NC}"

if [ $FAIL -eq 0 ]; then
  echo -e "\n${GREEN}✓ Todas las pruebas pasaron exitosamente${NC}"
  exit 0
else
  echo -e "\n${RED}✗ Algunas pruebas fallaron${NC}"
  exit 1
fi
