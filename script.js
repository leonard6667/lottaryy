// ⏱️ Countdown Timer
const endDate = new Date();
endDate.setDate(endDate.getDate() + 30);

function updateCountdown() {
  const now = new Date();
  const diff = endDate - now;

  if (diff <= 0) {
    document.getElementById("timer").textContent = "Lottery ended!";
    return;
  }

  const hours = Math.floor(diff / (1000 * 60 * 60)) % 24;
  const minutes = Math.floor(diff / (1000 * 60)) % 60;
  const seconds = Math.floor(diff / 1000) % 60;

  document.getElementById("hours").textContent = String(hours).padStart(2, '0');
  document.getElementById("minutes").textContent = String(minutes).padStart(2, '0');
  document.getElementById("seconds").textContent = String(seconds).padStart(2, '0');
}
setInterval(updateCountdown, 1000);

// 🔐 Register User
document.getElementById("registerForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("regEmail").value.trim();

  if (!email || !email.includes("@gmail.com")) {
    alert("Please enter a valid Gmail address.");
    return;
  }

  try {
    const res = await fetch("/register", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email })
});

if (!res.ok) {
  const text = await res.text(); // چون ممکنه HTML باشه
  console.error("Server error:", res.status, text);
  alert("ثبت‌نام انجام نشد: " + res.status);
  return;
}

const data = await res.json();
console.log("Registration successful:", data);
  } catch (err) {
    console.error(err);
    alert("Server error during registration.");
  }
});

// 💸 Submit Donation
document.getElementById("donationForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const txid = document.getElementById("txid").value.trim();
  const email = document.getElementById("donorEmail").value.trim();
  const refUID = document.getElementById("refUID").value.trim();

  if (!txid || !email) {
    alert("Please fill in all required fields.");
    return;
  }

  try {
    const res = await fetch("/donate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ txid, email, refUID })
    });

    const data = await res.json();
    alert(data.message || "Donation submitted!");
  } catch (err) {
    console.error(err);
    alert("Server error during donation submission.");
  }
});

// 📋 Copy Referral Link
function copyReferral() {
  const refInput = document.getElementById("refLink");
  refInput.select();
  refInput.setSelectionRange(0, 99999); // For mobile
  document.execCommand("copy");
  alert("Referral link copied!");
}

// 📊 Load Top Donors
async function loadTopDonors() {
  try {
    const res = await fetch("/top-donors");
    const donors = await res.json();
    const table = document.getElementById("donorTable");
    table.innerHTML = "";

    donors.forEach(d => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${d.uid}</td>
        <td>${d.email}</td>
        <td>${d.chances}</td>
        <td>${d.total}</td>
      `;
      table.appendChild(row);
    });
  } catch (err) {
    console.error("Error loading donors:", err);
  }
}

// 📊 Load Top Referrers
async function loadTopReferrals() {
  try {
    const res = await fetch("/top-referrals");
    const refs = await res.json();
    const table = document.getElementById("referralTable");
    table.innerHTML = "";

    refs.forEach(r => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${r.uid}</td>
        <td>${r.email}</td>
        <td>${r.count}</td>
      `;
      table.appendChild(row);
    });
  } catch (err) {
    console.error("Error loading referrals:", err);
  }
}

// 🚀 Initialize
document.addEventListener("DOMContentLoaded", () => {
  updateCountdown();
  loadTopDonors();
  loadTopReferrals();
});
// 🏆 Load Top Scores
async function loadTopScores() {
  try {
    const res = await fetch("/top-scores");
    const scores = await res.json();
    const table = document.getElementById("scoreTable");
    table.innerHTML = "";

    scores.forEach(user => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${user.email}</td>
        <td>${user.score}</td>
      `;
      table.appendChild(row);
    });
  } catch (err) {
    console.error("Error loading scores:", err);
  }
}