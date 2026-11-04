import { useQuery } from "@tanstack/react-query";

// Pantalla de arranque: comprueba que el frontend ya conversa con el backend.
// Reemplazar por las rutas reales (login, estudiante, control escolar).
export default function App() {
  const { data, isError, isPending } = useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      const res = await fetch("/api/health/");
      if (!res.ok) throw new Error("backend no disponible");
      return (await res.json()) as { status: string; app: string };
    },
    retry: false,
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 p-6">
      <h1 className="font-display text-3xl font-bold text-primary">SABE</h1>
      <p className="text-slate-600">Sistema de Altas y Bajas de Economía</p>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <span className="text-sm text-slate-500">Backend: </span>
        {isPending && <span>comprobando...</span>}
        {isError && (
          <span className="font-semibold text-baja">
            sin conexión (levanta Django en el puerto 8000)
          </span>
        )}
        {data && <span className="font-semibold text-alta">conectado ({data.status})</span>}
      </div>
    </main>
  );
}
