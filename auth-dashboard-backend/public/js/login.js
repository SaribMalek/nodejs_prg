// public/js/login.js (replace your file with this)
async function login() {
  try {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    document.getElementById("error").innerText = '';

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      credentials: 'same-origin' // safe when same origin
    });

    console.log('login HTTP status:', res.status, res.statusText);

    const data = await res.json().catch(err => {
      console.error('Failed parsing login JSON', err);
      return {};
    });

    console.log('raw login response body:', data);

    // tolerate multiple token shapes: { token }, { accessToken }, { data: { token } }
    const token = data.token || data.accessToken || (data.data && data.data.token) || null;

    if (!token) {
      // show the full response to user for debugging
      document.getElementById("error").innerText = data.error || JSON.stringify(data) || "Login failed (no token returned)";
      console.warn('No token in login response. Full response:', data);
      return;
    }

    // store and verify token
    localStorage.setItem("token", token);
    console.log('TOKEN SAVED (first 40 chars):', token.slice(0, 40) + (token.length > 40 ? '...' : ''));

    // quick sanity check - read it back
    const stored = localStorage.getItem('token');
    console.log('TOKEN read back from localStorage:', stored ? stored.slice(0, 40) + '...' : null);

    // navigate to dashboard
    window.location.href = "/dashboard.html";

  } catch (err) {
    console.error('Login error:', err);
    document.getElementById("error").innerText = 'Network or server error';
  }
}
