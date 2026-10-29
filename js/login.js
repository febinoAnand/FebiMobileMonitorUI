// Login page (UI only). Checks the user directory: username, email or mobile number + password.
// The demo admin is admin / admin. This check runs in the browser and is NOT secure — replace it
// with a call to the backend login API before going live.

(function () {
  // The view is asked first on the shared index page; each view has its own login and sign-up page
  if (!hasChosenView()) {
    location.replace(ROOT + "index.html");
    return;
  }
  if (document.body.dataset.loginView !== getView()) {
    location.replace(appUrl(location.pathname.split("/").pop()));
    return;
  }

  // Signed in already: go on to the app in the chosen view, or to setting up a phone first
  const nextPage = afterLoginUrl;

  if (getUser()) {
    location.replace(nextPage());
    return;
  }

  // The view chosen on the first page; "Change" goes back there
  $("view-chip-text").textContent = getView() === "mobile" ? "Mobile view" : "Web view";

  const form = $("login-form");
  const username = $("username");
  const password = $("password");

  function setError(field, input, errorEl, message) {
    $(field).classList.toggle("invalid", !!message);
    $(errorEl).textContent = message || "";
    input.setAttribute("aria-invalid", message ? "true" : "false");
  }

  $("toggle-pw").addEventListener("click", (e) => {
    const show = password.type === "password";
    password.type = show ? "text" : "password";
    e.currentTarget.textContent = show ? "Hide" : "Show";
    e.currentTarget.setAttribute("aria-label", show ? "Hide password" : "Show password");
  });

  $("forgot").addEventListener("click", (e) => {
    e.preventDefault();
    $("form-note").textContent = "Password reset will be available once the backend is connected.";
  });

  username.addEventListener("input", () => setError("field-username", username, "username-error", ""));
  password.addEventListener("input", () => setError("field-password", password, "password-error", ""));

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const usernameValue = username.value.trim();
    const usernameMsg = usernameValue ? "" : "Please enter your username";
    const passwordMsg = password.value ? "" : "Please enter your password";

    setError("field-username", username, "username-error", usernameMsg);
    setError("field-password", password, "password-error", passwordMsg);

    if (usernameMsg) return username.focus();
    if (passwordMsg) return password.focus();

    const btn = $("submit-btn");
    btn.disabled = true;
    btn.textContent = "Signing in…";

    setTimeout(() => {
      const account = findAccount(usernameValue);
      if (account && account.password === password.value) {
        if (!account.active) {
          btn.disabled = false;
          btn.textContent = "Sign in";
          setError("field-password", password, "password-error", "This account has been deactivated. Please contact your admin.");
          return;
        }
        updateAccount(account.id, { lastLogin: new Date().toISOString() });
        saveUser({ name: account.name, username: account.username, email: account.email, country: account.country, number: account.number }, $("remember").checked);
        location.href = nextPage();
        return;
      }

      btn.disabled = false;
      btn.textContent = "Sign in";

      // No account with that username / email / number: offer to create one
      if (!account) {
        setError("field-username", username, "username-error", "");
        $("field-username").classList.add("invalid");
        $("username-error").innerHTML = 'No account found. Don\'t have one? <a class="link" href="register.html">Create an account</a>';
        $("no-account").hidden = false;
        $("switch-auth").hidden = true;
        username.focus();
        return;
      }

      setError("field-password", password, "password-error", "Incorrect password");
      password.value = "";
      password.focus();
    }, 600);
  });
})();
