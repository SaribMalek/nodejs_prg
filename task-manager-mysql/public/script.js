document.addEventListener('DOMContentLoaded', () => {
  const editModal = document.getElementById('editModal');
  const editForm = document.getElementById('editForm');
  const editTitle = document.getElementById('editTitle');
  const cancelEdit = document.getElementById('cancelEdit');

  // Open edit modal when clicking Edit
  document.getElementById('taskList').addEventListener('click', (e) => {
    if (!e.target.classList.contains('editBtn')) return;
    const li = e.target.closest('li');
    if (!li) return;
    const id = li.dataset.id;
    const title = li.querySelector('.task-item__title').textContent.trim();

    // set form action (server expects POST /tasks/edit/:id)
    editForm.action = `/tasks/edit/${id}`;
    editTitle.value = title;

    // show modal
    editModal.setAttribute('aria-hidden', 'false');
    editTitle.focus();
    editTitle.select();
  });

  // Cancel edit
  cancelEdit.addEventListener('click', () => {
    editModal.setAttribute('aria-hidden', 'true');
  });

  // close modal when click backdrop
  document.querySelectorAll('[data-close="true"]').forEach(el => {
    el.addEventListener('click', () => editModal.setAttribute('aria-hidden', 'true'));
  });

  // close modal on ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') editModal.setAttribute('aria-hidden', 'true');
  });
});
