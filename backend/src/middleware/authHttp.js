import jwt from 'jsonwebtoken';
import moment from 'moment';

const secret = '3s[J293_PXP';

const md_auth = {}; 

md_auth.ensureAuth = (req, res, next) => {
    
    if (!req.headers.authorization) {
        
        return res.status(403).send({ message: 'La petición no tiene la cabecera de autenticación' })
    }
    const token = req.headers.authorization.split(' ')[1]
    try {
        var payload = jwt.decode(token, secret)
        if (payload.exp <= moment().unix()) {
            return res.status(401).send({ message: 'El token expirado' })
        }

    } catch (ex) {
        return res.status(403).send({ message: 'El token no es valido' })
    }

    req.user = payload;

    next();
};

export default md_auth