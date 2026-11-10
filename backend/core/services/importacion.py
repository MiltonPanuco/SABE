"""
Importación de CSV: padrón de alumnos y cargas académicas, en dos pasos.

1. Vista previa: lee el archivo, valida cada fila y no escribe nada.
2. Confirmar: vuelve a analizar el mismo archivo (no se guarda nada entre pasos), importa las
   filas válidas en una sola transacción, omite las que tienen error y deja el historial
   (`ImportacionCSV`) y la bitácora.

Reimportar no duplica: el alumno se identifica por matrícula (se actualizan sus datos, nunca su
contraseña) y la carga por alumno y grupo del periodo activo (solo se agregan cargas; una baja
aprobada se respeta). Un alumno nuevo recibe una contraseña temporal aleatoria que se devuelve una
sola vez, y debe cambiarla al entrar.
"""

import csv
import io
import secrets
import unicodedata
from collections import defaultdict
from dataclasses import asdict, dataclass, field
from typing import Any

from django.contrib.auth.hashers import make_password
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import IntegrityError, transaction
from django.db.models.functions import Lower, Upper

from core.models import (
    CargaAcademica,
    Estudiante,
    Grupo,
    ImportacionCSV,
    PeriodoEscolar,
    Programa,
    Rol,
    Turno,
    UnidadAprendizaje,
    Usuario,
)
from core.services.avisos import registrar
from core.services.catalogo import con_cupo
from core.services.choques import choques_entre

Tipo = ImportacionCSV.Tipo

COLUMNAS = {
    Tipo.ALUMNOS: ["matricula", "nombre", "apellidos", "email", "programa", "semestre", "turno"],
    Tipo.CARGAS: ["matricula", "clave_materia", "num_grupo", "ciclo"],
}
MAX_BYTES = 25 * 1024 * 1024
TAM_MUESTRA = 10
DOMINIOS = ("@uan.edu.mx", "@alumnos.uan.edu.mx")
# Sin 0/O, 1/l/I: la contraseña se lee de una hoja y se teclea.
ALFABETO = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
LARGO_TEMPORAL = 10


class ImportacionInvalida(Exception):
    """Error del archivo completo o de la importación, con el formato de DRF."""

    def __init__(self, datos: dict):
        super().__init__(datos)
        self.datos = datos


class Accion:
    NUEVO = "nuevo"
    ACTUALIZACION = "actualizacion"
    SIN_CAMBIOS = "sin_cambios"
    NUEVA = "nueva"
    BAJA_RESPETADA = "baja_respetada"


@dataclass
class FilaValida:
    linea: int
    datos: dict[str, Any]
    accion: str
    avisos: list[str] = field(default_factory=list)
    # Objetos para confirmar; no salen en la API.
    interno: dict[str, Any] = field(default_factory=dict, repr=False)

    def publica(self) -> dict:
        return {"linea": self.linea, "datos": self.datos, "accion": self.accion, "avisos": self.avisos}


@dataclass
class FilaError:
    linea: int
    matricula: str
    datos: str  # dato clave para ubicar la fila: nombre, "Clave: ECO-999" o "Grupo: 09"
    mensaje: str


@dataclass
class Analisis:
    total: int
    validas: list[FilaValida]
    errores: list[FilaError]


def _normal(texto: str) -> str:
    """Minúsculas y sin acentos, para comparar programas y turnos."""
    sin = unicodedata.normalize("NFD", texto.strip().lower())
    return "".join(c for c in sin if unicodedata.category(c) != "Mn")


def _espacios(texto: str) -> str:
    return " ".join(texto.split())


def _grupo_normal(num: str) -> str:
    """"1" y "01" son el mismo grupo."""
    num = num.strip().upper()
    return num.zfill(2) if num.isdigit() else num


# ---------------------------------------------------------------------------
# Lectura
# ---------------------------------------------------------------------------

