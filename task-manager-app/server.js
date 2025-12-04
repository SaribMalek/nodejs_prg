const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// File paths
const TASKS_FILE = path.join(__dirname, 'data', 'tasks.json');

// Load tasks
const loadTasks = () => {
    const dataBuffer = fs.readFileSync(TASKS_FILE);
    return JSON.parse(dataBuffer.toString());
};

// Save tasks
const saveTasks = (tasks) => {
    fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2));
};

// Routes
app.get('/api/tasks', (req, res) => {
    res.json(loadTasks());
});

app.post('/api/tasks', (req, res) => {
    const tasks = loadTasks();
    const newTask = {
        id: tasks.length + 1,
        title: req.body.title || 'Untitled Task',
        completed: false
    };
    tasks.push(newTask);
    saveTasks(tasks);
    res.status(201).json(newTask);
});

app.put('/api/tasks/:id', (req, res) => {
    const tasks = loadTasks();
    const task = tasks.find(t => t.id === parseInt(req.params.id));
    if (task) {
        task.title = req.body.title || task.title;
        task.completed = req.body.completed !== undefined ? req.body.completed : task.completed;
        saveTasks(tasks);
        res.json(task);
    } else {
        res.status(404).json({ error: 'Task not found' });
    }
});

app.delete('/api/tasks/:id', (req, res) => {
    let tasks = loadTasks();
    const index = tasks.findIndex(t => t.id === parseInt(req.params.id));
    if (index !== -1) {
        const deleted = tasks.splice(index, 1);
        saveTasks(tasks);
        res.json(deleted[0]);
    } else {
        res.status(404).json({ error: 'Task not found' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
