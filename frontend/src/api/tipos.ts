// Tipos que devuelve la API. Si cambia un serializer en backend/core/serializers.py, cámbialo aquí.

export type Rol = "estudiante" | "control_escolar" | "administrador";

export const NOMBRE_ROL: Record<Rol, string> = {
  estudiante: "Estudiante",
  control_escolar: "Control Escolar",
  administrador: "Administrador",
};

export interface PerfilEstudiante {
  matricula: string;
  programa: string;
  semestre: number;
  turno: "matutino" | "vespertino" | "";
}

/** GET /api/me/ */
export interface Usuario {
  id: number;
  username: string;
  nombre: string;
  apellidos: string;
  email: string;
  rol: Rol;
  debe_cambiar_password: boolean;
  estudiante: PerfilEstudiante | null;
}

// ---------------------------------------------------------------------------
// Catálogo y horario del estudiante (F3)
// ---------------------------------------------------------------------------

/** GET /api/periodos/activo/ */
export interface PeriodoActivo {
  ciclo: string;
  convocatoria_inicio: string;
  convocatoria_fin: string;
  convocatoria_abierta: boolean;
}

/** 1 = lunes ... 6 = sábado */
export type DiaSemana = 1 | 2 | 3 | 4 | 5 | 6;

export interface HorarioClase {
  dia_semana: DiaSemana;
  /** "07:00:00" */
  hora_inicio: string;
  hora_fin: string;
  aula: string;
}

/** Por qué el grupo con el que choca ocupa el horario: inscrito, otra alta del carrito o un alta en trámite. */
export type OrigenChoque = "inscrita" | "carrito" | "en_tramite";

/** El grupo choca con `grupo` esos días y a esa hora (horario de `grupo`). */
export interface Choque {
  grupo: number;
  materia: string;
  num_grupo: string;
  dias: DiaSemana[];
  hora_inicio: string;
  hora_fin: string;
  origen: OrigenChoque;
}

export type CodigoError =
  | "repetido"
  | "ya_inscrito"
  | "no_disponible"
  | "sin_cupo"
  | "misma_materia"
  | "no_inscrito"
  | "en_otro_folio"
  | "baja_pendiente";

export interface ErrorMovimiento {
  codigo: CodigoError;
  detalle: string;
}

/** Elemento de GET /api/grupos/ */
export interface Grupo {
  id: number;
  materia: { clave: string; nombre: string; creditos: number; programa: string };
  num_grupo: string;
  docente: string;
  turno: "matutino" | "vespertino" | "";
  cupo_maximo: number;
  cupo_disponible: number;
  horarios: HorarioClase[];
  /** false si control escolar lo ocultó del catálogo (solo control escolar ve grupos ocultos). */
  visible: boolean;
  /** Para un alumno: con qué choca si pidiera el alta (tomando en cuenta el carrito). */
  choques: Choque[];
  /** Para un alumno: por qué no podría pedir el alta, además de los choques. */
  errores: ErrorMovimiento[];
}

export type TipoTramite = "ALTA" | "BAJA";

export interface EnTramite {
  id: number;
  grupo: Grupo;
  tipo_tramite: TipoTramite;
  folio: string;
}

/** GET /api/estudiante/horario/ */
export interface HorarioEstudiante {
  ciclo: string | null;
  inscritas: Grupo[];
  en_tramite: EnTramite[];
}

/** Un movimiento del carrito tal como lo recibe la API. */
export interface MovimientoEntrada {
  grupo: number;
  tipo: TipoTramite;
}

export interface ResultadoMovimiento extends MovimientoEntrada {
  choques: Choque[];
  errores: ErrorMovimiento[];
}

/** POST /api/solicitudes/validar/ */
export interface Validacion {
  valido: boolean;
  movimientos: ResultadoMovimiento[];
}

export type EstadoMovimiento = "pendiente" | "aprobada" | "rechazada" | "cargada_sadce" | "cancelada";

/** Un movimiento de un folio, con su dictamen. */
export interface MovimientoFolio {
  id: number;
  grupo: Grupo;
  tipo_tramite: TipoTramite;
  estado: EstadoMovimiento;
  motivo_rechazo: string;
  /** Nombre de quien dictaminó, o null mientras está pendiente. */
  revisado_por: string | null;
  fecha_resolucion: string | null;
}

/** Elemento de GET /api/solicitudes/ (el folio). */
export interface Solicitud {
  id: number;
  folio_digital: string;
  ciclo: string;
  fecha_solicitud: string;
  estado: EstadoMovimiento;
  /** Estado en la bandeja de control escolar; coincide con el filtro ?estado=. */
  estado_bandeja: EstadoBandeja;
  extemporanea: boolean;
  justificacion: string;
  estudiante: { matricula: string; nombre: string; programa: string; semestre: number };
  movimientos: MovimientoFolio[];
  resumen: { total: number; aprobadas: number; resueltas: number };
}

// Bandeja y dictamen de control escolar (F6)

export type EstadoBandeja = "pendiente" | "parcial" | "dictaminada" | "rechazada" | "cancelada";

export interface FiltrosBandeja {
  q: string;
  estado: EstadoBandeja | "";
  /** "normal" = dentro de convocatoria, "extemp" = extemporáneo. */
  tipo: "" | "normal" | "extemp";
}

export interface ResumenBandeja {
  folios_pendientes: number;
  movimientos_aprobados: number;
  movimientos_rechazados: number;
  extemporaneos: number;
}

/** Qué impide hoy aprobar un movimiento pendiente (listas vacías si se puede aprobar). */
export interface RevisionMovimiento {
  id: number;
  choques: Choque[];
  errores: ErrorMovimiento[];
}

export interface Revision {
  movimientos: RevisionMovimiento[];
}

// ---------------------------------------------------------------------------
// Periodo, convocatoria y oferta académica (F7)
// ---------------------------------------------------------------------------

export type EstadoConvocatoria = "programada" | "abierta" | "cerrada";

export interface Periodo {
  id: number;
  ciclo: string;
  /** "2026-08-03" */
  fecha_inicio: string;
  fecha_fin: string;
  convocatoria_inicio: string;
  convocatoria_fin: string;
  activo: boolean;
  estado_convocatoria: EstadoConvocatoria;
  movimientos_pendientes: number;
}

export interface PeriodoEscritura {
  ciclo: string;
  fecha_inicio: string;
  fecha_fin: string;
  convocatoria_inicio: string;
  convocatoria_fin: string;
  activar: boolean;
}

export interface UltimaModificacion {
  usuario: string | null;
  fecha: string;
}

export interface Programa {
  id: number;
  nombre: string;
}

export interface Docente {
  id: number;
  nombre: string;
  grado_academico: string;
}

export interface HorarioEntrada {
  dia_semana: DiaSemana;
  /** "08:00" */
  hora_inicio: string;
  hora_fin: string;
}

export interface GrupoEscritura {
  clave: string;
  nombre_materia: string;
  programa: number;
  num_grupo: string;
  cupo_maximo: number;
  docente: number;
  horarios: HorarioEntrada[];
}

export interface FiltrosOferta {
  q: string;
  programa: string;
  cupo: "" | "con" | "sin";
}
