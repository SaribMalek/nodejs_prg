const taskInput = document.getElementById('taskInput');
const addTaskBtn = document.getElementById('addTaskBtn');
const taskList = document.getElementById('taskList');

// Load tasks from server
const loadTasks = async () => {
    const res = await fetch('/api/tasks');
    const tasks = await res.json();
    taskList.innerHTML = '';
    tasks.forEach(task => {
        const li = document.createElement('li');
        li.textContent = task.title;
        li.className = task.completed ? 'completed' : '';
        li.addEventListener('click', () => toggleTask(task.id, !task.completed));
        const delBtn = document.createElement('button');
        delBtn.textContent = 'Delete';
        delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteTask(task.id);
        });
        li.appendChild(delBtn);
        taskList.appendChild(li);
    });
};

// Add task
addTaskBtn.addEventListener('click', async () => {
    const title = taskInput.value.trim();
    if (!title) return alert('Enter a task!');
    await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title })
    });
    taskInput.value = '';
    loadTasks();
});

// Delete task
const deleteTask = async (id) => {
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    loadTasks();
};

// Toggle complete
const toggleTask = async (id, completed) => {
    await fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed })
    });
    loadTasks();
};

// Initial load
loadTasks();
