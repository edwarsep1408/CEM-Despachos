import fs from "fs";
import path from "path";

const CSV_PATH = path.join(__dirname, "../data/vehiculos-catalogo.csv");

const PLACEHOLDER = /^(n\.?n\.?|n\/a|na|xxx|-)?$/i;

const splitLinea = (linea) => {
  const out = [];
  let actual = "";
  let enComillas = false;
  for (let i = 0; i < linea.length; i += 1) {
    const ch = linea[i];
    if (ch === '"') {
      enComillas = !enComillas;
      continue;
    }
    if (ch === ";" && !enComillas) {
      out.push(actual.trim());
      actual = "";
      continue;
    }
    actual += ch;
  }
  out.push(actual.trim());
  return out;
};

export const normalizarPlaca = (placa) =>
  String(placa || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

export const esPlacaCarro = (placa) => /^[A-Z]{3}[0-9]{3}$/.test(normalizarPlaca(placa));

export const toneladasDeCapacidad = (valor) => {
  if (valor == null || valor === "") return 0;
  if (typeof valor === "number" && Number.isFinite(valor) && valor >= 0) return valor;
  const texto = String(valor).trim().toUpperCase().replace(",", ".");
  const match = texto.match(/([\d.]+)/);
  if (!match) return 0;
  const n = Number(match[1]);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

export const kgDeToneladas = (valor) => Number((toneladasDeCapacidad(valor) * 1000).toFixed(2));

const puntaje = (row) => {
  const conductor = String(row.conductor || "").trim();
  let puntos = 0;
  if (conductor && !PLACEHOLDER.test(conductor)) puntos += 4;
  if (row.telefono) puntos += 3;
  if (Number(row.flete) > 0) puntos += 2;
  if (row.idConductor) puntos += 2;
  if (row.capacidad && String(row.capacidad).toUpperCase() !== "0TON" && toneladasDeCapacidad(row.capacidad) > 0) puntos += 1;
  return puntos;
};

export const cargarCatalogoVehiculos = () => {
  if (!fs.existsSync(CSV_PATH)) return [];
  const texto = fs.readFileSync(CSV_PATH, "utf8").replace(/^\uFEFF/, "");
  const lineas = texto.split(/\r?\n/).filter((linea) => linea.trim());
  if (lineas.length < 2) return [];
  const encabezados = splitLinea(lineas[0]).map((h) => h.toLowerCase());
  const idx = (nombre) => encabezados.indexOf(nombre);

  const porPlaca = new Map();
  for (const linea of lineas.slice(1)) {
    const cols = splitLinea(linea);
    const placa = String(cols[idx("placa")] || "").trim().toUpperCase();
    if (!placa) continue;
    const clave = normalizarPlaca(placa);
    if (!clave) continue;
    const flete = Number(String(cols[idx("flete")] || "0").replace(",", "."));
    const row = {
      idVehiculo: Number(cols[idx("id")]) || 0,
      conductor: String(cols[idx("conductor")] || "").trim(),
      telefono: String(cols[idx("telefono")] || "").trim(),
      capacidad: toneladasDeCapacidad(cols[idx("capacidad")]),
      placa,
      flete: Number.isFinite(flete) ? flete : 0,
      idConductor: String(cols[idx("id_conductor")] || "").trim(),
    };
    const actual = porPlaca.get(clave);
    if (!actual) {
      porPlaca.set(clave, row);
      continue;
    }
    const mejor = puntaje(row) - puntaje(actual);
    if (mejor > 0 || (mejor === 0 && row.idVehiculo < actual.idVehiculo)) {
      porPlaca.set(clave, row);
    }
  }
  return [...porPlaca.values()].sort((a, b) => a.idVehiculo - b.idVehiculo);
};
