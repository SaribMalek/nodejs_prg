async function loadDashboard() {
  const token = localStorage.getItem("token");

  if (!token) {
    window.location.href = "login.html";
    return;
  }

  const res = await fetch("/api/dashboard", {
    headers: { Authorization: "Bearer " + token },
  });

  const data = await res.json();

  if (data.error) {
    window.location.href = "login.html";
  } else {
    document.getElementById("content").innerText =
      "Hello " + data.user.name + "! This is your dashboard.";
  }
}

function logout() {
  localStorage.removeItem("token");
  window.location.href = "login.html";
}

loadDashboard();
