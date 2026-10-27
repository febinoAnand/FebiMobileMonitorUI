// Shared helpers used by every page, in both the web view (web/*.html) and the mobile view (mobile/*.html).
// Data comes from CONTACTS / MESSAGES / CALLS (js/data.js).

const $ = (id) => document.getElementById(id);

const AVATAR_COLORS = ["#6366f1", "#e0573f", "#1f9d6b", "#9b51e0", "#e89b17", "#d63f8c", "#0f8fa8"];
const NUMBER_COLORS = ["#10b981", "#6366f1", "#f59e0b", "#ec4899", "#06b6d4", "#8b5cf6"];

// Pages inside web/ and mobile/ set data-root="../" so links back to the root pages work
const ROOT = document.body.dataset.root || "";

// ---------- Storage (UI only — the backend replaces all of this) ----------

function readJSON(storage, key) {
  try {
    return JSON.parse(storage.getItem(key));
  } catch {
    return null;
  }
}

function writeJSON(storage, key, value) {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable (private mode) — ignore
  }
}

function removeKey(storage, key) {
  try {
    storage.removeItem(key);
  } catch {
    // ignore
  }
}

// ---------- View: "web" (sidebar) or "mobile" (bottom tabs) ----------

const VIEW_KEY = "smsReader.view";

// Until someone picks a view, phones get the mobile view and computers the web view
function getView() {
  const v = readJSON(localStorage, VIEW_KEY);
  if (v === "mobile" || v === "web") return v;
  return window.matchMedia("(max-width: 700px), (pointer: coarse) and (max-width: 1024px)").matches ? "mobile" : "web";
}

// True once someone has picked a view on the first page
function hasChosenView() {
  const v = readJSON(localStorage, VIEW_KEY);
  return v === "mobile" || v === "web";
}

function setView(view) {
  writeJSON(localStorage, VIEW_KEY, view === "mobile" ? "mobile" : "web");
}

// The login page of the chosen view (web/login.html or mobile/login.html)
function loginUrl() {
  return appUrl("login.html");
}

// A page inside the app, in the chosen view, from anywhere
function appUrl(page) {
  return ROOT + getView() + "/" + page;
}

// ---------- URLs ----------

function getParam(name) {
  return new URLSearchParams(location.search).get(name);
}

function conversationUrl(contactId) {
  return "conversation.html?id=" + encodeURIComponent(contactId);
}

function contactUrl(contactId) {
  return "contact.html?id=" + encodeURIComponent(contactId);
}

// ---------- Auth ----------

const USER_KEY = "smsReader.user";

// A signed-in session lasts 8 hours, or 30 days with "Remember me" (kept after the browser closes).
// Sessions from older versions have no expiry and count as signed out.
const SESSION_HOURS = 8;
const REMEMBER_DAYS = 30;

function getUser() {
  const user = readJSON(localStorage, USER_KEY) || readJSON(sessionStorage, USER_KEY);
  // Valid until it expires — and only while the account still exists and is active
  // (an admin deleting or deactivating someone signs them out)
  const account = user && getAccounts().find((a) => a.username === user.username);
  if (user && user.expiresAt && Date.now() < user.expiresAt && account && account.active) return user;
  if (user) {
    removeKey(localStorage, USER_KEY);
    removeKey(sessionStorage, USER_KEY);
  }
  return null;
}

function saveUser(user, remember) {
  removeKey(localStorage, USER_KEY);
  removeKey(sessionStorage, USER_KEY);
  const expiresAt = Date.now() + (remember ? REMEMBER_DAYS * 24 : SESSION_HOURS) * 3600 * 1000;
  writeJSON(remember ? localStorage : sessionStorage, USER_KEY, { ...user, expiresAt });
}

// ---------- User directory ----------
// Every account that can sign in (UI only — the backend will store these, with hashed passwords).
// { id, name, username, password, email, country, number, phoneVerified, role: "Admin" | "User", active, createdAt, lastLogin }
// Admins see and manage everyone on the Users page; every user manages themselves on the Profile page.
const ACCOUNTS_KEY = "smsReader.directory";

function getAccounts() {
  const saved = readJSON(localStorage, ACCOUNTS_KEY);
  if (Array.isArray(saved)) return saved;

  // First run: the demo admin, the sample users, and any accounts made by an earlier version
  const now = new Date().toISOString();
  const list = [
    { id: "u1", name: "Admin", username: "admin", password: "admin", email: "admin@smsreader.com", country: "+91", number: "", phoneVerified: false, role: "Admin", active: true, createdAt: now, lastLogin: null },
    ...USERS.filter((u) => u.username !== "admin").map((u) => ({
      id: u.id, name: u.name, username: u.username, password: "password", email: u.email,
      country: u.phoneCountry, number: u.phoneNumber, phoneVerified: !!u.phoneVerified,
      role: "User", active: u.active, createdAt: now, lastLogin: u.lastLogin
    }))
  ];
  for (const old of readJSON(localStorage, "smsReader.accounts") || []) {
    if (list.some((x) => x.username === old.username)) continue;
    list.push({ id: "u" + Date.now() + list.length, name: old.name, username: old.username, password: old.password, email: old.email,
      country: old.country, number: old.number, phoneVerified: true, role: "User", active: true, createdAt: old.createdAt || now, lastLogin: null });
  }
  saveAccounts(list);
  return list;
}

