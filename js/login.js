// Login page (UI only). Accepts the demo account admin / admin.
// This check runs in the browser and is NOT secure — replace it with a call to the
// backend login API before going live.

const DEMO_USERNAME = "admin";
const DEMO_PASSWORD = "admin";

(function () {
  // Signed in already: go on to the app in the chosen view, or to adding a phone first
  const nextPage = () => (getNumbers().length ? appUrl("dashboard.html") : "connect.html");

  if (getUser()) {
    location.replace(nextPage());
    return;
  }

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
      if (usernameValue.toLowerCase() === DEMO_USERNAME && password.value === DEMO_PASSWORD) {
        saveUser({ name: "Admin", username: DEMO_USERNAME }, $("remember").checked);
        location.href = nextPage();
        return;
      }

      btn.disabled = false;
      btn.textContent = "Sign in";
      setError("field-password", password, "password-error", "Incorrect username or password");
      password.value = "";
      password.focus();
    }, 600);
  });
})();
