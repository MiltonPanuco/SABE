// CSV que se arma en el navegador (reporte de errores y cuentas generadas de la importación).
import { guardarArchivo } from "../api/client";

function celda(valor: string | number): string {
  const texto = String(valor);
  return /[",\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/** Descarga `filas` (la primera es el encabezado) como CSV con BOM, para que Excel respete los acentos. */
export function descargarCsv(nombre: string, filas: (string | number)[][]) {
  const texto = "﻿" + filas.map((f) => f.map(celda).join(",")).join("\r\n") + "\r\n";
  guardarArchivo(new Blob([texto], { type: "text/csv;charset=utf-8" }), nombre);
}
