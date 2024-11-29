module.exports = async () => {
  // Aumentar los timeouts globales para CI
  if (process.env.CI) {
    jest.setTimeout(60000);
  }

  // Configurar variables de entorno específicas para pruebas
  process.env.NODE_ENV = 'test';
  
  // Asegurar que los módulos ESM funcionen correctamente
  process.env.JEST_WORKER_ID = process.env.JEST_WORKER_ID || '1';
};
