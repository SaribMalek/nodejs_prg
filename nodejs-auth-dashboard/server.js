// server.js (compatible with lowdb@1.0.0)
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const flash = require('connect-flash');
const bcrypt = require('bcryptjs');
const shortid = require('shortid');

const low = require('lowdb');
const expressLayouts = require('express-ejs-layouts');
const FileSync = require('lowdb/adapters/FileSync');
const adapter = new FileSync(path.join(__dirname, 'db.json'));
const db = low(adapter);
db.defaults({ users: [] }).write();

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(expressLayouts);
app.set('layout', 'layout');

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'keyboard cat 123',
  resave: false,
  saveUninitialized: false
}));
app.use(flash());

app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.error = req.flash('error');
  res.locals.user = req.session.user || null;
  next();
});

function ensureAuthenticated(req, res, next) {
  if (req.session && req.session.user) return next();
  req.flash('error_msg', 'Please log in to view that resource');
  res.redirect('/login');
}

app.get('/', (req, res) => res.redirect('/login'));

app.get('/register', (req, res) => res.render('register'));

app.post('/register', (req, res) => {
  const { name, email, password, password2 } = req.body;
  let errors = [];

  if (!name || !email || !password || !password2) errors.push({ msg: 'Please enter all fields' });
  if (password !== password2) errors.push({ msg: 'Passwords do not match' });
  if (password && password.length < 6) errors.push({ msg: 'Password must be at least 6 characters' });

  if (errors.length > 0) return res.render('register', { errors, name, email, password, password2 });

  const existing = db.get('users').find({ email }).value();
  if (existing) {
    req.flash('error_msg', 'Email already registered');
    return res.redirect('/register');
  }

  const salt = bcrypt.genSaltSync(10);
  const hash = bcrypt.hashSync(password, salt);

  const user = { id: shortid.generate(), name, email, password: hash, createdAt: new Date().toISOString() };
  db.get('users').push(user).write();

  req.flash('success_msg', 'You are now registered and can log in');
  res.redirect('/login');
});

app.get('/login', (req, res) => res.render('login'));

app.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) { req.flash('error_msg', 'Please enter all fields'); return res.redirect('/login'); }

  const user = db.get('users').find({ email }).value();
  if (!user) { req.flash('error_msg', 'Invalid credentials'); return res.redirect('/login'); }

  const isMatch = bcrypt.compareSync(password, user.password);
  if (!isMatch) { req.flash('error_msg', 'Invalid credentials'); return res.redirect('/login'); }

  req.session.user = { id: user.id, name: user.name, email: user.email };
  req.flash('success_msg', 'Welcome back!');
  res.redirect('/dashboard');
});

app.get('/dashboard', ensureAuthenticated, (req, res) => {
  const users = db.get('users').value();
  res.render('dashboard', { users });
});

app.get('/logout', (req, res) => {
  req.session.destroy(err => { res.redirect('/login'); });
});

app.listen(PORT, () => console.log(`Server started on http://localhost:${PORT}`));
