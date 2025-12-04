// src/app.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { sequelize, testConnection } = require('./config/db');
const User = require('./models/User'); // ensure model is registered
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');

const app = express();
app.use(cors());
app.use(express.json());

// Test DB connection then sync models
(async () => {
  await testConnection();
  // sync tables - in production use migrations; alter:true for dev convenience
  await sequelize.sync({ alter: true });
  console.log('✅ Database synced (sequelize.sync).');
})();

app.use('/api/auth', authRoutes);
app.use('/api', dashboardRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
