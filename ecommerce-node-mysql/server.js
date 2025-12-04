require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;

// DB pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'ecommerce_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// view engine & static
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// parse body
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// session (cart stored in session)
app.use(session({
  secret: process.env.SESSION_SECRET || 'secretkey',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 1000 * 60 * 60 * 24 } // 1 day
}));

// middleware to ensure cart exists in session & make available to views
app.use((req, res, next) => {
  if (!req.session.cart) req.session.cart = {};
  res.locals.cart = req.session.cart;
  res.locals.cartCount = Object.values(req.session.cart).reduce((s, it) => s + it.qty, 0);
  next();
});

/* ---------- Routes ---------- */

// Home - products list
app.get('/', async (req, res) => {
  const [products] = await pool.query('SELECT * FROM products');
  res.render('index', { products });
});

// Product details
app.get('/product/:id', async (req, res) => {
  const id = req.params.id;
  const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [id]);
  if (rows.length === 0) return res.status(404).send('Product not found');
  res.render('product', { product: rows[0] });
});

// Add to cart (POST)
app.post('/cart/add', async (req, res) => {
  const { productId, qty } = req.body;
  const q = parseInt(qty, 10) || 1;
  const [rows] = await pool.query('SELECT id, title, price, stock FROM products WHERE id = ?', [productId]);
  if (rows.length === 0) return res.redirect('/');
  const p = rows[0];
  const id = p.id;

  // merge into session cart
  if (!req.session.cart[id]) {
    req.session.cart[id] = { id, title: p.title, price: parseFloat(p.price), qty: 0 };
  }
  req.session.cart[id].qty += q;

  // optional: clamp to stock
  if (p.stock && req.session.cart[id].qty > p.stock) req.session.cart[id].qty = p.stock;

  res.redirect('/cart');
});

// Show cart
app.get('/cart', (req, res) => {
  const items = Object.values(req.session.cart);
  const total = items.reduce((s, it) => s + it.qty * it.price, 0);
  res.render('cart', { items, total });
});

// Update cart (change qty)
app.post('/cart/update', (req, res) => {
  const { productId, qty } = req.body;
  const q = parseInt(qty, 10) || 1;
  if (req.session.cart[productId]) {
    if (q <= 0) delete req.session.cart[productId];
    else req.session.cart[productId].qty = q;
  }
  res.redirect('/cart');
});

// Remove item
app.post('/cart/remove', (req, res) => {
  const { productId } = req.body;
  if (req.session.cart[productId]) delete req.session.cart[productId];
  res.redirect('/cart');
});

// Checkout (creates order and order_items)
app.post('/checkout', async (req, res) => {
  const items = Object.values(req.session.cart);
  if (!items.length) return res.redirect('/cart');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const total = items.reduce((s, it) => s + it.qty * it.price, 0);
    const [orderResult] = await conn.query('INSERT INTO orders (total) VALUES (?)', [total]);
    const orderId = orderResult.insertId;

    const insertItemSql = 'INSERT INTO order_items (order_id, product_id, qty, price) VALUES ?';
    const values = items.map(it => [orderId, it.id, it.qty, it.price]);
    if (values.length) {
      await conn.query(insertItemSql, [values]);
    }

    // reduce stock (optional)
    for (const it of items) {
      await conn.query('UPDATE products SET stock = GREATEST(stock - ?, 0) WHERE id = ?', [it.qty, it.id]);
    }

    await conn.commit();
    // clear cart
    req.session.cart = {};

    res.render('success', { orderId, total });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).send('Checkout failed');
  } finally {
    conn.release();
  }
});

// start server
app.listen(PORT, () => console.log(`Server started at http://localhost:${PORT}`));
