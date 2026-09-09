---
name: clima-local
description: Consulta el clima actual y el pronóstico de los próximos días. Por defecto usa San Pablo, Cajamarca (Perú), y acepta cualquier otra ciudad como argumento. Úsalo cuando pregunten por el clima, el tiempo, la temperatura, la humedad, el viento, si va a llover, el pronóstico, la salida o puesta del sol, o cuando escriban /clima-local. Funciona sin API key y sin dependencias.
allowed-tools: Bash, Read
---

# Clima local

Obtiene el clima usando dos servicios públicos y gratuitos, sin registro ni API key:

- **Open-Meteo** (`api.open-meteo.com`) para el clima y el pronóstico.
- **Open-Meteo Geocoding** (`geocoding-api.open-meteo.com`) para convertir un nombre de ciudad en coordenadas.
- **ipapi.co** / **ip-api.com** solo si se pide detectar la ubicación por IP con `--ip`.

La ubicación por defecto es **San Pablo, Cajamarca (Perú)**, con coordenadas fijas
(`-7.1167, -78.8167`) dentro del script. Van fijas a propósito: el nombre "San Pablo"
resuelve a São Paulo (Brasil) en casi cualquier geocodificador.

## Uso

Ejecuta el script incluido. Rutas relativas a la raíz del proyecto:

```bash
# San Pablo, Cajamarca — clima actual + 3 días
python3 .claude/skills/clima-local/scripts/clima.py

# Una ciudad concreta (las comillas importan si el nombre lleva espacios)
python3 .claude/skills/clima-local/scripts/clima.py "Ciudad de México"
python3 .claude/skills/clima-local/scripts/clima.py Bogotá
python3 .claude/skills/clima-local/scripts/clima.py "Madrid, España"

# Más días de pronóstico (1 a 16)
python3 .claude/skills/clima-local/scripts/clima.py Valencia --dias 7

# Coordenadas directas, sin geocodificación
python3 .claude/skills/clima-local/scripts/clima.py --coords 19.4326,-99.1332

# Detectar la ubicación por IP en lugar de usar la de por defecto
python3 .claude/skills/clima-local/scripts/clima.py --ip

# Unidades imperiales (°F, mph)
python3 .claude/skills/clima-local/scripts/clima.py Miami --unidades imperial

# Salida JSON en crudo, para procesar en vez de leer
python3 .claude/skills/clima-local/scripts/clima.py --json
```

## Cómo elegir la ubicación

El script decide en este orden, y se queda con el primero que aplique:

1. `--coords LAT,LON`.
2. La ciudad pasada como primer argumento.
3. `--ip`, que detecta la ubicación desde la red actual.
4. La variable de entorno `CLIMA_UBICACION`, si está definida.
5. San Pablo, Cajamarca (Perú).

En la práctica: si el usuario nombra una ciudad, pásala tal cual la escribió. Si no nombra
ninguna, no preguntes ni uses `--ip`; ejecuta el script sin argumentos y responderá por
San Pablo.

## Cómo presentar el resultado

El script ya imprime un resumen formateado en español. Al responder:

- Da primero la respuesta a lo que preguntaron. Si preguntan "¿llevo paraguas?", contesta eso, no vuelques la tabla entera.
- Menciona la ciudad y el país que resolvió el script, para que el usuario detecte una geocodificación equivocada.
- Con `--ip`, la ubicación puede errar y apuntar a la ciudad del proveedor de internet. Si el resultado parece raro, dilo y sugiere pasar la ciudad explícitamente.

## Errores frecuentes

- **`No se pudo determinar la ubicación`**: solo ocurre con `--ip`, cuando no hay red o el servicio está bloqueado. Repite sin `--ip` para caer en San Pablo.
- **`No se encontró la ubicación`**: el geocodificador no reconoce el nombre. Prueba con `"Ciudad, País"` o con `--coords`.
- **Tiempo de espera agotado**: reintenta una vez. Si vuelve a fallar, informa que el servicio no responde en vez de inventar datos.

Nunca inventes valores de clima. Si el script falla, dilo.
