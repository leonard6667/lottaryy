require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { google } = require("googleapis");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const fs = require("fs");

const credentialsPath = path.join(__dirname, "fars-province-sh-1728386440651-cef703ad31f4.json");
const credentials = JSON.parse(fs.readFileSync(credentialsPath, "utf8"));

const auth = new google.auth.JWT(
  credentials.client_email,
  null,
  credentials.private_key,
  ["https://www.googleapis.com/auth/spreadsheets"]
);
const sheets = google.sheets({ version: "v4", auth });
const SHEET_ID = process.env.SHEET_ID;

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "../public")));

function calculateScore(amount) {
  if (amount >= 1 && amount < 5) return 1;
  if (amount >= 5 && amount <= 10) return 12;
  if (amount > 10 && amount <= 20) return 24;
  if (amount > 20 && amount <= 50) return 63;
  if (amount > 50 && amount <= 100) return 110;
  if (amount > 100) return 110 + Math.floor((amount - 100) * 1.5);
  return 0;
}

async function updateScore(email, points) {
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: "Scores!A2:C",
  });

  const rows = result.data.values || [];
  const index = rows.findIndex(row => row[0] === email);
  const newScore = index >= 0 ? parseInt(rows[index][1] || "0") + points : points;
  const timestamp = new Date().toISOString();

  if (index >= 0) {
    const rowNumber = index + 2;
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `Scores!B${rowNumber}:C${rowNumber}`,
      valueInputOption: "RAW",
      requestBody: { values: [[newScore, timestamp]] },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: "Scores!A2:C",
      valueInputOption: "RAW",
      requestBody: { values: [[email, newScore, timestamp]] },
    });
  }
}

// 🔐 ثبت‌نام با جلوگیری از ایمیل تکراری
app.post("/register", async (req, res) => {
  const { email } = req.body;
  const uid = uuidv4();
  const timestamp = new Date().toISOString();

  if (!email || typeof email !== "string") {
    return res.status(400).json({ error: "ایمیل نامعتبر است" });
  }

  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: "Participants!A2:F",
  });

  const rows = existing.data.values || [];
  const found = rows.find(row => row[1] === email);
  if (found) return res.status(409).json({ error: "ایمیل قبلاً ثبت شده" });

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: "Participants!A2:F",
    valueInputOption: "RAW",
    requestBody: { values: [[uid, email, "", "", "", timestamp]] },
  });

  res.json({ uid });
});

// 💸 ثبت تراکنش و رفرال
app.post("/donate", async (req, res) => {
  const { txid, email, refUID, amount } = req.body;
  const timestamp = new Date().toISOString();

  if (!txid || !email || !amount || isNaN(amount)) {
    return res.status(400).json({ error: "اطلاعات ناقص یا نامعتبر است" });
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: "Donations!A2:E",
    valueInputOption: "RAW",
    requestBody: { values: [[email, txid, amount, timestamp, "Pending"]] },
  });

  if (refUID) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: "Referrals!A2:D",
      valueInputOption: "RAW",
      requestBody: { values: [[refUID, email, timestamp, "Pending"]] },
    });
  }

  res.json({ message: "اطلاعات ثبت شد و منتظر تأیید است" });
});

// ✅ همگام‌سازی امتیازهای تأییدشده
app.get("/sync-scores", async (req, res) => {
  try {
    const donations = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "Donations!A2:E",
    });

    const referrals = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "Referrals!A2:D",
    });

    const donationRows = donations.data.values || [];
    const referralRows = referrals.data.values || [];

    for (const row of donationRows) {
      const [email, , amount, , status] = row;
      if (status === "Approved") {
        const score = calculateScore(parseFloat(amount));
        await updateScore(email, score);
      }
    }

    for (const row of referralRows) {
      const [refUID, , , status] = row;
      if (status === "Approved") {
        await updateScore(refUID, 15);
      }
    }

    res.json({ message: "امتیازها همگام‌سازی شدند" });
  } catch (err) {
    res.status(500).json({ error: "خطا در همگام‌سازی امتیازها" });
  }
});

// 📊 نمایش اهداکنندگان برتر
app.get("/top-donors", async (req, res) => {
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: "Donations!A2:E",
  });

  const rows = result.data.values || [];
  const summary = {};

  rows.forEach(([email, , amount, , status]) => {
    if (status === "Approved") {
      const amt = parseFloat(amount);
      const score = calculateScore(amt);
      summary[email] = (summary[email] || 0) + score;
    }
  });

  const top = Object.entries(summary)
    .map(([email, chances]) => ({
      uid: email,
      email,
      chances,
      total: chances,
    }))
    .sort((a, b) => b.total - a.total);

  res.json(top);
});

// 👥 نمایش رفرال‌های برتر
app.get("/top-referrals", async (req, res) => {
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: "Referrals!A2:D",
  });

  const rows = result.data.values || [];
  const summary = {};

  rows.forEach(([refUID, , , status]) => {
    if (status === "Approved") {
      summary[refUID] = (summary[refUID] || 0) + 1;
    }
  });

  const top = Object.entries(summary)
    .map(([uid, count]) => ({
      uid,
      email: uid,
      count,
    }))
    .sort((a, b) => b.count - a.count);

  res.json(top);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
// 🏆 نمایش امتیازهای برتر
app.get("/top-scores", async (req, res) => {
  try {
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "Scores!A2:C",
    });

    const rows = result.data.values || [];

    const top = rows
      .map(([email, score]) => ({
        email,
        score: parseInt(score || "0"),
      }))
      .sort((a, b) => b.score - a.score);

    res.json(top);
  } catch (err) {
    console.error("❌ خطا در بارگذاری امتیازها:", err.response?.data || err.message || err);
    res.status(500).json({ error: "خطا در بارگذاری امتیازها" });
  }
});
async function loadTopScores() {
  try {
    const res = await fetch("/top-scores");
    const scores = await res.json();

    const container = document.getElementById("scores-list");
    container.innerHTML = "";

    scores.forEach((user, index) => {
      const item = document.createElement("div");
      item.className = "score-item";
      item.innerHTML = `
        <strong>${index + 1}. ${user.email}</strong>
        <span>🏆 امتیاز: ${user.score}</span>
      `;
      container.appendChild(item);
    });
  } catch (err) {
    console.error("خطا در بارگذاری امتیازها:", err);
  }
}