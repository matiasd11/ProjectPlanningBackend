const jwt = require('jsonwebtoken');
const { secret } = require('../config/jwt');

function verifyToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

    if (!token) return res.status(401).json({ message: 'Token requerido' });

    jwt.verify(token, secret, (err, decoded) => {
        if (err) return res.status(403).json({ message: 'Token inválido' });
        req.user = decoded; // guardamos info del usuario en request
        next();
    });
}

module.exports = verifyToken;
