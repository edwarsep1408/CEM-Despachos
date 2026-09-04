import axios from "axios";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../middleware/authHttp";
import usuariosModel from "../models/usuarios.models";
import { verifyPassword } from "../seguridad/password";
import { asegurarCatalogoPermisos } from "../controllers/seguridad.controllers";
import { todosLosCodigos } from "../seguridad/catalogoPermisos";
import { esCargoFirma, etiquetaCargo } from "../seguridad/catalogoCargos";

const sesionCtr = {};

const API_URL = process.env.SSO_VALIDAR_URL || "http://192.168.1.252:5000/api/v1/validar-sesion";

const emitirToken = (identity) =>
  jwt.sign({ identity, sub: identity.nombre, origen: identity.origen }, JWT_SECRET, {
    expiresIn: "12h",
  });

sesionCtr.loginLocal = async (req, res) => {
    const { usuario, password } = req.body || {};
    if (!usuario || !password) {
        return res.status(401).json({
            status: 401,
            body: { message: "Usuario o contraseña incorrectos" },
            error: true,
        });
    }

    try {
        const localUser = process.env.LOCAL_LOGIN_USER || "admin";
        const localPass = process.env.LOCAL_LOGIN_PASSWORD || "admin";
        if (usuario === localUser && password === localPass) {
            const identity = {
                nombre: usuario,
                usuario,
                perfil: "Administrador",
                perfilId: "",
                permisos: todosLosCodigos(),
                puedeFirmar: false,
                origen: "local",
            };
            return res.status(200).json({
                token: emitirToken(identity),
                identity,
            });
        }

        await asegurarCatalogoPermisos();
        const usuarioBuscado = String(usuario).trim();
        const cuenta = await usuariosModel
            .findOne({
              usuario: { $regex: `^${usuarioBuscado.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
            })
            .populate("perfil", "nombre permisos estado");

        if (cuenta && verifyPassword(password, cuenta.password)) {
            if (cuenta.estado === 2) {
                return res.status(403).json({
                    status: 403,
                    body: { message: "Usuario inactivo. Pida que lo activen en Usuarios." },
                    error: true,
                });
            }
            if (cuenta.estado !== 0) {
                return res.status(401).json({
                    status: 401,
                    body: { message: "Usuario o contraseña incorrectos" },
                    error: true,
                });
            }
            const perfil = cuenta.perfil && cuenta.perfil.estado === 0 ? cuenta.perfil : null;
            let cargo = String(cuenta.cargo || "").toUpperCase();
            if (!cargo && perfil && /despachador/i.test(perfil.nombre)) cargo = "DESPACHADOR";
            else if (!cargo) cargo = String(cuenta.cargoFirma || "").toUpperCase();
            const soloFirma = esCargoFirma(cargo);
            const identity = {
                nombre: cuenta.nombre || cuenta.usuario,
                usuario: cuenta.usuario,
                usuarioId: String(cuenta._id),
                perfil: soloFirma ? etiquetaCargo(cargo) : perfil?.nombre || "",
                perfilId: soloFirma || !perfil?._id ? "" : String(perfil._id),
                permisos: soloFirma ? [] : Array.isArray(perfil?.permisos) ? perfil.permisos : [],
                puedeFirmar: soloFirma,
                cargo,
                cargoFirma: soloFirma ? cargo : "",
                bodega: String(cuenta.bodega || "").trim(),
                bodegaNombre: String(cuenta.bodegaNombre || "").trim(),
                origen: "local",
            };
            return res.status(200).json({
                token: emitirToken(identity),
                identity,
            });
        }

        return res.status(401).json({
            status: 401,
            body: { message: "Usuario o contraseña incorrectos" },
            error: true,
        });
    } catch (error) {
        return res.status(500).json({
            status: 500,
            body: { message: "No se pudo iniciar sesión." },
            error: true,
        });
    }
};

sesionCtr.validarSesion = async (req, res) => {
    const ssoHabilitado = String(process.env.SSO_ENABLED || "").toLowerCase() === "true";
    if (!ssoHabilitado) {
        return res.status(503).json({
            status: 503,
            body: { message: "SSO deshabilitado. Use el acceso local." },
            error: true,
        });
    }

    const { token } = req.body;

    try {
        const options = {
            headers: {
                AuthorizationApi: token,
            },
        };
        const response = await axios.post(API_URL, { token }, options);
        const responseData = response.data.body;

        res.status(response.status).json(responseData);
    } catch (error) {
        if (error.response) {
            res.status(error.response.status).json(error.response.data);
        } else if (error.request) {
            res.status(500).json({
                status: 500,
                body: { message: "No se recibió respuesta del servidor" },
                error: true,
            });
        } else {
            res.status(500).json({
                status: 500,
                body: { message: "Error al configurar la solicitud" },
                error: true,
            });
        }
    }
};

export default sesionCtr;
