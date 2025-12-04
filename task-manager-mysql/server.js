const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');

// MySQL Connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',      // your MySQL user
    password: '',      // your MySQL password
    database: 'task_manager'
});

db.connect((err) => {
    if (err) throw err;
    console.log('Connected to MySQL Database.');
});

// Routes

// Home page
app.get('/', (req, res) => {
    const sql = "SELECT * FROM tasks";
    db.query(sql, (err, results) => {
        if (err) throw err;
        res.render('index', { tasks: results });
    });
});

// Add task
app.post('/tasks/add', (req, res) => {
    const title = req.body.title;
    const sql = "INSERT INTO tasks (title) VALUES (?)";
    db.query(sql, [title], (err, result) => {
        if (err) throw err;
        res.redirect('/');
    });
});

// Update task (toggle complete)
app.post('/tasks/update/:id', (req, res) => {
    const id = req.params.id;
    const completed = req.body.completed === 'true' ? 1 : 0;
    const sql = "UPDATE tasks SET completed = ? WHERE id = ?";
    db.query(sql, [completed, id], (err, result) => {
        if (err) throw err;
        res.redirect('/');
    });
});

// Edit task title
app.post('/tasks/edit/:id', (req, res) => {
    const id = req.params.id;
    const title = req.body.title;
    const sql = "UPDATE tasks SET title = ? WHERE id = ?";
    db.query(sql, [title, id], (err, result) => {
        if (err) throw err;
        res.redirect('/');
    });
});

// Delete task
app.post('/tasks/delete/:id', (req, res) => {
    const id = req.params.id;
    const sql = "DELETE FROM tasks WHERE id = ?";
    db.query(sql, [id], (err, result) => {
        if (err) throw err;
        res.redirect('/');
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
