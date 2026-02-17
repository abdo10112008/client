
const loginBtn = document.getElementById("loginBtn");
const passwordInput = document.getElementById("password");
const loginScreen = document.getElementById("loginScreen");
const app = document.getElementById("app");

const addBtn = document.getElementById("addBtn");
const nameInput = document.getElementById("name");
const phoneInput = document.getElementById("phone");
const dateInput = document.getElementById("date");
const cards = document.getElementById("cards");

const searchInput = document.getElementById("searchInput");

let clients = [];

// ===== تسجيل الدخول =====
loginBtn.onclick = () => {
  if (passwordInput.value.trim() === "1234") {
    loginScreen.classList.add("hidden");
    app.classList.remove("hidden");
  } else {
    alert("كلمة السر غلط");
  }
};

// ===== دوال مساعدة =====
function daysFrom(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  return Math.floor((now - d) / (1000 * 60 * 60 * 24));
}

function statusClass(days) {
  if (days >= 30) return "danger";
  if (days >= 15) return "warn";
  if (days >= 7) return "info";
  return "";
}

function sortClientsByDays(list) {
  return list.sort((a, b) => daysFrom(b.date) - daysFrom(a.date));
}

function getAlerts(days, alertHandled) {
  const alerts = [];

  if (days >= 7 && !alertHandled[7])
    alerts.push({ msg: "⏰ مر 7 أيام! اكلم العميل", key: 7 });

  if (days >= 15 && !alertHandled[15])
    alerts.push({ msg: "⚠️ مر 15 يوم! متابعة العميل", key: 15 });

  if (days >= 30) {
    let multiples = Math.floor((days - 30) / 15) + 1;
    for (let m = 0; m <= multiples; m++) {
      let alertDay = 30 + m * 15;
      if (!alertHandled[alertDay]) {
        alerts.push({
          msg: `🔥 مر ${alertDay} يوم! متابعة العميل`,
          key: alertDay
        });
      }
    }
  }

  return alerts;
}

// ===== تحميل البيانات لايف من Firestore =====
async function startRealtimeListener() {
  const { collection, onSnapshot } =
    await import("https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js");

  onSnapshot(collection(window.db, "clients"), (snapshot) => {
    clients = [];
    snapshot.forEach((doc) => {
      clients.push({ id: doc.id, ...doc.data() });
    });
    render();
  });
}

// ===== رسم الكروت =====
function render() {
  cards.innerHTML = "";

  const searchValue = searchInput.value.toLowerCase();

  let filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(searchValue) ||
    c.phone.includes(searchValue)
  );

  filteredClients = sortClientsByDays(filteredClients);

  filteredClients.forEach((c) => {
    const days = daysFrom(c.date);
    if (!c.alertHandled) c.alertHandled = {};

    const card = document.createElement("div");
    card.className = `card ${statusClass(days)}`;

   card.innerHTML = `
<h3>${c.name}</h3>
<p>📞 ${c.phone}</p>

<div class="contact-buttons">
<a class="whatsapp-btn" target="_blank"
href="https://wa.me/${c.phone.replace(/^0/, "20")}">
💬 واتساب
</a>

<a class="call-btn"
href="tel:${c.phone}">
📞 اتصال
</a>
</div>

<p>⏱ منذ ${days} يوم</p>
<div class="alerts"></div>

<textarea placeholder="ملاحظات">${c.notes || ""}</textarea>

<p>💰 إجمالي المدفوع: <span class="total">${c.totalPaid || 0}</span> جنيه</p>

<input type="number" class="newAmount" placeholder="المبلغ الجديد">
<button class="addAmountBtn">💵 إضافة المبلغ</button>
<button class="doneBtn">✅ تم الدفع بالكامل</button>
`;



    const alertsDiv = card.querySelector(".alerts");
    const alerts = getAlerts(days, c.alertHandled);

    alerts.forEach(a => {
      const alertBox = document.createElement("div");
      alertBox.className = "alert-box";
      alertBox.innerHTML = `
        <span>${a.msg}</span>
        <button class="alertDoneBtn">تم</button>
      `;

      alertBox.querySelector(".alertDoneBtn").onclick = async () => {
        const { doc, updateDoc } =
          await import("https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js");

        c.alertHandled[a.key] = true;

        await updateDoc(doc(window.db, "clients", c.id), {
          alertHandled: c.alertHandled
        });
      };

      alertsDiv.appendChild(alertBox);
    });

    card.querySelector("textarea").oninput = async (e) => {
      const { doc, updateDoc } =
        await import("https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js");

      await updateDoc(doc(window.db, "clients", c.id), {
        notes: e.target.value
      });
    };


// حفظ الملاحظة بزرار تم
 
 
const noteValue = card.querySelector("textarea").value;

 




    card.querySelector(".addAmountBtn").onclick = async () => {
      const { doc, updateDoc } =
        await import("https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js");

      const val = parseFloat(card.querySelector(".newAmount").value);
      if (isNaN(val) || val <= 0) return alert("اكتب مبلغ صحيح");

      await updateDoc(doc(window.db, "clients", c.id), {
        totalPaid: (c.totalPaid || 0) + val
      });
    };

    card.querySelector(".doneBtn").onclick = async () => {
      const { doc, deleteDoc } =
        await import("https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js");

      if (confirm("⚠️ هل أنت متأكد؟")) {
        await deleteDoc(doc(window.db, "clients", c.id));
      }
    };

    cards.appendChild(card);
  });

  updateStats();
}

// ===== إضافة عميل =====
addBtn.onclick = async () => {
  const { collection, addDoc } =
    await import("https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js");

  const name = nameInput.value.trim();
  const phone = phoneInput.value.trim();
  const date = dateInput.value;

  if (!name || !phone || !date) return alert("املأ كل الحقول");

  await addDoc(collection(window.db, "clients"), {
    name,
    phone,
    date,
    totalPaid: 0,
    notes: "",
    alertHandled: {}
  });

  nameInput.value = "";
  phoneInput.value = "";
  dateInput.value = "";
};

// ===== السيرش =====
searchInput.oninput = () => {
  render();
};

function updateStats() {
  const totalClients = clients.length;
  let clients7 = 0, clients15 = 0, clients30 = 0, clients30plus = 0, totalPaid = 0;

  clients.forEach(c => {
    const days = daysFrom(c.date);
    totalPaid += c.totalPaid || 0;

    if (days < 7) clients7++;
    else if (days < 15) clients15++;
    else if (days <= 30) clients30++;
    else clients30plus++;
  });

  document.getElementById("totalClients").innerText = totalClients;
  document.getElementById("clients7").innerText = clients7;
  document.getElementById("clients15").innerText = clients15;
  document.getElementById("clients30").innerText = clients30;
  document.getElementById("clients30plus").innerText = clients30plus;
  document.getElementById("totalPaid").innerText = totalPaid;
}

// ===== تشغيل =====
startRealtimeListener();
