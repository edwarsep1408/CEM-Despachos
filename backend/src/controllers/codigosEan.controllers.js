import fs from "fs";
import path from "path";
import codigosEanModel from "../models/codigosEan.models";
import itemsModel from "../models/items.models";

const ok = (res, body, status = 200) =>
  res.status(status).json({ status, body, error: false });

const fail = (res, message, status = 400) =>
  res.status(status).json({ status, body: { message }, error: status >= 500 });

const txt = (v) => String(v ?? "").trim();

const parseCsv = (contenido) => {
  const lineas = String(contenido || "")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lineas.length) return [];
  const sep = lineas[0].includes(";") ? ";" : ",";
  const split = (linea) =>
    linea.split(sep).map((c) => txt(c).replace(/^"|"$/g, "").replace(/""/g, '"'));
  const header = split(lineas[0]).map((h) => h.toLowerCase());
  const idx = (names) => {
    for (const name of names) {
      const i = header.indexOf(name);
      if (i >= 0) return i;
    }
    return -1;
  };
  const iId = idx(["id", "idean"]);
  const iEan = idx(["eanprod", "ean", "ean_producto", "eanproducto"]);
  const iCliente = idx(["cliente"]);
  const iLoc = idx(["localizacion", "localización"]);
  const iRef = idx(["referencia", "referencia_producto"]);
  const iDesc = idx(["descripcion", "descripción"]);
  if (iEan < 0 || iRef < 0) {
    throw new Error("El CSV debe traer columnas eanprod (o ean) y referencia.");
  }
  const out = [];
  for (let n = 1; n < lineas.length; n += 1) {
    const cols = split(lineas[n]);
    const ean = txt(cols[iEan]);
    const referencia = txt(cols[iRef]);
    if (!ean || !referencia) continue;
    out.push({
      idEan: iId >= 0 ? Number(cols[iId]) || null : null,
      ean,
      cliente: (iCliente >= 0 ? txt(cols[iCliente]) : "") || "todos",
      localizacion: (iLoc >= 0 ? txt(cols[iLoc]) : "") || "1",
      referencia,
      descripcion: iDesc >= 0 ? txt(cols[iDesc]) : "",
    });
  }
  return out;
};

const siguienteId = async () => {
  const ultimo = await codigosEanModel.findOne().sort({ idEan: -1 }).lean();
  return (ultimo?.idEan || 0) + 1;
};

const upsertFilas = async (filas) => {
  let creados = 0;
  let actualizados = 0;
  let autoId = await siguienteId();
  for (const fila of filas) {
    const idEan = Number(fila.idEan) > 0 ? Number(fila.idEan) : autoId++;
    const filtro = { ean: fila.ean, cliente: fila.cliente || "todos" };
    const prev = await codigosEanModel.findOne(filtro).lean();
    if (prev) {
      await codigosEanModel.updateOne(
        { _id: prev._id },
        {
          $set: {
            referencia: fila.referencia,
            descripcion: fila.descripcion || prev.descripcion || "",
            localizacion: fila.localizacion || prev.localizacion || "1",
            estado: 0,
            fecha_actualizacion: new Date(),
          },
        }
      );
      actualizados += 1;
    } else {
      const idLibre = (await codigosEanModel.findOne({ idEan }).lean())
        ? await siguienteId()
        : idEan;
      if (idLibre >= autoId) autoId = idLibre + 1;
      await new codigosEanModel({
        idEan: idLibre,
        ean: fila.ean,
        cliente: fila.cliente || "todos",
        localizacion: fila.localizacion || "1",
        referencia: fila.referencia,
        descripcion: fila.descripcion || "",
      }).save();
      creados += 1;
    }
  }
  return { creados, actualizados, total: filas.length };
};

export const resolverItemPorEan = async (ean, glnOCliente = "") => {
  const codigo = txt(ean);
  if (!codigo) return null;
  const clave = txt(glnOCliente).toLowerCase();
  const candidatos = await codigosEanModel.find({ ean: codigo, estado: 0 }).lean();
  if (!candidatos.length) return null;
  const mapa =
    candidatos.find((c) => txt(c.localizacion).toLowerCase() === clave) ||
    candidatos.find((c) => txt(c.cliente).toLowerCase() === clave) ||
    candidatos.find((c) => txt(c.cliente).toLowerCase() === "todos") ||
    candidatos[0];
  if (!mapa) return null;
  const ref = txt(mapa.referencia);
  const item = await itemsModel
    .findOne({
      $or: [{ referencia: ref }, { codigoItem: ref }, { item: ref }],
    })
    .lean();
  return {
    ean: mapa.ean,
    cliente: mapa.cliente,
    localizacion: mapa.localizacion || "",
    referencia: ref,
    descripcionMapa: mapa.descripcion || "",
    item: item || null,
  };
};

