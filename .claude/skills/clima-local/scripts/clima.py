#!/usr/bin/env python3
"""Clima actual y pronóstico usando Open-Meteo. Solo librería estándar."""

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

TIMEOUT = 12
AGENTE = "clima-local-skill/1.0"

# Ubicación por defecto cuando no se indica ninguna otra.
# Las coordenadas van fijas en vez de geocodificarse porque el nombre "San Pablo"
# resuelve a São Paulo (Brasil) en la mayoría de los geocodificadores.
UBICACION_POR_DEFECTO = {
    "latitud": -7.1167,
    "longitud": -78.8167,
    "nombre": "San Pablo, Cajamarca",
    "pais": "Perú",
    "origen": "por defecto",
}

# Códigos WMO -> (emoji, descripción en español)
CODIGOS = {
    0: ("☀️", "Despejado"),
    1: ("🌤️", "Mayormente despejado"),
    2: ("⛅", "Parcialmente nublado"),
    3: ("☁️", "Nublado"),
    45: ("🌫️", "Niebla"),
    48: ("🌫️", "Niebla con escarcha"),
    51: ("🌦️", "Llovizna ligera"),
    53: ("🌦️", "Llovizna moderada"),
    55: ("🌧️", "Llovizna densa"),
    56: ("🌧️", "Llovizna helada ligera"),
    57: ("🌧️", "Llovizna helada densa"),
    61: ("🌦️", "Lluvia ligera"),
    63: ("🌧️", "Lluvia moderada"),
    65: ("🌧️", "Lluvia fuerte"),
    66: ("🌧️", "Lluvia helada ligera"),
    67: ("🌧️", "Lluvia helada fuerte"),
    71: ("🌨️", "Nevada ligera"),
    73: ("🌨️", "Nevada moderada"),
    75: ("❄️", "Nevada fuerte"),
    77: ("🌨️", "Granos de nieve"),
    80: ("🌦️", "Chubascos ligeros"),
    81: ("🌧️", "Chubascos moderados"),
    82: ("⛈️", "Chubascos violentos"),
    85: ("🌨️", "Chubascos de nieve ligeros"),
    86: ("❄️", "Chubascos de nieve fuertes"),
    95: ("⛈️", "Tormenta"),
    96: ("⛈️", "Tormenta con granizo ligero"),
    99: ("⛈️", "Tormenta con granizo fuerte"),
}

DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
         "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
RUMBOS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
          "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO"]


class ErrorClima(Exception):
    """Fallo esperado que se reporta al usuario sin traza."""


def pedir_json(url):
    peticion = urllib.request.Request(url, headers={"User-Agent": AGENTE})
    try:
        with urllib.request.urlopen(peticion, timeout=TIMEOUT) as respuesta:
            return json.loads(respuesta.read().decode("utf-8"))
    except urllib.error.HTTPError as err:
        raise ErrorClima("El servicio respondió %s en %s" % (err.code, url))
    except urllib.error.URLError as err:
        raise ErrorClima("No hay conexión con %s (%s)" % (url, err.reason))
    except (ValueError, OSError) as err:
        raise ErrorClima("Respuesta ilegible de %s (%s)" % (url, err))


def describir(codigo):
    return CODIGOS.get(codigo, ("🌡️", "Condición desconocida (código %s)" % codigo))


def rumbo(grados):
    if grados is None:
        return ""
    return RUMBOS[int((grados % 360) / 22.5 + 0.5) % 16]


