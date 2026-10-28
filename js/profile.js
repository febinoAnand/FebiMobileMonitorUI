// Profile page: the signed-in person's own account — name, username and email, and their password.
// Admins also manage other people on the Users page.

(function () {
  const account = currentAccount();
  if (!account) return; // the page guard sends signed-out visitors to login

  function setError(fieldId, errorId, message) {
    $(fieldId).classList.toggle("invalid", !!message);
    $(errorId).textContent = message || "";
  }

  // ---------- Summary card ----------

  function renderSummary() {
    const a = currentAccount();
    setAvatar($("profile-avatar"), { id: a.id, name: a.name });
    $("profile-name").textContent = a.name;
    $("profile-handle").textContent = "@" + a.username;
    $("profile-role").textContent = a.role;
    $("profile-role").className = "role role-" + a.role.toLowerCase();
    $("profile-since").textContent = "Member since " + formatDate(new Date(a.createdAt));
    const sims = getNumbers();
    $("profile-number").textContent = sims.length ? sims.map(numberDisplay).join(" · ") : (a.number ? formatPhone(a.country, a.number) : "Not linked");
  }

  // ---------- Account details: name, username, email ----------

  $("pf-name").value = account.name;
  $("pf-username").value = account.username;
  $("pf-email").value = account.email || "";
  [["pf-name", "field-pf-name", "pf-name-error"], ["pf-username", "field-pf-username", "pf-username-error"], ["pf-email", "field-pf-email", "pf-email-error"]]
    .forEach(([input, field, error]) => $(input).addEventListener("input", () => setError(field, error, "")));

  $("details-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const a = currentAccount();
    const name = $("pf-name").value.trim();
    const username = $("pf-username").value.trim().toLowerCase();
    const email = $("pf-email").value.trim();

    const nameMsg = name ? "" : "Please enter your name";
    const usernameMsg = usernameError(username, a.id);
    const emailMsg = !email ? "Please enter your email"
      : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? "Please enter a valid email"
      : getAccounts().some((x) => x.id !== a.id && (x.email || "").toLowerCase() === email.toLowerCase()) ? "Another account uses this email" : "";

    setError("field-pf-name", "pf-name-error", nameMsg);
    setError("field-pf-username", "pf-username-error", usernameMsg);
    setError("field-pf-email", "pf-email-error", emailMsg);
    if (nameMsg) return $("pf-name").focus();
    if (usernameMsg) return $("pf-username").focus();
    if (emailMsg) return $("pf-email").focus();

    if (name === a.name && username === a.username && email === (a.email || "")) {
      showToast("Nothing to change");
      return;
    }

    const usernameChanged = username !== a.username;
    if (usernameChanged) renameUserData(a.username, username);
    updateAccount(a.id, { name, username, email });
    // Keep the session in step (same expiry, same "remember me" choice)
    saveUser({ ...getUser(), name, username, email }, !!readJSON(localStorage, USER_KEY));
    showToast(usernameChanged ? "Saved. Sign in as @" + username + " from now on." : "Profile saved");
    setTimeout(() => location.reload(), 900);
  });

  // ---------- Change password ----------

  [["pf-current", "field-pf-current", "pf-current-error"], ["pf-new", "field-pf-new", "pf-new-error"], ["pf-confirm", "field-pf-confirm", "pf-confirm-error"]]
    .forEach(([input, field, error]) => $(input).addEventListener("input", () => setError(field, error, "")));

  $("pf-toggle-pw").addEventListener("click", (e) => {
    const show = $("pf-new").type === "password";
    ["pf-current", "pf-new", "pf-confirm"].forEach((id) => { $(id).type = show ? "text" : "password"; });
    e.currentTarget.textContent = show ? "Hide" : "Show";
    e.currentTarget.setAttribute("aria-label", show ? "Hide passwords" : "Show passwords");
  });

  $("password-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const a = currentAccount();
    const current = $("pf-current").value;
    const next = $("pf-new").value;
    const confirm = $("pf-confirm").value;

    const currentMsg = !current ? "Please enter your current password" : current !== a.password ? "That isn't your current password" : "";
    const nextMsg = passwordError(next) || (next === current ? "Choose a password you haven't used here" : "");
    const confirmMsg = !nextMsg && confirm !== next ? "Passwords don't match" : "";

    setError("field-pf-current", "pf-current-error", currentMsg);
    setError("field-pf-new", "pf-new-error", nextMsg);
    setError("field-pf-confirm", "pf-confirm-error", confirmMsg);
    if (currentMsg) return $("pf-current").focus();
    if (nextMsg) return $("pf-new").focus();
    if (confirmMsg) return $("pf-confirm").focus();

    updateAccount(a.id, { password: next });
    $("password-form").reset();
    showToast("Password changed ✓");
  });

  // ---------- Delete my account ----------

  const deleteModal = $("delete-account-modal");
  const onlyAdmin = () => isAdmin() && getAccounts().filter((x) => x.role === "Admin" && x.active).length < 2;

  $("delete-account-btn").addEventListener("click", () => {
    if (onlyAdmin()) {
      showToast("You're the only admin. Make someone else an admin first.");
      return;
    }
    $("delete-account-form").reset();
    setError("field-del-password", "del-password-error", "");
    setError("field-del-confirm", "del-confirm-error", "");
    openDialog(deleteModal);
    $("del-password").focus();
  });

  $("delete-account-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const a = currentAccount();
    const passwordMsg = $("del-password").value !== a.password ? "That isn't your password" : "";
    const confirmMsg = $("del-confirm").value.trim().toUpperCase() !== "DELETE" ? "Type DELETE to confirm" : "";
    setError("field-del-password", "del-password-error", passwordMsg);
    setError("field-del-confirm", "del-confirm-error", confirmMsg);
    if (passwordMsg) return $("del-password").focus();
    if (confirmMsg) return $("del-confirm").focus();

    // Remove the account and everything stored for it, then sign out
    saveAccounts(getAccounts().filter((x) => x.id !== a.id));
    removeUserData(a.username);
    for (const base of ["smsReader.placedCalls", "smsReader.location", "smsReader.find", "smsReader.viewUser"]) {
      removeKey(localStorage, base + "." + a.username);
    }
    deleteModal.close();
    $("delete-account-btn").disabled = true;
    showToast("Your account was deleted");
    setTimeout(logout, 1200);
  });

  wireDialogs();
  if (isAdmin()) $("admin-note").hidden = false;
  renderSummary();
})();
