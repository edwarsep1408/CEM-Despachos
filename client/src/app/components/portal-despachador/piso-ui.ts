import Swal from "sweetalert2";
import { firstValueFrom } from "rxjs";
import { MotivosOmisionService } from "../../services/despacho/motivos-omision.service";

export const atajoBloqueado = (ev: KeyboardEvent) => {
  const t = ev.target as HTMLElement | null;
  const tag = (t?.tagName || "").toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select" || t?.isContentEditable) {
    return true;
  }
  return !!document.querySelector(".swal2-container");
};

export async function pedirMotivoOmision(motivos: MotivosOmisionService): Promise<string | null> {
  let inputOptions: Record<string, string> = {};
  try {
    const res = await firstValueFrom(motivos.Get());
    for (const m of res?.body || []) {
      if (m?.nombre) inputOptions[m.nombre] = m.nombre;
    }
  } catch {
    /* catálogo local de respaldo */
  }
  if (!Object.keys(inputOptions).length) {
    inputOptions = {
      CANCELADO: "CANCELADO",
      REPETIDO: "REPETIDO",
      DISPONIBILIDAD: "DISPONIBILIDAD",
      EXCEDE: "EXCEDE",
      RETENIDO: "RETENIDO",
    };
  }
  const r = await Swal.fire({
    title: "Omitir",
    input: "select",
    inputOptions,
    inputPlaceholder: "Seleccione un motivo",
    showCancelButton: true,
    confirmButtonText: "Omitir",
    cancelButtonText: "Cancelar",
    confirmButtonColor: "#c0392b",
  });
  if (!r.isConfirmed) return null;
  const motivo = String(r.value || "").trim();
  return motivo || null;
}

export function mensajeApi(error: any, fallback = "No se pudo completar la acción.") {
  return error?.error?.body?.message || error?.message || fallback;
}

export function formatearTemperatura(valor: string | number | null | undefined): string | null {
  const s = String(valor ?? "")
    .trim()
    .replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return n.toFixed(1);
}

export function etiquetaCargue(id: unknown, bodega?: unknown): string {
  const n = id == null || id === "" ? "" : String(id);
  const b = String(bodega || "").trim();
  if (!n) return b;
  if (!b) return n;
  return `${n}-${b}`;
}

export function documentoDespachado(doc: any): boolean {
  return String(doc?.estadoDespacho || "").toUpperCase() === "DESP";
}

export function documentoOmitido(doc: any): boolean {
  return !!doc?.omitido || String(doc?.estadoDespacho || "").toUpperCase() === "OMIT";
}

export function documentoCerrado(doc: any): boolean {
  return documentoDespachado(doc) || documentoOmitido(doc);
}

export function lineaOmitida(row: any): boolean {
  return !!row?.omitido || String(row?.estadoDespacho || "").toUpperCase() === "OMIT";
}

export function pedidoEnDe(row: any): "UNIDADES" | "KILOS" {
  const um = String(row?.pedidoEn || row?.unidad || row?.undInventario || row?.um || "")
    .trim()
    .toUpperCase();
  if (um.includes("KG") || um.includes("KILO")) return "KILOS";
  if (um.includes("UND") || um.includes("UNID")) return "UNIDADES";
  const und = Number(row?.unidades) || 0;
  const kg = Number(row?.pesoPedido ?? row?.kilo) || 0;
  if (kg > 0 && !(und > 0)) return "KILOS";
  return "UNIDADES";
}

export type EstadoAvance = "falta" | "completo" | "exceso";

export type AvancePedido = { pct: number; estado: EstadoAvance; etiqueta: string };

