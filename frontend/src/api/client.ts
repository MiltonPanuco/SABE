// Cliente de la API de SABE: agrega el token, lo renueva cuando expira y traduce los errores de DRF.

const CLAVE_ACCESS = "sabe.access";
const CLAVE_REFRESH = "sabe.refresh";

function leer(clave: string): string | null {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
}

function escribir(clave: string, valor: string | null) {
  try {
    if (valor === null) localStorage.removeItem(clave);
    else localStorage.setItem(clave, valor);
  } catch {
    // Sin almacenamiento (modo privado estricto): la sesión dura lo que la pestaña.
  }
}

export const tokens = {
  access: () => leer(CLAVE_ACCESS),
  refresh: () => leer(CLAVE_REFRESH),
  guardar(access: string, refresh?: string) {
    escribir(CLAVE_ACCESS, access);
    if (refresh) escribir(CLAVE_REFRESH, refresh);
  },
  borrar() {
    escribir(CLAVE_ACCESS, null);
    escribir(CLAVE_REFRESH, null);
  },
};

/** Error de la API con el cuerpo que mandó DRF: {"detail": "..."} o {"campo": ["mensaje"]}. */
export class ApiError extends Error {
  status: number;
  datos: unknown;

  constructor(status: number, datos: unknown) {
    super(mensajeDeError(status, datos));
    this.status = status;
    this.datos = datos;
  }

  /** Mensajes de un campo concreto, para mostrarlos debajo de su input. */
  campo(nombre: string): string | undefined {
    const valor = (this.datos as Record<string, unknown> | null)?.[nombre];
    if (Array.isArray(valor)) return valor.join(" ");
    return typeof valor === "string" ? valor : undefined;
  }
}

function mensajeDeError(status: number, datos: unknown): string {
  if (status === 0) return "No se pudo conectar con el servidor. Revisa tu conexión.";
  if (datos && typeof datos === "object") {
    const d = datos as Record<string, unknown>;
    if (typeof d.detail === "string") return d.detail;
    const primero = Object.values(d)[0];
    if (Array.isArray(primero) && typeof primero[0] === "string") return primero[0];
  }
  if (status >= 500) return "El servidor no responde. Intenta de nuevo en un momento.";
  return "Ocurrió un error inesperado.";
}

async function pedir(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch {
    throw new ApiError(0, null);
  }
}

async function cuerpo(res: Response): Promise<unknown> {
  return res.json().catch(() => null);
}

// Si varias peticiones expiran al mismo tiempo, todas esperan la misma renovación.
let renovando: Promise<boolean> | null = null;

function renovarAccess(): Promise<boolean> {
  const refresh = tokens.refresh();
  if (!refresh) return Promise.resolve(false);
  renovando ??= pedir("/api/auth/token/refresh/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  })
    .then(async (res) => {
      if (!res.ok) return false;
      const datos = (await res.json()) as { access: string };
      tokens.guardar(datos.access);
      return true;
    })
    .catch(() => false)
    .finally(() => {
      renovando = null;
    });
  return renovando;
}

let alExpirar: (() => void) | null = null;

/** El AuthProvider se registra aquí para enterarse cuando la sesión ya no sirve. */
export function alExpirarSesion(fn: () => void) {
  alExpirar = fn;
}

interface Opciones {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Objeto que se manda como JSON, o FormData para subir archivos. */
  body?: unknown;
}

/** Hace la petición con el token; si expiró, lo renueva y la repite una vez. */
async function conSesion(ruta: string, { method = "GET", body }: Opciones): Promise<Response> {
  const enviar = () => {
    const access = tokens.access();
    const headers: Record<string, string> = {};
    const esArchivo = body instanceof FormData;
    if (body !== undefined && !esArchivo) headers["Content-Type"] = "application/json";
    if (access) headers.Authorization = `Bearer ${access}`;
    return pedir(`/api${ruta}`, {
      method,
      headers,
      body: body === undefined ? undefined : esArchivo ? body : JSON.stringify(body),
    });
  };

  let res = await enviar();
  if (res.status === 401 && (await renovarAccess())) res = await enviar();
  if (res.status === 401) {
    tokens.borrar();
    alExpirar?.();
  }
  if (!res.ok) throw new ApiError(res.status, await cuerpo(res));
  return res;
}

/** Llama a /api{ruta} con la sesión actual. Ejemplo: api<Usuario>("/me/"). */
export async function api<T>(ruta: string, opciones: Opciones = {}): Promise<T> {
  const res = await conSesion(ruta, opciones);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Descarga un archivo de /api{ruta} (por ejemplo, una plantilla CSV) con el nombre dado. */
export async function descargar(ruta: string, nombre: string): Promise<void> {
  const res = await conSesion(ruta, {});
  guardarArchivo(await res.blob(), nombre);
}

/** Ofrece al navegador un archivo para guardar. */
export function guardarArchivo(contenido: Blob, nombre: string) {
  const url = URL.createObjectURL(contenido);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Login: pide los tokens con matrícula (o usuario) y contraseña y los guarda. */
export async function obtenerTokens(username: string, password: string): Promise<void> {
  const res = await pedir("/api/auth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (res.status === 401) throw new ApiError(401, { detail: "Matrícula o contraseña incorrectas." });
  if (!res.ok) throw new ApiError(res.status, await cuerpo(res));
  const datos = (await res.json()) as { access: string; refresh: string };
  tokens.guardar(datos.access, datos.refresh);
}
