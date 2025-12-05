// public/js/notifications.js
$(function(){
  const socket = io();

  // identify server-side room
  const userId = window.APP && window.APP.userId ? window.APP.userId : null;
  socket.on('connect', () => {
    socket.emit('identify', { userId: userId });
    console.log('socket connected and identified as', userId);
  });

  // helper to add item to dropdown and increase badge
  function addNotificationToDropdown(payload) {
    const list = $('#notifList');
    const row = $(`
      <li class="d-flex align-items-start mb-2">
        <div class="me-2">
          <div class="fw-bold">${escapeHtml(payload.title)}</div>
          <div>${escapeHtml(payload.message)}</div>
          <small class="text-muted">${new Date(payload.created_at).toLocaleString()}</small>
        </div>
      </li>
    `);
    // replace 'No notifications' message
    list.find('li.text-muted').remove();
    list.prepend(row);
    incrementBadge();
  }

  socket.on('notification', (payload) => {
    console.log('received notification', payload);
    addNotificationToDropdown(payload);
    flashBrief(); // small pulse to draw attention
  });

  // send notification via API when form submitted
  $('#notifyForm').on('submit', function(e){
    e.preventDefault();
    const userIdVal = $('#inputUserId').val();
    const title = $('#inputTitle').val();
    const message = $('#inputMessage').val();
    $.ajax({
      url: '/api/notify',
      method: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({ userId: userIdVal ? parseInt(userIdVal,10) : null, title, message }),
      success(res) {
        alert('Notification sent');
        $('#inputTitle').val('');
        $('#inputMessage').val('');
        $('#inputUserId').val('');
      },
      error(err) {
        alert('Send failed: ' + (err.responseJSON && err.responseJSON.error ? err.responseJSON.error : 'server error'));
      }
    });
  });

  // mark read button
  $(document).on('click', '.markReadBtn', function(){
    const id = $(this).data('id');
    const btn = $(this);
    $.post('/api/mark-read', { id }, function(res){
      if (res.ok) {
        btn.replaceWith('<span class="badge bg-success">Read</span>');
        decrementBadge();
      } else {
        alert('Failed');
      }
    });
  });

  // badge helpers
  function updateBadge(n) {
    const badge = $('#notifCountBadge');
    if (n > 0) {
      badge.text(n).show();
    } else {
      badge.hide();
    }
  }
  function incrementBadge() {
    const badge = $('#notifCountBadge');
    let cur = parseInt(badge.text()) || 0;
    cur += 1;
    badge.text(cur).show();
  }
  function decrementBadge() {
    const badge = $('#notifCountBadge');
    let cur = parseInt(badge.text()) || 0;
    cur = Math.max(0, cur - 1);
    if (cur === 0) badge.hide();
    else badge.text(cur);
  }

  // make an animated flash on navbar bell
  function flashBrief() {
    const btn = $('#notifToggle');
    btn.addClass('btn-warning');
    setTimeout(() => btn.removeClass('btn-warning'), 700);
  }

  // basic escaping to avoid HTML injection
  function escapeHtml(text) {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
});