function saveAccounts(list) {
  writeJSON(localStorage, ACCOUNTS_KEY, list);
}

// Find an account by username, email or mobile number
function findAccount(identifier) {
  const id = identifier.trim().toLowerCase();
  const digits = id.replace(/\D/g, "");
  return getAccounts().find((a) =>
    a.username === id || (a.email || "").toLowerCase() === id ||
    (digits.length >= 8 && a.number && (a.number === digits || (a.country + a.number).replace(/\D/g, "") === digits))
  );
}

// The signed-in person's directory entry
function currentAccount() {
  const user = getUser();
  return user ? getAccounts().find((a) => a.username === user.username) || null : null;
}

function isAdmin() {
  const account = currentAccount();
  return !!(account && account.role === "Admin" && account.active);
}

function updateAccount(id, changes) {
  const list = getAccounts();
  const account = list.find((a) => a.id === id);
  Object.assign(account, changes);
  saveAccounts(list);
  return account;
}

// A username change moves that person's phone and settings along with it
function renameUserData(oldName, newName) {
  for (const base of ["smsReader.account", "smsReader.selectedNumber"]) {
    const value = localStorage.getItem(base + "." + oldName);
    if (value === null) continue;
    localStorage.setItem(base + "." + newName, value);
    localStorage.removeItem(base + "." + oldName);
  }
}

// Remove everything stored for a deleted user
function removeUserData(username) {
  for (const base of ["smsReader.account", "smsReader.selectedNumber"]) removeKey(localStorage, base + "." + username);
}

// Password rules shared by sign-up, Users and Profile
function passwordError(password) {
  return password.length < 6 ? "Password must be at least 6 characters" : "";
}

function usernameError(username, ownId) {
  if (!username) return "Please enter a username";
  if (!/^[a-z0-9._-]{3,}$/.test(username)) return "3+ characters: letters, numbers, . _ -";
  if (getAccounts().some((a) => a.username === username && a.id !== ownId)) return "This username is taken";
  return "";
}

// Six one-digit boxes that move along as you type, accept paste, and submit the form when full.
// autofill() fills them from the incoming SMS by itself (see below).
function setupOtpBoxes(container, form) {
  for (let i = 0; i < 6; i++) {
    const input = document.createElement("input");
    input.type = "text";
    input.inputMode = "numeric";
    input.maxLength = 1;
    input.autocomplete = i === 0 ? "one-time-code" : "off";
    input.setAttribute("aria-label", "Digit " + (i + 1));
    container.appendChild(input);
  }
  const inputs = [...container.querySelectorAll("input")];

  const fillFrom = (index, text) => {
    const digits = text.replace(/\D/g, "").slice(0, 6 - index).split("");
    digits.forEach((d, k) => {
      inputs[index + k].value = d;
      inputs[index + k].classList.add("filled");
    });
    inputs[Math.min(index + digits.length, 5)].focus();
    if (inputs.every((inp) => inp.value)) form.requestSubmit();
  };

  let autofillRun = 0; // bumped to cancel an autofill that is still running
  const markTyped = () => { autofillRun++; };

  inputs.forEach((input, i) => {
    input.addEventListener("keydown", markTyped);
    input.addEventListener("input", () => {
      const value = input.value.replace(/\D/g, "");
      input.value = "";
      input.classList.remove("filled");
      if (value) fillFrom(i, value);
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" && !input.value && i > 0) {
        inputs[i - 1].value = "";
        inputs[i - 1].classList.remove("filled");
        inputs[i - 1].focus();
        e.preventDefault();
      } else if (e.key === "ArrowLeft" && i > 0) {
        inputs[i - 1].focus();
      } else if (e.key === "ArrowRight" && i < 5) {
        inputs[i + 1].focus();
      }
    });
    input.addEventListener("paste", (e) => {
      e.preventDefault();
      fillFrom(i, (e.clipboardData || window.clipboardData).getData("text"));
    });
    input.addEventListener("focus", () => input.select());
  });

  const clear = () => inputs.forEach((inp) => { inp.value = ""; inp.classList.remove("filled", "autofilled"); });

  // Types the code in digit by digit, then verifies
  async function typeIn(code, run) {
    clear();
    for (let i = 0; i < 6; i++) {
      if (run !== autofillRun) return;
      inputs[i].value = code[i];
      inputs[i].classList.add("filled", "autofilled");
      await new Promise((r) => setTimeout(r, 90));
    }
    if (run === autofillRun) form.requestSubmit();
  }

  // Fill the code from the SMS without typing:
  //  - Android Chrome: the WebOTP API reads the SMS once the user taps Allow. The backend SMS must end with
  //    "@<your domain> #<code>" on its own line, e.g. a last line of "@smsreader.app #123456".
  //  - iPhone: autocomplete="one-time-code" on the first box offers the code above the keyboard.
  //  - This demo (no real SMS): an SMS notification appears and the code fills in by itself.
  function autofill(code) {
    const run = ++autofillRun;
    if ("OTPCredential" in window && location.protocol === "https:") {
      const abort = new AbortController();
      form.addEventListener("submit", () => abort.abort(), { once: true });
      navigator.credentials.get({ otp: { transport: ["sms"] }, signal: abort.signal })
        .then((otp) => { if (otp && otp.code) typeIn(otp.code, run); })
        .catch(() => { /* cancelled or not allowed: typing still works */ });
    }
    if (code) {
      setTimeout(() => {
        if (run !== autofillRun) return;
        showSmsNotification(code);
        setTimeout(() => typeIn(code, run), 1100);
      }, 1200);
    }
  }

  return {
    code: () => inputs.map((inp) => inp.value).join(""),
    clear: () => { autofillRun++; clear(); },
    focus: (index = 0) => inputs[index].focus(),
    autofill
  };
}

