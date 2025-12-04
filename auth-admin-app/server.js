require('dotenv').config();
const express = require('express');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const flash = require('connect-flash');

const app = express();
const PORT = process.env.PORT || 3000;

// DB pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'auth_admin_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// View engine & static
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Body parsers
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Sessions + flash
app.use(session({
  secret: process.env.SESSION_SECRET || 'keyboard cat',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 } // 1 day
}));
app.use(flash());

// expose flash & user to views
app.use((req, res, next) => {
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  res.locals.user = req.session.user || null;
  next();
});

// ----- Auth helpers -----
function ensureAuthenticated(req, res, next) {
  if (req.session.user) return next();
  req.flash('error', 'Please login to continue');
  res.redirect('/login');
}

function ensureAdmin(req, res, next) {
  if (req.session.user && req.session.user.role === 'admin') return next();
  req.flash('error', 'Admin access required');
  res.redirect('/');
}

// ----- Routes -----
// Home -> redirect to dashboard if logged in else to login or public welcome
app.get('/', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.redirect('/login');
});

app.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Session destroy error:', err);
      // if error, try to clear cookie and redirect anyway
      res.clearCookie('connect.sid');
      return res.redirect('/login');
    }
    res.clearCookie('connect.sid'); // remove session cookie
    // Redirect to login with a flag so we can show a message
    res.redirect('/login?loggedout=1');
  });
});


/* ---------- AUTH ------------ */

// GET - Register form
app.get('/register', (req, res) => {
  res.render('auth/register');
});

// POST - Register
app.post('/register', async (req, res) => {
  const { name, email, password, password2 } = req.body;
  if (!name || !email || !password || !password2) {
    req.flash('error', 'Please fill all fields');
    return res.redirect('/register');
  }
  if (password !== password2) {
    req.flash('error', 'Passwords do not match');
    return res.redirect('/register');
  }
  try {
    // check exists
    const [rows] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (rows.length) {
      req.flash('error', 'Email already registered');
      return res.redirect('/register');
    }
    // hash password
    const hashed = await bcrypt.hash(password, 10);
    // insert (first registered user becomes admin if table empty)
    const [count] = await pool.query('SELECT COUNT(*) AS c FROM users');
    const isFirst = count[0].c === 0;
    const role = isFirst ? 'admin' : 'user';
    await pool.query('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)', [name, email, hashed, role]);
    req.flash('success', 'Registration successful. Please login.');
    res.redirect('/login');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Something went wrong');
    res.redirect('/register');
  }
});

// GET - Login form
app.get('/login', (req, res) => {
  res.render('auth/login');
});

// POST - Login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    req.flash('error', 'Enter email and password');
    return res.redirect('/login');
  }
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (!rows.length) {
      req.flash('error', 'Invalid credentials');
      return res.redirect('/login');
    }
    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      req.flash('error', 'Invalid credentials');
      return res.redirect('/login');
    }
    // store safe user data in session
    req.session.user = { id: user.id, name: user.name, email: user.email, role: user.role };
    req.flash('success', 'Logged in successfully');
    res.redirect('/dashboard');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Login error');
    res.redirect('/login');
  }
});

// Logout
app.post('/logout', (req, res) => {
  req.session.destroy(err => {
    res.redirect('/login');
  });
});

/* ---------- Dashboard & Profile ---------- */

// Dashboard (protected)
app.get('/dashboard', ensureAuthenticated, async (req, res) => {
  // dummy analytics data
  const dummy = {
    usersCount: (await pool.query('SELECT COUNT(*) AS c FROM users'))[0][0].c,
    sales: 1200, // static/dummy
    orders: 34
  };
  res.render('dashboard', { analytics: dummy });
});

// Profile - GET
app.get('/profile', ensureAuthenticated, async (req, res) => {
  const userId = req.session.user.id;
  const [rows] = await pool.query('SELECT id, name, email, role, created_at FROM users WHERE id = ?', [userId]);
  res.render('profile', { user: rows[0] });
});

// Profile - POST update
app.post('/profile', ensureAuthenticated, async (req, res) => {
  const userId = req.session.user.id;
  const { name, email, password, password2 } = req.body;
  try {
    // check email uniqueness (if changed)
    const [rowsEmail] = await pool.query('SELECT id FROM users WHERE email = ? AND id != ?', [email, userId]);
    if (rowsEmail.length) {
      req.flash('error', 'Email already used by another account');
      return res.redirect('/profile');
    }
    if (password) {
      if (password !== password2) {
        req.flash('error', 'Passwords do not match');
        return res.redirect('/profile');
      }
      const hash = await bcrypt.hash(password, 10);
      await pool.query('UPDATE users SET name = ?, email = ?, password = ? WHERE id = ?', [name, email, hash, userId]);
    } else {
      await pool.query('UPDATE users SET name = ?, email = ? WHERE id = ?', [name, email, userId]);
    }
    // update session user
    req.session.user.name = name;
    req.session.user.email = email;
    req.flash('success', 'Profile updated');
    res.redirect('/profile');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Update failed');
    res.redirect('/profile');
  }
});

/* ---------- Admin: Manage Users (CRUD) ---------- */

// Admin users list
app.get('/admin/users', ensureAuthenticated, ensureAdmin, async (req, res) => {
  const [users] = await pool.query('SELECT id, name, email, role, created_at FROM users ORDER BY id DESC');
  res.render('admin/users', { users });
});

// Admin: create user (POST)
app.post('/admin/users/create', ensureAuthenticated, ensureAdmin, async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) {
    req.flash('error', 'Fill required fields');
    return res.redirect('/admin/users');
  }
  try {
    const [exists] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (exists.length) {
      req.flash('error', 'Email already exists');
      return res.redirect('/admin/users');
    }
    const hash = await bcrypt.hash(password, 10);
    await pool.query('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)', [name, email, hash, role || 'user']);
    req.flash('success', 'User created');
    res.redirect('/admin/users');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Create failed');
    res.redirect('/admin/users');
  }
});

// Admin: edit user
app.post('/admin/users/edit/:id', ensureAuthenticated, ensureAdmin, async (req, res) => {
  const id = req.params.id;
  const { name, email, role } = req.body;
  try {
    const [exists] = await pool.query('SELECT id FROM users WHERE email = ? AND id != ?', [email, id]);
    if (exists.length) {
      req.flash('error', 'Email already used');
      return res.redirect('/admin/users');
    }
    await pool.query('UPDATE users SET name = ?, email = ?, role = ? WHERE id = ?', [name, email, role, id]);
    req.flash('success', 'User updated');
    res.redirect('/admin/users');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Update failed');
    res.redirect('/admin/users');
  }
});

// Admin: delete user
app.post('/admin/users/delete/:id', ensureAuthenticated, ensureAdmin, async (req, res) => {
  const id = req.params.id;
  try {
    // prevent deleting self
    if (parseInt(id) === req.session.user.id) {
      req.flash('error', 'You cannot delete your own account');
      return res.redirect('/admin/users');
    }
    await pool.query('DELETE FROM users WHERE id = ?', [id]);
    req.flash('success', 'User deleted');
    res.redirect('/admin/users');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Delete failed');
    res.redirect('/admin/users');
  }
});

// start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
