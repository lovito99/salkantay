// Solo para "npm start": reenvía /api al backend cuando config.json usa una ruta relativa.
module.exports = {
  '/api': {
    target: process.env.API_TARGET || 'http://127.0.0.1:8000',
    secure: false,
    changeOrigin: true,
  },
};