// A phone-style "new message" banner at the top of the screen (inside the phone frame in the mobile view)
function showSmsNotification(code) {
  let note = document.querySelector(".sms-note");
  if (!note) {
    note = document.createElement("div");
    note.className = "sms-note";
    note.setAttribute("role", "status");
    note.innerHTML = '<span class="sms-note-icon">' + ICONS.messages + '</span><div><strong>Messages · now</strong><span class="sms-note-text"></span></div>';
    (document.querySelector(".m-phone, .auth-card") || document.body).appendChild(note);
  }
  note.querySelector(".sms-note-text").textContent = code + " is your SMS Reader verification code. Don't share it with anyone.";
  note.classList.remove("show");
  void note.offsetWidth;
  note.classList.add("show");
  clearTimeout(showSmsNotification.timer);
  showSmsNotification.timer = setTimeout(() => note.classList.remove("show"), 3600);
}

// Counts down before "Resend code" can be used again
function startResendTimer(button, label, seconds = 30) {
  let left = seconds;
  button.disabled = true;
  label.textContent = "in " + left + "s";
  clearInterval(startResendTimer.timer);
  startResendTimer.timer = setInterval(() => {
    left -= 1;
    label.textContent = left > 0 ? "in " + left + "s" : "";
    if (left <= 0) {
      clearInterval(startResendTimer.timer);
      button.disabled = false;
    }
  }, 1000);
}

function logout() {
  removeKey(localStorage, USER_KEY);
  removeKey(sessionStorage, USER_KEY);
  location.href = loginUrl();
}

// ---------- My phone and its SIMs ----------
// One login = one phone. The phone holds SIM 1 and, if it is dual SIM, SIM 2.
// account: { seq, devices: [{ id, name, type: "android" | "iphone", addedAt, app }],   (at most one phone)
//            numbers: [{ id, deviceId, slot: 1 | 2, country, number, label, verifiedAt }] }

const ACCOUNT_KEY = "smsReader.account";
const SELECTED_KEY = "smsReader.selectedNumber";

// Each login keeps its own phone, so several people can use the same browser
function accountKey(base) {
  const user = getUser();
  return user && user.username ? base + "." + user.username : base;
}

function getAccount() {
  const saved = readJSON(localStorage, accountKey(ACCOUNT_KEY));
  if (saved && Array.isArray(saved.devices) && Array.isArray(saved.numbers)) {
    // Earlier versions allowed several phones per login: keep the first one
    if (saved.devices.length > 1) {
      const keep = saved.devices[0];
      saved.devices = [keep];
      saved.numbers = saved.numbers.filter((n) => n.deviceId === keep.id);
      saveAccount(saved);
    }
    return saved;
  }

  // The first version linked a single number; carry it over as this account's phone
  const old = readJSON(localStorage, "smsReader.phone");
  if (old && old.number) {
    const migrated = {
      seq: 1,
      devices: [{ id: "d1", name: "My phone", type: "android", addedAt: old.verifiedAt || new Date().toISOString() }],
      numbers: [{ id: "n1", deviceId: "d1", slot: 1, country: old.country, number: old.number, label: "Personal", verifiedAt: old.verifiedAt || new Date().toISOString() }]
    };
    saveAccount(migrated);
    removeKey(localStorage, "smsReader.phone");
    return migrated;
  }
  return { seq: 0, devices: [], numbers: [] };
}

function saveAccount(account) {
  writeJSON(localStorage, accountKey(ACCOUNT_KEY), account);
}

// The account's phone, or null before it is set up
function getPhone() {
  return getAccount().devices[0] || null;
}

function getDevices() {
  return getAccount().devices;
}

// The phone's SIMs in slot order
function getNumbers() {
  return getAccount().numbers.slice().sort((a, b) => a.slot - b.slot);
}

function numberById(id) {
  return getNumbers().find((n) => n.id === id);
}

function deviceById(id) {
  return getDevices().find((d) => d.id === id);
}

function numberDisplay(n) {
  return formatPhone(n.country, n.number);
}

// SIM 1 green, SIM 2 indigo — the same colours everywhere
function numberColor(id) {
  const n = numberById(id);
  return NUMBER_COLORS[n && n.slot === 2 ? 1 : 0];
}

// SIMs whose messages and calls are shown (all of the phone's SIMs once signed in)
function readableNumbers() {
  return getNumbers();
}

// "All numbers", or the one number picked in the switcher
function getSelectedNumberId() {
  const id = readJSON(localStorage, accountKey(SELECTED_KEY));
  return id && readableNumbers().some((n) => n.id === id) ? id : "all";
}

