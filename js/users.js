// Users page: list, filter, add, edit and delete app users, including their mobile numbers.
// Changes are kept in the browser until the backend exists.

(function () {
  const USERS_KEY = "smsReader.users.v2";
  const ROLES = ["All", "Admin", "Editor", "Viewer"];

  let users = loadUsers();
  let roleFilter = "All";
  let query = "";
  let editingId = null;
  let deletingId = null;

  const me = (getUser() || {}).username;

  function loadUsers() {
    try {
      const saved = JSON.parse(localStorage.getItem(USERS_KEY));
      if (Array.isArray(saved)) return saved;
    } catch {
      // fall through to sample data
    }
    return USERS.map((u) => ({ ...u }));
  }

  function storeUsers() {
    try {
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
    } catch {
      // storage unavailable — changes last until the page is closed
    }
  }

  // The signed-in user's numbers are the ones on their linked phones (first one shown, "+2" for the rest)
  function phoneOf(u) {
    if (u.username === me) {
      const linked = getNumbers();
      if (!linked.length) return null;
      const extra = linked.length - 1;
      return { country: linked[0].country, number: linked[0].number, display: numberDisplay(linked[0]) + (extra ? " +" + extra : ""), verified: true };
    }
    if (!u.phoneNumber) return null;
    return { country: u.phoneCountry, number: u.phoneNumber, display: formatPhone(u.phoneCountry, u.phoneNumber), verified: !!u.phoneVerified };
  }

  // ---------- List ----------

  function renderFilters() {
    const box = $("role-filter");
    box.innerHTML = "";
    for (const role of ROLES) {
      const count = role === "All" ? users.length : users.filter((u) => u.role === role).length;
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip" + (role === roleFilter ? " active" : "");
      chip.setAttribute("aria-pressed", role === roleFilter);
      chip.innerHTML = "<span></span><span class=\"chip-count\"></span>";
      chip.firstChild.textContent = role;
      chip.lastChild.textContent = count;
      chip.addEventListener("click", () => {
        roleFilter = role;
        render();
      });
      box.appendChild(chip);
    }
  }

  function matches(u, q) {
    if (!q) return true;
    if ([u.name, u.username, u.email].some((v) => (v || "").toLowerCase().includes(q))) return true;
    const digits = q.replace(/\D/g, "");
    const phone = phoneOf(u);
    return !!(digits && phone && (phone.country + phone.number).replace(/\D/g, "").includes(digits));
  }

  function renderRows() {
    const q = query.toLowerCase();
    const visible = users
      .filter((u) => roleFilter === "All" || u.role === roleFilter)
      .filter((u) => matches(u, q))
      .sort((a, b) => a.name.localeCompare(b.name));

    const tbody = $("user-rows");
    tbody.innerHTML = "";

    if (visible.length === 0) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="6"><div class="no-results">No users found</div></td></tr>';
      return;
    }

    for (const u of visible) {
      const isMe = u.username === me;
      const tr = document.createElement("tr");
      tr.innerHTML =
        '<td><div class="user-cell"><div class="avatar"></div><div class="user-cell-text">' +
          '<strong></strong><small></small></div></div></td>' +
        '<td data-label="Mobile" class="phone-cell"></td>' +
        '<td data-label="Role"><span class="role"></span></td>' +
        '<td data-label="Status"><span class="status"></span></td>' +
        '<td data-label="Last login" class="last-login"></td>' +
        '<td class="row-actions">' +
          '<button type="button" class="icon-btn" data-edit aria-label="Edit">' + ICONS.edit + "</button>" +
          '<button type="button" class="icon-btn danger" data-delete aria-label="Delete">' + ICONS.trash + "</button>" +
        "</td>";

      setAvatar(tr.querySelector(".avatar"), { id: u.id, name: u.name });
      const nameEl = tr.querySelector("strong");
      nameEl.textContent = u.name;
      if (isMe) {
        const tag = document.createElement("span");
        tag.className = "you-tag";
        tag.textContent = "You";
        nameEl.appendChild(tag);
      }
      tr.querySelector("small").textContent = "@" + u.username + (u.email ? " · " + u.email : "");

      // Mobile number + verification state
      const phone = phoneOf(u);
      const phoneCell = tr.querySelector(".phone-cell");
      const wrap = document.createElement("div");
      wrap.className = "phone-wrap";
      const num = document.createElement("span");
      num.className = "phone-num";
      const badge = document.createElement("span");
      if (phone) {
        num.textContent = phone.display;
        badge.className = "verify-badge " + (phone.verified ? "ok" : "pending");
        badge.textContent = phone.verified ? "✓ Verified" : "⏳ Pending";
        badge.title = phone.verified ? "Verified with a one-time code" : "Waiting for the user to verify with a one-time code";
      } else {
        num.textContent = "Not linked";
        num.classList.add("none");
      }
      wrap.append(num);
      if (phone) wrap.append(badge);
      phoneCell.appendChild(wrap);

      const role = tr.querySelector(".role");
      role.textContent = u.role;
      role.classList.add("role-" + u.role.toLowerCase());

      const status = tr.querySelector(".status");
      status.textContent = u.active ? "Active" : "Inactive";
      status.classList.add(u.active ? "on" : "off");

      const last = tr.querySelector(".last-login");
      last.textContent = u.lastLogin ? formatListTime(new Date(u.lastLogin)) : "Never";
      if (u.lastLogin) last.title = new Date(u.lastLogin).toLocaleString();

      const editBtn = tr.querySelector("[data-edit]");
      editBtn.setAttribute("aria-label", "Edit " + u.name);
      editBtn.title = "Edit";
      editBtn.addEventListener("click", () => openUserModal(u.id));

      const delBtn = tr.querySelector("[data-delete]");
      delBtn.setAttribute("aria-label", "Delete " + u.name);
      delBtn.title = isMe ? "You can't delete your own account" : "Delete";
      delBtn.disabled = isMe;
      delBtn.addEventListener("click", () => openDeleteModal(u.id));

      tbody.appendChild(tr);
    }
  }

  function render() {
    const active = users.filter((u) => u.active).length;
    const verified = users.filter((u) => (phoneOf(u) || {}).verified).length;
    $("user-summary").textContent = users.length + " users · " + active + " active · " + verified + " verified numbers";
    renderFilters();
    renderRows();
  }

  // ---------- Add / edit ----------

  const modal = $("user-modal");
  const fields = {
    name: $("u-name"),
    username: $("u-username"),
    email: $("u-email"),
    country: $("u-country"),
    phone: $("u-phone"),
    password: $("u-password"),
    role: $("u-role"),
    active: $("u-active")
  };

  fillCountrySelect(fields.country);
  fields.phone.addEventListener("input", () => {
    fields.phone.value = fields.phone.value.replace(/[^\d\s]/g, "");
  });

  function setFieldError(fieldId, input, errorId, message) {
    $(fieldId).classList.toggle("invalid", !!message);
    $(errorId).textContent = message || "";
    input.setAttribute("aria-invalid", message ? "true" : "false");
  }

  function clearErrors() {
    setFieldError("field-name", fields.name, "u-name-error", "");
    setFieldError("field-uname", fields.username, "u-username-error", "");
    setFieldError("field-uphone", fields.phone, "u-phone-error", "");
    setFieldError("field-uemail", fields.email, "u-email-error", "");
    setFieldError("field-upassword", fields.password, "u-password-error", "");
  }

  function openUserModal(id) {
    editingId = id || null;
    const u = users.find((x) => x.id === id);
    const isMe = !!(u && u.username === me);
    const phone = u ? phoneOf(u) : null;

    $("user-modal-title").textContent = u ? "Edit user" : "Add user";
    $("user-modal-sub").textContent = u ? "Update details for " + u.name + "." : "Give someone access to SMS Reader.";
    $("user-save-btn").textContent = u ? "Save changes" : "Add user";

    fields.name.value = u ? u.name : "";
    fields.username.value = u ? u.username : "";
    fields.email.value = u ? u.email : "";
    fields.country.value = phone ? phone.country : "+91";
    fields.phone.value = phone ? phone.number : "";
    fields.password.value = "";
    fields.password.placeholder = u ? "Leave blank to keep current password" : "At least 4 characters";
    fields.role.value = u ? u.role : "Viewer";
    fields.active.checked = u ? u.active : true;

    // You can't lock yourself out, and your own number changes only through OTP verification
    fields.role.disabled = isMe;
    fields.active.disabled = isMe;
    fields.country.disabled = isMe;
    fields.phone.disabled = isMe;
    const hint = $("u-phone-hint");
    if (isMe) {
      hint.innerHTML = 'Your numbers come from your linked phones. <a class="link" href="devices.html">Manage phones &amp; numbers →</a>';
    } else {
      hint.textContent = phone && phone.verified
        ? "Verified. Changing it means they'll need to verify the new number."
        : "They'll verify it with a one-time code when they sign in.";
    }

    clearErrors();
    openDialog(modal);
    fields.name.focus();
  }

  // Is this number already used by someone else (including the signed-in user's linked number)?
  function numberTaken(country, number) {
    if (getNumbers().some((n) => n.country === country && n.number === number)) return true;
    return users.some((u) => {
      if (u.id === editingId) return false;
      const p = phoneOf(u);
      return p && p.country === country && p.number === number;
    });
  }

  $("user-form").addEventListener("submit", (e) => {
    e.preventDefault();

    const editing = users.find((u) => u.id === editingId);
    const isMe = !!(editing && editing.username === me);

    const name = fields.name.value.trim();
    const username = fields.username.value.trim().toLowerCase();
    const email = fields.email.value.trim();
    const country = fields.country.value;
    const phoneDigits = fields.phone.value.replace(/\D/g, "");
    const password = fields.password.value;

    const nameMsg = name ? "" : "Please enter a name";
    const usernameMsg = !username
      ? "Please enter a username"
      : !/^[a-z0-9._-]{3,}$/.test(username)
        ? "3+ characters: letters, numbers, . _ -"
        : users.some((u) => u.username === username && u.id !== editingId) ? "This username is taken" : "";
    const phoneMsg = isMe || !phoneDigits
      ? ""
      : validatePhone(country, phoneDigits) || (numberTaken(country, phoneDigits) ? "This number belongs to another user" : "");
    const emailMsg = email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? "Please enter a valid email" : "";
    const passwordMsg = !editingId && password.length < 4
      ? "Password must be at least 4 characters"
      : editingId && password && password.length < 4 ? "Password must be at least 4 characters" : "";

    setFieldError("field-name", fields.name, "u-name-error", nameMsg);
    setFieldError("field-uname", fields.username, "u-username-error", usernameMsg);
    setFieldError("field-uphone", fields.phone, "u-phone-error", phoneMsg);
    setFieldError("field-uemail", fields.email, "u-email-error", emailMsg);
    setFieldError("field-upassword", fields.password, "u-password-error", passwordMsg);

    const firstBad = [
      [nameMsg, fields.name], [usernameMsg, fields.username], [phoneMsg, fields.phone],
      [emailMsg, fields.email], [passwordMsg, fields.password]
    ].find(([msg]) => msg);
    if (firstBad) {
      firstBad[1].focus();
      return;
    }

    // Passwords are not stored here — the backend will handle them
    const data = { name, username, email, role: fields.role.value, active: fields.active.checked };

    if (!isMe) {
      // A new or changed number has to be verified again by that user
      const sameNumber = editing && editing.phoneCountry === country && editing.phoneNumber === phoneDigits;
      data.phoneCountry = country;
      data.phoneNumber = phoneDigits;
      data.phoneVerified = sameNumber ? !!editing.phoneVerified : false;
    }

    if (editing) {
      const numberChanged = !isMe && phoneDigits && editing.phoneNumber !== phoneDigits;
      Object.assign(editing, data);
      showToast(numberChanged ? "Saved. " + name + " needs to verify the new number." : "Saved changes to " + name);
    } else {
      users.push({ id: "u" + Date.now(), lastLogin: null, ...data });
      showToast(phoneDigits ? name + " was added. Their number is pending verification." : name + " was added");
    }

    storeUsers();
    modal.close();
    render();
  });

  // ---------- Delete ----------

  const deleteModal = $("delete-modal");

  function openDeleteModal(id) {
    const u = users.find((x) => x.id === id);
    if (!u || u.username === me) return;
    deletingId = id;
    $("delete-text").textContent = u.name + " (@" + u.username + ") will no longer be able to sign in. This can't be undone.";
    openDialog(deleteModal);
  }

  $("delete-confirm-btn").addEventListener("click", () => {
    const u = users.find((x) => x.id === deletingId);
    users = users.filter((x) => x.id !== deletingId);
    storeUsers();
    deleteModal.close();
    render();
    if (u) showToast(u.name + " was deleted");
  });

  // ---------- Init ----------

  wireDialogs();

  document.querySelectorAll("[data-icon]").forEach((el) => { el.innerHTML = ICONS[el.dataset.icon]; });
  $("add-user-btn").addEventListener("click", () => openUserModal(null));
  $("search").addEventListener("input", (e) => {
    query = e.target.value.trim();
    renderRows();
  });

  render();
})();
