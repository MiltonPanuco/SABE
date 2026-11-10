// Importación de CSV (padrón y cargas académicas): stitch/sabe_importaci_n_de_csv_control_escolar.
// Tres pasos: archivo, vista previa (no escribe nada) y resultado. El paso vive en la página:
// al recargar se empieza de nuevo, porque el navegador no conserva el archivo elegido.
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ApiError, descargar } from "../api/client";
import { useConfirmarImportacion, useImportaciones, useVistaPrevia } from "../api/control";
import { usePeriodoActivo } from "../api/estudiante";
import type {
  AccionImportacion,
  DatosAlumno,
  DatosCarga,
  FilaError,
  FilaValida,
  ResultadoImportacion,
  TipoImportacion,
  VistaPrevia,
} from "../api/tipos";
import { Simbolo, Spinner } from "../components/acceso";
import { descargarCsv } from "./csv";
import { fechaBitacora } from "./fechas";
import { Modal } from "./Modal";
import { useAviso } from "./Toast";

type Paso = 1 | 2 | 3;
const MAX_BYTES = 25 * 1024 * 1024;

const ACCIONES: Record<AccionImportacion, { texto: string; clase: string }> = {
  nuevo: { texto: "Nuevo Alumno", clase: "bg-tertiary-fixed text-on-tertiary-fixed" },
  nueva: { texto: "Nueva carga", clase: "bg-tertiary-fixed text-on-tertiary-fixed" },
  actualizacion: { texto: "Actualización", clase: "bg-surface-container-highest text-primary" },
  sin_cambios: { texto: "Sin cambios", clase: "bg-surface-container text-on-surface-variant" },
  baja_respetada: { texto: "Baja respetada", clase: "bg-surface-container text-on-surface-variant" },
};

function columnas(tipo: TipoImportacion, ciclo: string): [string, string][] {
  return tipo === "alumnos"
    ? [
        ["matricula", "Numérico (9 dígitos)"],
        ["nombre", "Texto (Alfanumérico)"],
        ["apellidos", "Texto (Alfanumérico)"],
        ["email", "@uan.edu.mx / @alumnos"],
        ["programa", "Clave (p. ej. L-ECO)"],
        ["semestre", "Entero 1 - 10"],
        ["turno", "Matutino / Vespertino"],
      ]
    : [
        ["matricula", "Numérico (9 dígitos)"],
        ["clave_materia", "Alfanumérico (ej. EC504)"],
        ["num_grupo", "Texto (ej. 01)"],
        ["ciclo", ciclo],
      ];
}

