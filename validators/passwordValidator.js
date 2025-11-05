/**
 * Validar contraseña para crear usuario en Bonita
 * Verifica que la contraseña contenga:
 * - Al menos una letra minúscula
 * - Al menos una letra mayúscula
 * - Al menos un número
 * - Al menos un carácter especial
 * - Mínimo 8 caracteres
 */

/**
 * Valida la fortaleza de una contraseña
 * @param {string} password - La contraseña a validar
 * @returns {Object} - { isValid: boolean, errors: string[] }
 */
function validatePasswordStrength(password) {
  const errors = [];

  // Verificar que la contraseña no esté vacía
  if (!password || typeof password !== 'string') {
    return {
      isValid: false,
      errors: ['La contraseña es requerida']
    };
  }

  // Verificar longitud mínima
  if (password.length < 8) {
    errors.push('La contraseña debe tener al menos 8 caracteres');
  }

  // Verificar minúsculas
  if (!/[a-z]/.test(password)) {
    errors.push('La contraseña debe contener al menos una letra minúscula');
  }

  // Verificar mayúsculas
  if (!/[A-Z]/.test(password)) {
    errors.push('La contraseña debe contener al menos una letra mayúscula');
  }

  // Verificar números
  if (!/[0-9]/.test(password)) {
    errors.push('La contraseña debe contener al menos un número');
  }

  // Verificar caracteres especiales
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('La contraseña debe contener al menos un carácter especial (!@#$%^&*()_+-=[]{}|;\':",./<>?)');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

module.exports = {
  validatePasswordStrength
};

