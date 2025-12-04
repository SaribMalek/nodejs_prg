(function(){
  const socket = io();

  const nameInput = document.getElementById('name');
  const roomInput = document.getElementById('room');
  const messageInput = document.getElementById('message');
  const sendBtn = document.getElementById('sendBtn');
  const chatArea = document.getElementById('chatArea');

  function appendMessage(m) {
    const el = document.createElement('div');
    el.className = 'mb-2';
    const time = new Date(m.created_at).toLocaleString();
    el.innerHTML = '<strong>' + m.sender + '</strong> <small class="text-muted">(' + m.role + ' - ' + time + ')</small><div>' + m.message + '</div>';
    chatArea.appendChild(el);
    chatArea.scrollTop = chatArea.scrollHeight;
  }

  // join room when name & room available
  function join() {
    const name = nameInput.value || 'Guest';
    const room = roomInput.value || 'support';
    socket.emit('join', { name, room, role: document.location.pathname.includes('admin') ? 'agent' : 'customer' });
    // load recent messages
    fetch('/messages').then(r=>r.json()).then(rows=>{
      chatArea.innerHTML = '';
      rows.forEach(appendMessage);
    });
  }

  sendBtn && sendBtn.addEventListener('click', ()=>{
    const text = messageInput.value.trim();
    if(!text) return;
    const payload = {
      room: roomInput.value || 'support',
      sender: nameInput.value || 'Guest',
      role: document.location.pathname.includes('admin') ? 'agent' : 'customer',
      text
    };
    socket.emit('message', payload);
    messageInput.value = '';
  });

  socket.on('connect', ()=>{
    join();
  });

  socket.on('message', (m)=>{
    appendMessage(m);
  });
})();
