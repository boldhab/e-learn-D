const app = require('./app');
const { initDB } = require('./db');

const PORT = process.env.PORT || 5001;

const startServer = async () => {
  await initDB();
  app.listen(PORT, () => {
    console.log(`🔐 Auth service running on port ${PORT}`);
  });
};

startServer();
