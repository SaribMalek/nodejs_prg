// src/middleware/auth.js
const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
  // Express lowercases header names, so use .authorization
  const authHeader = req.headers['authorization'] || req.headers['Authorization'] || null;
  console.log('auth middleware - raw authHeader:', authHeader);

  if (!authHeader) {
    return res.status(401).json({ error: 'Token missing' });
  }

  // Accept "Bearer <token>", "bearer <token>", or just "<token>"
  const parts = String(authHeader).split(' ').filter(Boolean);
  const token = parts.length === 2 ? parts[1] : parts[0];

  if (!token) {
    return res.status(401).json({ error: 'Token missing' });
  }

  try {
    const secret = process.env.JWT_SECRET || 'devsecret';
    const payload = jwt.verify(token, secret);
    req.user = payload;
    return next();
  } catch (err) {
    console.warn('auth middleware - jwt verify failed:', err.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};