function setSelectedNumberId(id) {
  writeJSON(localStorage, accountKey(SELECTED_KEY), id);
}

function activeNumberIds() {
  const selected = getSelectedNumberId();
  return selected === "all" ? readableNumbers().map((n) => n.id) : [selected];
}

// Show which number a message/call used only when several numbers are on screen together
function showNumberTags() {
  return getSelectedNumberId() === "all" && readableNumbers().length > 1;
}

function numberTag(numberId) {
  const n = numberById(numberId);
  const tag = document.createElement("span");
  tag.className = "num-tag";
  if (!n) return tag;
  tag.textContent = n.label + " · SIM " + n.slot;
  tag.title = numberDisplay(n);
  tag.style.setProperty("--num-color", numberColor(n.id));
  return tag;
}

// ---------- Data ----------

function getContact(id) {
  return CONTACTS.find((c) => c.id === id);
}

function visibleMessages() {
  const ids = activeNumberIds();
  return MESSAGES.filter((m) => ids.includes(m.numberId));
}

function messagesFor(contactId) {
  return visibleMessages()
    .filter((m) => m.contactId === contactId)
    .sort((a, b) => new Date(a.time) - new Date(b.time));
}

function visibleCalls() {
  const ids = activeNumberIds();
  return CALLS.filter((c) => ids.includes(c.numberId)).sort((a, b) => new Date(b.time) - new Date(a.time));
}

function callsFor(contactId) {
  return visibleCalls().filter((c) => c.contactId === contactId);
}

// Contacts that texted or called the numbers on screen
function contactsInView() {
  const ids = new Set([...visibleMessages(), ...visibleCalls()].map((x) => x.contactId));
  return CONTACTS.filter((c) => ids.has(c.id));
}

// Read status is kept in the browser until the backend exists
const READ_KEY = "smsReader.readIds";

function loadReadIds() {
  return new Set(readJSON(localStorage, READ_KEY) || []);
}

function isUnread(message) {
  return message.direction === "in" && !message.read && !loadReadIds().has(message.id);
}

function markRead(messages) {
  const ids = loadReadIds();
  messages.forEach((m) => ids.add(m.id));
  writeJSON(localStorage, READ_KEY, [...ids]);
}

// ---------- Calls ----------

const CALL_TYPES = {
  incoming: { label: "Incoming", icon: "callIn" },
  outgoing: { label: "Outgoing", icon: "callOut" },
  missed: { label: "Missed", icon: "callMissed" },
  rejected: { label: "Rejected", icon: "callRejected" }
};

// 905 -> "15m 5s"; 0 -> "—"
function formatDuration(seconds) {
  if (!seconds) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h) return h + "h " + m + "m";
  if (m) return m + "m" + (s ? " " + s + "s" : "");
  return s + "s";
}

function isMissedToday(call) {
  return call.type === "missed" && isSameDay(new Date(call.time), new Date());
}

// ---------- Phone numbers ----------

const COUNTRIES = [
  { code: "+91", name: "India", flag: "🇮🇳", digits: 10 },
  { code: "+1", name: "USA / Canada", flag: "🇺🇸", digits: 10 },
  { code: "+44", name: "United Kingdom", flag: "🇬🇧", digits: 10 },
  { code: "+971", name: "UAE", flag: "🇦🇪", digits: 9 },
  { code: "+65", name: "Singapore", flag: "🇸🇬", digits: 8 }
];

function fillCountrySelect(select) {
  for (const c of COUNTRIES) {
    const opt = document.createElement("option");
    opt.value = c.code;
    opt.textContent = c.flag + " " + c.code;
    opt.title = c.name;
    select.appendChild(opt);
  }
}

// Groups digits for display, e.g. +91 98765 43210
function formatPhone(code, digits) {
  const groups = { 10: code === "+91" ? [5, 5] : [3, 3, 4], 9: [2, 3, 4], 8: [4, 4] }[digits.length] || [digits.length];
  let i = 0;
  return code + " " + groups.map((n) => digits.slice(i, (i += n))).join(" ");
}

// Returns an error message, or "" when the number is valid
function validatePhone(code, digits) {
  const c = COUNTRIES.find((x) => x.code === code);
  if (!digits) return "Please enter a mobile number";
  if (digits.length !== c.digits) return "A " + c.name + " number has " + c.digits + " digits";
  if (code === "+91" && !/^[6-9]/.test(digits)) return "Indian mobile numbers start with 6, 7, 8 or 9";
  return "";
}

// ---------- Page guards ----------
// Opening a web/ or mobile/ page makes that the remembered view.
// App pages (data-nav) need a signed-in user. Once signed in, everything is open straight away.

if (document.body.dataset.view) setView(document.body.dataset.view);

if (document.body.dataset.nav && !getUser()) {
  location.replace(loginUrl());
}

if (document.body.dataset.nav) {
  // Back/forward can show a cached page: check the session again when it comes back
  window.addEventListener("pageshow", () => {
    if (!getUser()) location.replace(loginUrl());
  });
  // Logging out (or the session ending) in another tab closes this one too
  window.addEventListener("storage", (e) => {
    if (e.key === USER_KEY && !getUser()) location.replace(loginUrl());
  });
  // A session that runs out while the page is open
  setInterval(() => {
    if (!getUser()) location.replace(loginUrl());
  }, 60 * 1000);
}