function tamano(bytes: number): string {
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Filas con datos (sin el encabezado ni las vacías), contadas en el navegador para la tarjeta del archivo. */
async function contarRegistros(archivo: File): Promise<number> {
  const lineas = (await archivo.text()).split(/\r?\n/).filter((l) => l.replace(/[,;\s]/g, ""));
  return Math.max(lineas.length - 1, 0);
}

function sinExtension(nombre: string): string {
  return nombre.replace(/\.csv$/i, "");
}

export function ImportacionPage() {
  const { data: periodo, isPending: cargandoPeriodo } = usePeriodoActivo();
  const aviso = useAviso();
  const [tipo, setTipo] = useState<TipoImportacion>("alumnos");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [registros, setRegistros] = useState<number | null>(null);
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null);
  const [paso, setPaso] = useState<Paso>(1);
  const [previa, setPrevia] = useState<VistaPrevia | null>(null);
  const [resultado, setResultado] = useState<ResultadoImportacion | null>(null);
  const [historial, setHistorial] = useState(false);
  const cerrarHistorial = useCallback(() => setHistorial(false), []);
  const vistaPrevia = useVistaPrevia();
  const confirmar = useConfirmarImportacion();
  const ciclo = periodo?.ciclo ?? "";

  // Los botones de avanzar están al pie: cada paso empieza arriba.
  useEffect(() => window.scrollTo({ top: 0 }), [paso]);

  const reiniciar = () => {
    setArchivo(null);
    setRegistros(null);
    setErrorArchivo(null);
    setPrevia(null);
    setResultado(null);
    setPaso(1);
  };

  const elegirTipo = (nuevo: TipoImportacion) => {
    setTipo(nuevo);
    setPrevia(null);
    setResultado(null);
    setErrorArchivo(null);
  };

  const elegirArchivo = (elegido: File | undefined) => {
    setPrevia(null);
    setResultado(null);
    setRegistros(null);
    if (!elegido) return;
    if (!/\.csv$/i.test(elegido.name)) {
      setArchivo(null);
      setErrorArchivo("Selecciona un archivo .csv.");
      return;
    }
    if (elegido.size > MAX_BYTES) {
      setArchivo(null);
      setErrorArchivo("El archivo supera el máximo de 25 MB.");
      return;
    }
    setErrorArchivo(null);
    setArchivo(elegido);
    void contarRegistros(elegido).then((n) => setRegistros(n));
  };

  const quitar = () => {
    setArchivo(null);
    setRegistros(null);
    setErrorArchivo(null);
    setPrevia(null);
  };

  const analizar = () => {
    if (!archivo) return;
    setErrorArchivo(null);
    vistaPrevia.mutate(
      { tipo, archivo },
      {
        onSuccess: (datos) => {
          setPrevia(datos);
          setPaso(2);
        },
        onError: (e) => setErrorArchivo(e instanceof ApiError ? (e.campo("archivo") ?? e.message) : e.message),
      },
    );
  };

  const importar = () => {
    if (!archivo) return;
    confirmar.mutate(
      { tipo, archivo },
      {
        onSuccess: (datos) => {
          setResultado(datos);
          setPaso(3);
        },
        onError: (e) => aviso(e.message),
      },
    );
  };

  const plantilla = () =>
    descargar(`/importaciones/plantilla/${tipo}/`, `plantilla_${tipo}.csv`).catch((e: Error) => aviso(e.message));

  const reporteErrores = () => {
    if (!previa) return;
    descargarCsv(`errores_${sinExtension(previa.archivo)}.csv`, [
      ["linea", "matricula", "datos", "error"],
      ...previa.errores.map((e) => [e.linea, e.matricula, e.datos, e.mensaje]),
    ]);
  };

  const cuentas = () => {
    if (!resultado) return;
    descargarCsv(`cuentas_${resultado.folio}.csv`, [
      ["matricula", "nombre", "email", "contrasena_temporal"],
      ...resultado.credenciales.map((c) => [c.matricula, c.nombre, c.email, c.password]),
    ]);
  };

  if (!cargandoPeriodo && !periodo) {
    return (
      <div className="flex w-full flex-col gap-space-lg">
        <h1 className="font-headline-lg text-headline-lg tracking-tight text-primary">Importación de Datos (CSV)</h1>
        <div className="flex flex-col items-center gap-space-sm rounded-2xl bg-surface-container-lowest p-space-xl text-center shadow-sm">
          <p className="font-headline-sm text-headline-sm text-primary">No hay un periodo activo.</p>
          <Link
            to="/control-escolar/periodo"
            className="rounded-lg bg-primary-container px-space-md py-space-xs font-label-md text-label-md text-on-primary hover:bg-primary"
          >
            Ir a Periodo y Convocatoria
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col">
      <section className="mb-space-lg flex flex-col gap-space-sm">
        <div className="flex flex-wrap items-center gap-space-xs font-label-md text-label-md text-on-surface-variant">
          <span>Ventanilla de Control Escolar</span>
          <Simbolo nombre="chevron_right" className="text-[14px]!" />
          <span>Mantenimiento</span>
          <Simbolo nombre="chevron_right" className="text-[14px]!" />
          <span className="font-semibold text-primary">Importación Masiva CSV</span>
        </div>
        <div className="mt-space-xs flex flex-col justify-between gap-space-md lg:flex-row lg:items-center">
          <div className="flex items-start gap-space-md">
            <div className="flex shrink-0 items-center justify-center rounded-xl bg-surface-container p-space-sm text-primary shadow-sm">
              <Simbolo nombre="cloud_upload" className="text-[32px]!" />
            </div>
            <div className="flex flex-col">
              <div className="flex flex-wrap items-center gap-space-sm">
                <h1 className="font-headline-lg text-headline-lg tracking-tight text-primary">Importación de Datos (CSV)</h1>
                <span className="inline-flex items-center gap-space-xs rounded-full bg-surface-container-high px-space-sm py-0.5 font-label-sm text-label-sm text-primary">
                  <Simbolo nombre="event" className="text-[14px]!" />
                  Ciclo {ciclo}
                </span>
              </div>
              <p className="mt-0.5 max-w-3xl font-body-md text-body-md text-on-surface-variant">
                Carga masiva de alumnos y cargas académicas desde archivos CSV.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-space-sm self-start lg:self-auto">
            <button
              type="button"
              onClick={() => setHistorial(true)}
              className="inline-flex cursor-pointer items-center gap-space-xs rounded-lg bg-surface-container-lowest px-space-md py-space-sm font-label-lg text-label-lg text-primary shadow-sm transition-colors hover:bg-surface-container-high"
            >
              <Simbolo nombre="history" className="text-[18px]!" />
              <span>Ver historial de cargas</span>
            </button>
            <button
              type="button"
              onClick={reiniciar}
              className="inline-flex cursor-pointer items-center gap-space-xs rounded-lg bg-primary px-space-md py-space-sm font-label-lg text-label-lg text-on-primary shadow-sm transition-colors hover:bg-primary-container"
            >
              <Simbolo nombre="add" className="text-[18px]!" />
              <span>+ Nueva carga</span>
            </button>
          </div>
        </div>
      </section>

      <section className="mb-space-lg rounded-xl bg-surface-container-lowest p-space-md shadow-sm">
        <div className="grid grid-cols-1 gap-space-sm md:grid-cols-3">
          <PestanaPaso n={1} paso={paso} titulo="1. Archivo" detalle="Configuración y Carga" ir={() => setPaso(1)} habilitada={!resultado} />
          <PestanaPaso
            n={2}
            paso={paso}
            titulo="2. Vista previa"
            detalle="Validación y Detección de Errores"
            ir={() => setPaso(2)}
            habilitada={!!previa && !resultado}
          />
          <PestanaPaso
            n={3}
            paso={paso}
            titulo="3. Resultado"
            detalle="Confirmación y Resumen de Cuentas"
            ir={() => setPaso(3)}
            habilitada={!!resultado}
          />
        </div>
      </section>

      {paso === 1 && (
        <PasoArchivo
          tipo={tipo}
          ciclo={ciclo}
          archivo={archivo}
          registros={registros}
          error={errorArchivo}
          analizando={vistaPrevia.isPending}
          elegirTipo={elegirTipo}
          elegirArchivo={elegirArchivo}
          quitar={quitar}
          plantilla={plantilla}
          continuar={analizar}
        />
      )}
      {paso === 2 && previa && (
        <PasoVistaPrevia previa={previa} importando={confirmar.isPending} volver={() => setPaso(1)} importar={importar} />
      )}
      {paso === 3 && resultado && (
        <PasoResultado
          resultado={resultado}
          ciclo={ciclo}
          hayErrores={!!previa?.errores.length}
          reporteErrores={reporteErrores}
          otra={reiniciar}
          cuentas={cuentas}
        />
      )}

      {historial && <Historial cerrar={cerrarHistorial} />}
    </div>
  );
}

function PestanaPaso({
  n,
  paso,
  titulo,
  detalle,
  ir,
  habilitada,
}: {
  n: Paso;
  paso: Paso;
  titulo: string;
  detalle: string;
  ir: () => void;
  habilitada: boolean;
}) {
  const activa = n === paso;
  return (
    <button
      type="button"
      onClick={ir}
      disabled={!habilitada || activa}
      aria-current={activa ? "step" : undefined}
      className={`flex items-center gap-space-md rounded-lg p-space-md text-left transition-all ${
        activa
          ? "bg-primary-container text-on-primary shadow-sm"
          : `bg-surface-container-low text-on-surface-variant ${habilitada ? "cursor-pointer hover:bg-surface-container" : "cursor-default"}`
      }`}
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-headline-sm text-headline-sm font-bold ${
          activa ? "bg-on-primary text-primary shadow-sm" : "bg-surface-container-highest text-primary"
        }`}
      >
        {n}
      </div>
      <div className="flex min-w-0 flex-col">
        <span className="font-label-sm text-label-sm tracking-wider uppercase opacity-80">Paso {n}</span>
        <span className="truncate font-headline-sm text-headline-sm font-semibold">{titulo}</span>
        <span className={`truncate font-body-sm text-body-sm ${activa ? "opacity-90" : "opacity-80"}`}>{detalle}</span>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Paso 1
// ---------------------------------------------------------------------------

function PasoArchivo({
  tipo,
  ciclo,
  archivo,
  registros,
  error,
  analizando,
  elegirTipo,
  elegirArchivo,
  quitar,
  plantilla,
  continuar,
}: {
  tipo: TipoImportacion;
  ciclo: string;
  archivo: File | null;
  registros: number | null;
  error: string | null;
  analizando: boolean;
  elegirTipo: (t: TipoImportacion) => void;
  elegirArchivo: (f: File | undefined) => void;
  quitar: () => void;
  plantilla: () => void;
  continuar: () => void;
}) {
  return (
    <div className="flex flex-col gap-space-lg">
      <div className="grid grid-cols-1 gap-space-lg lg:grid-cols-12">
        <div className="flex flex-col gap-space-lg lg:col-span-8">
          <div className="rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
            <div className="mb-space-md flex items-center justify-between">
              <div>
                <span className="font-label-sm text-label-sm font-semibold tracking-wider text-on-surface-variant uppercase">
                  Configuración de Catálogo
                </span>
                <h2 className="font-headline-md text-headline-md text-primary">Selecciona el tipo de importación</h2>
              </div>
              <Simbolo nombre="tune" className="text-[20px]! text-on-surface-variant" />
            </div>
            <div className="grid grid-cols-1 gap-space-md sm:grid-cols-2">
              <OpcionTipo
                valor="alumnos"
                tipo={tipo}
                elegir={elegirTipo}
                icono="badge"
                titulo="Alumnos (Padrón Escolar)"
                texto="Catálogo de matrícula, correos, nombres oficiales y licenciatura activa UAE."
              />
              <OpcionTipo
                valor="cargas"
                tipo={tipo}
                elegir={elegirTipo}
                icono="auto_stories"
                titulo="Cargas académicas (Asignación de materias)"
                texto={`Relación de asignaturas, claves reticulares, números de grupo y semestre ${ciclo}.`}
              />
            </div>
          </div>

          <div className="flex flex-col gap-space-md rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-space-sm">
              <h2 className="font-headline-md text-headline-md text-primary">Carga de archivo</h2>
              <button
                type="button"
                onClick={plantilla}
                className="inline-flex cursor-pointer items-center gap-space-xs rounded-lg bg-surface-container-high px-space-md py-space-xs font-label-md text-label-md text-primary shadow-sm transition-colors hover:bg-surface-container"
              >
                <Simbolo nombre="download" className="text-[16px]!" />
                <span>Descargar plantilla oficial CSV (.csv)</span>
              </button>
            </div>
            <div className="group relative flex cursor-pointer flex-col items-center justify-center rounded-xl bg-surface-container-low p-space-xl text-center transition-all hover:bg-surface-container">
              <input
                type="file"
                accept=".csv,text/csv"
                aria-label="Archivo CSV"
                // Se limpia para que volver a elegir el mismo archivo también dispare onChange.
                onClick={(e) => (e.currentTarget.value = "")}
                onChange={(e) => elegirArchivo(e.target.files?.[0])}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
              <div className="mb-space-sm flex h-16 w-16 items-center justify-center rounded-full bg-surface-container-lowest text-primary shadow-md transition-transform group-hover:scale-105">
                <Simbolo nombre="upload_file" className="text-[36px]!" />
              </div>
              <span className="font-headline-sm text-headline-sm font-semibold text-primary">
                Arrastra tu archivo .csv aquí o haz clic para examinar
              </span>
              <p className="mt-1 max-w-md font-body-sm text-body-sm text-on-surface-variant">
                Formato delimitado por comas (UTF-8 estándar, sin acentos corruptos). Tamaño máximo permitido:{" "}
                <strong>25 MB</strong>.
              </p>
              <div className="mt-space-md flex flex-wrap items-center justify-center gap-space-sm">
                <span className="inline-flex items-center gap-space-xs rounded-full bg-surface-container-highest px-space-sm py-0.5 font-label-sm text-label-sm text-on-surface-variant">
                  <Simbolo nombre="table_chart" className="text-[14px]!" />
                  Formato CSV Estándar RFC 4180
                </span>
                <span className="inline-flex items-center gap-space-xs rounded-full bg-surface-container-highest px-space-sm py-0.5 font-label-sm text-label-sm text-on-surface-variant">
                  <Simbolo nombre="description" className="text-[14px]!" />
                  Codificación UTF-8
                </span>
              </div>
            </div>

            {error && (
              <div role="alert" className="flex items-start gap-space-sm rounded-xl bg-error-container/60 p-space-md font-label-md text-label-md text-on-error-container">
                <Simbolo nombre="error" className="mt-0.5 text-[18px]! text-error" />
                <span>{error}</span>
              </div>
            )}

            {archivo && (
              <div className="flex flex-col justify-between gap-space-sm rounded-xl bg-surface-container p-space-md sm:flex-row sm:items-center">
                <div className="flex min-w-0 items-center gap-space-md">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-container-lowest text-primary shadow-sm">
                    <Simbolo nombre="description" className="text-[24px]!" />
                  </div>
                  <div className="flex min-w-0 flex-col">
                    <span className="font-label-lg text-label-lg font-semibold break-all text-primary">{archivo.name}</span>
                    <span className="font-label-sm text-label-sm text-on-surface-variant">
                      {tamano(archivo.size)} • {registros ?? "…"} {registros === 1 ? "registro detectado" : "registros detectados"} • Codificación UTF-8
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-space-sm self-end sm:self-auto">
                  <span className="inline-flex items-center gap-space-xs rounded-full bg-tertiary-fixed px-space-sm py-0.5 font-label-sm text-label-sm font-semibold text-on-tertiary-fixed">
                    <Simbolo nombre="check" className="text-[14px]!" />
                    Listo para analizar
                  </span>
                  <button
                    type="button"
                    onClick={quitar}
                    aria-label="Quitar archivo"
                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg bg-surface-container-lowest text-on-surface-variant transition-colors hover:text-error"
                  >
                    <Simbolo nombre="close" className="text-[18px]!" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-space-lg lg:col-span-4">
          <div className="flex flex-col gap-space-md rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
            <div className="flex items-center gap-space-sm">
              <Simbolo nombre="schema" className="text-[22px]! text-primary" />
              <h3 className="font-headline-sm text-headline-sm font-semibold text-primary">Estructura y Columnas Esperadas</h3>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Asegúrate de que la primera fila contenga exactamente los nombres de encabezado sin espacios en blanco:
            </p>
            <div className="flex flex-col gap-space-xs">
              {columnas(tipo, ciclo).map(([nombre, formato]) => (
                <div
                  key={nombre}
                  className="flex items-center justify-between gap-space-sm rounded-lg bg-surface-container-low p-space-sm font-label-sm text-label-sm"
                >
                  <code className="font-bold text-primary">{nombre}</code>
                  <span className="rounded bg-surface-container px-space-xs py-0.5 text-right text-on-surface-variant">{formato}</span>
                </div>
              ))}
            </div>
            <div className="flex items-start gap-space-sm rounded-xl bg-surface-container-high p-space-md">
              <Simbolo nombre="info" className="mt-0.5 shrink-0 text-[20px]! text-primary" />
              <p className="font-label-sm text-label-sm leading-relaxed text-primary">
                <strong>Nota sobre duplicidad:</strong> Reimportar el mismo archivo no duplica registros; actualiza la
                información si la matrícula ya existe en la base de datos de SABE.
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between gap-space-md rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
            <div className="flex items-center gap-space-md">
              <img alt="Escudo UAE" className="h-12 w-auto shrink-0 object-contain" src="/img/escudo-uae.png" />
              <div className="flex flex-col">
                <span className="font-label-md text-label-md font-bold text-primary">Unidad Académica de Economía</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">Control Escolar • Ciclo {ciclo}</span>
              </div>
            </div>
            <img alt="Logo SABE" className="h-8 w-auto shrink-0 object-contain" src="/img/sabe-logo.png" />
          </div>
        </div>
      </div>

      <BarraAcciones>
        <div className="flex items-center gap-space-sm font-label-sm text-label-sm text-on-surface-variant">
          <Simbolo nombre="verified" className="text-[18px]!" />
          <span>Validación de formato CSV conforme a los campos requeridos</span>
        </div>
        <button
          type="button"
          onClick={continuar}
          disabled={!archivo || analizando}
          className="inline-flex cursor-pointer items-center justify-center gap-space-sm rounded-lg bg-primary px-space-lg py-space-sm font-label-lg text-label-lg text-on-primary shadow-sm transition-all hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-50"
        >
          {analizando && <Spinner className="h-4 w-4" />}
          <span>Continuar a Vista Previa</span>
          <Simbolo nombre="arrow_forward" className="text-[18px]!" />
        </button>
      </BarraAcciones>
    </div>
  );
}

function OpcionTipo({
  valor,
  tipo,
  elegir,
  icono,
  titulo,
  texto,
}: {
  valor: TipoImportacion;
  tipo: TipoImportacion;
  elegir: (t: TipoImportacion) => void;
  icono: string;
  titulo: string;
  texto: string;
}) {
  const elegida = valor === tipo;
  return (
    <label className="group cursor-pointer">
      <input
        type="radio"
        name="tipo_importacion"
        value={valor}
        checked={elegida}
        onChange={() => elegir(valor)}
        className="peer sr-only"
      />
      <div
        className={`flex h-full flex-col gap-space-xs rounded-xl p-space-md shadow-sm transition-all hover:shadow-md peer-focus-visible:ring-2 peer-focus-visible:ring-primary-container ${
          elegida ? "bg-primary text-on-primary" : "bg-surface-container-low text-on-surface"
        }`}
      >
        <div className="flex items-center justify-between">
          {/* Como se ve en stitch: el recuadro del icono queda claro y sin palomita en la opción elegida. */}
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-container-lowest text-primary">
            <Simbolo nombre={icono} className="text-[22px]!" />
          </div>
        </div>
        <span className="mt-space-xs font-headline-sm text-headline-sm font-semibold">{titulo}</span>
        <span className="font-body-sm text-body-sm opacity-80">{texto}</span>
      </div>
    </label>
  );
}

function BarraAcciones({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-stretch justify-between gap-space-md rounded-xl bg-surface-container-lowest p-space-md shadow-sm sm:flex-row sm:items-center">
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Paso 2
// ---------------------------------------------------------------------------

function PasoVistaPrevia({
  previa,
  importando,
  volver,
  importar,
}: {
  previa: VistaPrevia;
  importando: boolean;
  volver: () => void;
  importar: () => void;
}) {
  const [verMuestra, setVerMuestra] = useState(true);
  const errores = previa.errores.length;
  const porcentaje = (n: number) => `${previa.total ? (n / previa.total) * 100 : 0}%`;

  return (
    <div className="flex flex-col gap-space-lg">
      <div className="grid grid-cols-1 gap-space-md sm:grid-cols-3">
        <div className="relative flex flex-col justify-between overflow-hidden rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
          <div className="mb-space-sm flex items-center justify-between gap-space-sm">
            <span className="font-label-md text-label-md font-semibold tracking-wider text-on-surface-variant uppercase">Validación Exitosa</span>
            <span className="inline-flex items-center gap-space-xs rounded-full bg-tertiary-fixed px-space-sm py-0.5 font-label-sm text-label-sm font-semibold text-on-tertiary-fixed">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-on-tertiary-container" />
              Listas para procesar
            </span>
          </div>
          <div className="flex items-baseline gap-space-sm">
            <span className="font-display-lg text-display-lg font-bold text-primary">{previa.validas}</span>
            <span className="font-body-md text-body-md text-on-surface-variant">{previa.validas === 1 ? "fila válida" : "filas válidas"}</span>
          </div>
          <div className="mt-space-sm h-1.5 w-full overflow-hidden rounded-full bg-surface-container">
            <div className="h-full rounded-full bg-tertiary-fixed-dim" style={{ width: porcentaje(previa.validas) }} />
          </div>
        </div>
        <div className="relative flex flex-col justify-between overflow-hidden rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
          <div className="mb-space-sm flex items-center justify-between gap-space-sm">
            <span className="font-label-md text-label-md font-semibold tracking-wider text-error uppercase">Conflictos Hallados</span>
            <span className="inline-flex items-center gap-space-xs rounded-full bg-error-container px-space-sm py-0.5 font-label-sm text-label-sm font-semibold text-on-error-container">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-error" />
              Requieren corrección
            </span>
          </div>
          <div className="flex items-baseline gap-space-sm">
            <span className="font-display-lg text-display-lg font-bold text-error">{errores}</span>
            <span className="font-body-md text-body-md text-error">{errores === 1 ? "fila con error" : "filas con error"}</span>
          </div>
          <div className="mt-space-sm h-1.5 w-full overflow-hidden rounded-full bg-surface-container">
            <div className="h-full rounded-full bg-error" style={{ width: porcentaje(errores) }} />
          </div>
        </div>
        <div className="flex flex-col justify-between rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
          <div className="mb-space-sm flex items-center justify-between gap-space-sm">
            <span className="font-label-md text-label-md font-semibold tracking-wider text-on-surface-variant uppercase">
              {previa.tipo === "alumnos" ? "Padrón Procesado" : "Cargas Procesadas"}
            </span>
            <span className="inline-flex items-center gap-space-xs rounded-full bg-surface-container px-space-sm py-0.5 font-label-sm text-label-sm font-semibold text-primary">
              Archivo CSV
            </span>
          </div>
          <div className="flex items-baseline gap-space-sm">
            <span className="font-display-lg text-display-lg font-bold text-primary">{previa.total}</span>
            <span className="font-body-md text-body-md text-on-surface-variant">
              {previa.total === 1 ? "registro detectado" : "total registros detectados"}
            </span>
          </div>
          <div className="mt-space-sm flex items-center gap-space-xs font-label-sm text-label-sm text-on-surface-variant">
            <Simbolo nombre="check_circle" className="text-[16px]!" />
            <span>100% analizado sin interrupciones</span>
          </div>
        </div>
      </div>

      {errores > 0 && <TablaErrores errores={previa.errores} />}

      {previa.validas > 0 && (
        <div className="overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm">
          <button
            type="button"
            onClick={() => setVerMuestra((v) => !v)}
            aria-expanded={verMuestra}
            className="flex w-full cursor-pointer flex-col justify-between gap-space-sm bg-surface-container-low p-space-md text-left transition-colors select-none hover:bg-surface-container sm:flex-row sm:items-center"
          >
            <div className="flex flex-wrap items-center gap-space-sm">
              <Simbolo nombre="verified" className="text-[22px]! text-on-tertiary-container" />
              <h3 className="font-headline-sm text-headline-sm font-semibold text-primary">
                Muestra de Filas Válidas a Importar ({previa.validas} registros correctos)
              </h3>
              <span className="rounded bg-surface-container px-space-xs py-0.5 font-label-sm text-label-sm text-on-surface-variant">
                Mostrando {previa.muestra.length} de {previa.validas}
              </span>
              {previa.avisos > 0 && (
                <span className="rounded bg-secondary-fixed px-space-xs py-0.5 font-label-sm text-label-sm font-semibold text-on-secondary-fixed">
                  {previa.avisos} con aviso
                </span>
              )}
            </div>
            <div className="flex items-center gap-space-xs font-label-md text-label-md text-primary">
              <span>{verMuestra ? "Ocultar muestra" : "Mostrar muestra"}</span>
              <Simbolo nombre={verMuestra ? "expand_less" : "expand_more"} className="text-[20px]!" />
            </div>
          </button>
          {verMuestra && (
            <div className="overflow-x-auto">
              {previa.tipo === "alumnos" ? <MuestraAlumnos filas={previa.muestra} /> : <MuestraCargas filas={previa.muestra} />}
            </div>
          )}
        </div>
      )}

      <BarraAcciones>
        <button
          type="button"
          onClick={volver}
          className="inline-flex cursor-pointer items-center justify-center gap-space-sm rounded-lg bg-surface-container-low px-space-md py-space-sm font-label-lg text-label-lg text-on-surface-variant transition-colors hover:bg-surface-container"
        >
          <Simbolo nombre="arrow_back" className="text-[18px]!" />
          <span>Cancelar / Subir otro archivo</span>
        </button>
        <div className="flex flex-col items-stretch gap-space-sm sm:flex-row sm:items-center sm:gap-space-md">
          {errores > 0 && (
            <span className="hidden font-label-sm text-label-sm text-on-surface-variant sm:inline">
              Se omitirán {errores === 1 ? "la fila conflictiva" : `las ${errores} filas conflictivas`} automáticamente
            </span>
          )}
          <button
            type="button"
            onClick={importar}
            disabled={importando || previa.validas === 0}
            className="inline-flex cursor-pointer items-center justify-center gap-space-sm rounded-lg bg-primary px-space-lg py-space-sm font-label-lg text-label-lg text-on-primary shadow-sm transition-all hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-50"
          >
            {importando ? <Spinner className="h-4 w-4" /> : <Simbolo nombre="cloud_done" className="text-[18px]!" />}
            <span>
              {previa.validas === 0
                ? "No hay filas válidas para importar"
                : `Confirmar importación de ${previa.validas} ${previa.validas === 1 ? "fila válida" : "filas válidas"}`}
            </span>
          </button>
        </div>
      </BarraAcciones>
    </div>
  );
}

/** "Clave: ECO-999" -> Clave: <code>ECO-999</code>, como en stitch. */
function DatoClave({ texto }: { texto: string }) {
  const partes = /^(Clave|Grupo|Ciclo): (.*)$/.exec(texto);
  if (!partes) return <>{texto}</>;
  return (
    <>
      {partes[1]}: <code className="font-mono text-error">{partes[2]}</code>
    </>
  );
}

function TablaErrores({ errores }: { errores: FilaError[] }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm">
      <div className="flex flex-col justify-between gap-space-xs bg-error-container/40 p-space-md sm:flex-row sm:items-center">
        <div className="flex items-center gap-space-sm">
          <Simbolo nombre="warning" className="text-[22px]! text-error" />
          <h2 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
            Filas con error detectadas ({errores.length} {errores.length === 1 ? "registro excluido" : "registros excluidos"})
          </h2>
        </div>
        <span className="font-label-sm text-label-sm text-on-surface-variant">
          Estos registros no serán importados hasta ser corregidos en el archivo fuente.
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left font-body-md text-body-md">
          <thead className="bg-surface-container-low font-label-md text-label-md tracking-wider text-on-surface-variant uppercase">
            <tr>
              <th className="px-space-md py-space-sm">Fila CSV</th>
              <th className="px-space-md py-space-sm">Matrícula / ID</th>
              <th className="px-space-md py-space-sm">Datos Clave</th>
              <th className="px-space-md py-space-sm">Detalle del Error Detectado</th>
              <th className="px-space-md py-space-sm text-center">Estado</th>
            </tr>
          </thead>
          <tbody>
            {errores.map((e, i) => (
              <tr
                key={e.linea}
                className={`transition-colors hover:bg-surface-container-low/60 ${i % 2 ? "bg-surface-container-low/30" : ""}`}
              >
                <td className="px-space-md py-space-md font-semibold whitespace-nowrap text-primary">Línea #{e.linea}</td>
                <td className="px-space-md py-space-md">
                  <span className="rounded bg-surface-container px-space-xs py-0.5 font-mono text-label-sm font-bold text-primary">
                    {e.matricula || "—"}
                  </span>
                </td>
                <td className="px-space-md py-space-md font-semibold text-on-surface">
                  <DatoClave texto={e.datos} />
                </td>
                <td className="px-space-md py-space-md font-label-md text-error">
                  <span className="flex items-center gap-space-xs">
                    <Simbolo nombre="error" className="shrink-0 text-[18px]!" />
                    <span>{e.mensaje}</span>
                  </span>
                </td>
                <td className="px-space-md py-space-md text-center">
                  <span className="inline-flex items-center gap-space-xs rounded-full bg-error-container px-space-sm py-0.5 font-label-sm text-label-sm font-semibold text-on-error-container">
                    <Simbolo nombre="cancel" className="text-[14px]!" />
                    Rechazado
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Accion({ fila }: { fila: FilaValida }) {
  const { texto, clase } = ACCIONES[fila.accion];
  return (
    <div className="flex flex-col items-center gap-1">
      <span className={`inline-flex items-center gap-space-xs rounded-full px-space-xs py-0.5 font-label-sm text-label-sm font-semibold whitespace-nowrap ${clase}`}>
        {texto}
      </span>
      {fila.avisos.map((a) => (
        <span key={a} className="flex items-center gap-1 font-label-sm text-label-sm whitespace-nowrap text-secondary">
          <Simbolo nombre="warning" className="text-[14px]!" />
          {a}
        </span>
      ))}
    </div>
  );
}

const CABECERA_MUESTRA = "bg-surface-container-low/50 font-label-md text-label-md tracking-wider text-on-surface-variant uppercase";

function MuestraAlumnos({ filas }: { filas: FilaValida[] }) {
  return (
    <table className="w-full min-w-[900px] text-left font-body-md text-body-md">
      <thead className={CABECERA_MUESTRA}>
        <tr>
          <th className="px-space-md py-space-sm">Matrícula</th>
          <th className="px-space-md py-space-sm">Nombre Completo</th>
          <th className="px-space-md py-space-sm">Correo Institucional</th>
          <th className="px-space-md py-space-sm">Programa Académico</th>
          <th className="px-space-md py-space-sm">Semestre</th>
          <th className="px-space-md py-space-sm">Turno</th>
          <th className="px-space-md py-space-sm text-center">Acción SABE</th>
        </tr>
      </thead>
      <tbody>
        {filas.map((f, i) => {
          const d = f.datos as DatosAlumno;
          return (
            <tr key={f.linea} className={`transition-colors hover:bg-surface-container-low/40 ${i % 2 ? "bg-surface-container-low/20" : ""}`}>
              <td className="px-space-md py-space-sm font-mono font-semibold text-primary">{d.matricula}</td>
              <td className="px-space-md py-space-sm font-semibold">
                {d.nombre} {d.apellidos}
              </td>
              <td className="px-space-md py-space-sm text-on-surface-variant">{d.email}</td>
              <td className="px-space-md py-space-sm">
                <span
                  className={`rounded px-space-xs py-0.5 font-label-sm whitespace-nowrap ${
                    d.programa === "Finanzas" ? "bg-primary-fixed text-on-primary-fixed" : "bg-surface-container text-on-surface"
                  }`}
                >
                  Lic. en {d.programa}
                </span>
              </td>
              <td className="px-space-md py-space-sm whitespace-nowrap">{d.semestre}° Semestre</td>
              <td className="px-space-md py-space-sm capitalize">{d.turno || "—"}</td>
              <td className="px-space-md py-space-sm text-center">
                <Accion fila={f} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function MuestraCargas({ filas }: { filas: FilaValida[] }) {
  return (
    <table className="w-full min-w-[820px] text-left font-body-md text-body-md">
      <thead className={CABECERA_MUESTRA}>
        <tr>
          <th className="px-space-md py-space-sm">Matrícula</th>
          <th className="px-space-md py-space-sm">Alumno</th>
          <th className="px-space-md py-space-sm">Asignatura</th>
          <th className="px-space-md py-space-sm">Grupo</th>
          <th className="px-space-md py-space-sm">Ciclo</th>
          <th className="px-space-md py-space-sm text-center">Acción SABE</th>
        </tr>
      </thead>
      <tbody>
        {filas.map((f, i) => {
          const d = f.datos as DatosCarga;
          return (
            <tr key={f.linea} className={`transition-colors hover:bg-surface-container-low/40 ${i % 2 ? "bg-surface-container-low/20" : ""}`}>
              <td className="px-space-md py-space-sm font-mono font-semibold text-primary">{d.matricula}</td>
              <td className="px-space-md py-space-sm font-semibold">{d.alumno}</td>
              <td className="px-space-md py-space-sm">
                <span className="font-semibold">{d.materia}</span>
                <span className="block font-label-sm text-label-sm text-on-surface-variant">{d.clave}</span>
              </td>
              <td className="px-space-md py-space-sm whitespace-nowrap">Gpo {d.grupo}</td>
              <td className="px-space-md py-space-sm whitespace-nowrap">{d.ciclo}</td>
              <td className="px-space-md py-space-sm text-center">
                <Accion fila={f} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ---------------------------------------------------------------------------
// Paso 3
// ---------------------------------------------------------------------------

function PasoResultado({
  resultado,
  ciclo,
  hayErrores,
  reporteErrores,
  otra,
  cuentas,
}: {
  resultado: ResultadoImportacion;
  ciclo: string;
  hayErrores: boolean;
  reporteErrores: () => void;
  otra: () => void;
  cuentas: () => void;
}) {
  const alumnos = resultado.tipo === "alumnos";
  const hayCuentas = alumnos && resultado.credenciales.length > 0;
  return (
    <div className="flex flex-col gap-space-lg">
      <div className="relative flex flex-col items-center justify-between gap-space-lg overflow-hidden rounded-xl bg-primary p-space-xl text-on-primary shadow-sm md:flex-row">
        <div className="z-10 flex flex-col items-center gap-space-lg sm:flex-row">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-tertiary-fixed text-on-tertiary-fixed shadow-lg">
            <Simbolo nombre="check_circle" className="text-[38px]!" />
          </div>
          <div className="flex flex-col">
            <div className="flex flex-wrap items-center gap-space-sm">
              <span className="rounded-full bg-primary-container px-space-sm py-0.5 font-label-sm text-label-sm font-semibold tracking-wider text-on-primary uppercase">
                Proceso Concluido
              </span>
              <span className="font-label-sm text-label-sm text-on-primary-container">ID Lote: #{resultado.folio}</span>
            </div>
            <h2 className="mt-1 font-display-lg text-display-lg font-bold text-on-primary">¡Importación completada con éxito!</h2>
            <p className="mt-1 max-w-2xl font-body-md text-body-md text-surface-container-high">
              Los datos fueron incorporados correctamente en la base del Sistema de Altas y Bajas (SABE) para la Unidad
              Académica de Economía UAE.
            </p>
          </div>
        </div>
        <div className="z-10 shrink-0">
          <img alt="Escudo UAE" className="h-16 w-auto object-contain opacity-90 brightness-125" src="/img/escudo-uae.png" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-space-md sm:grid-cols-3">
        <TarjetaResumen
          titulo="Nuevas Altas"
          icono="person_add"
          circulo="bg-tertiary-fixed text-on-tertiary-fixed"
          numero={resultado.creados}
          etiqueta={alumnos ? "alumnos dados de alta" : "cargas nuevas"}
          detalle={alumnos ? "Cuentas generadas con correo institucional" : "Inscritas con origen Importación CSV"}
        />
        <TarjetaResumen
          titulo="Actualizaciones"
          icono="sync"
          circulo="bg-surface-container-highest text-primary"
          numero={resultado.actualizados}
          etiqueta={alumnos ? "registros actualizados" : "cargas sin cambios"}
          detalle={alumnos ? "Actualizados sin duplicar matrículas" : "Ya inscritas o con baja respetada"}
        />
        <TarjetaResumen
          titulo="Exclusiones"
          icono="block"
          circulo="bg-error-container text-on-error-container"
          numero={resultado.excluidos}
          etiqueta={resultado.excluidos === 1 ? "fila excluida" : "filas excluidas"}
          detalle="Disponibles en el reporte de anomalías"
          error
        />
      </div>

      <div className="flex flex-col items-start gap-space-md rounded-xl bg-secondary-fixed/50 p-space-lg text-on-surface shadow-sm sm:flex-row">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary-container text-on-secondary-fixed shadow-sm">
          <Simbolo nombre="security" className="text-[24px]!" />
        </div>
        <div className="flex flex-col">
          <div className="flex flex-wrap items-center gap-space-xs">
            <span className="font-headline-sm text-headline-sm font-bold text-primary">Aviso para Ventanilla de Control Escolar</span>
            <span className="rounded bg-surface-container-lowest px-space-xs py-0.5 font-label-sm text-label-sm font-semibold text-secondary">
              Ventanilla UAE
            </span>
          </div>
          <p className="mt-1 font-body-md text-body-md leading-relaxed text-on-surface">
            {resultado.creados === 0 ? (
              <>
                No hubo <strong>{alumnos ? "cuentas nuevas" : "cargas nuevas"}</strong>: los registros que ya existían se
                conservaron sin duplicar.
              </>
            ) : (
              <>
                {resultado.creados === 1 ? "La " : "Las "}
                <strong>
                  {resultado.creados} {alumnos ? "cuenta" : "carga"}
                  {resultado.creados === 1 ? " nueva" : "s nuevas"}
                </strong>{" "}
                {resultado.creados === 1 ? "se registró" : "se registraron"} en el catálogo local.
              </>
            )}{" "}
            La información procesada queda disponible para la generación del reporte y captura correspondiente por parte
            del personal de Control Escolar para el <strong>Ciclo Escolar {ciclo}</strong>.
          </p>
          <div className="mt-space-sm flex flex-wrap items-center gap-space-md font-label-sm text-label-sm text-on-surface-variant">
            <span className="flex items-center gap-space-xs">
              <Simbolo nombre="mark_email_read" className="text-[16px]! text-primary" />
              Notificación registrada en ventanilla
            </span>
            <span className="flex items-center gap-space-xs">
              <Simbolo nombre="assignment_turned_in" className="text-[16px]! text-primary" />
              Verificación manual por Control Escolar
            </span>
          </div>
          {hayCuentas && (
            <p className="mt-space-sm flex items-start gap-space-xs font-label-md text-label-md font-semibold text-primary">
              <Simbolo nombre="key" className="mt-0.5 text-[16px]!" />
              Las contraseñas temporales solo se muestran ahora: descarga las cuentas generadas antes de salir. Cada alumno
              deberá cambiarla al entrar.
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col items-center justify-between gap-space-md rounded-xl bg-surface-container-lowest p-space-md shadow-sm sm:flex-row">
        {hayErrores ? (
          <button
            type="button"
            onClick={reporteErrores}
            className="inline-flex w-full cursor-pointer items-center justify-center gap-space-sm rounded-lg bg-surface-container-low px-space-md py-space-sm font-label-lg text-label-lg text-primary transition-colors hover:bg-surface-container sm:w-auto"
          >
            <Simbolo nombre="download_for_offline" className="text-[18px]!" />
            <span>Descargar reporte de errores (.csv)</span>
          </button>
        ) : (
          <span />
        )}
        <div className="flex w-full flex-col items-stretch gap-space-sm sm:w-auto sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={otra}
            className="inline-flex cursor-pointer items-center justify-center gap-space-xs rounded-lg bg-surface-container-lowest px-space-md py-space-sm font-label-lg text-label-lg text-on-surface-variant shadow-sm transition-colors hover:bg-surface-container-low"
          >
            <Simbolo nombre="refresh" className="text-[18px]!" />
            <span>Importar otro archivo</span>
          </button>
          {hayCuentas && (
            <button
              type="button"
              onClick={cuentas}
              className="inline-flex cursor-pointer items-center justify-center gap-space-xs rounded-lg bg-primary px-space-lg py-space-sm font-label-lg text-label-lg text-on-primary shadow-sm transition-colors hover:bg-primary-container"
            >
              <Simbolo nombre="groups" className="text-[18px]!" />
              <span>Ver cuentas de estudiantes generadas</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function TarjetaResumen({
  titulo,
  icono,
  circulo,
  numero,
  etiqueta,
  detalle,
  error = false,
}: {
  titulo: string;
  icono: string;
  circulo: string;
  numero: number;
  etiqueta: string;
  detalle: string;
  error?: boolean;
}) {
  return (
    <div className="flex flex-col justify-between rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
      <div className="mb-space-sm flex items-center justify-between">
        <span className={`font-label-md text-label-md font-semibold tracking-wider uppercase ${error ? "text-error" : "text-on-surface-variant"}`}>
          {titulo}
        </span>
        <div className={`flex h-8 w-8 items-center justify-center rounded-full ${circulo}`}>
          <Simbolo nombre={icono} className="text-[18px]!" />
        </div>
      </div>
      <div className="flex flex-col">
        <span className={`font-display-lg text-display-lg font-bold ${error ? "text-error" : "text-primary"}`}>{numero}</span>
        <span className={`font-label-lg text-label-lg font-semibold ${error ? "text-error" : "text-on-surface"}`}>{etiqueta}</span>
        <span className="mt-1 font-body-sm text-body-sm text-on-surface-variant">{detalle}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Historial
// ---------------------------------------------------------------------------

function Historial({ cerrar }: { cerrar: () => void }) {
  const { data, isPending, error } = useImportaciones(true);
  return (
    <Modal cerrar={cerrar} titulo="titulo-historial" className="max-h-[90vh] max-w-4xl">
      <div className="flex items-center justify-between gap-space-md bg-surface-container-low p-space-lg">
        <div className="flex items-center gap-space-sm">
          <Simbolo nombre="history" className="text-[22px]! text-primary" />
          <h2 id="titulo-historial" className="font-headline-md text-headline-md text-primary">
            Historial de cargas
          </h2>
        </div>
        <button
          type="button"
          onClick={cerrar}
          aria-label="Cerrar"
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container"
        >
          <Simbolo nombre="close" className="text-[20px]!" />
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left font-body-md text-body-md">
          <thead className="bg-surface-container-low/50 font-label-md text-label-md tracking-wider text-on-surface-variant uppercase">
            <tr>
              <th className="px-space-md py-space-sm">ID Lote</th>
              <th className="px-space-md py-space-sm">Tipo</th>
              <th className="px-space-md py-space-sm">Archivo</th>
              <th className="px-space-md py-space-sm">Registró</th>
              <th className="px-space-md py-space-sm text-center">Altas / Act. / Excl.</th>
            </tr>
          </thead>
          <tbody>
            {data?.map((imp, i) => (
              <tr key={imp.id} className={i % 2 ? "bg-surface-container-low/20" : ""}>
                <td className="px-space-md py-space-sm font-mono font-semibold whitespace-nowrap text-primary">#{imp.folio}</td>
                <td className="px-space-md py-space-sm whitespace-nowrap">{imp.tipo === "alumnos" ? "Alumnos" : "Cargas académicas"}</td>
                <td className="max-w-[220px] px-space-md py-space-sm break-all text-on-surface-variant">{imp.archivo}</td>
                <td className="px-space-md py-space-sm">
                  <span className="block font-semibold">{imp.usuario ?? "—"}</span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">{fechaBitacora(imp.fecha)}</span>
                </td>
                <td className="px-space-md py-space-sm text-center whitespace-nowrap">
                  <span className="font-semibold text-primary">{imp.creados}</span> / {imp.actualizados} /{" "}
                  <span className={imp.excluidos ? "font-semibold text-error" : ""}>{imp.excluidos}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {isPending && (
          <div className="flex items-center justify-center gap-2 p-space-xl font-body-md text-on-surface-variant">
            <Spinner className="h-5 w-5 text-primary-container" /> Cargando historial…
          </div>
        )}
        {error && <div className="p-space-xl text-center font-body-md text-error">{error.message}</div>}
        {data?.length === 0 && (
          <div className="p-space-xl text-center font-body-md text-on-surface-variant">Aún no hay importaciones.</div>
        )}
      </div>
    </Modal>
  );
}
