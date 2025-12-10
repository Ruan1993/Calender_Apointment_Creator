import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
  signInWithCustomToken,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  linkWithCredential,
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithCredential,
  sendPasswordResetEmail,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  onSnapshot,
  collection,
  query,
  orderBy,
  where,
  serverTimestamp,
  deleteDoc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-analytics.js";
import { setLogLevel } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

window.initializeApp = initializeApp;
window.getAuth = getAuth;
window.signInAnonymously = signInAnonymously;
window.signInWithCustomToken = signInWithCustomToken;
window.signInWithEmailAndPassword = signInWithEmailAndPassword;
window.onAuthStateChanged = onAuthStateChanged;
window.setPersistence = setPersistence;
window.browserLocalPersistence = browserLocalPersistence;
window.linkWithCredential = linkWithCredential;
window.EmailAuthProvider = EmailAuthProvider;
window.createUserWithEmailAndPassword = createUserWithEmailAndPassword;
window.signOut = signOut;
window.GoogleAuthProvider = GoogleAuthProvider;
window.signInWithPopup = signInWithPopup;
window.signInWithRedirect = signInWithRedirect;
window.getRedirectResult = getRedirectResult;
window.signInWithCredential = signInWithCredential;
window.sendPasswordResetEmail = sendPasswordResetEmail;

window.getFirestore = getFirestore;
window.doc = doc;
window.setDoc = setDoc;
window.onSnapshot = onSnapshot;
window.collection = collection;
window.query = query;
window.orderBy = orderBy;
window.where = where;
window.serverTimestamp = serverTimestamp;
window.deleteDoc = deleteDoc;
window.updateDoc = updateDoc;
window.getAnalytics = getAnalytics;
window.setLogLevel = setLogLevel;

setLogLevel("debug");

const appId = "appointment-maker-pro";

const FIREBASE_CONFIG_OBJECT = {
  apiKey: "AIzaSyDEIMyAdZ-5IvsOdeZCZnWcpr5QpOhU5b4",
  authDomain: "appointment-maker-pro.firebaseapp.com",
  projectId: "appointment-maker-pro",
  storageBucket: "appointment-maker-pro.firebasestorage.app",
  messagingSenderId: "1083294283084",
  appId: "1:1083294283084:web:014f109dfd815092fbcbe9",
  measurementId: "G-DBF2HMR5FN",
};

const firebaseConfig = FIREBASE_CONFIG_OBJECT;
const initialAuthToken = null;

let db, auth;
let userId = "unknown";

window.state = {
  currentMonth: new Date(),
  selectedDate: new Date(),
  calendarMode: "month",
  appointments: [],
  services: [],
  contacts: [],
  currentView: "calendar",
  isAuthReady: false,
  editingAppointmentId: null,
  upcomingMode: "list",
  theme: (localStorage.getItem('amp-theme') || 'light'),
};

applyTheme();

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function isOnline() {
  return navigator.onLine;
}

function getPendingKey() {
  return `pendingAppointments:${userId || 'unknown'}`;
}