// The account's phone comes from its mobile number: SIM 1 is the number used to sign up.
// (The demo admin account gets a dual SIM phone so both SIMs can be tried.)
function ensurePhone(user) {
  if (!user || getPhone()) return;
  const now = new Date().toISOString();
  const sims = user.number
    ? [{ country: user.country, number: user.number, label: "Personal" }]
    : [{ country: "+91", number: "9876543210", label: "Personal" }, { country: "+91", number: "9123400001", label: "Work" }];
  saveAccount({
    seq: sims.length,
    devices: [{ id: "d1", name: "My phone", type: "android", addedAt: now }],
    numbers: sims.map((s, i) => ({ id: "n" + (i + 1), deviceId: "d1", slot: i + 1, country: s.country, number: s.number, label: s.label, verifiedAt: now }))
  });
}
ensurePhone(getUser());

// Where to go after signing in or creating an account
function afterLoginUrl() {
  ensurePhone(getUser());
  return appUrl("dashboard.html");
}

// ---------- Display ----------

function displayName(contact) {
  return contact.name || contact.phone;
}

function initials(contact) {
  if (!contact.name) return "#";
  return contact.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function avatarColor(contact) {
  let hash = 0;
  for (const ch of contact.id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function createAvatar(contact, className = "avatar") {
  const el = document.createElement("div");
  el.className = className;
  setAvatar(el, contact);
  return el;
}

function setAvatar(el, contact) {
  el.textContent = initials(contact);
  el.style.background = avatarColor(contact);
}

// ---------- Dates ----------

function isSameDay(a, b) {
  return a.toDateString() === b.toDateString();
}

function relativeDay(date) {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, now)) return "Today";
  if (isSameDay(date, yesterday)) return "Yesterday";
  return null;
}

// "Today", "Yesterday", "This week" or "Earlier"
function dayBucket(date) {
  const rel = relativeDay(date);
  if (rel) return rel;
  const weekAgo = new Date();
  weekAgo.setHours(0, 0, 0, 0);
  weekAgo.setDate(weekAgo.getDate() - 6);
  return date >= weekAgo ? "This week" : "Earlier";
}

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatDate(date) {
  return date.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}

// Short label for lists: time today, "Yesterday", or date
function formatListTime(date) {
  const rel = relativeDay(date);
  if (rel === "Today") return formatTime(date);
  if (rel) return rel;
  return date.toLocaleDateString([], { day: "numeric", month: "short" });
}

function formatDayDivider(date) {
  return relativeDay(date) ||
    date.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

// ---------- Icons ----------

const svg = (body, width = 2) =>
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + width + '" stroke-linecap="round" stroke-linejoin="round">' + body + "</svg>";

const ICONS = {
  logo: svg('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 12h.01M12 12h.01M15.5 12h.01"/>', 2.2),
  dashboard: svg('<rect x="3" y="3" width="7" height="9" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/><rect x="3" y="16" width="7" height="5" rx="2"/>'),
  messages: svg('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>'),
  contacts: svg('<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M16 4a4 4 0 0 1 0 8"/><path d="M22 21a7 7 0 0 0-4-6.3"/>'),
  unread: svg('<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z"/>'),
  today: svg('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>'),
  call: svg('<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>'),
  calls: svg('<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>'),
  callIn: svg('<path d="M17 7 7 17"/><path d="M15 17H7V9"/>', 2.4),
  callOut: svg('<path d="M7 17 17 7"/><path d="M9 7h8v8"/>', 2.4),
  callMissed: svg('<path d="m4 7 6 6 4-4 6 6"/><path d="M20 10v5h-5"/>', 2.4),
  callRejected: svg('<circle cx="12" cy="12" r="9"/><path d="m5.7 5.7 12.6 12.6"/>', 2.2),
  download: svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>'),
  clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  phone: svg('<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/>'),
  devices: svg('<rect x="3" y="4" width="11" height="17" rx="2"/><path d="M8 17h1"/><rect x="15" y="8" width="6" height="13" rx="1.5"/>'),
  sim: svg('<path d="M7 2h7l5 5v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><rect x="8" y="11" width="8" height="7" rx="1"/>'),
  android: svg('<rect x="5" y="2" width="14" height="20" rx="3"/><path d="M10 5h4"/><circle cx="12" cy="18" r="1"/>'),
  iphone: svg('<rect x="5" y="2" width="14" height="20" rx="4"/><path d="M10 4.5h4"/><path d="M10 19h4"/>'),
  monitor: svg('<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>'),
  menu: svg('<path d="M4 6h16M4 12h16M4 18h16"/>'),
  close: svg('<path d="M18 6 6 18M6 6l12 12"/>'),
  back: svg('<path d="M19 12H5M11 19l-7-7 7-7"/>'),
  chevron: svg('<path d="m9 18 6-6-6-6"/>'),
  profile: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
  key: svg('<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.8-9.8"/><path d="m17 6 3 3"/><path d="m15 8 2 2"/>'),
  users: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 11-7.4"/><path d="M19 15v6M16 18h6"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>', 2.4),
  edit: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
  trash: svg('<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>'),
  logout: svg('<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 17l-5-5 5-5"/><path d="M5 12h11"/>')
};

// ---------- Navigation (same items in the web sidebar and the mobile tabs/menu) ----------

// Menu items; adminOnly ones are shown to admins only
const NAV_SECTIONS = [
  {
    title: "Menu",
    items: [
      { nav: "dashboard", href: "dashboard.html", label: "Dashboard", tab: "Home", icon: "dashboard" },
      { nav: "messages", href: "messages.html", label: "Messages", tab: "Messages", icon: "messages" },
      { nav: "calls", href: "calls.html", label: "Calls", tab: "Calls", icon: "calls" },
      { nav: "contacts", href: "contacts.html", label: "Contacts", tab: "Contacts", icon: "contacts" }
    ]
  },
  {
    title: "Manage",
    items: [
      { nav: "devices", href: "devices.html", label: "My phone", icon: "phone" },
      { nav: "profile", href: "profile.html", label: "Profile", icon: "profile" },
      { nav: "users", href: "users.html", label: "Users", icon: "users", adminOnly: true }
    ]
  }
];

function navBadgeCount(nav) {
  if (nav === "messages") return visibleMessages().filter(isUnread).length;
  if (nav === "calls") return visibleCalls().filter(isMissedToday).length;
  return 0;
}

// The same page in the other view, e.g. web/calls.html <-> mobile/calls.html
function otherViewUrl() {
  const other = getView() === "mobile" ? "web" : "mobile";
  return ROOT + other + "/" + location.pathname.split("/").pop() + location.search;
}

// SIM switcher: both SIMs together, or one SIM at a time
function buildNumberSelect(select) {
  const numbers = readableNumbers();
  const selected = getSelectedNumberId();
  select.innerHTML = "";

  const all = document.createElement("option");
  all.value = "all";
  all.textContent = numbers.length === 0 ? "Phone not set up"
    : numbers.length === 1 ? numberDisplay(numbers[0]) : "Both SIMs";
  select.appendChild(all);

  if (numbers.length > 1) {
    numbers.forEach((n) => {
      const opt = document.createElement("option");
      opt.value = n.id;
      opt.textContent = "SIM " + n.slot + " · " + n.label + " (" + numberDisplay(n) + ")";
      select.appendChild(opt);
    });
  }

  select.value = selected;
  select.disabled = numbers.length < 2;
  select.addEventListener("change", () => {
    setSelectedNumberId(select.value);
    location.reload();
  });
}

function selectedNumberCaption() {
  const numbers = readableNumbers();
  const selected = numberById(getSelectedNumberId());
  if (selected) return "SIM " + selected.slot + " · " + selected.label;
  if (numbers.length === 1) return "SIM 1 · " + numbers[0].label;
  if (numbers.length === 0) return getView() === "mobile" ? "Set up this phone" : "Install the app";
  return "Viewing both SIMs";
}

function fillLinkedNumberText() {
  const numbers = readableNumbers();
  const selected = numberById(getSelectedNumberId());
  const text = selected
    ? numberDisplay(selected)
    : numbers.length === 1 ? numberDisplay(numbers[0]) : "both SIMs";
  document.querySelectorAll("[data-linked-number]").forEach((el) => { el.textContent = text; });
}

function currentUserInfo() {
  const user = getUser() || { name: "Guest", username: "" };
  return { name: user.name, handle: user.username || user.email || "" };
}

// ---------- Web view: sidebar ----------

function renderSidebar() {
  const sidebar = $("sidebar");
  if (!sidebar) return;

  const current = document.body.dataset.nav;
  const { name, handle } = currentUserInfo();

  sidebar.innerHTML =
    '<a class="brand" href="dashboard.html"><span class="brand-logo">' + ICONS.logo + '</span><span class="brand-name">SMS Reader</span></a>' +
    '<div class="number-switch">' +
      '<a class="phone-chip-icon" href="devices.html" title="My phone">' + ICONS.phone + "</a>" +
      '<label class="number-switch-text"><small id="ns-caption"></small><select id="number-select" aria-label="Number to view"></select></label>' +
    "</div>" +
    NAV_SECTIONS.map((section) =>
      '<div class="nav-section">' + section.title + "</div>" +
      section.items.filter((item) => !item.adminOnly || isAdmin()).map((item) => {
        const count = navBadgeCount(item.nav);
        return '<a class="nav-link' + (item.nav === current ? ' active" aria-current="page' : "") + '" href="' + item.href + '" title="' + item.label + '" data-nav-link="' + item.nav + '">' +
          ICONS[item.icon] + '<span class="nav-label">' + item.label + "</span>" +
          (item.nav === "messages" || item.nav === "calls" ? '<span class="nav-badge"' + (count ? "" : " hidden") + ">" + count + "</span>" : "") +
        "</a>";
      }).join("")
    ).join("") +
    '<div class="sidebar-footer">' +
      '<div class="avatar" id="user-avatar"></div>' +
      '<div class="user-info"><span class="user-name" id="user-name"></span><span class="user-email" id="user-email"></span></div>' +
      '<a class="icon-btn view-btn" id="switch-view" href="#" title="Mobile view" aria-label="Switch to mobile view">' + ICONS.phone + "</a>" +
      '<button class="icon-btn logout-btn" id="logout-btn" title="Log out" aria-label="Log out">' + ICONS.logout + "</button>" +
    "</div>";

  // User details go in as text, never HTML
  setAvatar($("user-avatar"), { id: handle || "guest", name });
  $("user-name").textContent = name;
  $("user-email").textContent = handle ? "@" + handle : "";
  $("ns-caption").textContent = selectedNumberCaption();
  buildNumberSelect($("number-select"));
  $("switch-view").href = otherViewUrl();
  $("logout-btn").addEventListener("click", logout);

  // Phone-width web view: the sidebar slides in as a drawer
  const backdrop = document.createElement("div");
  backdrop.className = "sidebar-backdrop";
  document.body.appendChild(backdrop);

  const setOpen = (open) => document.body.classList.toggle("nav-open", open);
  document.querySelectorAll("[data-menu]").forEach((btn) =>
    btn.addEventListener("click", () => setOpen(!document.body.classList.contains("nav-open")))
  );
  backdrop.addEventListener("click", () => setOpen(false));
  sidebar.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => setOpen(false)));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setOpen(false);
  });
}