def leer_csv(archivo, tipo: str) -> list[tuple[int, dict[str, str]]]:
    """Filas del archivo como (línea, {columna: valor}). La línea 1 es el encabezado."""
    if archivo.size > MAX_BYTES:
        raise ImportacionInvalida({"archivo": ["El archivo supera el máximo de 25 MB."]})
    try:
        texto = archivo.read().decode("utf-8-sig")
    except UnicodeDecodeError:
        raise ImportacionInvalida({"archivo": ["El archivo no está en UTF-8."]}) from None

    primera = texto.split("\n", 1)[0]
    separador = ";" if primera.count(";") > primera.count(",") else ","
    lector = csv.reader(io.StringIO(texto), delimiter=separador)
    encabezado = next(lector, None)
    if not encabezado or not any(c.strip() for c in encabezado):
        raise ImportacionInvalida({"archivo": ["El archivo está vacío."]})

    columnas = [c.strip().lower() for c in encabezado]
    esperadas = COLUMNAS[tipo]
    faltan = [c for c in esperadas if c not in columnas]
    sobran = [c for c in columnas if c and c not in esperadas]
    problemas = []
    if faltan:
        problemas.append(f"Faltan columnas: {', '.join(faltan)}.")
    if sobran:
        problemas.append(f"Columnas desconocidas: {', '.join(sobran)}.")
    if problemas:
        raise ImportacionInvalida({"archivo": problemas})

    posicion = {c: columnas.index(c) for c in esperadas}
    filas = []
    for celdas in lector:
        if not any(c.strip() for c in celdas):
            continue
        filas.append(
            (
                lector.line_num,
                {c: celdas[i].strip() if i < len(celdas) else "" for c, i in posicion.items()},
            )
        )
    if not filas:
        raise ImportacionInvalida({"archivo": ["El archivo no tiene filas."]})
    return filas


# ---------------------------------------------------------------------------
# Padrón de alumnos
# ---------------------------------------------------------------------------

def analizar_alumnos(filas: list[tuple[int, dict[str, str]]]) -> Analisis:
    matriculas = {f["matricula"] for _, f in filas}
    correos = {f["email"].lower() for _, f in filas}
    existentes = {
        e.matricula: e
        for e in Estudiante.objects.filter(matricula__in=matriculas).select_related("usuario", "programa")
    }
    cuentas = dict(Usuario.objects.filter(username__in=matriculas).values_list("username", "rol"))
    duenos_correo = dict(
        Usuario.objects.annotate(correo=Lower("email")).filter(correo__in=correos).values_list("correo", "username")
    )
    programas = {}
    for programa in Programa.objects.all():
        programas[_normal(programa.clave)] = programa
        programas[_normal(programa.nombre)] = programa

    validas, errores = [], []
    linea_matricula: dict[str, int] = {}
    linea_correo: dict[str, int] = {}
    for linea, f in filas:
        matricula = f["matricula"]
        nombre, apellidos = _espacios(f["nombre"]), _espacios(f["apellidos"])
        correo = f["email"].lower()

        def error(mensaje):
            errores.append(FilaError(linea, matricula, _espacios(f"{nombre} {apellidos}"), mensaje))

        if not (matricula.isdigit() and len(matricula) == 9):
            error("La matrícula debe tener 9 dígitos.")
            continue
        if matricula in linea_matricula:
            error(f"Matrícula repetida en este archivo CSV (duplicada en línea {linea_matricula[matricula]})")
            continue
        linea_matricula[matricula] = linea
        if matricula in cuentas and matricula not in existentes:
            error(
                "La matrícula pertenece a una cuenta de personal."
                if cuentas[matricula] != Rol.ESTUDIANTE
                else "La matrícula ya tiene una cuenta sin expediente de alumno."
            )
            continue
        if not nombre or not apellidos:
            error("Faltan el nombre o los apellidos.")
            continue
        try:
            validate_email(correo)
            valido = correo.endswith(DOMINIOS)
        except ValidationError:
            valido = False
        if not valido:
            error("Correo institucional inválido (@uan.edu.mx o @alumnos.uan.edu.mx).")
            continue
        if correo in linea_correo:
            error(f"Correo repetido en este archivo CSV (duplicado en línea {linea_correo[correo]})")
            continue
        linea_correo[correo] = linea
        if duenos_correo.get(correo, matricula) != matricula:
            error("El correo ya pertenece a otra cuenta.")
            continue
        programa = programas.get(_normal(f["programa"]))
        if programa is None:
            error(f"Programa inexistente: {f['programa'] or '(vacío)'}.")
            continue
        semestre = int(f["semestre"]) if f["semestre"].isdigit() else 0
        if not 1 <= semestre <= 10:
            error("El semestre debe ser un entero de 1 a 10.")
            continue
        turno = _normal(f["turno"])
        if turno not in ("", Turno.MATUTINO, Turno.VESPERTINO):
            error("El turno debe ser Matutino o Vespertino.")
            continue

        estudiante = existentes.get(matricula)
        if estudiante is None:
            accion = Accion.NUEVO
        else:
            u = estudiante.usuario
            igual = (u.first_name, u.last_name, u.email.lower(), estudiante.programa_id, estudiante.semestre,
                     estudiante.turno) == (nombre, apellidos, correo, programa.pk, semestre, turno)
            accion = Accion.SIN_CAMBIOS if igual else Accion.ACTUALIZACION
        validas.append(
            FilaValida(
                linea,
                {
                    "matricula": matricula,
                    "nombre": nombre,
                    "apellidos": apellidos,
                    "email": correo,
                    "programa": programa.nombre,
                    "semestre": semestre,
                    "turno": turno,
                },
                accion,
                interno={"estudiante": estudiante, "programa": programa},
            )
        )
    return Analisis(len(filas), validas, errores)


