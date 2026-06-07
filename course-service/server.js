const app = require('./app');
const { initDB } = require('./db');

const PORT = process.env.PORT || 5002;

const startServer = async () => {
  await initDB();
  app.listen(PORT, () => {
    console.log(`📚 Course service running on port ${PORT}`);
  });
};

startServer();