export function avancePedido(linea: any): AvancePedido {
  const enKilos = pedidoEnDe(linea) === "KILOS";
  const pedido = enKilos ? Number(linea?.pesoPedido || 0) : Number(linea?.unidades || 0);
  const despachado = enKilos ? Number(linea?.pd || 0) : Number(linea?.cd || 0);
  if (!(pedido > 0)) {
    const estado: EstadoAvance = despachado > 0 ? "exceso" : "falta";
    return { pct: despachado > 0 ? 100 : 0, estado, etiqueta: etiquetaAvance(estado) };
  }
  const pct = (despachado / pedido) * 100;
  const estado: EstadoAvance = pct > 101 ? "exceso" : pct >= 99 ? "completo" : "falta";
  return { pct, estado, etiqueta: etiquetaAvance(estado) };
}

function etiquetaAvance(estado: EstadoAvance) {
  if (estado === "completo") return "Completo";
  if (estado === "exceso") return "Se pasó";
  return "Falta";
}

export async function confirmarRepesar(texto: string): Promise<boolean> {
  const r = await Swal.fire({
    title: "Repesar",
    text: texto,
    showCancelButton: true,
    confirmButtonText: "Repesar",
    cancelButtonText: "Cancelar",
  });
  return r.isConfirmed;
}

export function mensajePesoInvalido(peso: number | null, tara = 0): string {
  if (peso == null || !Number.isFinite(Number(peso))) return "Indique el peso.";
  const p = Number(peso);
  const t = Number(tara) || 0;
  if (p < 0) return "El peso no puede ser negativo.";
  if (!(p > 1)) return "El peso debe ser mayor a 1 kg.";
  if (t < 0) return "La tara no puede ser negativa.";
  if (p - t < 0) return "El peso neto no puede ser negativo. La tara es mayor que el peso.";
  return "";
}

export async function confirmarDesbalance(opts: {
  estado: EstadoAvance;
  etiqueta: string;
  detalle?: string;
  accion?: string;
}): Promise<boolean> {
  if (opts.estado !== "falta" && opts.estado !== "exceso") return true;
  const esc = (s: string) =>
    String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  const cuerpo = esc(
    opts.detalle || `${opts.etiqueta}. ¿Confirma ${opts.accion || "guardar"} igual?`
  ).replace(/\n/g, "<br>");
  const r = await Swal.fire({
    icon: "warning",
    title: opts.estado === "exceso" ? "Hay exceso" : "Falta despacho",
    html: cuerpo,
    showCancelButton: true,
    confirmButtonText: opts.accion ? `${opts.accion} igual` : "Guardar igual",
    cancelButtonText: "Cancelar",
    confirmButtonColor: "#c0392b",
  });
  return r.isConfirmed;
}

export const MUELLE_PISO_KEY = "cem-muelle-piso";
export const MUELLE_PISO_NOMBRE_KEY = "cem-muelle-piso-nombre";
const MUELLE_PISO_SESION_KEY = "cem-muelle-piso-sesion";

export const leerMuellePiso = () => {
  try {
    return String(localStorage.getItem(MUELLE_PISO_KEY) || "").trim();
  } catch {
    return "";
  }
};

export const leerNombreMuellePiso = () => {
  try {
    return String(localStorage.getItem(MUELLE_PISO_NOMBRE_KEY) || "").trim();
  } catch {
    return "";
  }
};

export const guardarMuellePiso = (id: string, nombre?: string) => {
  try {
    const valor = String(id || "").trim();
    if (valor) {
      localStorage.setItem(MUELLE_PISO_KEY, valor);
      const etiqueta = String(nombre || "").trim();
      if (etiqueta) localStorage.setItem(MUELLE_PISO_NOMBRE_KEY, etiqueta);
    } else {
      localStorage.removeItem(MUELLE_PISO_KEY);
      localStorage.removeItem(MUELLE_PISO_NOMBRE_KEY);
    }
  } catch {
    /* ignore */
  }
};

export const limpiarMuellePiso = () => {
  guardarMuellePiso("");
  try {
    sessionStorage.removeItem(MUELLE_PISO_SESION_KEY);
  } catch {
    /* ignore */
  }
};