def fecha_larga(iso):
    """'2026-09-09' -> 'miércoles 9 de septiembre'. Sin dependencias de locale."""
    try:
        anio, mes, dia = (int(parte) for parte in iso.split("-"))
    except ValueError:
        return iso
    # Algoritmo de Sakamoto para el día de la semana.
    tabla = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4]
    y = anio - (1 if mes < 3 else 0)
    indice = (y + y // 4 - y // 100 + y // 400 + tabla[mes - 1] + dia) % 7
    nombre = DIAS[(indice + 6) % 7]  # Sakamoto empieza en domingo; DIAS en lunes.
    return "%s %d de %s" % (nombre, dia, MESES[mes - 1])


def ubicacion_por_ip():
    for url, campos in (
        ("https://ipapi.co/json/", ("latitude", "longitude", "city", "country_name")),
        ("http://ip-api.com/json/", ("lat", "lon", "city", "country")),
    ):
        try:
            datos = pedir_json(url)
        except ErrorClima:
            continue
        lat, lon = datos.get(campos[0]), datos.get(campos[1])
        if lat is None or lon is None:
            continue
        return {
            "latitud": float(lat),
            "longitud": float(lon),
            "nombre": datos.get(campos[2]) or "Ubicación detectada",
            "pais": datos.get(campos[3]) or "",
            "origen": "IP",
        }
    raise ErrorClima(
        "No se pudo determinar la ubicación por IP. Indica una ciudad como argumento."
    )


def geocodificar(nombre):
    url = "https://geocoding-api.open-meteo.com/v1/search?" + urllib.parse.urlencode(
        {"name": nombre, "count": 1, "language": "es", "format": "json"}
    )
    datos = pedir_json(url)
    resultados = datos.get("results") or []
    if not resultados:
        raise ErrorClima(
            'No se encontró la ubicación "%s". Prueba con "Ciudad, País".' % nombre
        )
    lugar = resultados[0]
    region = lugar.get("admin1") or ""
    return {
        "latitud": lugar["latitude"],
        "longitud": lugar["longitude"],
        "nombre": lugar["name"] + (", " + region if region else ""),
        "pais": lugar.get("country") or "",
        "origen": "búsqueda",
    }


def consultar_clima(lugar, dias, imperial):
    parametros = {
        "latitude": lugar["latitud"],
        "longitude": lugar["longitud"],
        "current": ",".join([
            "temperature_2m", "apparent_temperature", "relative_humidity_2m",
            "precipitation", "weather_code", "wind_speed_10m", "wind_direction_10m",
        ]),
        "daily": ",".join([
            "weather_code", "temperature_2m_max", "temperature_2m_min",
            "precipitation_probability_max", "sunrise", "sunset",
        ]),
        "timezone": "auto",
        "forecast_days": dias,
    }
    if imperial:
        parametros["temperature_unit"] = "fahrenheit"
        parametros["wind_speed_unit"] = "mph"
    url = "https://api.open-meteo.com/v1/forecast?" + urllib.parse.urlencode(parametros)
    return pedir_json(url)


def formatear(lugar, clima):
    actual = clima.get("current") or {}
    unidades = clima.get("current_units") or {}
    grado = unidades.get("temperature_2m", "°C")
    viento_u = unidades.get("wind_speed_10m", "km/h")
    emoji, descripcion = describir(actual.get("weather_code"))

    encabezado = lugar["nombre"]
    if lugar["pais"]:
        encabezado += " (%s)" % lugar["pais"]

    lineas = [
        "",
        "  %s  %s" % (emoji, encabezado),
        "  " + "─" * (len(encabezado) + 4),
        "",
        "  Ahora        %s%s · %s" % (actual.get("temperature_2m", "?"), grado, descripcion),
        "  Sensación    %s%s" % (actual.get("apparent_temperature", "?"), grado),
        "  Humedad      %s%%" % actual.get("relative_humidity_2m", "?"),
        "  Viento       %s %s %s" % (
            actual.get("wind_speed_10m", "?"),
            viento_u,
            rumbo(actual.get("wind_direction_10m")),
        ),
        "  Precipitac.  %s %s" % (
            actual.get("precipitation", "?"),
            unidades.get("precipitation", "mm"),
        ),
        "",
    ]

    diario = clima.get("daily") or {}
    fechas = diario.get("time") or []
    if fechas:
        lineas.append("  Pronóstico")
        for i, fecha in enumerate(fechas):
            e, d = describir(diario["weather_code"][i])
            lluvia = diario["precipitation_probability_max"][i]
            amanecer = (diario["sunrise"][i] or "")[-5:]
            atardecer = (diario["sunset"][i] or "")[-5:]
            lineas.append("    %s %-32s" % (e, fecha_larga(fecha)))
            lineas.append("       %s / %s%s · %s" % (
                diario["temperature_2m_min"][i],
                diario["temperature_2m_max"][i],
                grado,
                d,
            ))
            lineas.append("       lluvia %s%%  ☀ %s  🌙 %s" % (
                "?" if lluvia is None else lluvia, amanecer, atardecer
            ))
        lineas.append("")

    zona = clima.get("timezone")
    if zona:
        lineas.append("  Zona horaria: %s · Fuente: Open-Meteo" % zona)
        lineas.append("")
    return "\n".join(lineas)


def main():
    analizador = argparse.ArgumentParser(
        description="Clima actual y pronóstico (Open-Meteo, sin API key)."
    )
    analizador.add_argument("ubicacion", nargs="?", help='Ciudad, p. ej. "Madrid, España"')
    analizador.add_argument("--coords", help="Coordenadas directas: LAT,LON")
    analizador.add_argument("--ip", action="store_true",
                            help="Detecta la ubicación por IP en vez de usar la de por defecto")
    analizador.add_argument("--dias", type=int, default=3, help="Días de pronóstico (1-16)")
    analizador.add_argument("--unidades", choices=["metrico", "imperial"], default="metrico")
    analizador.add_argument("--json", action="store_true", dest="crudo",
                            help="Imprime el JSON de Open-Meteo sin formatear")
    args = analizador.parse_args()

    if not 1 <= args.dias <= 16:
        print("Error: --dias debe estar entre 1 y 16.", file=sys.stderr)
        return 2

    try:
        if args.coords:
            partes = args.coords.split(",")
            if len(partes) != 2:
                raise ErrorClima("--coords espera el formato LAT,LON")
            try:
                lat, lon = float(partes[0]), float(partes[1])
            except ValueError:
                raise ErrorClima("--coords espera dos números: LAT,LON")
            lugar = {"latitud": lat, "longitud": lon,
                     "nombre": "%.4f, %.4f" % (lat, lon), "pais": "", "origen": "coordenadas"}
        elif args.ubicacion:
            lugar = geocodificar(args.ubicacion)
        elif args.ip:
            lugar = ubicacion_por_ip()
        elif os.environ.get("CLIMA_UBICACION"):
            lugar = geocodificar(os.environ["CLIMA_UBICACION"])
        else:
            lugar = dict(UBICACION_POR_DEFECTO)

        clima = consultar_clima(lugar, args.dias, args.unidades == "imperial")
    except ErrorClima as err:
        print("Error: %s" % err, file=sys.stderr)
        return 1

    if args.crudo:
        print(json.dumps({"lugar": lugar, "clima": clima}, ensure_ascii=False, indent=2))
    else:
        print(formatear(lugar, clima))
    return 0


if __name__ == "__main__":
    sys.exit(main())
