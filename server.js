const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mysql = require('mysql2/promise');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configure your MySQL connection here (update for your local setup)
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'chat_support'
};

// Helper: get DB connection
async function getConn() {
  return await mysql.createConnection(dbConfig);
}

// REST API to fetch last messages
app.get('/messages', async (req, res) => {
  try {
    const conn = await getConn();
    const [rows] = await conn.execute('SELECT * FROM messages ORDER BY created_at ASC LIMIT 1000');
    await conn.end();
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db error' });
  }
});

// Save message helper
async function saveMessage(sender, role, text) {
  try {
    const conn = await getConn();
    await conn.execute(
      'INSERT INTO messages (sender, role, message) VALUES (?, ?, ?)',
      [sender, role, text]
    );
    await conn.end();
  } catch (err) {
    console.error('saveMessage error', err);
  }
}

io.on('connection', (socket) => {
  console.log('socket connected', socket.id);

  socket.on('join', (data) => {
    // data: { room, name, role }
    socket.join(data.room);
    socket.data = { name: data.name, role: data.role, room: data.room };
    console.log(`${data.name} joined ${data.room} as ${data.role}`);
  });

  socket.on('message', async (msg) => {
    // msg: { room, sender, role, text }
    const payload = {
      id: Date.now(),
      sender: msg.sender,
      role: msg.role,
      message: msg.text,
      created_at: new Date()
    };
    // Save to DB
    await saveMessage(msg.sender, msg.role, msg.text);
    // Broadcast to room
    io.to(msg.room).emit('message', payload);
  });

  socket.on('disconnect', () => {
    console.log('socket disconnect', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('Server listening on', PORT);
});