def _contrasena_temporal() -> str:
    return "".join(secrets.choice(ALFABETO) for _ in range(LARGO_TEMPORAL))


def _importar_alumnos(analisis: Analisis) -> tuple[int, int, list[dict]]:
    nuevos, credenciales, cambiados = [], [], []
    for fila in analisis.validas:
        d, estudiante = fila.datos, fila.interno["estudiante"]
        if estudiante is None:
            temporal = _contrasena_temporal()
            usuario = Usuario(
                username=d["matricula"],
                first_name=d["nombre"],
                last_name=d["apellidos"],
                email=d["email"],
                rol=Rol.ESTUDIANTE,
                debe_cambiar_password=True,
                password=make_password(temporal, hasher="pbkdf2_temporal"),
            )
            nuevos.append((usuario, fila))
            credenciales.append(
                {
                    "matricula": d["matricula"],
                    "nombre": f"{d['nombre']} {d['apellidos']}",
                    "email": d["email"],
                    "password": temporal,
                }
            )
        elif fila.accion == Accion.ACTUALIZACION:
            u = estudiante.usuario
            u.first_name, u.last_name, u.email = d["nombre"], d["apellidos"], d["email"]
            estudiante.programa = fila.interno["programa"]
            estudiante.semestre, estudiante.turno = d["semestre"], d["turno"]
            cambiados.append(estudiante)

    Usuario.objects.bulk_create([u for u, _ in nuevos])
    Estudiante.objects.bulk_create(
        [
            Estudiante(
                usuario=u,
                matricula=f.datos["matricula"],
                programa=f.interno["programa"],
                semestre=f.datos["semestre"],
                turno=f.datos["turno"],
            )
            for u, f in nuevos
        ]
    )
    Usuario.objects.bulk_update([e.usuario for e in cambiados], ["first_name", "last_name", "email"])
    Estudiante.objects.bulk_update(cambiados, ["programa", "semestre", "turno"])
    return len(nuevos), len(analisis.validas) - len(nuevos), credenciales


# ---------------------------------------------------------------------------
# Cargas académicas
# ---------------------------------------------------------------------------

