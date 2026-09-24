import path from "path";
import fs from "fs";
import XLSX from "xlsx";
import localizacionesModel from "../models/localizaciones.models";

const locCtr = {};

const ok = (res, body, status = 200) =>
  res.status(status).json({ status, body, error: false });

const fail = (res, message, status = 400) =>
  res.status(status).json({ status, body: { message }, error: status >= 500 });

const txt = (v) => String(v ?? "").trim();

const siguienteId = async () => {
  const ultimo = await localizacionesModel.findOne().sort({ idLocalizacion: -1 }).lean();
  return (ultimo?.idLocalizacion || 0) + 1;
};

const normalizarFila = (raw = {}) => {
  const codigoDep = txt(raw.codigoDep ?? raw.Dep ?? raw.dep ?? raw.codigo);
  let gln = txt(
    raw.gln ??
      raw["Localización EDI"] ??
      raw["Localizacion EDI"] ??
      raw.LocalizacionEDI ??
      raw.localizacion
  );
  if (gln === "0") gln = "";
  const dependencia = txt(
    raw.dependencia ?? raw.Dependencia ?? raw.nombre ?? raw.sede ?? raw.establecimiento
  );
  const cadena = txt(raw.cadena ?? raw.Cadena);
  const zona = txt(raw.zona ?? raw.Zona);
  return { codigoDep, gln, dependencia, cadena, zona };
};

const filasDesdeWorkbook = (workbook) => {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  return json.map(normalizarFila).filter((f) => f.dependencia || f.gln || f.codigoDep);
};

const filasDesdeCsv = (texto) => {
  const workbook = XLSX.read(texto, { type: "string" });
  return filasDesdeWorkbook(workbook);
};

const upsertFilas = async (filas) => {
  let creados = 0;
  let actualizados = 0;
  let omitidos = 0;
  let id = await siguienteId();
  for (const fila of filas) {
    if (!fila.dependencia && !fila.gln) {
      omitidos += 1;
      continue;
    }
    const filtro =
      fila.gln.length >= 8
        ? { gln: fila.gln, estado: { $in: [0, 2] } }
        : {
            cadena: fila.cadena,
            codigoDep: fila.codigoDep,
            estado: { $in: [0, 2] },
          };
    const prev = await localizacionesModel.findOne(filtro).lean();
    if (prev) {
      await localizacionesModel.updateOne(
        { _id: prev._id },
        {
          $set: {
            codigoDep: fila.codigoDep || prev.codigoDep,
            gln: fila.gln || prev.gln,
            dependencia: fila.dependencia || prev.dependencia,
            cadena: fila.cadena || prev.cadena,
            zona: fila.zona || prev.zona,
            estado: 0,
            fecha_actualizacion: new Date(),
          },
        }
      );
      actualizados += 1;
      continue;
    }
    while (await localizacionesModel.findOne({ idLocalizacion: id }).lean()) id += 1;
    await new localizacionesModel({
      idLocalizacion: id,
      ...fila,
      estado: 0,
    }).save();
    id += 1;
    creados += 1;
  }
  return { creados, actualizados, omitidos, total: filas.length };
};

const mapLocalizacion = (fila, gln = "") => {
  if (!fila) return null;
  return {
    gln: gln || fila.gln || "",
    nombreEstablecimiento: fila.dependencia || "",
    codigoEstablecimiento: fila.codigoDep || "",
    codigoDep: fila.codigoDep || "",
    dependencia: fila.dependencia || "",
    razonSocial: fila.cadena || "",
    zona: fila.zona || "",
    cadena: fila.cadena || "",
  };
};

/** Resuelve sede por GLN desde el catálogo de localizaciones. */
export const resolverLocalizacionPorGln = async (gln) => {
  const codigo = txt(gln);
  if (!codigo || codigo.length < 8) return null;
  const fila = await localizacionesModel.findOne({ gln: codigo, estado: 0 }).lean();
  return mapLocalizacion(fila, codigo);
};

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Resuelve sede por GLN, código Dep o nombre de dependencia/establecimiento. */
export const resolverLocalizacionParaDoc = async (doc = {}) => {
  const gln = txt(doc.gln || doc.glnEntrega || doc.glnComprador || doc.glnFacturar);
  if (gln.length >= 8) {
    const porGln = await resolverLocalizacionPorGln(gln);
    if (porGln?.codigoDep) return porGln;
  }
  const dep = txt(
    doc.codigoDep || doc.codigoEstablecimiento || doc.codigoCliente || doc.codigo
  );
  if (dep) {
    const fila = await localizacionesModel
      .findOne({ codigoDep: dep, estado: 0 })
      .lean();
    if (fila) return mapLocalizacion(fila);
  }
  const nombre = txt(doc.establecimiento || doc.sucursal || doc.dependencia || doc.cliente);
  if (nombre.length >= 5) {
    const fragmento = escapeRegex(nombre.slice(0, 36));
    const fila =
      (await localizacionesModel
        .findOne({ estado: 0, dependencia: new RegExp(`^${fragmento}`, "i") })
        .lean()) ||
      (await localizacionesModel
        .findOne({ estado: 0, dependencia: new RegExp(fragmento, "i") })
        .lean());
    if (fila) return mapLocalizacion(fila);
  }
  return null;
};