function readPendingAppointments() {
  try {
    const raw = localStorage.getItem(getPendingKey());
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writePendingAppointments(list) {
  try {
    localStorage.setItem(getPendingKey(), JSON.stringify(list || []));
  } catch {}
}

function queuePendingAppointment(op, data, id) {
  const list = readPendingAppointments();
  const item = { op, data, id: id || null, ts: Date.now() };
  list.push(item);
  writePendingAppointments(list);
}

async function syncPendingAppointments() {
  if (!isOnline()) return;
  const appointmentsRef = getAppointmentsRef();
  if (!appointmentsRef) return;
  let list = readPendingAppointments();
  if (!list.length) return;
  const remaining = [];
  for (const item of list) {
    try {
      if (item.op === 'update' && item.id) {
        await window.updateDoc(window.doc(appointmentsRef, item.id), item.data);
      } else {
        await window.setDoc(window.doc(appointmentsRef), item.data);
      }
    } catch (e) {
      remaining.push(item);
    }
  }
  writePendingAppointments(remaining);
  if (list.length !== remaining.length) displayMessage('Offline changes synced');
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function getStartOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

function displayMessage(message, type = "success", duration = 3000) {
  const box = document.getElementById("message-box");
  box.innerHTML = `<div class="rounded-lg p-3 text-sm text-white shadow-lg ${
    type === "error" ? "bg-red-500" : "bg-green-500"
  }">
                      ${message}
                  </div>`;
  box.classList.remove("hidden");
  setTimeout(() => box.classList.add("hidden"), duration);
}

function getDefaultCountryCode() {
  const fromState = (window.state && window.state.whatsappCountryCode) ? String(window.state.whatsappCountryCode) : null;
  const fromStorage = localStorage.getItem('amp-whatsapp-cc');
  const v = (fromStorage || fromState || '27').replace(/\D/g, '');
  return v || '27';
}

function normalizeWhatsAppNumber(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  const cc = getDefaultCountryCode();
  if (digits.startsWith("0")) return `${cc}${digits.slice(1)}`;
  return digits;
}

function applyTheme() {
  const t = window.state.theme || 'light';
  document.body.classList.toggle('dark', t === 'dark');
}

function toggleTheme() {
  const next = window.state.theme === 'dark' ? 'light' : 'dark';
  window.state.theme = next;
  localStorage.setItem('amp-theme', next);
  applyTheme();
}
window.toggleTheme = toggleTheme;

function getLanguage() {
  return localStorage.getItem('amp-lang') || (window.state && window.state.language) || 'en';
}

function getLocalizedWhatsAppText(appt, dateDisplay) {
  const name = appt.clientName || '';
  const time = appt.time || '';
  const lang = getLanguage();
  if (lang === 'af') return `Hallo ${name}, jou afspraak is op ${dateDisplay} om ${time}. Sien jou gou!`;
  if (lang === 'zu') return `Sawubona ${name}, umhlangano wakho use ${dateDisplay} nge ${time}. Sizobonana maduze!`;
  return `Hi ${name}, your appointment is on ${dateDisplay} at ${time}. See you soon!`;
}

function toggleSettingsMenu() {
  const menu = document.getElementById('settings-menu');
  if (!menu) return;
  const ccInput = document.getElementById('whatsapp-cc-input');
  const langSel = document.getElementById('language-select');
  if (ccInput) ccInput.value = getDefaultCountryCode();
  const lang = getLanguage();
  if (langSel) langSel.value = lang;
  const willOpen = menu.classList.contains('hidden');
  menu.classList.toggle('hidden');
  const bg = document.getElementById('settings-menu-bg');
  const panel = document.getElementById('settings-menu-panel');
  if (!menu.classList.contains('hidden')) {
    if (bg) bg.onclick = () => { try { toggleSettingsMenu(); } catch {} };
    if (window.__settingsHandler) {
      try { document.removeEventListener('click', window.__settingsHandler); } catch {}
      window.__settingsHandler = null;
    }
    const handler = (e) => {
      if (!panel || !panel.contains(e.target)) {
        if (!menu.classList.contains('hidden')) menu.classList.add('hidden');
        if (bg) bg.onclick = null;
        window.__settingsHandler = null;
      }
    };
    window.__settingsHandler = handler;
    setTimeout(() => document.addEventListener('click', handler, { once: true, capture: true }), 0);
  } else {
    if (bg) bg.onclick = null;
    if (window.__settingsHandler) {
      try { document.removeEventListener('click', window.__settingsHandler); } catch {}
      window.__settingsHandler = null;
    }
  }
}
window.toggleSettingsMenu = toggleSettingsMenu;

function saveSettingsMenu() {
  const ccInput = document.getElementById('whatsapp-cc-input');
  const langSel = document.getElementById('language-select');
  if (ccInput) {
    const v = String(ccInput.value || '').replace(/\D/g, '');
    if (v) {
      localStorage.setItem('amp-whatsapp-cc', v);
      window.state.whatsappCountryCode = v;
    }
  }
  if (langSel) {
    const v = String(langSel.value || 'en');
    localStorage.setItem('amp-lang', v);
    window.state.language = v;
  }
  const menu = document.getElementById('settings-menu');
  if (menu) menu.classList.add('hidden');
  displayMessage('Settings saved');
}
window.saveSettingsMenu = saveSettingsMenu;

async function logout() {
  const menu = document.getElementById('settings-menu');
  if (menu) menu.classList.add('hidden');
  const confirm = await showConfirmModal('Sign Out', 'Are you sure you want to sign out?', { okText: 'Yes' });
  if (!confirm) return;
  try {
    const a = auth || (window.getAuth ? window.getAuth() : null);
    if (a) await window.signOut(a);
  } finally {
    displayMessage('Signed out');
  }
}
window.logout = logout;

function rateApp() {
  const pkg = 'com.rc.appointmentmaker';
  const web = `https://play.google.com/store/apps/details?id=${pkg}`;
  const url = `market://details?id=${pkg}`;
  try {
    window.open(url, '_blank');
  } catch {
    window.open(web, '_blank');
  }
}
window.rateApp = rateApp;

function shareApp() {
  const url = 'https://play.google.com/store/apps/details?id=com.rc.appointmentmaker';
  const title = 'Appointment Maker Pro';
  const text = 'Check out Appointment Maker Pro';
  if (navigator.share) {
    navigator.share({ title, text, url }).catch(() => {});
  } else {
    try {
      navigator.clipboard.writeText(url).then(() => displayMessage('Link copied'));
    } catch {
      window.open(url, '_blank');
    }
  }
}
window.shareApp = shareApp;

function openPrivacyPolicy() {
  try { location.href = 'privacy.html'; } catch (_) { window.open('privacy.html', '_blank'); }
}
window.openPrivacyPolicy = openPrivacyPolicy;

function openTermsOfService() {
  try { location.href = 'terms.html'; } catch (_) { window.open('terms.html', '_blank'); }
}
window.openTermsOfService = openTermsOfService;


function parseDurationToMinutes(input) {
  const s = String(input || "").trim().toLowerCase();
  if (!s) return NaN;
  let total = 0;
  const hm = s.match(/^(\d+)\s*:\s*(\d{1,2})$/);
  if (hm) {
    total += parseInt(hm[1], 10) * 60 + parseInt(hm[2], 10);
    return total;
  }
  const hrs = s.match(/(\d+(?:\.\d+)?)\s*h/);
  const mins = s.match(/(\d+(?:\.\d+)?)\s*m(?:in(?:utes)?)?/);
  if (hrs) total += Math.round(parseFloat(hrs[1]) * 60);
  if (mins) total += Math.round(parseFloat(mins[1]));
  if (!hrs && !mins) {
    const num = parseFloat(s);
    if (!isNaN(num)) total += Math.round(num);
  }
  return total;
}

const SERVICE_COLORS = {
  indigo: {
    bg: "bg-indigo-50",
    border: "border-indigo-100",
    text: "text-indigo-600",
    badgeBg: "bg-indigo-100",
    badgeText: "text-indigo-700",
    dot: "bg-indigo-500",
  },
  rose: {
    bg: "bg-rose-50",
    border: "border-rose-100",
    text: "text-rose-600",
    badgeBg: "bg-rose-100",
    badgeText: "text-rose-700",
    dot: "bg-rose-500",
  },
  emerald: {
    bg: "bg-emerald-50",
    border: "border-emerald-100",
    text: "text-emerald-600",
    badgeBg: "bg-emerald-100",
    badgeText: "text-emerald-700",
    dot: "bg-emerald-500",
  },
  amber: {
    bg: "bg-amber-50",
    border: "border-amber-100",
    text: "text-amber-600",
    badgeBg: "bg-amber-100",
    badgeText: "text-amber-700",
    dot: "bg-amber-500",
  },
  sky: {
    bg: "bg-sky-50",
    border: "border-sky-100",
    text: "text-sky-600",
    badgeBg: "bg-sky-100",
    badgeText: "text-sky-700",
    dot: "bg-sky-500",
  },
  violet: {
    bg: "bg-violet-50",
    border: "border-violet-100",
    text: "text-violet-600",
    badgeBg: "bg-violet-100",
    badgeText: "text-violet-700",
    dot: "bg-violet-500",
  },
  cyan: {
    bg: "bg-cyan-50",
    border: "border-cyan-100",
    text: "text-cyan-600",
    badgeBg: "bg-cyan-100",
    badgeText: "text-cyan-700",
    dot: "bg-cyan-500",
  },
  pink: {
    bg: "bg-pink-50",
    border: "border-pink-100",
    text: "text-pink-600",
    badgeBg: "bg-pink-100",
    badgeText: "text-pink-700",
    dot: "bg-pink-500",
  },
  red: {
    bg: "bg-red-50",
    border: "border-red-100",
    text: "text-red-600",
    badgeBg: "bg-red-100",
    badgeText: "text-red-700",
    dot: "bg-red-500",
  },
  orange: {
    bg: "bg-orange-50",
    border: "border-orange-100",
    text: "text-orange-600",
    badgeBg: "bg-orange-100",
    badgeText: "text-orange-700",
    dot: "bg-orange-500",
  },
  lime: {
    bg: "bg-lime-50",
    border: "border-lime-100",
    text: "text-lime-600",
    badgeBg: "bg-lime-100",
    badgeText: "text-lime-700",
    dot: "bg-lime-500",
  },
  teal: {
    bg: "bg-teal-50",
    border: "border-teal-100",
    text: "text-teal-600",
    badgeBg: "bg-teal-100",
    badgeText: "text-teal-700",
    dot: "bg-teal-500",
  },
  blue: {
    bg: "bg-blue-50",
    border: "border-blue-100",
    text: "text-blue-600",
    badgeBg: "bg-blue-100",
    badgeText: "text-blue-700",
    dot: "bg-blue-500",
  },
  purple: {
    bg: "bg-purple-50",
    border: "border-purple-100",
    text: "text-purple-600",
    badgeBg: "bg-purple-100",
    badgeText: "text-purple-700",
    dot: "bg-purple-500",
  },
};

const APPOINTMENT_PASTELS = [
  { bg: "bg-emerald-50", border: "border-emerald-100", text: "text-emerald-800" },
  { bg: "bg-amber-50", border: "border-amber-100", text: "text-amber-800" },
  { bg: "bg-sky-50", border: "border-sky-100", text: "text-sky-800" },
  { bg: "bg-violet-50", border: "border-violet-100", text: "text-violet-800" },
  { bg: "bg-rose-50", border: "border-rose-100", text: "text-rose-800" },
  { bg: "bg-indigo-50", border: "border-indigo-100", text: "text-indigo-800" },
];

const SERVICE_ACCENT_HEX = {
  indigo: "#6366f1",
  rose: "#f43f5e",
  emerald: "#10b981",
  amber: "#f59e0b",
  sky: "#0ea5e9",
  violet: "#7c3aed",
  cyan: "#06b6d4",
  pink: "#ec4899",
  red: "#ef4444",
  orange: "#f97316",
  lime: "#84cc16",
  teal: "#14b8a6",
  blue: "#3b82f6",
  purple: "#8b5cf6",
};

function formatHM(totalMinutes) {
  const m = Math.max(0, Number(totalMinutes) || 0);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h > 0 && mm > 0) return `${h}h ${mm}m`;
  if (h > 0) return `${h}h`;
  return `${mm}m`;
}

function timeToMinutes(t) {
  const [H, M] = String(t || "00:00")
    .split(":")
    .map((x) => parseInt(x, 10));
  return (isNaN(H) ? 0 : H) * 60 + (isNaN(M) ? 0 : M);
}

function minutesToTime(mins) {
  const m = Math.max(0, Math.round(mins));
  const H = String(Math.floor(m / 60)).padStart(2, "0");
  const M = String(m % 60).padStart(2, "0");
  return `${H}:${M}`;
}

function renderHourlySchedule(dayKey, title) {
  const appts = window.state.appointments.filter((a) => a.date === dayKey);
  const rows = [];
  const startHour = 6;
  const endHour = 21;
  const hourHeight = 80;
  const apptsSorted = appts.slice().sort((a, b) => {
    const aMs = new Date(`${a.date}T${a.time || '00:00'}`).getTime();
    const bMs = new Date(`${b.date}T${b.time || '00:00'}`).getTime();
    return aMs - bMs;
  });
  const colorIndexById = new Map(apptsSorted.map((a, i) => [a.id, i]));
  const isDark = document.body.classList.contains('dark');
  for (let h = startHour; h <= endHour; h++) {
    const inHour = appts.filter((a) => {
      const s = timeToMinutes(a.time || "00:00");
      const hStart = h * 60;
      const hEnd = (h + 1) * 60;
      return s >= hStart && s < hEnd;
    });
    const items = inHour
      .map((a) => {
        const startMins = timeToMinutes(a.time || "00:00");
        const minutesIntoHour = startMins % 60;
        const duration = Number(a.duration) || 30;
        const topPct = (minutesIntoHour / 60) * 100;
        let heightPx = (duration / 60) * hourHeight;
        if (heightPx < 25) heightPx = 25;
        const endMs = new Date(`${dayKey}T${a.time}`).getTime() + duration * 60000;
        const isCompleted = Date.now() >= endMs;
        const idx = colorIndexById.has(a.id) ? colorIndexById.get(a.id) : 0;
        const p = APPOINTMENT_PASTELS[idx % APPOINTMENT_PASTELS.length];
        let badgeClass = `${p.bg} ${p.border} ${isDark ? 'text-slate-900' : p.text}`;
        if (isCompleted) badgeClass = "bg-gray-100 border-gray-200 text-gray-500 opacity-75";
        let accentHex = SERVICE_ACCENT_HEX.indigo;
        if (Array.isArray(a.serviceDetails) && a.serviceDetails.length) {
          const key = a.serviceDetails[0].color || "indigo";
          accentHex = SERVICE_ACCENT_HEX[key] || accentHex;
        }
        if (isCompleted) accentHex = "#d1d5db";
        const endStr = minutesToTime(startMins + duration);
        return `
          <div onclick="editAppointment('${a.id}'); event.stopPropagation();"
               class="appointment-card absolute w-[95%] left-[2%] border-l-4 rounded shadow-sm px-2 py-1 text-xs cursor-pointer hover:brightness-95 transition z-10 overflow-hidden ${badgeClass}"
               style="top: ${topPct}%; height: ${heightPx}px; min-height: 24px; border-left-color: ${accentHex};">
            <div class="flex justify-between items-start">
              <span class="font-bold truncate mr-1">${a.clientName}</span>
              <span class="font-mono opacity-80">${a.time} - ${endStr}</span>
            </div>
            <div class="truncate opacity-75 text-[10px]">${a.service || "No Service"}</div>
          </div>
        `;
      })
      .join("");
    rows.push(
      `<div class="grid grid-cols-[50px_1fr] border-b border-gray-100 relative" style="height: ${hourHeight}px;">
          <div class="text-xs text-gray-400 font-medium text-right pr-2 pt-1 -mt-2.5 bg-white z-20 relative">
            ${String(h).padStart(2, "0")}:00
          </div>
          <div onclick="handleHourClick(${h}, event)" class="relative border-l border-gray-100 hover:bg-gray-50 active:bg-indigo-50 transition-colors cursor-crosshair">
             <div class="absolute top-1/2 w-full border-t border-dotted border-gray-200 pointer-events-none"></div>
             ${items}
          </div>
       </div>`
    );
  }
  return `
    <div class="bg-white rounded-xl shadow border border-gray-100 mb-20 overflow-hidden select-none">
      <h3 class="p-3 text-lg font-bold text-gray-800 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
        <span>${title}</span>
        <span class="text-xs font-normal text-gray-500">Tap empty slot to add</span>
      </h3>
      <div class="relative">
        ${rows.join("")}
        ${renderCurrentTimeIndicator(dayKey, startHour, hourHeight)}
      </div>
    </div>
  `;
}

function renderCurrentTimeIndicator(dayKey, startHour, hourHeight) {
  const now = new Date();
  const todayKey = formatDate(now);
  if (dayKey !== todayKey) return "";
  const currentH = now.getHours();
  if (currentH < startHour || currentH > 21) return "";
  const currentM = now.getMinutes();
  const topPx = (currentH - startHour) * hourHeight + (currentM / 60) * hourHeight;
  return `
    <div class="absolute w-full border-t-2 border-red-500 z-50 pointer-events-none flex items-center" style="top: ${topPx}px; left: 50px; width: calc(100% - 50px);">
      <div class="w-2 h-2 bg-red-500 rounded-full -ml-1"></div>
    </div>
  `;
}

function handleHourClick(hour, event) {
  const rect = event.currentTarget.getBoundingClientRect();
  const y = event.clientY - rect.top;
  const height = rect.height;
  const rawMinutes = (y / height) * 60;
  const roundedMinutes = Math.round(rawMinutes / 5) * 5;
  let finalHour = hour;
  let finalMinutes = roundedMinutes;
  if (finalMinutes === 60) {
    finalHour += 1;
    finalMinutes = 0;
  }
  const timeString = `${String(finalHour).padStart(2, "0")}:${String(finalMinutes).padStart(2, "0")}`;
  window.state.suggestedTime = timeString;
  changeView("add");
}
window.handleHourClick = handleHourClick;

function editAppointment(id) {
  window.state.editingAppointmentId = id;
  changeView("add");
}
window.editAppointment = editAppointment;

function cancelEditAppointment() {
  if (window.state) window.state.editingAppointmentId = null;
  const form = document.getElementById("appointment-form");
  if (form) delete form.dataset.editingId;
  const titleEl = document.getElementById("appointment-form-title");
  const submitEl = document.getElementById("appointment-submit-btn");
  const cancelEl = document.getElementById("appointment-cancel-edit");
  if (titleEl) titleEl.textContent = "Book New Appointment";
  if (submitEl)
    submitEl.innerHTML =
      '<i class="fas fa-calendar-plus mr-2"></i> Save Appointment';
  if (cancelEl) cancelEl.classList.add("hidden");
}
window.cancelEditAppointment = cancelEditAppointment;

function showConfirmModal(title, message, options = {}) {
  return new Promise((resolve) => {
    const modal = document.getElementById("confirm-modal");
    const titleEl = document.getElementById("confirm-modal-title");
    const messageEl = document.getElementById("confirm-modal-message");
    const okBtn = document.getElementById("confirm-modal-ok");
    const cancelBtn = document.getElementById("confirm-modal-cancel");

    titleEl.textContent = title;
    messageEl.textContent = message;
    if (options && options.okText) okBtn.textContent = String(options.okText);
    if (options && options.cancelText) cancelBtn.textContent = String(options.cancelText);

    const bg = document.getElementById("confirm-modal-bg");
    const panel = document.getElementById("confirm-modal-panel");

    function hideModal(result) {
      bg.classList.remove("modal-bg-enter-active");
      bg.classList.add("modal-bg-enter");
      panel.classList.remove("modal-enter-active");
      panel.classList.add("modal-enter");

      setTimeout(() => {
        modal.classList.add("hidden");
        okBtn.removeEventListener("click", onOk);
        cancelBtn.removeEventListener("click", onCancel);
        resolve(result);
      }, 300);
    }

    function onOk() {
      hideModal(true);
    }
    function onCancel() {
      hideModal(false);
    }

    okBtn.onclick = onOk;
    cancelBtn.onclick = onCancel;

    modal.classList.remove("hidden");
    setTimeout(() => {
      bg.classList.add("modal-bg-enter-active");
      bg.classList.remove("modal-bg-enter");
      panel.classList.add("modal-enter-active");
      panel.classList.remove("modal-enter");
    }, 10);
  });
}
window.showConfirmModal = showConfirmModal;

async function pickContact() {
  try {
    const cap = window.Capacitor;
    const plugin = cap && cap.Plugins ? (cap.Plugins.Contacts || cap.Plugins.ContactsPlugin) : (window.Contacts || null);
    if (plugin) {
      let granted = true;
      if (typeof plugin.checkPermissions === "function") {
        try {
          const status = await plugin.checkPermissions();
          granted = !!(status && (status.granted === true || status.contacts === "granted"));
          if (!granted && typeof plugin.requestPermissions === "function") {
            const req = await plugin.requestPermissions();
            granted = !!(req && (req.granted === true || req.contacts === "granted"));
          }
        } catch (_) { granted = false; }
      }
      if (!granted) {
        displayMessage("Contacts permission denied.", "error", 3000);
        openContactsModal();
        return;
      }
      let selected = null;
      if (typeof plugin.pickContact === "function") {
        const res = await plugin.pickContact({ projection: { name: true, phones: true, emails: true } });
        if (res && res.contact) selected = res.contact;
      } else if (typeof plugin.getContacts === "function") {
        const res = await plugin.getContacts({ projection: { name: true, phones: true, emails: true } });
        if (res && Array.isArray(res.contacts) && res.contacts.length) selected = res.contacts[0];
      }
      if (selected) {
        const name = (selected.name && (selected.name.display || [selected.name.given, selected.name.family].filter(Boolean).join(" "))) || "";
        const tel = (Array.isArray(selected.phones) && selected.phones.length ? (selected.phones[0].number || "") : "");
        const form = document.getElementById("appointment-form");
        if (form) {
          if (name) form.clientName.value = name;
          if (tel) form.phone.value = tel;
          displayMessage("Contact details added.");
        }
      } else {
        displayMessage("No contact selected.");
      }
    } else if (navigator.contacts && navigator.contacts.select) {
      const contacts = await navigator.contacts.select(["name", "tel"], { multiple: false });
      if (contacts && contacts.length) {
        const c = contacts[0];
        const name = Array.isArray(c.name) ? c.name[0] : c.name;
        let tel = "";
        if (c.tel && c.tel.length) {
          const t = c.tel[0];
          tel = typeof t === "string" ? t : t.value || t;
        }
        const form = document.getElementById("appointment-form");
        if (form) {
          if (name) form.clientName.value = name;
          if (tel) form.phone.value = tel;
          displayMessage("Contact details added.");
        }
      } else {
        openContactsModal();
      }
    } else {
      openContactsModal();
    }
  } catch (e) {
    displayMessage("Unable to access contacts: " + e.message, "error", 4000);
  }
}
window.pickContact = pickContact;

function showLoading(show) {
  document.getElementById("loading").classList.toggle("hidden", !show);
  document.getElementById("calendar-view").classList.toggle("hidden", show);
  document.getElementById("add-appointment-view").classList.toggle("hidden", show);
  document.getElementById("service-management-view").classList.toggle("hidden", show);
}

window.authMode = "login";
window.toggleAuthMode = function () {
  const title = document.getElementById("auth-title");
  const button = document.getElementById("auth-button");
  const toggleText = document.getElementById("auth-toggle-text");
  const overlay = document.getElementById("login-overlay");
  const errorMsg = document.getElementById("login-error");
  if (errorMsg) errorMsg.classList.add("hidden");
  const toggleButton = overlay ? overlay.querySelector(".text-indigo-600") : null;
  if (window.authMode === "login") {
    window.authMode = "register";
    if (title) title.textContent = "Create New Account";
    if (button) button.textContent = "Register";
    if (toggleText) toggleText.textContent = "Already have an account?";
    if (toggleButton) toggleButton.textContent = "Sign In";
  } else {
    window.authMode = "login";
    if (title) title.textContent = "Sign In";
    if (button) button.textContent = "Log In";
    if (toggleText) toggleText.textContent = "New user?";
    if (toggleButton) toggleButton.textContent = "Register";
  }
};

window.handleAuth = async function () {
  const emailEl = document.getElementById("auth-email");
  const passwordEl = document.getElementById("auth-password");
  const errorMsg = document.getElementById("login-error");
  const email = emailEl ? emailEl.value : "";
  const password = passwordEl ? passwordEl.value : "";
  const emailTrim = String(email || '').trim();
  const passwordTrim = String(password || '');
  if (errorMsg) errorMsg.classList.add("hidden");
  if (!emailTrim || !passwordTrim) {
    if (errorMsg) {
      errorMsg.textContent = "Please enter both email and password.";
      errorMsg.classList.remove("hidden");
    }
    return;
  }
  const a = auth || (window.getAuth ? window.getAuth() : null);
  if (!a) {
    if (errorMsg) {
      errorMsg.textContent = "App not connected to Firebase. Check config.";
      errorMsg.classList.remove("hidden");
    }
    return;
  }
  try {
    const overlay = document.getElementById("login-overlay");
    if (window.authMode === "login") {
      await window.signInWithEmailAndPassword(a, emailTrim, passwordTrim);
      if (overlay) overlay.classList.add("hidden");
      displayMessage('Signed in', 'success');
    } else {
      await window.createUserWithEmailAndPassword(a, emailTrim, passwordTrim);
      if (overlay) overlay.classList.add("hidden");
      displayMessage('Account created and signed in', 'success');
    }
  } catch (error) {
    console.error("Authentication failed:", error);
    let msg = "An unknown error occurred.";
    if (error && error.code === "auth/email-already-in-use") msg = "This email is already registered. Try signing in.";
    else if (error && error.code === "auth/weak-password") msg = "Password should be at least 6 characters.";
    else if (error && (error.code === "auth/invalid-credential" || error.code === "auth/user-not-found")) msg = "Invalid email or password.";
    if (errorMsg) {
      errorMsg.textContent = msg;
      errorMsg.classList.remove("hidden");
    }
  }
};

async function handleGoogleRedirectResult() {
  try {
    const a = auth || (window.getAuth ? window.getAuth() : null);
    if (!a) return;
    const res = await window.getRedirectResult(a);
    if (res && res.user) {
      displayMessage('Signed in with Google');
      const overlay = document.getElementById('login-overlay');
      if (overlay) overlay.classList.add('hidden');
    }
  } catch (e) {
    console.warn('Google redirect failed:', e);
  }
}

window.googleLogin = async function () {
  const a = auth || (window.getAuth ? window.getAuth() : null);
  if (!a) return;
  try {
    const cap = window.Capacitor;
    const isNative = !!(cap && typeof cap.getPlatform === 'function' && cap.getPlatform() !== 'web');
    try { console.log('Capacitor platform:', cap && cap.getPlatform && cap.getPlatform()); } catch {}
    try { console.log('Capacitor plugins:', cap && cap.Plugins ? Object.keys(cap.Plugins) : null); } catch {}
    if (isNative) {
      const gl = cap && cap.Plugins ? (cap.Plugins.CapacitorGoogleLogin || cap.Plugins.GoogleLogin || cap.Plugins.GoogleLoginPlugin) : null;
      if (gl && typeof gl.initialize === 'function' && typeof gl.login === 'function') {
        const webClientId = '1083294283084-n5775c6fmvq1i0rbkk2knjcgvvqj4a1o.apps.googleusercontent.com';
        await gl.initialize({ android: { clientId: webClientId } });
        try { if (typeof gl.logout === 'function') await gl.logout(); } catch {}
        const response = await gl.login();
        const idToken = response && (response.idToken || (response.authentication && response.authentication.idToken));
        if (!idToken) {
          displayMessage('Login failed: Missing Google ID token', 'error', 6000);
          return;
        }
        const credential = window.GoogleAuthProvider.credential(idToken);
        await window.signInWithCredential(a, credential);
        const overlay = document.getElementById('login-overlay');
        if (overlay) overlay.classList.add('hidden');
        displayMessage('Signed in with Google (Native)');
        return;
      }
      displayMessage('Google sign-in not available on device', 'error', 6000);
      return;
    }
    const provider = new window.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    await window.signInWithPopup(a, provider);
  } catch (e) {
    console.error('Google Login Error:', e);
    displayMessage('Login failed: ' + (e.message || JSON.stringify(e)), 'error', 6000);
  }
};

window.togglePasswordVisibility = function () {
  const input = document.getElementById("auth-password");
  const icon = document.getElementById("password-visibility-icon");
  if (!input) return;
  const isHidden = input.type === "password";
  input.type = isHidden ? "text" : "password";
  if (icon) {
    icon.classList.toggle("fa-eye", !isHidden);
    icon.classList.toggle("fa-eye-slash", isHidden);
  }
};

window.resetPassword = async function () {
  const emailEl = document.getElementById("auth-email");
  const email = emailEl ? String(emailEl.value || "").trim() : "";
  const errorMsg = document.getElementById("login-error");
  if (errorMsg) errorMsg.classList.add("hidden");
  if (!email) {
    if (errorMsg) {
      errorMsg.textContent = "Please enter your email address first.";
      errorMsg.classList.remove("hidden");
    }
    return;
  }
  const a = auth || (window.getAuth ? window.getAuth() : null);
  try {
    await window.sendPasswordResetEmail(a, email);
    displayMessage(`Password reset email sent to ${email}`);
  } catch (error) {
    console.error(error);
    if (errorMsg) {
      errorMsg.textContent = "Error sending reset email: " + (error.message || String(error));
      errorMsg.classList.remove("hidden");
    }
  }
};

async function initApp() {
  if (!firebaseConfig) {
    console.error("Firebase config is missing.");
    showLoading(false);
    displayMessage(
      "Error: Firebase configuration missing (Guaranteed fix failure).",
      "error",
      5000
    );
    return;
  }

  try {
    const app = window.initializeApp(firebaseConfig);
    const { getAuth } = window;
    const { getFirestore } = window;
    const { setPersistence, browserLocalPersistence, signInAnonymously, onAuthStateChanged } = window;

    db = getFirestore(app);
    auth = getAuth(app);
    try {
      window.analytics = window.getAnalytics(app);
    } catch (e) {
      console.warn("Analytics initialization skipped:", e);
    }

    await setPersistence(auth, browserLocalPersistence).catch((e) => {
      console.warn("Persistence failed, continuing without it:", e);
    });

    onAuthStateChanged(auth, (user) => {
      const overlay = document.getElementById("login-overlay");
      if (user) {
        userId = user.uid;
        window.state.isAuthReady = true;
        document.getElementById("user-id-display").textContent = `User ID: ${userId}`;
        console.log("User logged in:", userId);
        if (overlay) overlay.classList.add("hidden");
        if (!window.appInitialized) {
          window.appInitialized = true;
          listenForAppointments();
          listenForServices();
          listenForContacts();
          render();
          syncPendingAppointments();
        }
      } else {
        console.log("User signed out, showing login screen.");
        window.state.isAuthReady = false;
        userId = "unknown";
        if (window.__unsubs && window.__unsubs.length) {
          try { window.__unsubs.forEach((u) => { try { u(); } catch (_) {} }); } finally { window.__unsubs = []; }
        }
        window.appInitialized = false;
        window.state.appointments = [];
        window.state.services = [];
        window.state.contacts = [];
        if (overlay) overlay.classList.remove("hidden");
        const box = document.getElementById("message-box");
        if (box) box.classList.add("hidden");
        const appContent = document.getElementById("app-content");
        if (appContent) appContent.innerHTML = appContent.innerHTML; // noop to maintain structure
      }
      showLoading(false);
    });

    handleGoogleRedirectResult();
  } catch (error) {
    console.error("Firebase initialization or sign-in failed:", error);
    const code = error && error.code ? String(error.code) : "unknown";
    let hint = "";
    if (code.includes("invalid-api-key") || code.includes("api-key-not-valid")) {
      hint =
        "Check Firebase Web App config: use the Web API key from Project Settings -> General, and ensure your deployed domain is listed under Authentication -> Settings -> Authorized domains.";
    } else if (code.includes("operation-not-allowed")) {
      hint = "Enable Anonymous sign-in in Firebase Authentication -> Sign-in method.";
    }
    displayMessage(`Auth Error: ${error.message}${hint ? "\n" + hint : ""}`, "error", 12000);
    showLoading(false);
  }
}

window.addEventListener('online', () => {
  syncPendingAppointments();
});

function getAppointmentsRef() {
  if (!db || !userId) {
    console.error("Database or User ID not ready for appointments.");
    return null;
  }
  return window.collection(db, `artifacts/${appId}/users/${userId}/appointments`);
}

async function blobToBase64(blob) {
  return new Promise((resolve) => {
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        const res = String(reader.result || '');
        const b64 = res.includes(',') ? res.split(',')[1] : res;
        resolve(b64);
      };
      reader.readAsDataURL(blob);
    } catch {
      resolve('');
    }
  });
}