def analizar_cargas(filas: list[tuple[int, dict[str, str]]], periodo: PeriodoEscolar) -> Analisis:
    matriculas = {f["matricula"] for _, f in filas}
    claves = {f["clave_materia"].upper() for _, f in filas}
    estudiantes = {
        e.matricula: e for e in Estudiante.objects.filter(matricula__in=matriculas).select_related("usuario")
    }
    materias = {
        m.clave.upper(): m
        for m in UnidadAprendizaje.objects.annotate(c=Upper("clave")).filter(c__in=claves)
    }
    grupos: dict[tuple[int, str], Grupo] = {}
    grupos_de: dict[int, list[str]] = defaultdict(list)
    for g in con_cupo(Grupo.objects.filter(periodo=periodo, materia__in=materias.values())).order_by("num_grupo"):
        grupos[(g.materia_id, _grupo_normal(g.num_grupo))] = g
        grupos_de[g.materia_id].append(g.num_grupo)

    cargas = {}
    inscritas: dict[int, list[Grupo]] = defaultdict(list)
    for carga in (
        CargaAcademica.objects.filter(estudiante__in=estudiantes.values(), grupo__periodo=periodo)
        .select_related("grupo__materia")
        .prefetch_related("grupo__horarios")
    ):
        cargas[(carga.estudiante_id, carga.grupo_id)] = carga
        if carga.estado == CargaAcademica.Estado.INSCRITO:
            inscritas[carga.estudiante_id].append(carga.grupo)

    validas, errores = [], []
    linea_carga: dict[tuple[int, int], int] = {}
    materia_en_archivo: dict[tuple[int, int], tuple[Grupo, int]] = {}
    nuevas_por_grupo: dict[int, int] = defaultdict(int)
    nuevas_del_alumno: dict[int, list[Grupo]] = defaultdict(list)
    for linea, f in filas:
        matricula, clave = f["matricula"], f["clave_materia"].upper()
        estudiante = estudiantes.get(matricula)
        materia = materias.get(clave)
        nombre = _espacios(estudiante.usuario.get_full_name()) if estudiante else ""

        def error(mensaje, datos=None):
            errores.append(FilaError(linea, matricula, datos or nombre or matricula, mensaje))

        if estudiante is None:
            error("Alumno inexistente: importa primero el padrón.")
            continue
        if f["ciclo"].upper() != periodo.ciclo:
            error(f"El ciclo debe ser el periodo activo ({periodo.ciclo}).", f"Ciclo: {f['ciclo'] or '(vacío)'}")
            continue
        if materia is None:
            error(f"Materia inexistente: {clave or '(vacía)'}.", f"Clave: {clave}")
            continue
        grupo = grupos.get((materia.pk, _grupo_normal(f["num_grupo"])))
        if grupo is None:
            existen = grupos_de.get(materia.pk)
            detalle = f"(Solo existen {' y '.join(existen)})" if existen else "(no tiene grupos en el periodo)"
            error(
                f"Grupo inexistente para la materia {materia.nombre_materia} {detalle}",
                f"Grupo: {f['num_grupo'] or '(vacío)'}",
            )
            continue
        llave = (estudiante.pk, grupo.pk)
        if llave in linea_carga:
            error(f"Carga repetida en este archivo CSV (duplicada en línea {linea_carga[llave]})")
            continue
        otro = next((g for g in inscritas[estudiante.pk] if g.materia_id == materia.pk and g.pk != grupo.pk), None)
        if otro is not None:
            error(f"El alumno ya está inscrito en {materia.clave} gpo {otro.num_grupo}.")
            continue
        previo = materia_en_archivo.get((estudiante.pk, materia.pk))
        if previo is not None:
            error(f"El alumno ya tiene {materia.clave} gpo {previo[0].num_grupo} en la línea {previo[1]}.")
            continue
        linea_carga[llave] = linea
        materia_en_archivo[(estudiante.pk, materia.pk)] = (grupo, linea)

        carga = cargas.get(llave)
        avisos = []
        if carga is None:
            accion = Accion.NUEVA
            nuevas_por_grupo[grupo.pk] += 1
            ocupados = grupo.inscritos_n + nuevas_por_grupo[grupo.pk]
            if ocupados > grupo.cupo_maximo:
                avisos.append(f"Excede el cupo ({ocupados} de {grupo.cupo_maximo})")
            for choque in choques_entre(grupo, inscritas[estudiante.pk] + nuevas_del_alumno[estudiante.pk]):
                avisos.append(f"Choca con {choque.choca_con.materia.clave} gpo {choque.choca_con.num_grupo}")
            nuevas_del_alumno[estudiante.pk].append(grupo)
        elif carga.estado == CargaAcademica.Estado.INSCRITO:
            accion = Accion.SIN_CAMBIOS
        else:
            accion = Accion.BAJA_RESPETADA
        validas.append(
            FilaValida(
                linea,
                {
                    "matricula": matricula,
                    "alumno": nombre,
                    "clave": materia.clave,
                    "materia": materia.nombre_materia,
                    "grupo": grupo.num_grupo,
                    "ciclo": periodo.ciclo,
                },
                accion,
                avisos,
                interno={"estudiante": estudiante, "grupo": grupo},
            )
        )
    return Analisis(len(filas), validas, errores)