const marcarSesionMuelle = () => {
  try {
    sessionStorage.setItem(MUELLE_PISO_SESION_KEY, "1");
  } catch {
    /* ignore */
  }
};

const sesionMuelleOk = () => {
  try {
    return sessionStorage.getItem(MUELLE_PISO_SESION_KEY) === "1";
  } catch {
    return false;
  }
};

const nombreMuelleOpcion = (item: any) => String(item?.nombre || "").trim() || "Muelle";

const escHtml = (valor: string) =>
  String(valor)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const tituloBodega = (muelles: any[]) => {
  const bodega = muelles[0]?.bodega;
  if (!bodega) return "";
  const codigo = String(bodega.codigo || "").trim();
  const nombre = String(bodega.nombre || "").trim();
  if (nombre && codigo && nombre !== codigo) return `${nombre} (${codigo})`;
  return nombre || codigo;
};

export async function pedirMuellePiso(
  muellesApi: { GetPiso: () => import("rxjs").Observable<any> },
  opts?: { forzar?: boolean }
): Promise<string | null> {
  let muelles: any[] = [];
  try {
    const res = await firstValueFrom(muellesApi.GetPiso());
    muelles = res?.body || [];
  } catch (err) {
    await Swal.fire({
      icon: "error",
      title: "No se pudieron cargar los muelles",
      text: mensajeApi(err, "Asigne una bodega a este despachador en Asignación de bodega."),
      confirmButtonText: "Salir",
    });
    return null;
  }

  if (!muelles.length) {
    await Swal.fire({
      icon: "warning",
      title: "Sin muelles",
      text: "No hay muelles en la bodega asignada. Créelos en Configuración → Muelles.",
      confirmButtonText: "Salir",
    });
    return null;
  }

  const actual = leerMuellePiso();
  const valido = muelles.some((item) => String(item._id) === actual);
  if (!opts?.forzar && sesionMuelleOk() && valido) return actual;

  const preseleccion = valido ? actual : muelles.length === 1 ? String(muelles[0]._id) : "";

  const bodega = tituloBodega(muelles);
  const opciones = muelles
    .map((item) => {
      const id = String(item._id);
      const marcado = id === preseleccion ? " checked" : "";
      return `<label class="swal-muelle">
        <input type="radio" name="muelle-piso" value="${escHtml(id)}"${marcado}>
        <span class="swal-muelle-check" aria-hidden="true"></span>
        <span class="swal-muelle-nombre">${escHtml(nombreMuelleOpcion(item))}</span>
      </label>`;
    })
    .join("");

  const r = await Swal.fire({
    title: "Seleccione el muelle",
    html: `${bodega ? `<p class="swal-muelle-bodega">Bodega ${escHtml(bodega)}</p>` : ""}<div class="swal-muelle-lista">${opciones}</div>`,
    allowOutsideClick: false,
    allowEscapeKey: false,
    showCancelButton: true,
    confirmButtonText: "Continuar",
    cancelButtonText: "Salir",
    confirmButtonColor: "#1a3a6b",
    width: 420,
    customClass: {
      popup: "swal-muelle-popup",
      htmlContainer: "swal-muelle-html",
    },
    preConfirm: () => {
      const elegido = document.querySelector<HTMLInputElement>('input[name="muelle-piso"]:checked');
      if (!elegido?.value) {
        Swal.showValidationMessage("Seleccione un muelle para continuar.");
        return false;
      }
      return elegido.value;
    },
  });

  if (!r.isConfirmed) return null;
  const id = String(r.value || "").trim();
  if (!id) return null;
  const elegido = muelles.find((item) => String(item._id) === id);
  guardarMuellePiso(id, elegido?.nombre);
  marcarSesionMuelle();
  return id;
};

export const nombreMuelle = (valor: unknown) => {
  if (!valor || typeof valor === "string") return "";
  return String((valor as { nombre?: string }).nombre || "").trim();
};
