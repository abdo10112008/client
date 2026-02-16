// ===== المتغيرات =====
const loginBtn = document.getElementById("loginBtn");
const passwordInput = document.getElementById("password");
const loginScreen = document.getElementById("loginScreen");
const appScreen = document.getElementById("app");
const addBtn = document.getElementById("addBtn");
const nameInput = document.getElementById("name");
const phoneInput = document.getElementById("phone");
const dateInput = document.getElementById("date");
const cardsContainer = document.getElementById("cards");
const searchInput = document.getElementById("searchInput");

let clients = [];

// ===== تسجيل الدخول =====
loginBtn.onclick = () => {
    if (passwordInput.value.trim() === "1234") {
        loginScreen.classList.add("hidden");
        appScreen.classList.remove("hidden");
    } else {
        alert("كلمة السر خاطئة!");
    }
};

// ===== دالة حساب الأيام الدقيقة =====
function daysFrom(dateStr) {
    if (!dateStr) return 0;
    const pastDate = new Date(dateStr);
    const today = new Date();
    
    // تصفير الوقت للمقارنة بين التواريخ فقط
    pastDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    
    const diffTime = today - pastDate;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 ? diffDays : 0; // لضمان عدم ظهور أيام بالسالب
}

// ===== تحديد كلاس الحالة (CSS) =====
function statusClass(days) {
    if (days >= 30) return "danger";
    if (days >= 15) return "warn";
    if (days >= 7) return "info";
    return "";
}

// ===== نظام التنبيهات التلقائي =====
function getAlerts(days, alertHandled = {}) {
    const alerts = [];
    if (days >= 7 && !alertHandled[7]) alerts.push({ msg: "⏰ مر 7 أيام! اكلم العميل", key: 7 });
    if (days >= 15 && !alertHandled[15]) alerts.push({ msg: "⚠️ مر 15 يوم! متابعة العميل", key: 15 });
    
    if (days >= 30) {
        let multiples = Math.floor((days - 30) / 15);
        for (let m = 0; m <= multiples; m++) {
            let alertDay = 30 + (m * 15);
            if (!alertHandled[alertDay]) {
                alerts.push({ msg: `🔥 مر ${alertDay} يوم! متابعة عاجلة`, key: alertDay });
            }
        }
    }
    return alerts;
}

// ===== تحميل البيانات لايف من Firestore =====
async function startRealtimeListener() {
    const { collection, onSnapshot } = await import("https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js");
    
    onSnapshot(collection(window.db, "clients"), (snapshot) => {
        clients = [];
        snapshot.forEach((doc) => {
            clients.push({ id: doc.id, ...doc.data() });
        });
        render();
    });
}

// ===== رسم الكروت وتحديث الواجهة =====
async function render() {
    const { doc, updateDoc, deleteDoc } = await import("https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js");
    
    cardsContainer.innerHTML = "";
    const searchValue = searchInput.value.toLowerCase();

    let filtered = clients.filter(c => 
        (c.name && c.name.toLowerCase().includes(searchValue)) || 
        (c.phone && c.phone.includes(searchValue))
    );

    // ترتيب من الأقدم للأحدث (حسب عدد الأيام)
    filtered.sort((a, b) => daysFrom(b.date) - daysFrom(a.date));

    filtered.forEach((c) => {
        const days = daysFrom(c.date);
        const card = document.createElement("div");
        card.className = `card ${statusClass(days)}`;
        
        card.innerHTML = `
            <h3>${c.name}</h3>
            <p>📞 ${c.phone}</p>
            <p>📅 تاريخ البداية: ${c.date}</p>
            <p>⏱ منذ <strong>${days}</strong> يوم</p>
            <div class="alerts"></div>
            <textarea placeholder="ملاحظات العميل...">${c.notes || ""}</textarea>
            <p>💰 الإجمالي: <span class="total">${c.totalPaid || 0}</span> ج.م</p>
            <input type="number" class="newAmount" placeholder="إضافة مبلغ">
            <button class="addAmountBtn">💵 حفظ المبلغ</button>
            <button class="doneBtn">✅ حذف (تم الدفع)</button>
        `;

        // التعامل مع التنبيهات
        const alertsDiv = card.querySelector(".alerts");
        const alertsList = getAlerts(days, c.alertHandled);
        
        alertsList.forEach(a => {
            const alertBox = document.createElement("div");
            alertBox.className = "alert-box";
            alertBox.innerHTML = `<span>${a.msg}</span><button class="alertDoneBtn">تم</button>`;
            
            alertBox.querySelector(".alertDoneBtn").onclick = async () => {
                const newHandled = { ...(c.alertHandled || {}), [a.key]: true };
                await updateDoc(doc(window.db, "clients", c.id), { alertHandled: newHandled });
            };
            alertsDiv.appendChild(alertBox);
        });

        // تحديث الملاحظات (Debounce بسيط)
        card.querySelector("textarea").onchange = async (e) => {
            await updateDoc(doc(window.db, "clients", c.id), { notes: e.target.value });
        };

        // إضافة مبلغ مالي
        card.querySelector(".addAmountBtn").onclick = async () => {
            const input = card.querySelector(".newAmount");
            const val = parseFloat(input.value);
            if (isNaN(val) || val <= 0) return alert("اكتب مبلغ صحيح");
            await updateDoc(doc(window.db, "clients", c.id), { 
                totalPaid: (c.totalPaid || 0) + val 
            });
            input.value = "";
        };

        // حذف العميل
        card.querySelector(".doneBtn").onclick = async () => {
            if (confirm("هل تم تحصيل كامل المبلغ وحذف العميل؟")) {
                await deleteDoc(doc(window.db, "clients", c.id));
            }
        };

        cardsContainer.appendChild(card);
    });

    updateStats();
}

// ===== إضافة عميل جديد =====
addBtn.onclick = async () => {
    const { collection, addDoc } = await import("https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js");
    
    const name = nameInput.value.trim();
    const phone = phoneInput.value.trim();
    const date = dateInput.value;

    if (!name || !phone || !date) return alert("برجاء ملء جميع البيانات");

    await addDoc(collection(window.db, "clients"), {
        name,
        phone,
        date,
        totalPaid: 0,
        notes: "",
        alertHandled: {}
    });

    // تفريغ الحقول
    nameInput.value = "";
    phoneInput.value = "";
    dateInput.value = "";
};

// ===== تحديث الإحصائيات =====
function updateStats() {
    let stats = { total: 0, c7: 0, c15: 0, c30: 0, c30p: 0, money: 0 };

    clients.forEach(c => {
        const d = daysFrom(c.date);
        stats.total++;
        stats.money += (c.totalPaid || 0);

        if (d < 7) stats.c7++;
        else if (d < 15) stats.c15++;
        else if (d <= 30) stats.c30++;
        else stats.c30p++;
    });

    document.getElementById("totalClients").innerText = stats.total;
    document.getElementById("clients7").innerText = stats.c7;
    document.getElementById("clients15").innerText = stats.c15;
    document.getElementById("clients30").innerText = stats.c30;
    document.getElementById("clients30plus").innerText = stats.c30p;
    document.getElementById("totalPaid").innerText = stats.money;
}

// ===== السيرش =====
searchInput.oninput = () => render();

// ===== التشغيل الفوري =====
startRealtimeListener();
