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
