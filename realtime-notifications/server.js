// server.js
const express = require('express');
const http = require('http');
const path = require('path');
const pool = require('./config/db');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

/*
  Concept:
  - Each connected client sends `userId` (could be via query or handshake) and server makes the socket join a room `user_<userId>`
  - To notify a single user: emit to room `user_<userId>`
  - To broadcast: emit to `broadcast` room or to all sockets
  - Notifications are persisted into MySQL (notifications table)
*/

// Express setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || 'change_this_secret',
  resave: false,
  saveUninitialized: true
}));

// Simple "login" for demo (select user id via query param or form)
app.get('/', async (req, res) => {
  // If user selected ?userId=1, we store it in session for demo
  if (req.query.userId) {
    req.session.userId = parseInt(req.query.userId, 10);
  }
  const userId = req.session.userId || null;

  // fetch last 10 notifications for this user (user_id = null = broadcasts)
  try {
    let rows;
    if (userId) {
      [rows] = await pool.query(
        `SELECT * FROM notifications 
         WHERE user_id IS NULL OR user_id = ? 
         ORDER BY created_at DESC LIMIT 50`, [userId]
      );
    } else {
      [rows] = await pool.query(
        `SELECT * FROM notifications 
         WHERE user_id IS NULL 
         ORDER BY created_at DESC LIMIT 50`
      );
    }
    res.render('index', { userId, notifications: rows });
  } catch (err) {
    console.error('DB fetch error:', err);
    res.render('index', { userId, notifications: [] });
  }
});

/*
  API to create notification.
  POST /api/notify
  body: { userId: optional int (omit or null for broadcast), title: string, message: string, meta: object(optional) }
*/
app.post('/api/notify', async (req, res) => {
  try {
    const { userId, title, message, meta } = req.body;
    const parsedMeta = meta ? JSON.stringify(meta) : null;
    // persist
    const [result] = await pool.query(
      'INSERT INTO notifications (user_id, title, message, meta) VALUES (?, ?, ?, ?)',
      [userId || null, title, message, parsedMeta]
    );
    const insertId = result.insertId;
    const payload = {
      id: insertId,
      user_id: userId || null,
      title,
      message,
      meta: meta || null,
      created_at: new Date().toISOString()
    };

    // emit real-time
    if (userId) {
      // to specific user room
      io.to(`user_${userId}`).emit('notification', payload);
    } else {
      // broadcast to everyone
      io.emit('notification', payload);
    }

    res.json({ ok: true, id: insertId, payload });
  } catch (err) {
    console.error('Notify error:', err);
    res.status(500).json({ ok: false, error: err.message || 'server error' });
  }
});

/*
  API to mark a notification as read:
  POST /api/mark-read
  body: { id: notificationId }
*/
app.post('/api/mark-read', async (req, res) => {
  try {
    const { id } = req.body;
    await pool.query('UPDATE notifications SET is_read = 1 WHERE id = ?', [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('mark-read error:', err);
    res.status(500).json({ ok: false, error: err.message || 'server error' });
  }
});

/* Socket.IO handling */
io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  // Expect client to send "identify" event with userId after connecting
  socket.on('identify', (data) => {
    // data: { userId: 123 }
    const userId = data && data.userId ? data.userId : null;
    if (userId) {
      const room = `user_${userId}`;
      socket.join(room);
      console.log(`Socket ${socket.id} joined room ${room}`);
    } else {
      // optionally join a public room for anonymous users
      socket.join('anonymous');
    }
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);
  });
});

// start
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
