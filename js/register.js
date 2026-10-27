// Create account: mobile number + email -> verify the number with an OTP -> choose username + password.
// UI only: the OTP is always 123456 and accounts are kept in the browser. The backend will send real
// codes and store accounts with hashed passwords.

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

  if (getUser()) {
    location.replace(afterLoginUrl());
    return;
  }

  const DEMO_OTP = "123456";
  let details = null; // { country, number, email }

  function setStep(step) {
    document.querySelectorAll("[data-step-item]").forEach((li) => {
      const n = +li.dataset.stepItem;
      li.classList.toggle("active", n === step);
      li.classList.toggle("done", n < step);
    });
    $("details-form").hidden = step !== 1;
    $("reg-otp-form").hidden = step !== 2;
    $("credentials-form").hidden = step !== 3;
  }

  function setError(fieldId, errorId, message) {
    $(fieldId).classList.toggle("invalid", !!message);
    $(errorId).textContent = message || "";
  }

  // ---------- Step 1: mobile number + email ----------

  fillCountrySelect($("reg-country"));
  $("reg-number").addEventListener("input", (e) => {
    e.target.value = e.target.value.replace(/[^\d\s]/g, "");
    setError("field-reg-phone", "reg-phone-error", "");
  });
  $("reg-email").addEventListener("input", () => setError("field-reg-email", "reg-email-error", ""));

  $("details-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const country = $("reg-country").value;
    const number = $("reg-number").value.replace(/\D/g, "");
    const email = $("reg-email").value.trim();

    const phoneMsg = validatePhone(country, number) ||
      (findAccount(country + number) ? "An account already uses this number. Sign in instead." : "");
    const emailMsg = !email
      ? "Please enter your email"
      : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? "Please enter a valid email"
      : findAccount(email) ? "An account already uses this email. Sign in instead." : "";

    setError("field-reg-phone", "reg-phone-error", phoneMsg);
    setError("field-reg-email", "reg-email-error", emailMsg);
    if (phoneMsg) return $("reg-number").focus();
    if (emailMsg) return $("reg-email").focus();

    const btn = $("reg-send-btn");
    btn.disabled = true;
    btn.textContent = "Sending…";
    setTimeout(() => {
      btn.disabled = false;
      btn.textContent = "Send OTP";
      details = { country, number, email };
      $("reg-otp-number").textContent = formatPhone(country, number);
      otp.clear();
      setError("field-reg-otp", "reg-otp-error", "");
      setStep(2);
      startResendTimer($("reg-resend-btn"), $("reg-resend-timer"));
      otp.focus();
      otp.autofill(DEMO_OTP); // fills in from the SMS by itself
    }, 600);
  });

  // ---------- Step 2: OTP ----------

  const otp = setupOtpBoxes($("reg-otp-boxes"), $("reg-otp-form"));

  $("reg-otp-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const code = otp.code();
    if (code.length < 6) {
      setError("field-reg-otp", "reg-otp-error", "Please enter all 6 digits");
      otp.focus(code.length);
      return;
    }
    if (code !== DEMO_OTP) {
      setError("field-reg-otp", "reg-otp-error", "That code is incorrect. Please try again.");
      otp.clear();
      otp.focus();
      return;
    }
    clearInterval(startResendTimer.timer);
    // Suggest a username from the email
    $("reg-username").value = details.email.split("@")[0].toLowerCase().replace(/[^a-z0-9._-]/g, "");
    setStep(3);
    $("reg-username").focus();
  });

  $("reg-edit").addEventListener("click", () => {
    clearInterval(startResendTimer.timer);
    setStep(1);
    $("reg-number").focus();
  });

  $("reg-resend-btn").addEventListener("click", () => {
    otp.clear();
    setError("field-reg-otp", "reg-otp-error", "");
    startResendTimer($("reg-resend-btn"), $("reg-resend-timer"));
    otp.focus();
    showToast("A new code was sent to " + $("reg-otp-number").textContent);
    otp.autofill(DEMO_OTP);
  });

  // ---------- Step 3: username + password ----------

  $("reg-toggle-pw").addEventListener("click", (e) => {
    const show = $("reg-password").type === "password";
    $("reg-password").type = show ? "text" : "password";
    $("reg-confirm").type = show ? "text" : "password";
    e.currentTarget.textContent = show ? "Hide" : "Show";
    e.currentTarget.setAttribute("aria-label", show ? "Hide password" : "Show password");
  });
  [["reg-username", "field-reg-username", "reg-username-error"], ["reg-password", "field-reg-password", "reg-password-error"], ["reg-confirm", "field-reg-confirm", "reg-confirm-error"]]
    .forEach(([input, field, error]) => $(input).addEventListener("input", () => setError(field, error, "")));

  $("credentials-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const username = $("reg-username").value.trim().toLowerCase();
    const password = $("reg-password").value;
    const confirm = $("reg-confirm").value;

    const usernameMsg = !username
      ? "Please choose a username"
      : !/^[a-z0-9._-]{3,}$/.test(username) ? "3+ characters: letters, numbers, . _ -"
      : username === "admin" || findAccount(username) ? "This username is taken" : "";
    const passwordMsg = password.length < 6 ? "Password must be at least 6 characters" : "";
    const confirmMsg = !passwordMsg && confirm !== password ? "Passwords don't match" : "";

    setError("field-reg-username", "reg-username-error", usernameMsg);
    setError("field-reg-password", "reg-password-error", passwordMsg);
    setError("field-reg-confirm", "reg-confirm-error", confirmMsg);
    if (usernameMsg) return $("reg-username").focus();
    if (passwordMsg) return $("reg-password").focus();
    if (confirmMsg) return $("reg-confirm").focus();

    const name = username.split(/[._-]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
    saveAccounts([...getAccounts(), { name, username, password, email: details.email, country: details.country, number: details.number, createdAt: new Date().toISOString() }]);
    saveUser({ name, username, email: details.email, country: details.country, number: details.number }, false);

    const btn = $("reg-create-btn");
    btn.disabled = true;
    btn.textContent = "Account created ✓";
    // Signed in: next, set up the phone (or go straight in if it is already set up)
    setTimeout(() => { location.href = afterLoginUrl(); }, 700);
  });

  setStep(1);
})();