window.exportAppointments = async function (startDate, endDate) {
  const btn = document.getElementById('export-pdf-btn');
  try {
    if (btn) { btn.disabled = true; btn.classList.add('opacity-50'); btn.querySelector('span').textContent = 'Generating...'; }
    if (!window.jspdf) throw new Error('PDF library loading...');
    const cap = window.Capacitor;
    const isNative = cap && typeof cap.isNativePlatform === 'function' ? cap.isNativePlatform() : !!(cap && cap.Plugins);
    const Filesystem = cap && cap.Plugins ? cap.Plugins.Filesystem : null;
    const Share = cap && cap.Plugins ? cap.Plugins.Share : null;
    const Directory = { Cache: 'CACHE' };
    const nameEl = document.getElementById('export-name');
    const startEl = document.getElementById('export-start');
    const endEl = document.getElementById('export-end');
    const customName = nameEl && nameEl.value ? nameEl.value : '';
    const startStr = startDate instanceof Date ? startDate.toISOString().split('T')[0] : (startEl ? startEl.value : '');
    const endStr = endDate instanceof Date ? endDate.toISOString().split('T')[0] : (endEl ? endEl.value : '');
    const allAppts = Array.isArray(window.state.appointments) ? window.state.appointments : [];
    const filtered = allAppts.filter((a) => {
      if (startStr && String(a.date) < startStr) return false;
      if (endStr && String(a.date) > endStr) return false;
      return true;
    });
    if (!filtered.length) { alert('No appointments found in this date range.'); return; }
    const sorted = filtered.sort((a, b) => {
      const d1 = new Date(`${a.date}T${a.time || '00:00'}`);
      const d2 = new Date(`${b.date}T${b.time || '00:00'}`);
      return d1 - d2;
    });
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.setTextColor(79, 70, 229);
    const title = customName ? `Schedule for ${customName}` : 'Appointment Schedule';
    doc.text(title, 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(100);
    let rangeText = 'All upcoming & past appointments';
    if (startStr || endStr) rangeText = `Range: ${startStr || 'Start'} to ${endStr || 'End'}`;
    doc.text(rangeText, 14, 28);
    function formatTimeRange(start, durationStr) {
      if (!start) return '';
      const duration = Number(durationStr) || 0;
      const [h, m] = String(start).split(':').map(Number);
      const totalMins = (h || 0) * 60 + (m || 0) + duration;
      const endH = Math.floor(totalMins / 60) % 24;
      const endM = totalMins % 60;
      return `${start} - ${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
    }
    const tableRows = sorted.map((appt) => {
      const d = new Date(appt.date);
      const dateDisplay = isNaN(d) ? String(appt.date || '') : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      const serviceList = Array.isArray(appt.serviceDetails) ? appt.serviceDetails.map((s) => s && s.name).filter(Boolean).join(', ') : '';
      const timeDisplay = formatTimeRange(appt.time, appt.duration);
      return [dateDisplay, timeDisplay, String(appt.clientName || ''), String(appt.phone || ''), serviceList, String(appt.notes || '')];
    });
    doc.autoTable({ startY: 35, head: [['Date', 'Time', 'Client', 'Phone', 'Service', 'Notes']], body: tableRows, theme: 'grid', headStyles: { fillColor: [79, 70, 229] }, styles: { fontSize: 9, cellPadding: 3 }, columnStyles: { 0: { cellWidth: 25 }, 1: { cellWidth: 25 }, 2: { cellWidth: 30 }, 5: { cellWidth: 35 } } });
    const filename = `Schedule_${startStr || 'All'}_to_${endStr || 'All'}.pdf`;
    const blob = doc.output('blob');
    if (isNative && Filesystem && Share) {
      const base64 = await blobToBase64(blob);
      const { uri } = await Filesystem.writeFile({ path: filename, data: base64, directory: Directory.Cache })
        .then(() => Filesystem.getUri({ path: filename, directory: Directory.Cache }));
      await Share.share({ title: 'Appointment Report', url: uri, dialogTitle: 'Share PDF' });
      setTimeout(() => { Filesystem.deleteFile({ path: filename, directory: Directory.Cache }).catch(() => {}); }, 60000);
      return;
    }
    const file = new File([blob], filename, { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Appointment Schedule', text: 'Here is the exported schedule PDF.' });
      return;
    }
    try {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
      return;
    } catch {
      try {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => { URL.revokeObjectURL(url); }, 60000);
        return;
      } catch {}
    }
    doc.save(filename);
  } catch (error) {
    alert('Export failed—check permissions');
  } finally {
    if (btn) { btn.disabled = false; btn.classList.remove('opacity-50'); btn.querySelector('span').textContent = 'Share or Download PDF'; }
  }
};

window.downloadPDF = async function () { return window.exportAppointments(); };

function listenForAppointments() {
  const appointmentsRef = getAppointmentsRef();
  if (!appointmentsRef) return;

  const q = window.query(appointmentsRef, window.orderBy('date', 'asc'));
  const unsub = window.onSnapshot(
    q,
    (snapshot) => {
      let fetchedAppointments = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      fetchedAppointments.sort((a, b) => {
        const dateTimeA = new Date(`${a.date}T${a.time || "00:00"}`);
        const dateTimeB = new Date(`${b.date}T${b.time || "00:00"}`);
        return dateTimeA - dateTimeB;
      });

      window.state.appointments = fetchedAppointments;
      console.log("Appointments updated:", window.state.appointments.length);
      renderCalendarView();
      renderUpcomingView();
      scheduleReminders();
    },
    (error) => {
      console.error("Error listening to appointments:", error);
      displayMessage("Error fetching appointment data: " + error.message, "error", 5000);
    }
  );
  window.__unsubs = window.__unsubs || [];
  window.__unsubs.push(unsub);
}

async function saveAppointment(event) {
  event.preventDefault();
  const form = event.target;
  const appointmentsRef = getAppointmentsRef();
  if (!appointmentsRef) return;

  const selectedServiceCheckboxes = Array.from(form.querySelectorAll('input[name="serviceId"]:checked'));

  if (selectedServiceCheckboxes.length === 0) {
    displayMessage("Please select at least one service before saving.", "error");
    return;
  }

  let totalDuration = 0;
  const serviceDetails = [];
  const serviceNames = [];

  selectedServiceCheckboxes.forEach((checkbox) => {
    const serviceId = checkbox.value;
    const service = window.state.services.find((s) => s.id === serviceId);
    if (service) {
      totalDuration += service.duration;
      serviceDetails.push({ id: service.id, name: service.name, duration: service.duration, color: service.color || "indigo" });
      serviceNames.push(service.name);
    }
  });

  const newAppointment = {
    clientName: form.clientName.value.trim(),
    service: serviceNames.join(", "),
    serviceDetails: serviceDetails,
    date: form.date.value,
    time: form.time.value,
    duration: totalDuration,
    phone: form.phone ? form.phone.value.trim() : "",
    notes: form.notes.value.trim(),
    guestEmails: form.guestEmails ? form.guestEmails.value.trim() : "",
    reminderMinutes: (() => {
      const v = form.simpleReminder && form.simpleReminder.value ? Number(form.simpleReminder.value) : 0;
      return Number.isFinite(v) && v > 0 ? v : 0;
    })(),
    timestamp: window.serverTimestamp(),
  };

  try {
    if (!newAppointment.date || !newAppointment.time || !newAppointment.clientName) {
      displayMessage("Please fill out all required fields (Client, Date, Time, Service).", "error");
      return;
    }

    const editingId = form.dataset.editingId || window.state.editingAppointmentId || null;
    if (!isOnline()) {
      queuePendingAppointment(editingId ? 'update' : 'create', newAppointment, editingId || undefined);
      // Optimistic UI update – show appointment immediately
      if (!editingId) {
        const tempId = `temp_${Date.now()}`;
        const tempAppt = { ...newAppointment, id: tempId, pending: true };
        window.state.appointments.push(tempAppt);
        window.state.appointments.sort((a,b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
        renderCalendarView();
        renderUpcomingView();
      }
      displayMessage("Appointment added offline – will sync when back online", "success", 5000);
      const mc1 = document.getElementById("main-content");
      if (mc1) mc1.scrollTo({ top: 0, behavior: "smooth" });
      window.state.editingAppointmentId = null;
      delete form.dataset.editingId;
    } else {
      if (editingId) {
        const docRef = window.doc(appointmentsRef, editingId);
        await window.updateDoc(docRef, newAppointment);
        displayMessage(`Appointment updated for ${newAppointment.clientName}.`, "success", 5000);
        const mc2 = document.getElementById("main-content");
        if (mc2) mc2.scrollTo({ top: 0, behavior: "smooth" });
        window.state.editingAppointmentId = null;
        delete form.dataset.editingId;
      } else {
        await window.setDoc(window.doc(appointmentsRef), newAppointment);
        displayMessage(`Appointment added: ${newAppointment.clientName} on ${newAppointment.date} at ${newAppointment.time}.`, "success", 5000);
        const mc3 = document.getElementById("main-content");
        if (mc3) mc3.scrollTo({ top: 0, behavior: "smooth" });
      }
    }

    form.reset();
    changeView("upcoming");
  } catch (error) {
    const editingId = form.dataset.editingId || window.state.editingAppointmentId || null;
    queuePendingAppointment(editingId ? 'update' : 'create', newAppointment, editingId || undefined);
    // Optimistic UI update – show appointment immediately
    if (!editingId) {
      const tempId = `temp_${Date.now()}`;
      const tempAppt = { ...newAppointment, id: tempId, pending: true };
      window.state.appointments.push(tempAppt);
      window.state.appointments.sort((a,b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
      renderCalendarView();
      renderUpcomingView();
    }
    displayMessage("Appointment added offline – will sync when back online", "success", 5000);
    const mc4 = document.getElementById("main-content");
    if (mc4) mc4.scrollTo({ top: 0, behavior: "smooth" });
  }
}
window.saveAppointment = saveAppointment;

function clearReminder() {
  const amountEl = document.getElementById("reminderAmount");
  const unitEl = document.getElementById("reminderUnit");
  if (amountEl) amountEl.value = "";
  if (unitEl) unitEl.value = "minutes";
}
window.clearReminder = clearReminder;

function pad2(n) { return String(n).padStart(2, "0"); }
function formatICSDate(dateObj) {
  const y = dateObj.getUTCFullYear();
  const m = pad2(dateObj.getUTCMonth() + 1);
  const d = pad2(dateObj.getUTCDate());
  const H = pad2(dateObj.getUTCHours());
  const M = pad2(dateObj.getUTCMinutes());
  const S = pad2(dateObj.getUTCSeconds());
  return `${y}${m}${d}T${H}${M}${S}Z`;
}

function generateICS(appt) {
  const start = new Date(`${appt.date}T${appt.time || "00:00"}`);
  const end = new Date(start.getTime() + ((Number(appt.duration) || 30) * 60000));
  const dtStart = formatICSDate(start);
  const dtEnd = formatICSDate(end);
  const now = new Date();
  const dtStamp = formatICSDate(now);
  const uid = `${appt.id || Math.random().toString(36).slice(2)}@appointmentmaker.local`;
  const summary = `${appt.clientName} - ${appt.service || "Appointment"}`;
  const description = (appt.notes || "").replace(/\n/g, "\\n");
  let alarms = "";
  const arr = Array.isArray(appt.alertsMinutes) && appt.alertsMinutes.length ? appt.alertsMinutes : (Number(appt.reminderMinutes) > 0 ? [Number(appt.reminderMinutes)] : []);
  arr.forEach((m) => {
    const mm = Number(m);
    if (Number.isFinite(mm) && mm > 0) {
      alarms += `BEGIN:VALARM\nACTION:DISPLAY\nDESCRIPTION:Reminder\nTRIGGER:-PT${mm}M\nEND:VALARM\n`;
    }
  });
  const ics = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Appointment Maker Pro//EN\nBEGIN:VEVENT\nUID:${uid}\nDTSTAMP:${dtStamp}\nDTSTART:${dtStart}\nDTEND:${dtEnd}\nSUMMARY:${summary}\nDESCRIPTION:${description}\n${alarms}END:VEVENT\nEND:VCALENDAR\n`;
  return ics;
}

function getGoogleCalendarLink(appt) {
  const start = new Date(`${appt.date}T${appt.time || "00:00"}`);
  const end = new Date(start.getTime() + ((Number(appt.duration) || 30) * 60000));
  const dtStart = formatICSDate(start);
  const dtEnd = formatICSDate(end);
  const text = encodeURIComponent(`${appt.clientName} - ${appt.service || "Appointment"}`);
  const dates = encodeURIComponent(`${dtStart}/${dtEnd}`);
  const detailsParts = [];
  detailsParts.push(`Services: ${appt.service || ""}`);
  if (appt.notes) detailsParts.push(appt.notes);
  const details = encodeURIComponent(detailsParts.join("\n"));
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${dates}&details=${details}`;
}
window.getGoogleCalendarLink = getGoogleCalendarLink;

function downloadICSForAppointment(id) {
  const appt = (window.state.appointments || []).find((a) => a.id === id);
  if (!appt) return;
  const ics = generateICS(appt);
  const blob = new Blob([ics], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safeName = `${appt.clientName || "appointment"}-${appt.date}`.replace(/[^a-z0-9_-]/gi, "_");
  a.href = url;
  a.download = `${safeName}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  displayMessage("Calendar event file downloaded.");
}
window.downloadICSForAppointment = downloadICSForAppointment;

async function addToDeviceCalendar(id) {
  const appt = (window.state.appointments || []).find((a) => a.id === id);
  if (!appt) return;
  const cap = window.Capacitor;
  const cal = cap && cap.Plugins ? (cap.Plugins.Calendar || cap.Plugins.CapacitorCalendar) : null;
  if (!cal) {
    downloadICSForAppointment(id);
    return;
  }
  try {
    if (typeof cal.requestFullCalendarAccess === "function") {
      await cal.requestFullCalendarAccess();
    } else if (typeof cal.requestAllPermissions === "function") {
      await cal.requestAllPermissions();
    }
    const start = new Date(`${appt.date}T${appt.time || "00:00"}`);
    const end = new Date(start.getTime() + ((Number(appt.duration) || 30) * 60000));
    const title = `${appt.clientName} - ${appt.service || "Appointment"}`;
    const notes = appt.notes || "";
    const baseAlerts = Array.isArray(appt.alertsMinutes) && appt.alertsMinutes.length ? appt.alertsMinutes : (Number(appt.reminderMinutes) > 0 ? [Number(appt.reminderMinutes)] : []);
    const alertMinutes = baseAlerts.length ? baseAlerts.map((m) => -Number(m)).filter((n) => Number.isFinite(n)) : undefined;
    let calendarId;
    try {
      if (typeof cal.listCalendars === "function") {
        const list = await cal.listCalendars();
        const arr = list && list.result ? list.result : [];
        if (arr.length) {
          const names = arr.map((c, i) => `${i + 1}. ${c.name}`).join("\n");
          const sel = window.prompt(`Select calendar:\n${names}\nEnter number or leave blank for default:`) || "";
          const idx = Number(sel) - 1;
          if (Number.isInteger(idx) && idx >= 0 && idx < arr.length) {
            calendarId = arr[idx].id;
          }
        }
      }
      if (!calendarId && typeof cal.getDefaultCalendar === "function") {
        const def = await cal.getDefaultCalendar();
        if (def && def.result && def.result.id) {
          calendarId = def.result.id;
        }
      }
    } catch (_) {}
    const opts = {
      title,
      location: "",
      description: notes,
      startDate: start.getTime(),
      endDate: end.getTime(),
      alerts: alertMinutes,
      calendarId,
    };
    const platform = cap.getPlatform ? cap.getPlatform() : "web";
    if (typeof cal.createEvent === "function" && platform === "android") {
      const attendees = (() => {
        const raw = appt.guestEmails || "";
        return raw
          .split(",")
          .map((s) => String(s).trim())
          .filter((e) => e && /@/.test(e))
          .map((email) => ({ email }));
      })();
      if (attendees.length) opts.attendees = attendees;
      await cal.createEvent(opts);
    } else if (typeof cal.createEventWithPrompt === "function") {
      const invitees = (() => {
        const raw = appt.guestEmails || "";
        return raw
          .split(",")
          .map((s) => String(s).trim())
          .filter((e) => e && /@/.test(e));
      })();
      if (invitees.length) opts.invitees = invitees;
      await cal.createEventWithPrompt(opts);
    } else if (typeof cal.createEvent === "function") {
      await cal.createEvent(opts);
    } else {
      downloadICSForAppointment(id);
      return;
    }
    if (typeof cal.openCalendar === "function") {
      await cal.openCalendar({ date: start.getTime() });
    }
    displayMessage("Event added to device calendar.");
  } catch (e) {
    downloadICSForAppointment(id);
  }
}
window.addToDeviceCalendar = addToDeviceCalendar;

async function deleteAppointment(id) {
  const appointmentsRef = getAppointmentsRef();
  if (!appointmentsRef) return;

  const confirmed = await showConfirmModal(
    "Confirm Deletion",
    "Are you sure you want to delete this appointment? This action cannot be undone."
  );
  if (!confirmed) return;

  try {
    const docRef = window.doc(appointmentsRef, id);
    await window.deleteDoc(docRef);
    displayMessage("Appointment deleted successfully.");
  } catch (error) {
    console.error("Error deleting appointment:", error);
    displayMessage("Failed to delete appointment: " + error.message, "error", 5000);
  }
}
window.deleteAppointment = deleteAppointment;

function getServicesRef() {
  if (!db || !userId) {
    console.error("Database or User ID not ready for services.");
    return null;
  }
  return window.collection(db, `artifacts/${appId}/users/${userId}/services`);
}

function listenForServices() {
  const servicesRef = getServicesRef();
  if (!servicesRef) return;

  const q = window.query(servicesRef, window.orderBy("name", "asc"));
  const unsub = window.onSnapshot(
    q,
    (snapshot) => {
      window.state.services = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      console.log("Services updated:", window.state.services.length);
      if (window.state.currentView === "services") {
        renderServiceManagementView();
      } else if (window.state.currentView === "add") {
        renderAddAppointmentView();
      }
    },
    (error) => {
      console.error("Error listening to services:", error);
      displayMessage("Error fetching service data: " + error.message, "error", 5000);
    }
  );
  window.__unsubs = window.__unsubs || [];
  window.__unsubs.push(unsub);
}

async function saveService(event) {
  event.preventDefault();
  const form = document.getElementById("service-form");
  const servicesRef = getServicesRef();
  if (!servicesRef) return;

  const serviceName = form.serviceName.value.trim();
  const hours = parseInt(form.serviceHours.value || "0", 10);
  const minutes = parseInt(form.serviceMinutes.value || "0", 10);
  const serviceDuration = Math.max(0, (isNaN(hours) ? 0 : hours) * 60 + (isNaN(minutes) ? 0 : minutes));
  const serviceColor = (form.serviceColor && form.serviceColor.value) || "indigo";
  const serviceId = form.dataset.editingId;

  if (!serviceName || !Number.isFinite(serviceDuration) || serviceDuration < 5) {
    displayMessage("Please provide a valid name and duration (min 5 minutes).", "error");
    return;
  }

  const serviceData = { name: serviceName, duration: serviceDuration, color: serviceColor, timestamp: window.serverTimestamp() };

  try {
    if (serviceId) {
      await window.updateDoc(window.doc(servicesRef, serviceId), serviceData);
      displayMessage(`Service "${serviceName}" updated successfully!`);
    } else {
      await window.setDoc(window.doc(servicesRef), serviceData);
      displayMessage(`Service "${serviceName}" added successfully!`);
    }

    form.reset();
    delete form.dataset.editingId;
    document.getElementById("service-form-title").textContent = "Add New Service";
    document.getElementById("service-submit-btn").textContent = "Save Service";
    const cancelButton = document.getElementById("service-cancel-edit");
    if (cancelButton) cancelButton.classList.add("hidden");
  } catch (error) {
    console.error("Error saving service:", error);
    displayMessage("Failed to save service: " + error.message, "error", 5000);
  }
}
window.saveService = saveService;

async function deleteService(id, name) {
  const confirmed = await showConfirmModal(
    "Confirm Service Deletion",
    `Are you sure you want to delete the service: ${name}? All appointments referencing this service will still exist but will show "Service N/A".`
  );
  if (!confirmed) return;

  const servicesRef = getServicesRef();
  if (!servicesRef) return;

  try {
    await window.deleteDoc(window.doc(servicesRef, id));
    displayMessage(`Service "${name}" deleted.`);
  } catch (error) {
    console.error("Error deleting service:", error);
    displayMessage("Failed to delete service: " + error.message, "error", 5000);
  }
}
window.deleteService = deleteService;

function editService(id, name, duration, color) {
  const form = document.getElementById("service-form");
  form.serviceName.value = name;
  const d = Number(duration) || 0;
  const h = Math.floor(d / 60);
  const m = d % 60;
  if (form.serviceHours) form.serviceHours.value = String(h);
  if (form.serviceMinutes) form.serviceMinutes.value = String(m);
  if (form.serviceColor) form.serviceColor.value = color || "indigo";
  form.dataset.editingId = id;
  document.getElementById("service-form-title").textContent = "Edit Service";
  document.getElementById("service-submit-btn").textContent = "Update Service";
  const cancelButton = document.getElementById("service-cancel-edit");
  if (cancelButton) cancelButton.classList.remove("hidden");
  form.scrollIntoView({ behavior: "smooth", block: "start" });
  form.serviceName.focus();
}
window.editService = editService;

function cancelEditService() {
  const form = document.getElementById("service-form");
  form.reset();
  delete form.dataset.editingId;
  document.getElementById("service-form-title").textContent = "Add New Service";
  document.getElementById("service-submit-btn").textContent = "Save Service";
  const cancelButton = document.getElementById("service-cancel-edit");
  if (cancelButton) cancelButton.classList.add("hidden");
}
window.cancelEditService = cancelEditService;

function getContactsRef() {
  if (!db || !userId) {
    console.error("Database or User ID not ready for contacts.");
    return null;
  }
  return window.collection(db, `artifacts/${appId}/users/${userId}/contacts`);
}

function listenForContacts() {
  const contactsRef = getContactsRef();
  if (!contactsRef) return;
  const q = window.query(contactsRef, window.orderBy("name", "asc"));
  const unsub = window.onSnapshot(q, (snapshot) => {
    window.state.contacts = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  });
  window.__unsubs = window.__unsubs || [];
  window.__unsubs.push(unsub);
}

function saveNewContact(name, phone) {
  const contactsRef = getContactsRef();
  if (!contactsRef || !name || !phone) return;
  const data = { name: String(name).trim(), phone: String(phone).trim(), createdAt: window.serverTimestamp() };
  return window.setDoc(window.doc(contactsRef), data)
    .then(() => {
      displayMessage("Contact saved");
    })
    .catch((e) => {
      displayMessage("Failed to save contact: " + e.message, "error", 4000);
    });
}

function openContactsModal() {
  const modal = document.getElementById("contacts-modal");
  const bg = document.getElementById("contacts-modal-bg");
  const panel = document.getElementById("contacts-modal-panel");
  const listEl = document.getElementById("contacts-list");
  const searchEl = document.getElementById("contacts-search");
  const closeBtn = document.getElementById("contacts-modal-close");
  const saveBtn = document.getElementById("save-new-contact");

  function renderList(filter) {
    const items = (window.state.contacts || []).filter((c) => {
      const f = String(filter || "").toLowerCase();
      if (!f) return true;
      return (
        String(c.name || "").toLowerCase().includes(f) ||
        String(c.phone || "").toLowerCase().includes(f)
      );
    });
    if (items.length === 0) {
      listEl.innerHTML = '<div class="p-3 text-center text-gray-500">No contacts yet.</div>';
    } else {
      listEl.innerHTML = items
        .map(
          (c) =>
            `<button data-id="${c.id}" class="w-full text-left p-3 hover:bg-indigo-50 flex items-center justify-between">
                     <span class="text-sm text-gray-800">${c.name || "Unnamed"}</span>
                     <span class="text-xs text-gray-500">${c.phone || ""}</span>
                   </button>`
        )
        .join("");
      listEl.querySelectorAll("button[data-id]").forEach((btn) => {
        btn.onclick = () => {
          const id = btn.getAttribute("data-id");
          const c = (window.state.contacts || []).find((x) => x.id === id);
          const form = document.getElementById("appointment-form");
          if (form && c) {
            if (c.name) form.clientName.value = c.name;
            if (c.phone) form.phone.value = c.phone;
            closeContactsModal();
            displayMessage("Contact selected");
          }
        };
      });
    }
  }

  searchEl.oninput = () => renderList(searchEl.value);
  saveBtn.onclick = async () => {
    const name = document.getElementById("new-contact-name").value;
    const phone = document.getElementById("new-contact-phone").value;
    if (name && phone) {
      await saveNewContact(name, phone);
      document.getElementById("new-contact-name").value = "";
      document.getElementById("new-contact-phone").value = "";
      renderList(searchEl.value);
    }
  };

  closeBtn.onclick = closeContactsModal;
  bg.onclick = closeContactsModal;

  modal.classList.remove("hidden");
  bg.classList.add("modal-bg-enter");
  panel.classList.add("modal-enter");
  requestAnimationFrame(() => {
    bg.classList.add("modal-bg-enter-active");
    panel.classList.add("modal-enter-active");
  });
  renderList("");
}

function closeContactsModal() {
  const modal = document.getElementById("contacts-modal");
  const bg = document.getElementById("contacts-modal-bg");
  const panel = document.getElementById("contacts-modal-panel");
  bg.classList.remove("modal-bg-enter-active");
  panel.classList.remove("modal-enter-active");
  setTimeout(() => {
    modal.classList.add("hidden");
    bg.classList.remove("modal-bg-enter");
    panel.classList.remove("modal-enter");
  }, 200);
}

function updateAppointmentDuration() {
  const serviceCheckboxes = document.querySelectorAll('input[name="serviceId"]');
  const durationInput = document.getElementById("duration");
  let totalDuration = 0;

  serviceCheckboxes.forEach((checkbox) => {
    if (checkbox.checked) {
      const serviceId = checkbox.value;
      const service = window.state.services.find((s) => s.id === serviceId);
      if (service) {
        totalDuration += service.duration;
      }
    }
  });

  durationInput.value = totalDuration > 0 ? totalDuration : 30;
}
window.updateAppointmentDuration = updateAppointmentDuration;

function render() {
  document.getElementById("calendar-view").classList.add("hidden");
  document.getElementById("upcoming-view").classList.add("hidden");
  document.getElementById("add-appointment-view").classList.add("hidden");
  document.getElementById("service-management-view").classList.add("hidden");

  switch (window.state.currentView) {
    case "calendar":
      document.getElementById("calendar-view").classList.remove("hidden");
      renderCalendarView();
      break;
    case "upcoming":
      document.getElementById("upcoming-view").classList.remove("hidden");
      renderUpcomingView();
      break;
    case "add":
      document.getElementById("add-appointment-view").classList.remove("hidden");
      renderAddAppointmentView();
      break;
    case "services":
      document.getElementById("service-management-view").classList.remove("hidden");
      renderServiceManagementView();
      break;
  }
  updateNavBar();
}
window.render = render;

function updateNavBar() {
  document.querySelectorAll(".nav-button").forEach((btn) => {
    btn.classList.remove("text-indigo-600");
    btn.classList.add("text-gray-500");
  });

  let activeId = "";
  if (window.state.currentView === "calendar") activeId = "nav-calendar";
  else if (window.state.currentView === "upcoming") activeId = "nav-upcoming";
  else if (window.state.currentView === "add") activeId = "nav-add";
  else if (window.state.currentView === "services") activeId = "nav-services";

  const activeBtn = document.getElementById(activeId);
  if (activeBtn) {
    activeBtn.classList.add("text-indigo-600");
    activeBtn.classList.remove("text-gray-500");
  }
}

function changeView(view) {
  window.state.currentView = view;
  render();
}
window.changeView = changeView;

function changeMonth(delta) {
  window.state.currentMonth.setMonth(window.state.currentMonth.getMonth() + delta);
  window.state.currentMonth = new Date(window.state.currentMonth);
  renderCalendarView();
}
window.changeMonth = changeMonth;

function changeSelectedDate(delta) {
  window.state.selectedDate = addDays(window.state.selectedDate, delta);
  window.state.currentMonth = new Date(
    window.state.selectedDate.getFullYear(),
    window.state.selectedDate.getMonth(),
    1
  );
  renderCalendarView();
}
window.changeSelectedDate = changeSelectedDate;

function selectDate(day) {
  window.state.selectedDate = new Date(
    window.state.currentMonth.getFullYear(),
    window.state.currentMonth.getMonth(),
    day
  );
  window.state.calendarMode = "day";
  renderCalendarView();
}
window.selectDate = selectDate;

function setCalendarMode(mode) {
  window.state.calendarMode = mode;
  if (mode === "month") {
    window.state.currentMonth = new Date(
      window.state.selectedDate.getFullYear(),
      window.state.selectedDate.getMonth(),
      1
    );
  }
  renderCalendarView();
}
window.setCalendarMode = setCalendarMode;

function generateDayAppointmentListHTML(dayKey, displayTitle, isCompact = false) {
  const appts = window.state.appointments.filter((appt) => appt.date === dayKey);

  let listHTML = `
                      <div class="mt-8">
                          <h3 class="${isCompact ? "text-lg" : "text-xl"} font-bold text-gray-800 mb-3 border-b pb-2">${displayTitle}</h3>
                          <div class="appointment-list-container ${isCompact ? "max-h-full" : "max-h-[30vh]"} overflow-y-auto pr-2">
                  `;

  if (appts.length === 0) {
    listHTML += `
                          <div class="text-center py-5 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                              <i class="fas fa-calendar-check text-2xl text-gray-300"></i>
                              <p class="mt-1 text-sm text-gray-600">No appointments.</p>
                          </div>
                      `;
  } else {
    appts.forEach((appt) => {
      const serviceDisplay = appt.service || "Service N/A";
      const phone = (appt.phone || "").trim();
      const waNumber = normalizeWhatsAppNumber(phone);
      const dateDisplay = new Date(`${dayKey}T${appt.time || "00:00"}`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
      const waText = encodeURIComponent(getLocalizedWhatsAppText(appt, dateDisplay));
      const waLink = waNumber ? `https://wa.me/${waNumber}?text=${waText}` : "";
      const telLink = phone ? `tel:${phone}` : "";
      const startMs = new Date(`${dayKey}T${appt.time || "00:00"}`).getTime();
      const endMs = startMs + ((Number(appt.duration) || 30) * 60000);
      const isCompleted = Date.now() >= endMs;
      const completedNoteHTML = isCompleted ? `<p class=\"text-xs font-semibold text-red-600 mt-1\"><i class=\"fas fa-circle-check w-3 text-center\"></i> Appointment Completed</p>` : "";

      const endStr = minutesToTime(timeToMinutes(appt.time || "00:00") + (Number(appt.duration) || 30));
      listHTML += `
                              <div class="bg-white p-3 mb-2 rounded-xl shadow-lg border border-indigo-100 flex justify-between items-start">
                                  <div class="flex-grow">
                                      <p class="text-xs font-semibold uppercase text-indigo-500">${serviceDisplay}</p>
                                      <h4 class="text-base font-bold text-gray-900">${appt.clientName}</h4>
                                      <div class="text-xs text-gray-600 mt-1">
                                          <p><i class="fas fa-clock w-3 text-center text-indigo-400"></i> <span class="ml-1">${appt.time} - ${endStr}</span></p>
                                          ${phone ? `<p class=\"mt-1\"><i class=\"fas fa-phone w-3 text-center text-indigo-400\"></i> <span class=\"ml-1\">${phone}</span></p>` : ""}
                                          ${appt.notes && !isCompact ? `<p class="mt-1 text-xs italic text-gray-500"><i class="fas fa-sticky-note w-3 text-center"></i> ${appt.notes}</p>` : ""}
                                      </div>
                                  </div>
                                  <div class="flex flex-col items-end ml-2">
                                      <div class="flex items-center gap-2">
                                          <button onclick="editAppointment('${appt.id}')" class="p-1 text-indigo-500 hover:text-indigo-700 transition" title="Edit Appointment"><i class="fas fa-edit"></i></button>
                                          ${waLink ? `<a href=\"${waLink}\" target=\"_blank\" class=\"p-1 text-green-600 hover:text-green-700 transition\" title=\"WhatsApp\"><i class=\"fab fa-whatsapp\"></i></a>` : ""}
                                          ${telLink ? `<a href=\"${telLink}\" class=\"p-1 text-indigo-600 hover:text-indigo-700 transition\" title=\"Call\"><i class=\"fas fa-phone\"></i></a>` : ""}
                                          <button onclick="deleteAppointment('${appt.id}')" class="text-red-400 hover:text-red-600 transition p-1 focus:outline-none" title="Delete Appointment"><i class="fas fa-trash-alt text-base"></i></button>
                                      </div>
                                      ${completedNoteHTML}
                                  </div>
                              </div>
                          `;
    });
  }

  listHTML += `</div></div>`;
  return listHTML;
}

function renderCalendarView() {
  const container = document.getElementById("calendar-view");
  if (container.classList.contains("hidden")) return;

  const mode = window.state.calendarMode;

  const modeSelectorHTML = `
                  <div class="flex justify-center space-x-2 mb-4 bg-gray-100 p-1 rounded-xl shadow-inner border border-gray-200">
                      <button onclick="setCalendarMode('day')" class="flex-1 py-2 text-sm font-semibold rounded-lg transition ${mode === "day" ? "bg-indigo-600 text-white shadow" : "text-gray-700 hover:bg-white"}">Day</button>
                      <button onclick="setCalendarMode('week')" class="flex-1 py-2 text-sm font-semibold rounded-lg transition ${mode === "week" ? "bg-indigo-600 text-white shadow" : "text-gray-700 hover:bg-white"}">Week</button>
                      <button onclick="setCalendarMode('month')" class="flex-1 py-2 text-sm font-semibold rounded-lg transition ${mode === "month" ? "bg-indigo-600 text-white shadow" : "text-gray-700 hover:bg-white"}">Month</button>
                  </div>
              `;

  try {
    container.innerHTML = modeSelectorHTML;
    let content = "";
    switch (mode) {
      case "day":
        content = renderDayView();
        break;
      case "week":
        content = renderWeekView();
        break;
      case "month":
      default:
        content = renderMonthView();
        break;
    }
    container.innerHTML += content || "";
  } catch (e) {
    console.error("Render calendar error", e);
    container.innerHTML =
      modeSelectorHTML +
      `<div class="p-4 text-center text-red-600">Unable to render calendar view.</div>`;
  }
}

function renderDayView() {
  const selectedDate = window.state.selectedDate;
  const dayKey = formatDate(selectedDate);
  const selectedDateDisplay = selectedDate.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const navHTML = `
                    <div class="mb-4 flex justify-between items-center px-2">
                        <button onclick="changeSelectedDate(-1)" class="p-2 text-indigo-600 hover:bg-indigo-100 rounded-full transition"><i class="fas fa-chevron-left"></i></button>
                        <h2 class="text-xl font-semibold text-gray-800 text-center">${selectedDateDisplay}</h2>
                        <button onclick="changeSelectedDate(1)" class="p-2 text-indigo-600 hover:bg-indigo-100 rounded-full transition"><i class="fas fa-chevron-right"></i></button>
                    </div>
                `;

  const hourlyHTML = renderHourlySchedule(dayKey, "Schedule");
  return navHTML + hourlyHTML + generateDayAppointmentListHTML(dayKey, "Appointments", false);
}

function renderWeekView() {
  const selectedDate = window.state.selectedDate;
  const startOfWeek = getStartOfWeek(selectedDate);

  const weekEnd = addDays(startOfWeek, 6);
  const weekStartDisplay = startOfWeek.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const weekEndDisplay = weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  const navHTML = `
                    <div class="mb-4 flex justify-between items-center px-2">
                        <button onclick="changeSelectedDate(-7)" class="p-2 text-indigo-600 hover:bg-indigo-100 rounded-full transition"><i class="fas fa-chevron-left"></i></button>
                        <h2 class="text-xl font-semibold text-gray-800">${weekStartDisplay} - ${weekEndDisplay}</h2>
                        <button onclick="changeSelectedDate(7)" class="p-2 text-indigo-600 hover:bg-indigo-100 rounded-full transition"><i class="fas fa-chevron-right"></i></button>
                    </div>
                `;

  let weekCalendarHTML = `<div class="grid grid-cols-7 text-center text-sm font-medium text-gray-500 border-b pb-2 mb-2">`;
  let weekApptListHTML = `<div class="space-y-4">`;
  const selectedDayKey = formatDate(selectedDate);

  for (let i = 0; i < 7; i++) {
    const day = addDays(startOfWeek, i);
    const dayKey = formatDate(day);
    const isSelected = dayKey === selectedDayKey;
    const apptsForDay = window.state.appointments.filter((appt) => appt.date === dayKey);
    const apptCount = apptsForDay.length;
    const dayOfWeek = daysOfWeek[day.getDay()];

    weekCalendarHTML += `
                        <div onclick="changeSelectedDate(${i - (selectedDate.getDay() - startOfWeek.getDay())})"
                             class="p-1 cursor-pointer ${isSelected ? "bg-indigo-600 text-white rounded-lg shadow" : "text-gray-800 hover:bg-gray-100 rounded-lg"}">
                            <span class="text-xs block">${dayOfWeek}</span>
                            <span class="text-lg font-bold block">${day.getDate()}</span>
                            ${apptCount > 0 ? `<span class="block text-xs leading-none mt-0.5 w-1.5 h-1.5 rounded-full mx-auto ${isSelected ? "bg-white" : "bg-green-500"}"></span>` : ""}
                        </div>
                    `;

    if (isSelected) {
      weekApptListHTML += generateDayAppointmentListHTML(
        dayKey,
        day.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }),
        false
      );
    }
  }

  weekCalendarHTML += `</div>`;
  weekApptListHTML += `</div>`;

  return navHTML + weekCalendarHTML + weekApptListHTML;
}

function renderMonthView() {
  const currentDate = window.state.currentMonth;
  const today = new Date();
  const selectedDayKey = formatDate(window.state.selectedDate);

  const monthName = months[currentDate.getMonth()];
  const year = currentDate.getFullYear();

  const firstDayOfMonth = new Date(year, currentDate.getMonth(), 1).getDay();
  const daysInMonth = new Date(year, currentDate.getMonth() + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, currentDate.getMonth(), 0).getDate();

  const appointmentsByDay = window.state.appointments.reduce(
    (acc, appt) => {
      acc[appt.date] = acc[appt.date] || [];
      acc[appt.date].push(appt);
      return acc;
    },
    {}
  );

  let calendarHTML = `
                      <div class="mb-4 flex justify-between items-center px-2">
                          <button onclick="changeMonth(-1)" class="p-2 text-indigo-600 hover:bg-indigo-100 rounded-full transition"><i class="fas fa-chevron-left"></i></button>
                          <h2 class="text-2xl font-semibold text-gray-800">${monthName} ${year}</h2>
                          <button onclick="changeMonth(1)" class="p-2 text-indigo-600 hover:bg-indigo-100 rounded-full transition"><i class="fas fa-chevron-right"></i></button>
                      </div>

                      <div class="grid grid-cols-7 text-center text-sm font-medium text-gray-500 border-b pb-2">
                          ${daysOfWeek.map((day) => `<span>${day}</span>`).join("")}
                      </div>

                      <div class="grid grid-cols-7 gap-1 mt-2">
                  `;

  let dayCounter = 1;
  let currentDayDate;

  for (let i = 0; i < firstDayOfMonth; i++) {
    const prevDay = daysInPrevMonth - firstDayOfMonth + i + 1;
    calendarHTML += `<div class="text-center p-2 text-gray-300 font-medium">${prevDay}</div>`;
  }

  for (let i = 1; i <= daysInMonth; i++) {
    currentDayDate = new Date(year, currentDate.getMonth(), i);
    const dayKey = formatDate(currentDayDate);
    const isToday = dayKey === formatDate(today);
    const isSelected = dayKey === selectedDayKey;
    const apptCount = (appointmentsByDay[dayKey] || []).length;

    let classes = "p-1 h-24 flex flex-col items-stretch justify-start rounded-xl font-medium cursor-pointer transition transform gap-0.5";

    if (isSelected) {
      classes += " bg-indigo-600 text-white shadow-lg ring-2 ring-indigo-300 scale-105";
    } else if (isToday) {
      classes += " bg-indigo-100 text-indigo-700 hover:bg-indigo-200";
    } else {
      classes += " text-gray-800 hover:bg-gray-100";
    }

    const dayAppts = appointmentsByDay[dayKey] || [];
    const palette = ["text-indigo-600", "text-rose-600", "text-emerald-600", "text-amber-600", "text-sky-600"];
    const namesList = dayAppts
      .slice(0, 3)
      .map((a, idx) => {
        const color = isSelected ? "text-white" : palette[idx % palette.length];
        const name = String(a.clientName || "").trim();
        return `<div class="text-[10px] leading-tight text-center truncate w-full ${color}">${name}</div>`;
      })
      .join("");
    const moreCount = dayAppts.length > 3 ? dayAppts.length - 3 : 0;
    const moreLine = moreCount > 0 ? `<div class="text-[10px] leading-tight text-center ${isSelected ? "text-white" : "text-gray-500"}">+${moreCount} more</div>` : "";
    calendarHTML += `
                          <div onclick="selectDate(${i})" class="${classes}" role="button" aria-pressed="${isSelected}">
                              <span class="text-lg leading-none text-center">${i}</span>
                              ${namesList}${moreLine}
                          </div>
                      `;
    dayCounter++;
  }

  while ((dayCounter - 1) % 7 !== 0) {
    calendarHTML += `<div class="text-center p-2 text-gray-300 font-medium">${dayCounter - firstDayOfMonth - daysInMonth}</div>`;
    dayCounter++;
  }

  calendarHTML += "</div>";
  const selectedDateDisplay = window.state.selectedDate.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return calendarHTML + generateDayAppointmentListHTML(selectedDayKey, `Appointments for ${selectedDateDisplay}`, false);
}

function renderUpcomingView() {
  const container = document.getElementById("upcoming-view");
  if (container.classList.contains("hidden")) return;

  const mode = window.state.upcomingMode || "list";
  const main = document.getElementById("main-content");
  const prevScroll = main ? main.scrollTop : 0;
  const modeSelectorHTML = `
                  <div class="flex justify-center space-x-2 mb-4 bg-gray-100 p-1 rounded-xl shadow-inner border border-gray-200">
                      <button onclick="setUpcomingMode('list')" class="flex-1 py-2 text-sm font-semibold rounded-lg transition ${mode === "list" ? "bg-indigo-600 text-white shadow" : "text-gray-700 hover:bg-white"}">List</button>
                      <button onclick="setUpcomingMode('hourly')" class="flex-1 py-2 text-sm font-semibold rounded-lg transition ${mode === "hourly" ? "bg-indigo-600 text-white shadow" : "text-gray-700 hover:bg-white"}">Hourly</button>
                  </div>
                   <div class="mb-4">
                     <input id="upcoming-search" type="text" placeholder="Search by name, service, phone" class="w-full p-2 border border-gray-300 rounded-lg bg-white" value="${window.state.upcomingSearch || ''}">
                   </div>
              `;

  const nowMs = Date.now();
  const search = String(window.state.upcomingSearch || '').toLowerCase();
  const upcomingAppts = window.state.appointments
    .filter((appt) => {
      const startMs = new Date(`${appt.date}T${appt.time || "00:00"}`).getTime();
      const endMs = startMs + ((Number(appt.duration) || 30) * 60000);
      return endMs >= nowMs;
    })
    .filter((appt) => {
      if (!search) return true;
      return (
        String(appt.clientName || '').toLowerCase().includes(search) ||
        String(appt.service || '').toLowerCase().includes(search) ||
        String(appt.phone || '').toLowerCase().includes(search)
      );
    });

  let listHTML = modeSelectorHTML + `
                    <h2 class="text-2xl font-bold text-gray-800 mb-6">Upcoming Appointments</h2>
                    <div class="space-y-4 appointment-list-container max-h-[80vh] overflow-y-auto">
                `;

  if (upcomingAppts.length === 0) {
    listHTML += `
                    <div class="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                        <i class="fas fa-calendar-alt text-4xl text-gray-300"></i>
                        <p class="mt-3 text-gray-600">No appointments scheduled for the future.</p>
                        <button onclick="changeView('add')" class="mt-4 text-indigo-600 font-medium hover:text-indigo-700">
                            Book a new appointment <i class="fas fa-arrow-right ml-1"></i>
                        </button>
                    </div>
                `;
  } else if (mode === "list") {
      upcomingAppts.forEach((appt) => {
        const dateDisplay = new Date(`${appt.date}T${appt.time || "00:00"}`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });

      const phone = (appt.phone || "").trim();
      const waNumber = normalizeWhatsAppNumber(phone);
      const waText = encodeURIComponent(getLocalizedWhatsAppText(appt, dateDisplay));
      const waLink = waNumber ? `https://wa.me/${waNumber}?text=${waText}` : "";
      const telLink = phone ? `tel:${phone}` : "";
      const gcalLink = getGoogleCalendarLink(appt);
      const startMs = new Date(`${appt.date}T${appt.time || "00:00"}`).getTime();
      const endMs = startMs + ((Number(appt.duration) || 30) * 60000);
      const isCompleted = Date.now() >= endMs;
      const completedHTML = isCompleted ? `<p class="mt-1 text-xs font-semibold text-emerald-600"><i class="fas fa-check-circle w-4 text-center"></i> Appointment Completed</p>` : "";
        const endStr = minutesToTime(timeToMinutes(appt.time || "00:00") + (Number(appt.duration) || 30));
        const serviceBadgesHTML = Array.isArray(appt.serviceDetails) && appt.serviceDetails.length
          ? appt.serviceDetails
              .map((s) => {
                const key = s.color || "indigo";
                const c = SERVICE_COLORS[key] || SERVICE_COLORS.indigo;
                return `<span class="inline-flex items-center text-xs font-medium px-2 py-1 rounded ${c.badgeBg} ${c.badgeText} mr-1 mb-1">${s.name}</span>`;
              })
              .join("")
          : `<span class="text-xs font-semibold uppercase text-indigo-500">${appt.service || "Service N/A"}</span>`;
        listHTML += `
                        <div class="bg-white pt-6 pr-4 pb-16 pl-4 rounded-xl shadow-lg border border-indigo-100 flex justify-between items-start" style="position: relative;">
                            <div class="flex-grow">
                                <div class="flex flex-wrap">${serviceBadgesHTML}</div>
                                <h4 class="text-lg font-bold text-gray-900">${appt.clientName}</h4>
                                <div class="text-sm text-gray-600 mt-1 space-y-0.5">
                                    <p><i class="fas fa-calendar-day w-4 text-center text-indigo-500"></i> <span class="ml-1 font-bold text-indigo-700">${dateDisplay}</span></p>
                                    <p><i class="fas fa-clock w-4 text-center text-indigo-400"></i> <span class="ml-1">${appt.time} - ${endStr}</span></p>
                                    ${completedHTML}
                                    ${phone ? `<p><i class="fas fa-phone w-4 text-center text-indigo-400"></i> <span class="ml-1">${phone}</span></p>` : ""}
                                </div>
                            </div>
                            <div class="flex items-center gap-3">
                                <button onclick="editAppointment('${appt.id}')" class="p-2 text-indigo-500 hover:text-indigo-700 transition" title="Edit Appointment">
                                    <i class="fas fa-edit"></i>
                                </button>
                                ${waLink ? `<a href="${waLink}" target="_blank" class="p-2 text-green-600 hover:text-green-700 transition" title="WhatsApp"><i class="fab fa-whatsapp"></i></a>` : ""}
                                ${telLink ? `<a href="${telLink}" class="p-2 text-indigo-600 hover:text-indigo-700 transition" title="Call"><i class="fas fa-phone"></i></a>` : ""}
                                <button onclick="deleteAppointment('${appt.id}')" class="text-red-400 hover:text-red-600 transition p-2 ml-1 focus:outline-none" title="Delete Appointment">
                                    <i class="fas fa-trash-alt text-lg"></i>
                                </button>
                            </div>
                            <a href="${gcalLink}" target="_blank" class="px-2 py-1 text-xs bg-teal-600 text-white rounded-md hover:bg-teal-700 transition" style="position: absolute; right: 12px; bottom: 20px; z-index: 10;">Add to Google Calendar</a>
                        </div>
                    `;
      });
    listHTML += `</div>`;
  } else {
    const selectedDate = window.state.selectedDate;
    const dayKey = formatDate(selectedDate);
    const selectedDateDisplay = selectedDate.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const navHTML = `
                    <div class="mb-2 flex justify-between items-center px-2">
                        <button onclick="changeSelectedDate(-1)" class="p-2 text-indigo-600 hover:bg-indigo-100 rounded-full transition"><i class="fas fa-chevron-left"></i></button>
                        <h3 class="text-base font-semibold text-gray-800">${selectedDateDisplay}</h3>
                        <button onclick="changeSelectedDate(1)" class="p-2 text-indigo-600 hover:bg-indigo-100 rounded-full transition"><i class="fas fa-chevron-right"></i></button>
                    </div>
                `;
    listHTML = modeSelectorHTML + navHTML + renderHourlySchedule(dayKey, "Hourly Plan");
  }
  container.innerHTML = listHTML;
  const searchEl = document.getElementById('upcoming-search');
  if (searchEl && !searchEl.__init) {
    searchEl.__init = true;
    searchEl.addEventListener('input', () => {
      window.state.upcomingSearch = searchEl.value;
      renderUpcomingView();
    });
  }
  if (main) {
    main.scrollTop = prevScroll;
    const btn = document.getElementById("back-to-top");
    if (btn && !btn.__init) {
      btn.__init = true;
      btn.onclick = () => main.scrollTo({ top: 0, behavior: "smooth" });
      main.addEventListener("scroll", () => {
        const show = main.scrollTop > 200;
        btn.classList.toggle("hidden", !show);
      });
    }
    const show = main.scrollTop > 200;
    const btn2 = document.getElementById("back-to-top");
    if (btn2) btn2.classList.toggle("hidden", !show);
  }
}
window.renderUpcomingView = renderUpcomingView;

function setUpcomingMode(mode) {
  window.state.upcomingMode = mode;
  renderUpcomingView();
}
window.setUpcomingMode = setUpcomingMode;

async function initNotifications() {
  try {
    if (!('Notification' in window)) return;
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return;
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return;
    window.__swReg = reg;
  } catch {}
}

function scheduleReminders() {
  const reg = window.__swReg;
  if (!reg || !('showNotification' in reg)) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (!window.__reminderTimers) window.__reminderTimers = new Map();
  const now = Date.now();
  const maxAhead = 7 * 24 * 60 * 60 * 1000;
  (window.state.appointments || []).forEach((appt) => {
    const rm = Number(appt.reminderMinutes) || 0;
    if (!rm) return;
    const startMs = new Date(`${appt.date}T${appt.time || '00:00'}`).getTime();
    const triggerMs = startMs - rm * 60000;
    const delay = triggerMs - now;
    if (delay <= 0 || delay > maxAhead) return;
    if (window.__reminderTimers.has(appt.id)) return;
    const t = setTimeout(() => {
      reg.showNotification('Upcoming appointment', {
        body: `${appt.clientName} • ${appt.service || ''} at ${appt.time || ''}`,
        tag: `appt-${appt.id}`,
        badge: undefined,
        icon: undefined,
      });
      window.__reminderTimers.delete(appt.id);
    }, delay);
    window.__reminderTimers.set(appt.id, t);
  });
}

function renderAddAppointmentView() {
  const container = document.getElementById("add-appointment-view");
  if (container.classList.contains("hidden")) return;

  const defaultDate = formatDate(window.state.selectedDate);
  const nowTime = new Date();
  let defaultTime;
  if (window.state.suggestedTime) {
    defaultTime = window.state.suggestedTime;
    window.state.suggestedTime = null;
  } else {
    defaultTime = `${String(nowTime.getHours()).padStart(2, "0")}:${String(nowTime.getMinutes()).padStart(2, "0")}`;
  }

  const serviceOptions = window.state.services
    .map((service) => {
      const colorKey = service.color || "indigo";
      const c = SERVICE_COLORS[colorKey] || SERVICE_COLORS.indigo;
      return `<label class="flex items-center space-x-2 p-3 border-b border-gray-100 cursor-pointer hover:bg-indigo-50 transition">
                        <input type="checkbox" name="serviceId" value="${service.id}" data-duration="${service.duration}"
                               class="h-5 w-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                               onchange="updateAppointmentDuration()">
                        <span class="inline-block w-3 h-3 rounded-full ${c.dot}"></span>
                        <span class="text-gray-800">${service.name}</span>
                        <span class="text-sm text-gray-500 ml-auto">${service.duration} min</span>
                    </label>`;
    })
    .join("");

  container.innerHTML = `
                      <div class="p-4 bg-white rounded-xl shadow-2xl border border-gray-100">
                          <h2 class="text-2xl font-bold text-gray-800 mb-6" id="appointment-form-title">Book New Appointment</h2>
                          <form onsubmit="saveAppointment(event)" id="appointment-form" class="space-y-4">

                              <div>
                                  <label for="clientName" class="block text-sm font-medium text-gray-700 mb-1">Client Name <span class="text-red-500">*</span></label>
                                  <input type="text" id="clientName" name="clientName" required class="w-full p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition shadow-sm" placeholder="e.g., Jane Doe">
                              </div>

                              <div class="flex items-end space-x-2">
                                  <div class="flex-1">
                                      <label for="phone" class="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                                      <input type="tel" id="phone" name="phone" class="w-full p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition shadow-sm" placeholder="e.g., +27 82 123 4567">
                                  </div>
                                  <button type="button" onclick="pickContact()" class="px-3 py-2 bg-gray-100 text-gray-800 rounded-lg border border-gray-300 hover:bg-gray-200 transition whitespace-nowrap"><i class="fas fa-address-book mr-1"></i> Pick contact</button>
                              </div>

                              <div>
                                  <label class="block text-sm font-medium text-gray-700 mb-1">Select Services (Multiple allowed) <span class="text-red-500">*</span></label>
                                  <div id="service-options-container" class="border border-gray-300 rounded-lg max-h-48 overflow-y-auto bg-white shadow-sm divide-y">
                                      ${window.state.services.length === 0 ? '<p class="p-4 text-gray-500 text-center">No services defined. Please use the Services tab to add them first!</p>' : serviceOptions}
                                  </div>
                              </div>

                              <div class="flex space-x-3">
                                  <div class="w-1/2">
                                      <label for="date" class="block text-sm font-medium text-gray-700 mb-1">Date <span class="text-red-500">*</span></label>
                                      <input type="date" id="date" name="date" required value="${defaultDate}" class="w-full p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition shadow-sm">
                                  </div>
                                  <div class="w-1/2">
                                      <label for="time" class="block text-sm font-medium text-gray-700 mb-1">Time <span class="text-red-500">*</span></label>
                                      <input type="time" id="time" name="time" required value="${defaultTime}" class="w-full p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition shadow-sm">
                                  </div>
                              </div>

                              <div>
                                  <label class="block text-sm font-medium text-gray-700 mb-1">Reminder before appointment</label>
                                  <select id="simpleReminder" name="simpleReminder" class="w-full p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition shadow-sm">
                                      <option value="0">None</option>
                                      <option value="15">15 minutes before</option>
                                      <option value="30">30 minutes before</option>
                                      <option value="60">1 hour before</option>
                                      <option value="1440">1 day before</option>
                                  </select>
                              </div>

                              

                              <div>
                                  <label for="duration" class="block text-sm font-medium text-gray-700 mb-1">Total Duration (minutes)</label>
                                  <input type="number" id="duration" name="duration" min="5" value="30" readonly
                                         class="w-full p-3 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed font-bold text-indigo-600 transition shadow-sm">
                              </div>

                              <details class="bg-gray-50 border border-gray-200 rounded-lg p-3">
                                  <summary class="cursor-pointer text-sm font-semibold text-gray-700">Add Notes</summary>
                                  <div class="mt-3 space-y-3">
                                      <div>
                                          <label for="notes" class="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                                          <textarea id="notes" name="notes" rows="3" class="w-full p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition shadow-sm" placeholder="Details about the client or service."></textarea>
                                      </div>
                                  </div>
                              </details>

                              <button type="submit" id="appointment-submit-btn" class="w-full py-3 mt-6 bg-indigo-600 text-white font-semibold rounded-xl shadow-lg hover:bg-indigo-700 transition duration-300 focus:outline-none focus:ring-4 focus:ring-indigo-500 focus:ring-opacity-50 flex items-center justify-center">
                                  <i class="fas fa-calendar-plus mr-2"></i> Save Appointment
                              </button>
                              <button type="button" onclick="cancelEditAppointment()" id="appointment-cancel-edit" class="w-full py-2 mt-2 text-indigo-600 border border-indigo-600 font-semibold rounded-xl hover:bg-indigo-50 transition hidden">
                                  Cancel Edit
                              </button>
                          </form>
                      </div>
                  `;
  const form = document.getElementById("appointment-form");
  if (form) {
    document.getElementById("clientName").focus();
  }
  updateAppointmentDuration();

  if (window.state && window.state.editingAppointmentId) {
    const appt = window.state.appointments.find((a) => a.id === window.state.editingAppointmentId);
    if (appt) {
      form.dataset.editingId = appt.id;
      document.getElementById("appointment-form-title").textContent = "Edit Appointment";
      document.getElementById("appointment-submit-btn").innerHTML = '<i class="fas fa-save mr-2"></i> Update Appointment';
      document.getElementById("appointment-cancel-edit").classList.remove("hidden");
      form.clientName.value = appt.clientName || "";
      form.phone.value = appt.phone || "";
      form.date.value = appt.date || defaultDate;
      form.time.value = appt.time || defaultTime;
      form.notes.value = appt.notes || "";
      const rm = Number(appt.reminderMinutes) || 0;
      const sr = document.getElementById("simpleReminder");
      if (sr) {
        const allowed = [0, 15, 30, 60, 1440];
        sr.value = allowed.includes(rm) ? String(rm) : "0";
      }
      if (appt.guestEmails) {
        const el2 = document.getElementById("guestEmails");
        if (el2) el2.value = appt.guestEmails;
      }
      if (Array.isArray(appt.serviceDetails)) {
        const ids = new Set(appt.serviceDetails.map((s) => s.id));
        form.querySelectorAll('input[name="serviceId"]').forEach((cb) => {
          cb.checked = ids.has(cb.value);
        });
        updateAppointmentDuration();
      }
    }
  }
}

function renderServiceManagementView() {
  const container = document.getElementById("service-management-view");
  if (container.classList.contains("hidden")) return;

  let isEditing = null;
  const existingForm = document.getElementById("service-form");
  if (existingForm) {
    isEditing = existingForm.dataset.editingId;
  }

  const servicesList = window.state.services
    .map((service) => {
      const colorKey = service.color || "indigo";
      const c = SERVICE_COLORS[colorKey] || SERVICE_COLORS.indigo;
      return `
                      <div class="bg-white p-4 rounded-xl shadow border border-gray-100 flex justify-between items-center mb-3">
                          <div>
                              <p class="text-lg font-semibold text-gray-800 flex items-center gap-2"><span class="inline-block w-3 h-3 rounded-full ${c.dot}"></span>${service.name}</p>
                              <p class="text-sm text-gray-500"><i class="fas fa-stopwatch text-indigo-400 mr-1"></i> ${service.duration} minutes</p>
                          </div>
                          <div class="flex space-x-2">
                              <button onclick="editService('${service.id}', '${service.name}', ${service.duration}, '${colorKey}')" class="p-2 text-indigo-500 hover:text-indigo-700 transition" title="Edit Service">
                                  <i class="fas fa-edit"></i>
                              </button>
                              <button onclick="deleteService('${service.id}', '${service.name}')" class="p-2 text-red-500 hover:text-red-700 transition" title="Delete Service">
                                  <i class="fas fa-trash-alt"></i>
                              </button>
                          </div>
                      </div>
                  `;
    })
    .join("");

  container.innerHTML = `
                      <div class="p-4">
                          <h2 class="text-2xl font-bold text-gray-800 mb-6" id="service-form-title">${isEditing ? "Edit Service" : "Add New Service"}</h2>

                          <form onsubmit="saveService(event)" id="service-form" class="space-y-4 bg-white p-5 rounded-xl shadow-lg mb-6 border border-indigo-100" ${isEditing ? `data-editing-id="${isEditing}"` : ""}>

                              <div>
                                  <label for="serviceName" class="block text-sm font-medium text-gray-700 mb-1">Service Name <span class="text-red-500">*</span></label>
                                  <input type="text" id="serviceName" name="serviceName" required class="w-full p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition shadow-sm" placeholder="e.g., Haircut, Gel Manicure, Consultation">
                              </div>

                              <div>
                                  <label class="block text-sm font-medium text-gray-700 mb-1">Duration <span class="text-red-500">*</span></label>
                                  <div class="flex gap-2">
                                      <div class="flex-1">
                                          <select id="serviceHours" name="serviceHours" class="w-full p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition shadow-sm">
                                              ${Array.from({ length: 13 }, (_, i) => `<option value="${i}">${i} hours</option>`).join("")}
                                          </select>
                                      </div>
                                      <div class="flex-1">
                                          <select id="serviceMinutes" name="serviceMinutes" class="w-full p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition shadow-sm">
                                              ${[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => `<option value="${m}">${m} minutes</option>`).join("")}
                                          </select>
                                      </div>
                                  </div>
                              </div>

                              <div>
                                  <label for="serviceColor" class="block text-sm font-medium text-gray-700 mb-1">Color <span class="text-red-500">*</span></label>
                                  <select id="serviceColor" name="serviceColor" class="w-full p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition shadow-sm">
                                      <option value="indigo">Indigo</option>
                                      <option value="rose">Rose</option>
                                      <option value="emerald">Emerald</option>
                                      <option value="amber">Amber</option>
                                      <option value="sky">Sky</option>
                                      <option value="violet">Violet</option>
                                      <option value="cyan">Cyan</option>
                                      <option value="pink">Pink</option>
                                      <option value="red">Red</option>
                                      <option value="orange">Orange</option>
                                      <option value="lime">Lime</option>
                                      <option value="teal">Teal</option>
                                      <option value="blue">Blue</option>
                                      <option value="purple">Purple</option>
                                  </select>
                                  <div id="serviceColorPreview" class="mt-2 flex items-center gap-2"></div>
                              </div>

                              <button type="submit" id="service-submit-btn" class="w-full py-3 bg-indigo-600 text-white font-semibold rounded-xl shadow-lg hover:bg-indigo-700 transition duration-300 focus:outline-none focus:ring-4 focus:ring-indigo-500 focus:ring-opacity-50">
                                  ${isEditing ? "Update Service" : "Save Service"}
                              </button>
                              <button type="button" onclick="cancelEditService()" id="service-cancel-edit" class="w-full py-2 mt-2 text-indigo-600 border border-indigo-600 font-semibold rounded-xl hover:bg-indigo-50 transition ${isEditing ? "" : "hidden"}">
                                  Cancel Edit
                              </button>
                          </form>

                          <h3 class="text-XL font-bold text-gray-800 mb-3 border-b pb-2">Defined Services (${window.state.services.length})</h3>
                          <div class="service-list-container max-h-[40vh] overflow-y-auto pr-2">
                              ${window.state.services.length === 0 ? '<p class="text-gray-500 text-center py-5">No services defined yet. Use the form above to get started!</p>' : servicesList}
                          </div>
                      </div>
                  `;

  const form = document.getElementById("service-form");
  if (isEditing && window.state.services.length > 0) {
    const serviceToEdit = window.state.services.find((s) => s.id === isEditing);
    if (serviceToEdit) {
      form.serviceName.value = serviceToEdit.name;
      const d = Number(serviceToEdit.duration) || 0;
      const h = Math.floor(d / 60);
      const m = d % 60;
      if (form.serviceHours) form.serviceHours.value = String(h);
      if (form.serviceMinutes) form.serviceMinutes.value = String(m);
      if (form.serviceColor) form.serviceColor.value = serviceToEdit.color || "indigo";
    }
  } else {
    if (form.serviceHours) form.serviceHours.value = "0";
    if (form.serviceMinutes) form.serviceMinutes.value = "30";
    if (form.serviceColor) form.serviceColor.value = "indigo";
  }

  function updateColorPreview() {
    const key = form.serviceColor.value || "indigo";
    const c = SERVICE_COLORS[key] || SERVICE_COLORS.indigo;
    const preview = document.getElementById("serviceColorPreview");
    preview.innerHTML = `<span class="inline-block w-4 h-4 rounded-full ${c.dot}"></span><span class="text-sm ${c.text}">${key.charAt(0).toUpperCase() + key.slice(1)}</span>`;
  }
  updateColorPreview();
  form.serviceColor.addEventListener("change", updateColorPreview);
}
window.renderServiceManagementView = renderServiceManagementView;

window.onload = initApp;
const __dv = localStorage.getItem('amp-default-view') || 'calendar';
changeView(__dv);
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {
    // ignore registration errors to avoid impacting app usage
  });
}
applyTheme();
initNotifications();
setInterval(() => {
  if (window.state && window.state.currentView === "upcoming") {
    renderUpcomingView();
  }
}, 30000);
// shareOrDownloadPDF now delegates to the Capacitor-backed downloadPDF
window.shareOrDownloadPDF = async function () { return window.downloadPDF(); };
