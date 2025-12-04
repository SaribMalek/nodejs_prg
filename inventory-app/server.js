require('dotenv').config();
const express = require('express');
const path = require('path');
const mysql = require('mysql2/promise');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// create pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'inventory_db',
  waitForConnections: true,
  connectionLimit: 10,
});

// helper: query wrapper
async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

/* ---------- Routes ---------- */

// Dashboard
app.get('/', async (req, res) => {
  const totalItems = (await query('SELECT COUNT(*) AS c FROM items'))[0].c;
  const totalSuppliers = (await query('SELECT COUNT(*) AS c FROM suppliers'))[0].c;
  const totalStock = (await query('SELECT SUM(stock) AS s FROM items'))[0].s || 0;
  // low stock items (stock < 10)
  const lowStock = await query('SELECT id, name, stock FROM items WHERE stock < 10 ORDER BY stock ASC LIMIT 8');
  res.render('dashboard', { totalItems, totalSuppliers, totalStock, lowStock });
});

/* ---------- ITEMS (CRUD) ---------- */

// List items
app.get('/items', async (req, res) => {
  const items = await query(`
    SELECT items.*, suppliers.name AS supplier_name
    FROM items
    LEFT JOIN suppliers ON suppliers.id = items.supplier_id
    ORDER BY items.id DESC
  `);
  res.render('items', { items });
});

// Add item form
app.get('/items/add', async (req, res) => {
  const suppliers = await query('SELECT id, name FROM suppliers ORDER BY name');
  res.render('item_form', { item: null, suppliers });
});

// Create item
app.post('/items/add', async (req, res) => {
  const { name, sku, category, price, stock, supplier_id } = req.body;
  await query(
    'INSERT INTO items (name, sku, category, price, stock, supplier_id) VALUES (?, ?, ?, ?, ?, ?)',
    [name, sku || null, category || null, parseFloat(price) || 0, parseInt(stock) || 0, supplier_id || null]
  );
  res.redirect('/items');
});

// Edit form
app.get('/items/edit/:id', async (req, res) => {
  const id = req.params.id;
  const item = (await query('SELECT * FROM items WHERE id = ?', [id]))[0];
  if (!item) return res.redirect('/items');
  const suppliers = await query('SELECT id, name FROM suppliers ORDER BY name');
  res.render('item_form', { item, suppliers });
});

// Update item
app.post('/items/edit/:id', async (req, res) => {
  const id = req.params.id;
  const { name, sku, category, price, stock, supplier_id } = req.body;
  await query(
    'UPDATE items SET name=?, sku=?, category=?, price=?, stock=?, supplier_id=? WHERE id=?',
    [name, sku || null, category || null, parseFloat(price) || 0, parseInt(stock) || 0, supplier_id || null, id]
  );
  res.redirect('/items');
});

// Delete item
app.post('/items/delete/:id', async (req, res) => {
  const id = req.params.id;
  await query('DELETE FROM items WHERE id = ?', [id]);
  res.redirect('/items');
});

/* ---------- SUPPLIERS (CRUD) ---------- */

// List suppliers
app.get('/suppliers', async (req, res) => {
  const suppliers = await query('SELECT * FROM suppliers ORDER BY id DESC');
  res.render('suppliers', { suppliers });
});

// Add supplier form
app.get('/suppliers/add', (req, res) => res.render('supplier_form', { supplier: null }));

// Create supplier
app.post('/suppliers/add', async (req, res) => {
  const { name, phone, email } = req.body;
  await query('INSERT INTO suppliers (name, phone, email) VALUES (?, ?, ?)', [name, phone || null, email || null]);
  res.redirect('/suppliers');
});

// Edit supplier form
app.get('/suppliers/edit/:id', async (req, res) => {
  const id = req.params.id;
  const supplier = (await query('SELECT * FROM suppliers WHERE id = ?', [id]))[0];
  if (!supplier) return res.redirect('/suppliers');
  res.render('supplier_form', { supplier });
});

// Update supplier
app.post('/suppliers/edit/:id', async (req, res) => {
  const id = req.params.id;
  const { name, phone, email } = req.body;
  await query('UPDATE suppliers SET name=?, phone=?, email=? WHERE id=?', [name, phone || null, email || null, id]);
  res.redirect('/suppliers');
});

// Delete supplier
app.post('/suppliers/delete/:id', async (req, res) => {
  const id = req.params.id;
  // optional: check items linked to supplier
  await query('UPDATE items SET supplier_id = NULL WHERE supplier_id = ?', [id]);
  await query('DELETE FROM suppliers WHERE id = ?', [id]);
  res.redirect('/suppliers');
});

/* ---------- STOCK MOVEMENTS ---------- */

// Stock page (list movements + quick forms)
app.get('/stock', async (req, res) => {
  const items = await query('SELECT id, name, stock FROM items ORDER BY name');
  const recent = await query(`
    SELECT sm.*, i.name AS item_name
    FROM stock_movements sm
    JOIN items i ON i.id = sm.item_id
    ORDER BY sm.created_at DESC
    LIMIT 30
  `);
  res.render('stock', { items, recent });
});

// Stock in
app.post('/stock/in', async (req, res) => {
  const { item_id, qty, note } = req.body;
  const q = parseInt(qty) || 0;
  if (q <= 0) return res.redirect('/stock');
  await query('INSERT INTO stock_movements (item_id, type, qty, note) VALUES (?, "in", ?, ?)', [item_id, q, note || null]);
  await query('UPDATE items SET stock = stock + ? WHERE id = ?', [q, item_id]);
  res.redirect('/stock');
});

// Stock out
app.post('/stock/out', async (req, res) => {
  const { item_id, qty, note } = req.body;
  const q = parseInt(qty) || 0;
  if (q <= 0) return res.redirect('/stock');
  // optional: clamp stock to zero
  await query('INSERT INTO stock_movements (item_id, type, qty, note) VALUES (?, "out", ?, ?)', [item_id, q, note || null]);
  await query('UPDATE items SET stock = GREATEST(stock - ?, 0) WHERE id = ?', [q, item_id]);
  res.redirect('/stock');
});

/* ---------- Start server ---------- */

app.listen(PORT, () => {
  console.log(`Inventory app running on http://localhost:${PORT}`);
});