/** En el CSV, cuando localizacion es GLN, cliente trae el nombre de la tienda (ej. 726-CARULLA TESORO). */
export const resolverTiendaPorGln = async (gln) => {
  const codigo = txt(gln);
  if (!codigo || codigo.length < 8) return null;
  const fila = await codigosEanModel
    .findOne({
      estado: 0,
      localizacion: codigo,
      cliente: { $nin: ["", "todos", "TODOS", "1"] },
    })
    .lean();
  if (!fila) return null;
  const nombre = txt(fila.cliente);
  const m = nombre.match(/^(\d+)\s*[-–]\s*(.+)$/);
  return {
    gln: codigo,
    nombreEstablecimiento: nombre,
    codigoEstablecimiento: m ? m[1] : "",
    razonSocial: /exito|carulla|surtimax|super\s*inter/i.test(nombre)
      ? "ALMACENES EXITO S.A."
      : /euro/i.test(nombre)
        ? "EURO"
        : "",
  };
};

const eanCtr = {};

eanCtr.getAll = async (req, res) => {
  try {
    const q = txt(req.query.q);
    const filtro = { estado: 0 };
    if (q) {
      filtro.$or = [
        { ean: new RegExp(q, "i") },
        { referencia: new RegExp(q, "i") },
        { descripcion: new RegExp(q, "i") },
        { cliente: new RegExp(q, "i") },
      ];
    }
    const body = await codigosEanModel.find(filtro).sort({ idEan: -1 }).lean();
    return ok(res, body);
  } catch (error) {
    console.error("codigosEan.getAll:", error.message);
    return fail(res, "No se pudieron leer los códigos EAN.", 500);
  }
};

eanCtr.post = async (req, res) => {
  try {
    const ean = txt(req.body?.ean || req.body?.eanProducto);
    const referencia = txt(req.body?.referencia || req.body?.referenciaProducto);
    const cliente = txt(req.body?.cliente) || "todos";
    const localizacion = txt(req.body?.localizacion) || "1";
    const descripcion = txt(req.body?.descripcion);
    if (!ean || !referencia) return fail(res, "EAN y referencia son obligatorios.");
    const existe = await codigosEanModel.findOne({ ean, cliente, estado: 0 }).lean();
    if (existe) return fail(res, `Ya existe EAN ${ean} para cliente ${cliente}.`);
    const body = await new codigosEanModel({
      idEan: await siguienteId(),
      ean,
      cliente,
      localizacion,
      referencia,
      descripcion,
    }).save();
    return ok(res, body.toObject(), 201);
  } catch (error) {
    console.error("codigosEan.post:", error.message);
    return fail(res, "No se pudo crear el código EAN.", 500);
  }
};

eanCtr.put = async (req, res) => {
  try {
    const { _id } = req.body || {};
    if (!_id) return fail(res, "Falta el identificador.");
    const ean = txt(req.body?.ean || req.body?.eanProducto);
    const referencia = txt(req.body?.referencia || req.body?.referenciaProducto);
    const cliente = txt(req.body?.cliente) || "todos";
    if (!ean || !referencia) return fail(res, "EAN y referencia son obligatorios.");
    const body = await codigosEanModel.findOneAndUpdate(
      { _id, estado: 0 },
      {
        ean,
        cliente,
        localizacion: txt(req.body?.localizacion) || "1",
        referencia,
        descripcion: txt(req.body?.descripcion),
        fecha_actualizacion: new Date(),
      },
      { new: true }
    );
    if (!body) return fail(res, "No se encontró el registro.", 404);
    return ok(res, body);
  } catch (error) {
    return fail(res, "No se pudo actualizar el código EAN.", 500);
  }
};

eanCtr.delete = async (req, res) => {
  try {
    const body = await codigosEanModel.findOneAndUpdate(
      { _id: req.params._id, estado: 0 },
      { estado: 2, fecha_actualizacion: new Date() },
      { new: true }
    );
    if (!body) return fail(res, "No se encontró el registro.", 404);
    return ok(res, body);
  } catch (error) {
    return fail(res, "No se pudo eliminar el código EAN.", 500);
  }
};

eanCtr.importarCsv = async (req, res) => {
  try {
    let contenido = "";
    if (req.file?.buffer) {
      contenido = req.file.buffer.toString("utf8");
    } else {
      const archivo = path.join(__dirname, "../data/codigosEan.csv");
      if (!fs.existsSync(archivo)) {
        return fail(res, "No hay archivo CSV adjunto ni plantilla en el servidor.");
      }
      contenido = fs.readFileSync(archivo, "utf8");
    }
    const filas = parseCsv(contenido);
    if (!filas.length) return fail(res, "El CSV no tiene filas válidas.");
    const result = await upsertFilas(filas);
    return ok(res, result);
  } catch (error) {
    console.error("codigosEan.importarCsv:", error.message);
    return fail(res, error.message || "No se pudo importar el CSV.", 400);
  }
};

export default eanCtr;
