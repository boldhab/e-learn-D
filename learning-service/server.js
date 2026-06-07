const app = require('./app');
const { initDB } = require('./db');

const PORT = process.env.PORT || 5003;

const startServer = async () => {
  await initDB();
  app.listen(PORT, () => {
    console.log(`📖 Learning service running on port ${PORT}`);
  });
};

startServer();