locCtr.getAll = async (req, res) => {
  try {
    const q = txt(req.query.q);
    const cadena = txt(req.query.cadena);
    const zona = txt(req.query.zona);
    const filtro = { estado: 0 };
    if (cadena) filtro.cadena = new RegExp(cadena, "i");
    if (zona) filtro.zona = new RegExp(zona, "i");
    if (q) {
      filtro.$or = [
        { gln: new RegExp(q, "i") },
        { dependencia: new RegExp(q, "i") },
        { codigoDep: new RegExp(q, "i") },
        { cadena: new RegExp(q, "i") },
        { zona: new RegExp(q, "i") },
      ];
    }
    const body = await localizacionesModel
      .find(filtro)
      .sort({ cadena: 1, zona: 1, dependencia: 1 })
      .lean();
    return ok(res, body);
  } catch (error) {
    console.error("localizaciones.getAll:", error.message);
    return fail(res, "No se pudieron leer las localizaciones.", 500);
  }
};

locCtr.post = async (req, res) => {
  try {
    const fila = normalizarFila(req.body || {});
    if (!fila.dependencia) return fail(res, "La dependencia (sede) es obligatoria.", 400);
    if (fila.gln) {
      const existe = await localizacionesModel.findOne({ gln: fila.gln, estado: 0 }).lean();
      if (existe) return fail(res, `Ya existe la localización GLN ${fila.gln}.`, 400);
    }
    const body = await new localizacionesModel({
      idLocalizacion: await siguienteId(),
      ...fila,
      estado: 0,
    }).save();
    return ok(res, body.toObject(), 201);
  } catch (error) {
    console.error("localizaciones.post:", error.message);
    return fail(res, "No se pudo guardar la localización.", 500);
  }
};

locCtr.put = async (req, res) => {
  try {
    const _id = txt(req.body?._id);
    if (!_id) return fail(res, "Falta el id.", 400);
    const fila = normalizarFila(req.body || {});
    if (!fila.dependencia) return fail(res, "La dependencia (sede) es obligatoria.", 400);
    const body = await localizacionesModel.findOneAndUpdate(
      { _id, estado: 0 },
      {
        $set: {
          ...fila,
          fecha_actualizacion: new Date(),
        },
      },
      { new: true }
    ).lean();
    if (!body) return fail(res, "No se encontró la localización.", 404);
    return ok(res, body);
  } catch (error) {
    console.error("localizaciones.put:", error.message);
    return fail(res, "No se pudo actualizar la localización.", 500);
  }
};

locCtr.delete = async (req, res) => {
  try {
    const body = await localizacionesModel.findOneAndUpdate(
      { _id: req.params._id, estado: 0 },
      { $set: { estado: 2, fecha_actualizacion: new Date() } },
      { new: true }
    ).lean();
    if (!body) return fail(res, "No se encontró la localización.", 404);
    return ok(res, body);
  } catch (error) {
    console.error("localizaciones.delete:", error.message);
    return fail(res, "No se pudo inactivar la localización.", 500);
  }
};

locCtr.importarArchivo = async (req, res) => {
  try {
    const archivo = req.file;
    if (!archivo?.buffer?.length) return fail(res, "Adjunte un Excel (.xlsx) o CSV.", 400);
    const nombre = String(archivo.originalname || "").toLowerCase();
    let filas = [];
    if (nombre.endsWith(".csv") || String(archivo.mimetype || "").includes("csv")) {
      filas = filasDesdeCsv(archivo.buffer.toString("utf8"));
    } else {
      const workbook = XLSX.read(archivo.buffer, { type: "buffer" });
      filas = filasDesdeWorkbook(workbook);
    }
    if (!filas.length) return fail(res, "El archivo no trae filas de localización.", 400);
    const resumen = await upsertFilas(filas);
    return ok(res, resumen);
  } catch (error) {
    console.error("localizaciones.importarArchivo:", error.message);
    return fail(res, "No se pudo importar el archivo.", 500);
  }
};

locCtr.importarPlantilla = async (_req, res) => {
  try {
    const xlsxPath = path.join(__dirname, "../data/localizaciones.xlsx");
    const csvPath = path.join(__dirname, "../data/localizaciones.csv");
    let filas = [];
    if (fs.existsSync(xlsxPath)) {
      const workbook = XLSX.readFile(xlsxPath);
      filas = filasDesdeWorkbook(workbook);
    } else if (fs.existsSync(csvPath)) {
      filas = filasDesdeCsv(fs.readFileSync(csvPath, "utf8"));
    } else {
      return fail(res, "No hay plantilla localizaciones.xlsx/csv en el servidor.", 404);
    }
    const resumen = await upsertFilas(filas);
    return ok(res, resumen);
  } catch (error) {
    console.error("localizaciones.importarPlantilla:", error.message);
    return fail(res, "No se pudo cargar la plantilla del servidor.", 500);
  }
};

export default locCtr;