// ---------- Mobile view: top bar, bottom tabs and "More" menu ----------

function renderMobileShell() {
  const tabbar = $("m-tabbar");
  if (!tabbar) return;

  const current = document.body.dataset.nav;
  const { name, handle } = currentUserInfo();
  const tabs = NAV_SECTIONS[0].items;

  // Top bar: logo, number switcher, avatar (opens the menu)
  const topbar = $("m-topbar");
  if (topbar) {
    topbar.innerHTML =
      '<a class="m-brand" href="dashboard.html" aria-label="Home"><span class="brand-logo">' + ICONS.logo + "</span></a>" +
      '<label class="m-number"><span class="m-number-dot"></span><span class="m-number-text"><small id="ns-caption"></small><select id="number-select" aria-label="Number to view"></select></span></label>' +
      '<button type="button" class="m-avatar" data-more aria-label="Open menu"><span class="avatar" id="user-avatar"></span></button>';
    setAvatar($("user-avatar"), { id: handle || "guest", name });
    $("ns-caption").textContent = selectedNumberCaption();
    buildNumberSelect($("number-select"));
    const sel = numberById(getSelectedNumberId());
    topbar.querySelector(".m-number-dot").style.background = sel ? numberColor(sel.id) : "var(--gradient)";
    // Chat/contact headers stick just below the top bar
    document.documentElement.style.setProperty("--m-topbar-h", topbar.offsetHeight + "px");
  }

  tabbar.innerHTML =
    tabs.map((item) => {
      const count = navBadgeCount(item.nav);
      return '<a class="m-tab' + (item.nav === current ? ' active" aria-current="page' : "") + '" href="' + item.href + '" data-nav-link="' + item.nav + '">' +
        '<span class="m-tab-ic">' + ICONS[item.icon] + (count ? '<span class="m-tab-badge">' + count + "</span>" : "") + "</span>" + item.tab +
      "</a>";
    }).join("") +
    '<button type="button" class="m-tab' + (tabs.some((t) => t.nav === current) ? "" : " active") + '" data-more><span class="m-tab-ic">' + ICONS.menu + "</span>More</button>";

  // "More" menu: everything that isn't a tab, plus view switch and logout
  const sheet = document.createElement("div");
  sheet.className = "m-sheet";
  sheet.id = "more-menu";
  sheet.innerHTML =
    '<div class="m-sheet-backdrop" data-close-sheet></div>' +
    '<div class="m-sheet-panel" role="dialog" aria-modal="true" aria-label="Menu">' +
      '<div class="m-sheet-grip"></div>' +
      '<div class="m-sheet-user"><span class="avatar" id="sheet-avatar"></span><span><strong id="sheet-name"></strong><small id="sheet-handle"></small></span>' +
        '<button type="button" class="icon-btn" data-close-sheet aria-label="Close menu">' + ICONS.close + "</button></div>" +
      NAV_SECTIONS.map((section) =>
        '<p class="m-sheet-title">' + section.title + "</p>" +
        section.items.filter((item) => !item.adminOnly || isAdmin()).map((item) =>
          '<a class="m-sheet-link' + (item.nav === current ? " active" : "") + '" href="' + item.href + '">' + ICONS[item.icon] + "<span>" + item.label + "</span>" + ICONS.chevron + "</a>"
        ).join("")
      ).join("") +
      '<p class="m-sheet-title">App</p>' +
      '<a class="m-sheet-link" id="switch-view" href="#">' + ICONS.monitor + "<span>Web view</span>" + ICONS.chevron + "</a>" +
      '<button type="button" class="m-sheet-link danger" id="logout-btn">' + ICONS.logout + "<span>Log out</span></button>" +
    "</div>";
  (document.querySelector(".m-phone") || document.body).appendChild(sheet);

  setAvatar($("sheet-avatar"), { id: handle || "guest", name });
  $("sheet-name").textContent = name;
  $("sheet-handle").textContent = handle ? "@" + handle : "";
  $("switch-view").href = otherViewUrl();
  $("logout-btn").addEventListener("click", logout);

  const setOpen = (open) => sheet.classList.toggle("open", open);
  document.querySelectorAll("[data-more]").forEach((btn) => btn.addEventListener("click", () => setOpen(true)));
  sheet.querySelectorAll("[data-close-sheet]").forEach((el) => el.addEventListener("click", () => setOpen(false)));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setOpen(false);
  });
}

