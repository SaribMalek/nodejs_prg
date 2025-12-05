// server.js
const express = require('express');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const session = require('express-session');
const flash = require('express-flash');
require('dotenv').config();

const app = express();

const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'public', 'uploads');
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '5242880', 10);

console.log('Starting server with configuration:');
console.log({ PORT, UPLOAD_DIR, MAX_FILE_SIZE, DB_HOST: process.env.DB_HOST, DB_NAME: process.env.DB_NAME });

/* create upload dir if necessary */
try {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    console.log('Created upload dir:', UPLOAD_DIR);
  } else {
    console.log('Upload dir exists:', UPLOAD_DIR);
  }
} catch (err) {
  console.error('Failed to create upload dir:', err);
  process.exit(1);
}

/* DB pool: initialize and test connection */
let pool;
(async () => {
  try {
    const mysql = require('mysql2/promise');
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'file_upload_db',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    // test a simple connection
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    console.log('Connected to MySQL:', process.env.DB_NAME);
  } catch (err) {
    console.error('MySQL connection error. Check credentials / server. Error:');
    console.error(err.message || err);
    console.error('Exiting process. Fix DB and restart.');
    process.exit(1);
  }
})();

/* express setup */
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || 'change_this_secret',
  resave: false,
  saveUninitialized: true
}));
app.use(flash());

/* multer storage */
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext)
      .replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
    const unique = Date.now() + '-' + Math.round(Math.random()*1e9);
    cb(null, `${base}_${unique}${ext}`);
  }
});

const ALLOWED_MIME = [
  'image/jpeg','image/png','image/gif',
  'application/pdf','text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Invalid file type: ' + file.mimetype));
  }
});

/* Routes */
app.get('/', async (req, res) => {
  try {
    if (!pool) throw new Error('DB pool not initialized yet');
    const [rows] = await pool.query('SELECT * FROM files ORDER BY uploaded_at DESC');
    res.render('index', { files: rows, messages: req.flash(), maxFileSize: MAX_FILE_SIZE });
  } catch (err) {
    console.error('GET / error:', err.message || err);
    req.flash('error', 'Server error: ' + (err.message || 'unknown'));
    res.render('index', { files: [], messages: req.flash(), maxFileSize: MAX_FILE_SIZE });
  }
});

app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      req.flash('error', 'No file uploaded');
      return res.redirect('/');
    }
    const { originalname, filename, mimetype, size, path: fpath } = req.file;
    await pool.query(
      'INSERT INTO files (original_name, file_name, mime_type, size, path) VALUES (?, ?, ?, ?, ?)',
      [originalname, filename, mimetype, size, fpath]
    );
    req.flash('success', 'File uploaded');
    res.redirect('/');
  } catch (err) {
    console.error('POST /upload error:', err.message || err);
    if (req.file && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch(e){}
    }
    req.flash('error', 'Upload failed: ' + (err.message || 'unknown'));
    res.redirect('/');
  }
});

app.get('/download/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM files WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).send('File not found');
    const file = rows[0];
    res.download(path.resolve(file.path), file.original_name);
  } catch (err) {
    console.error('GET /download error:', err);
    res.status(500).send('Server error');
  }
});

app.post('/delete/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM files WHERE id = ?', [req.params.id]);
    if (!rows.length) { req.flash('error','File not found'); return res.redirect('/'); }
    const file = rows[0];
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    await pool.query('DELETE FROM files WHERE id = ?', [req.params.id]);
    req.flash('success','File deleted');
    res.redirect('/');
  } catch (err) {
    console.error('POST /delete error:', err);
    req.flash('error','Delete failed');
    res.redirect('/');
  }
});

/* global error handler */
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  req.flash('error', err.message || 'Unknown error');
  res.redirect('/');
});

/* start server */
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
