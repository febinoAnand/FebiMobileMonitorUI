// Users page (admins only): every account in the user directory — add, edit, reset password,
// activate / deactivate and delete. Everyone else manages their own account on the Profile page.

(function () {
  if (!isAdmin()) {
    location.replace("profile.html");
    return;
  }

  const ROLES = ["All", "Admin", "User"];

  let roleFilter = "All";
  let query = "";
  let editingId = null;
  let deletingId = null;

  const me = (getUser() || {}).username;
  const users = () => getAccounts();

  // The signed-in admin's numbers are the SIMs in their phone (SIM 1 shown, "+1" when there is a SIM 2)
  function phoneOf(u) {
    if (u.username === me) {
      const linked = getNumbers();
      if (!linked.length) return null;
      const extra = linked.length - 1;
      return { country: linked[0].country, number: linked[0].number, display: numberDisplay(linked[0]) + (extra ? " +" + extra : ""), verified: true };
    }
    if (!u.number) return null;
    return { country: u.country, number: u.number, display: formatPhone(u.country, u.number), verified: !!u.phoneVerified };
  }

  // ---------- List ----------

  function renderFilters() {
    const box = $("role-filter");
    box.innerHTML = "";
    for (const role of ROLES) {
      const count = role === "All" ? users().length : users().filter((u) => u.role === role).length;
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
    const visible = users()
      .filter((u) => roleFilter === "All" || u.role === roleFilter)
      .filter((u) => matches(u, q))
      .sort((a, b) => (b.role === "Admin") - (a.role === "Admin") || a.name.localeCompare(b.name));

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
      const wrap = document.createElement("div");
      wrap.className = "phone-wrap";
      const num = document.createElement("span");
      num.className = "phone-num";
      wrap.append(num);
      if (phone) {
        num.textContent = phone.display;
        const badge = document.createElement("span");
        badge.className = "verify-badge " + (phone.verified ? "ok" : "pending");
        badge.textContent = phone.verified ? "✓ Verified" : "⏳ Pending";
        badge.title = phone.verified ? "Verified with a one-time code" : "Waiting for the user to verify with a one-time code";
        wrap.append(badge);
      } else {
        num.textContent = "Not linked";
        num.classList.add("none");
      }
      tr.querySelector(".phone-cell").appendChild(wrap);

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
    const list = users();
    const active = list.filter((u) => u.active).length;
    const admins = list.filter((u) => u.role === "Admin").length;
    $("user-summary").textContent = list.length + " users · " + active + " active · " + admins + (admins === 1 ? " admin" : " admins");
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
    const u = users().find((x) => x.id === id);
    const isMe = !!(u && u.username === me);
    const phone = u ? phoneOf(u) : null;

    $("user-modal-title").textContent = u ? "Edit user" : "Add user";
    $("user-modal-sub").textContent = u ? "Update details for " + u.name + "." : "They can sign in with this username and password.";
    $("user-save-btn").textContent = u ? "Save changes" : "Add user";
    $("u-password-label").textContent = u ? "Reset password" : "Password";

    fields.name.value = u ? u.name : "";
    fields.username.value = u ? u.username : "";
    fields.email.value = u ? u.email : "";
    fields.country.value = phone ? phone.country : "+91";
    fields.phone.value = phone ? phone.number : "";
    fields.password.value = "";
    fields.password.placeholder = u ? "Leave blank to keep their password" : "At least 6 characters";
    fields.role.value = u ? u.role : "User";
    fields.active.checked = u ? u.active : true;

    // You can't lock yourself out; your own password and number are changed on Profile / My phone
    fields.role.disabled = isMe;
    fields.active.disabled = isMe;
    fields.country.disabled = isMe;
    fields.phone.disabled = isMe;
    fields.password.disabled = isMe;
    $("u-password-hint").innerHTML = isMe
      ? 'Change your own password on your <a class="link" href="profile.html">Profile</a>.'
      : u ? "Type a new password to reset it. They'll use it next time they sign in." : "";
    const hint = $("u-phone-hint");
    if (isMe) {
      hint.innerHTML = 'Your numbers are the SIMs in your phone. <a class="link" href="devices.html">Manage my phone →</a>';
    } else {
      hint.textContent = phone && phone.verified
        ? "Verified. Changing it means they'll need to verify the new number."
        : "They'll verify it with a one-time code when they sign in.";
    }

    clearErrors();
    openDialog(modal);
    fields.name.focus();
  }

  // Is this number already used by someone else (including the signed-in admin's SIMs)?
  function numberTaken(country, number) {
    if (getNumbers().some((n) => n.country === country && n.number === number)) return true;
    return users().some((u) => u.id !== editingId && u.country === country && u.number === number);
  }

  $("user-form").addEventListener("submit", (e) => {
    e.preventDefault();

    const editing = users().find((u) => u.id === editingId);
    const isMe = !!(editing && editing.username === me);

    const name = fields.name.value.trim();
    const username = fields.username.value.trim().toLowerCase();
    const email = fields.email.value.trim();
    const country = fields.country.value;
    const phoneDigits = fields.phone.value.replace(/\D/g, "");
    const password = fields.password.value;

    const nameMsg = name ? "" : "Please enter a name";
    const usernameMsg = usernameError(username, editingId);
    const phoneMsg = isMe || !phoneDigits
      ? ""
      : validatePhone(country, phoneDigits) || (numberTaken(country, phoneDigits) ? "This number belongs to another user" : "");
    const emailMsg = email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? "Please enter a valid email"
      : email && users().some((u) => u.id !== editingId && (u.email || "").toLowerCase() === email.toLowerCase()) ? "Another user has this email" : "";
    const passwordMsg = isMe ? "" : (!editingId || password) ? passwordError(password) : "";

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

    const data = { name, username, email };
    if (!isMe) {
      data.role = fields.role.value;
      data.active = fields.active.checked;
      // A new or changed number has to be verified again by that user
      const sameNumber = editing && editing.country === country && editing.number === phoneDigits;
      data.country = country;
      data.number = phoneDigits;
      data.phoneVerified = sameNumber ? !!editing.phoneVerified : false;
      if (password) data.password = password;
    }

    if (editing) {
      if (editing.username !== username) renameUserData(editing.username, username);
      updateAccount(editing.id, data);
      // Keep the admin's own session in step with a new name / username
      if (isMe) saveUser({ ...getUser(), name, username, email }, !!readJSON(localStorage, USER_KEY));
      showToast(password && !isMe ? "Saved. " + name + "'s password was reset." : "Saved changes to " + name);
    } else {
      saveAccounts([...users(), { id: "u" + Date.now(), createdAt: new Date().toISOString(), lastLogin: null, ...data }]);
      showToast(name + " was added. They can sign in as @" + username + ".");
    }

    modal.close();
    render();
    if (isMe) location.reload();
  });

  // ---------- Delete ----------

  const deleteModal = $("delete-modal");

  function openDeleteModal(id) {
    const u = users().find((x) => x.id === id);
    if (!u || u.username === me) return;
    deletingId = id;
    $("delete-text").textContent = u.name + " (@" + u.username + ") will be signed out and can no longer sign in. This can't be undone.";
    openDialog(deleteModal);
  }

  $("delete-confirm-btn").addEventListener("click", () => {
    const u = users().find((x) => x.id === deletingId);
    saveAccounts(users().filter((x) => x.id !== deletingId));
    if (u) removeUserData(u.username);
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