// Keeps the unread / missed badges in step after a page changes them
function refreshNavBadges() {
  document.querySelectorAll("[data-nav-link]").forEach((link) => {
    const count = navBadgeCount(link.dataset.navLink);
    const badge = link.querySelector(".nav-badge, .m-tab-badge");
    if (!badge) return;
    badge.textContent = count;
    badge.hidden = count === 0;
  });
}

// ---------- Shared UI ----------

// One row of a call log. The row opens the contact; the phone button calls back.
function createCallItem(call, { showContact = true, groupedByDay = false } = {}) {
  const contact = getContact(call.contactId);
  const type = CALL_TYPES[call.type];
  const date = new Date(call.time);

  const li = document.createElement("li");
  li.className = "call-item call-" + call.type;

  const link = document.createElement("a");
  link.className = "call-row";
  link.href = contactUrl(contact.id);

  const lead = document.createElement("span");
  lead.className = "call-lead" + (showContact ? "" : " solo");
  if (showContact) lead.appendChild(createAvatar(contact));
  const typeIcon = document.createElement("span");
  typeIcon.className = "call-type-icon";
  typeIcon.innerHTML = ICONS[type.icon];
  typeIcon.title = type.label;
  lead.appendChild(typeIcon);

  const main = document.createElement("span");
  main.className = "call-main";
  const top = document.createElement("span");
  top.className = "call-top";
  const name = document.createElement("span");
  name.className = "call-name";
  name.textContent = showContact ? displayName(contact) : type.label + " call";
  top.appendChild(name);
  if (showNumberTags()) top.appendChild(numberTag(call.numberId));

  const status = document.createElement("span");
  status.className = "call-status";
  status.textContent = call.type === "missed" ? "Missed call"
    : call.type === "rejected" ? "Rejected"
    : type.label + " · " + formatDuration(call.duration);
  main.append(top, status);

  const time = document.createElement("span");
  time.className = "call-time";
  time.textContent = groupedByDay ? formatTime(date) : formatListTime(date);
  time.title = date.toLocaleString();

  link.append(lead, main, time);
  li.appendChild(link);

  const isPhoneNumber = /^\+?[\d\s()-]+$/.test(contact.phone);
  const back = document.createElement("a");
  back.className = "icon-btn call-back" + (isPhoneNumber ? "" : " disabled");
  back.innerHTML = ICONS.call;
  back.title = "Call " + displayName(contact);
  back.setAttribute("aria-label", "Call " + displayName(contact));
  if (isPhoneNumber) back.href = "tel:" + contact.phone.replace(/\s/g, "");
  else back.setAttribute("aria-disabled", "true");
  li.appendChild(back);

  return li;
}

