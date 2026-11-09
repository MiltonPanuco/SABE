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

/** El grupo choca con una materia inscrita (`grupo`) esos días y a esa hora. */
export interface Choque {
  grupo: number;
  materia: string;
  num_grupo: string;
  dias: DiaSemana[];
  hora_inicio: string;
  hora_fin: string;
}

/** Elemento de GET /api/grupos/ */
export interface Grupo {
  id: number;
  materia: { clave: string; nombre: string; creditos: number };
  num_grupo: string;
  docente: string;
  turno: "matutino" | "vespertino" | "";
  cupo_maximo: number;
  cupo_disponible: number;
  horarios: HorarioClase[];
  choques: Choque[];
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