def _importar_cargas(analisis: Analisis) -> tuple[int, int, list[dict]]:
    nuevas = [
        CargaAcademica(
            estudiante=f.interno["estudiante"],
            grupo=f.interno["grupo"],
            estado=CargaAcademica.Estado.INSCRITO,
            origen=CargaAcademica.Origen.IMPORTACION,
        )
        for f in analisis.validas
        if f.accion == Accion.NUEVA
    ]
    CargaAcademica.objects.bulk_create(nuevas)
    return len(nuevas), len(analisis.validas) - len(nuevas), []


# ---------------------------------------------------------------------------
# Pasos
# ---------------------------------------------------------------------------

def _analizar(tipo: str, archivo, periodo: PeriodoEscolar) -> Analisis:
    filas = leer_csv(archivo, tipo)
    return analizar_alumnos(filas) if tipo == Tipo.ALUMNOS else analizar_cargas(filas, periodo)


def vista_previa(tipo: str, archivo, periodo: PeriodoEscolar) -> dict:
    """Valida el archivo sin escribir nada."""
    analisis = _analizar(tipo, archivo, periodo)
    return {
        "tipo": tipo,
        "archivo": archivo.name,
        "total": analisis.total,
        "validas": len(analisis.validas),
        "avisos": sum(1 for f in analisis.validas if f.avisos),
        "errores": [asdict(e) for e in analisis.errores],
        "muestra": [f.publica() for f in analisis.validas[:TAM_MUESTRA]],
    }


def confirmar(tipo: str, archivo, usuario: Usuario, periodo: PeriodoEscolar, *, request=None) -> dict:
    """Importa las filas válidas, omite las de error y deja el historial y la bitácora."""
    try:
        with transaction.atomic():
            analisis = _analizar(tipo, archivo, periodo)
            if not analisis.validas:
                raise ImportacionInvalida({"detail": "No hay filas válidas para importar."})
            importar = _importar_alumnos if tipo == Tipo.ALUMNOS else _importar_cargas
            creados, actualizados, credenciales = importar(analisis)
            importacion = ImportacionCSV.objects.create(
                tipo=tipo,
                periodo=periodo,
                usuario=usuario,
                archivo=archivo.name[:255],
                total=analisis.total,
                creados=creados,
                actualizados=actualizados,
                excluidos=len(analisis.errores),
            )
            registrar(usuario, "importar_csv", importacion, descripcion=f"{importacion.folio} {tipo}", request=request)
    except IntegrityError:
        raise ImportacionInvalida(
            {"detail": "Otra importación cambió estos datos; vuelve a analizar el archivo."}
        ) from None
    return {
        "folio": importacion.folio,
        "tipo": tipo,
        "creados": creados,
        "actualizados": actualizados,
        "excluidos": importacion.excluidos,
        "credenciales": credenciales,
    }


def plantilla(tipo: str) -> str:
    """Encabezados del CSV, con BOM para que Excel respete los acentos."""
    return "﻿" + ",".join(COLUMNAS[tipo]) + "\r\n"