function renderNotFound(card, text) {
  card.innerHTML = "";
  const box = document.createElement("div");
  box.className = "not-found";
  box.innerHTML = "<div><p></p><p style=\"margin-top:12px\"><a href=\"messages.html\">← Back to messages</a></p></div>";
  box.querySelector("p").textContent = text;
  card.appendChild(box);
}

// Back button: return to the previous page if it was ours, otherwise use the link's href
function wireBackButton(el) {
  el.addEventListener("click", (e) => {
    if (document.referrer && new URL(document.referrer).origin === location.origin && history.length > 1) {
      e.preventDefault();
      history.back();
    }
  });
}

// Small message that pops up at the bottom of the screen (inside the phone frame in the mobile view)
function showToast(text) {
  let toast = document.querySelector(".toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    toast.setAttribute("role", "status");
    (document.querySelector(".m-phone") || document.body).appendChild(toast);
  }
  toast.textContent = text;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2600);
}

// Dialogs: centred pop-ups on the web; bottom sheets that stay inside the phone frame on mobile
function openDialog(dialog) {
  const phone = document.querySelector(".m-phone");
  if (!phone) {
    dialog.showModal();
    return;
  }
  dialog.show();
  phone.classList.add("dialog-open");
}

function wireDialogs() {
  document.querySelectorAll("dialog").forEach((dlg) => {
    dlg.querySelectorAll("[data-close]").forEach((btn) => btn.addEventListener("click", () => dlg.close()));
    // Click on the dimmed area outside the card closes it
    dlg.addEventListener("click", (e) => {
      if (e.target === dlg) dlg.close();
    });
    dlg.addEventListener("close", () => {
      const phone = document.querySelector(".m-phone");
      if (phone && !document.querySelector("dialog[open]")) phone.classList.remove("dialog-open");
    });
  });
  const shade = document.querySelector(".m-dialog-shade");
  if (shade) {
    shade.addEventListener("click", () => document.querySelectorAll("dialog[open]").forEach((d) => d.close()));
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") document.querySelectorAll("dialog[open]").forEach((d) => d.close());
  });
}

// Runs after the page's own script, so badges include anything it just marked read
document.addEventListener("DOMContentLoaded", () => {
  renderSidebar();
  renderMobileShell();
  fillLinkedNumberText();
});
