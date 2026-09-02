import jwt from 'jsonwebtoken';

export const JWT_SECRET = process.env.JWT_SECRET || '3s[J293_PXP';

const md_auth = {};

md_auth.ensureAuth = (req, res, next) => {
    if (!req.headers.authorization) {
        return res.status(403).send({ message: 'La petición no tiene la cabecera de autenticación' });
    }

    const parts = req.headers.authorization.split(' ');
    const token = parts.length === 2 ? parts[1] : null;

    if (!token) {
        return res.status(403).send({ message: 'El token no es valido' });
    }

    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch (ex) {
        return res.status(403).send({ message: 'El token no es valido' });
    }
};

md_auth.requirePermiso = (codigo) => md_auth.requireAnyPermiso(codigo);

md_auth.requireAnyPermiso = (...codigos) => (req, res, next) => {
    const permisos = req.user?.identity?.permisos;
    if (!Array.isArray(permisos)) {
        return next();
    }
    if (codigos.some((codigo) => permisos.includes(codigo))) {
        return next();
    }
    return res.status(403).json({
        status: 403,
        body: { message: "No tiene permiso para esta acción." },
        error: true,
    });
};

export default md_auth;
