module.exports = {
    secret: process.env.JWT_SECRET || 'tu_secreto_super_seguro', // cambiar en producción
    expiresIn: '1h' // duración del token
};
