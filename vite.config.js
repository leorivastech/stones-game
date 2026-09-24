export default {
  server: {
    host: "127.0.0.1",
    port: 5181,
    strictPort: true,
    // En línea en desarrollo: la conexión en vivo va al servidor de server/ (npm run server).
    proxy: { "/net": { target: "ws://127.0.0.1:5190", ws: true } },
  },
};
