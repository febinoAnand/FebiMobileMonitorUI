// "Add a phone": name the phone -> its SIM numbers (one or two) -> verify each number with an OTP.
// With ?device=<id> it adds a number to the free SIM slot of a phone that is already linked.
// UI only: the OTP is always 123456. When the backend is ready, "Send OTP" and "Verify"
// become API calls, and the backend syncs messages and calls for each verified number.

const DEMO_OTP = "123456";
const RESEND_SECONDS = 30;

(function () {
  const user = getUser();
  if (!user) {
    location.replace("login.html");
    return;
  }

  const account = getAccount();
  const hadNumbers = account.numbers.length > 0;
  const existingDevice = account.devices.find((d) => d.id === getParam("device"));
  const usedSlots = existingDevice ? account.numbers.filter((n) => n.deviceId === existingDevice.id).map((n) => n.slot) : [];
  const freeSlot = [1, 2].find((s) => !usedSlots.includes(s));

  const doneUrl = hadNumbers ? appUrl("devices.html") : appUrl("dashboard.html");
  let device = null;        // { name, type } for a new phone
  let pending = [];         // numbers waiting for OTP: { slot, label, country, number }
  let verifyIndex = 0;
  let timer = null;

  $("signed-in-name").textContent = user.name;
  $("connect-logout").addEventListener("click", logout);
  document.querySelectorAll("[data-cancel]").forEach((a) => {
    a.hidden = !hadNumbers;
    a.href = appUrl("devices.html");
  });

  // ---------- Steps ----------

  function setStep(step) {
    document.querySelectorAll("[data-step-item]").forEach((li) => {
      const n = +li.dataset.stepItem;
      li.classList.toggle("active", n === step);
      li.classList.toggle("done", n < step);
    });
    $("device-form").hidden = step !== 1;
    $("sims-form").hidden = step !== 2;
    $("otp-form").hidden = step !== 3;
  }

  function setError(fieldId, errorId, message) {
    $(fieldId).classList.toggle("invalid", !!message);
    $(errorId).textContent = message || "";
  }

  // ---------- Step 1: phone ----------

  $("device-name").addEventListener("input", () => setError("field-device", "device-error", ""));

  $("device-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = $("device-name").value.trim();
    const msg = !name
      ? "Please give this phone a name"
      : account.devices.some((d) => d.name.toLowerCase() === name.toLowerCase()) ? "You already have a phone with this name" : "";
    setError("field-device", "device-error", msg);
    if (msg) {
      $("device-name").focus();
      return;
    }
    device = { name, type: document.querySelector("input[name=device-type]:checked").value };
    $("sims-sub").textContent = "Add the number in each SIM slot of " + name + ".";
    setStep(2);
    $("sim-1-number").focus();
  });

  // ---------- Step 2: SIM numbers ----------

  for (const i of [1, 2]) {
    fillCountrySelect($("sim-" + i + "-country"));
    $("sim-" + i + "-number").addEventListener("input", (e) => {
      e.target.value = e.target.value.replace(/[^\d\s]/g, "");
      setError("field-sim-" + i, "sim-" + i + "-error", "");
    });
  }

  $("dual-sim").addEventListener("change", (e) => {
    $("sim-block-2").hidden = !e.target.checked;
    if (e.target.checked) $("sim-2-number").focus();
  });

  $("sims-back").addEventListener("click", () => {
    if (existingDevice) location.href = appUrl("devices.html");
    else setStep(1);
  });

  // Adding a SIM to a phone that's already linked: skip step 1, one block for the free slot
  if (existingDevice) {
    if (!freeSlot) {
      location.replace(appUrl("devices.html"));
      return;
    }
    $("sims-step-label").textContent = "Step 1 of 2";
    $("otp-step-label").textContent = "Step 2 of 2";
    $("sims-title").textContent = "Add SIM " + freeSlot + " number";
    $("sims-sub").textContent = "The number in SIM slot " + freeSlot + " of " + existingDevice.name + ".";
    $("sim-1-badge").textContent = "SIM " + freeSlot;
    $("sim-1-label").value = freeSlot === 2 ? "Work" : "Personal";
    $("dual-sim-toggle").hidden = true;
    $("sims-back").textContent = "Cancel";
    document.querySelector('[data-step-item="1"]').hidden = true;
  }

  $("sims-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const taken = new Set(account.numbers.map((n) => n.country + n.number));
    const blocks = $("dual-sim").checked && !existingDevice ? [1, 2] : [1];
    const entries = [];
    let firstBad = null;

    for (const i of blocks) {
      const country = $("sim-" + i + "-country").value;
      const number = $("sim-" + i + "-number").value.replace(/\D/g, "");
      const msg = validatePhone(country, number) ||
        (taken.has(country + number) ? "This number is already linked to your account" : "") ||
        (entries.some((x) => x.country + x.number === country + number) ? "SIM 1 and SIM 2 can't have the same number" : "");
      setError("field-sim-" + i, "sim-" + i + "-error", msg);
      if (msg && !firstBad) firstBad = $("sim-" + i + "-number");
      entries.push({ slot: existingDevice ? freeSlot : i, label: $("sim-" + i + "-label").value, country, number });
    }

    if (firstBad) {
      firstBad.focus();
      return;
    }

    const btn = $("send-otp-btn");
    btn.disabled = true;
    btn.textContent = "Sending…";
    setTimeout(() => {
      btn.disabled = false;
      btn.textContent = "Send OTP";
      pending = entries;
      verifyIndex = 0;
      showOtpFor(0);
    }, 600);
  });

  // ---------- Step 3: OTP, one number at a time ----------

  for (let i = 0; i < 6; i++) {
    const input = document.createElement("input");
    input.type = "text";
    input.inputMode = "numeric";
    input.maxLength = 1;
    input.autocomplete = i === 0 ? "one-time-code" : "off";
    input.setAttribute("aria-label", "Digit " + (i + 1));
    $("otp-boxes").appendChild(input);
  }
  const otpInputs = [...$("otp-boxes").querySelectorAll("input")];

  function showOtpFor(index) {
    const entry = pending[index];
    $("otp-title").textContent = "Verify SIM " + entry.slot + " · " + entry.label;
    $("otp-number").textContent = formatPhone(entry.country, entry.number);
    const base = existingDevice ? "Step 2 of 2" : "Step 3 of 3";
    $("otp-step-label").textContent = pending.length > 1 ? base + " · Number " + (index + 1) + " of " + pending.length : base;
    clearOtp();
    setError("field-otp", "otp-error", "");
    setStep(3);
    startResendTimer();
    otpInputs[0].focus();
  }

  function clearOtp() {
    otpInputs.forEach((inp) => { inp.value = ""; inp.classList.remove("filled"); });
  }

  function fillFrom(index, text) {
    const digits = text.replace(/\D/g, "").slice(0, 6 - index).split("");
    digits.forEach((d, k) => {
      otpInputs[index + k].value = d;
      otpInputs[index + k].classList.add("filled");
    });
    otpInputs[Math.min(index + digits.length, 5)].focus();
    setError("field-otp", "otp-error", "");
    // Submit automatically once all 6 digits are in
    if (otpInputs.every((inp) => inp.value)) $("otp-form").requestSubmit();
  }

  otpInputs.forEach((input, i) => {
    input.addEventListener("input", () => {
      const value = input.value.replace(/\D/g, "");
      input.value = "";
      input.classList.remove("filled");
      if (value) fillFrom(i, value);
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" && !input.value && i > 0) {
        otpInputs[i - 1].value = "";
        otpInputs[i - 1].classList.remove("filled");
        otpInputs[i - 1].focus();
        e.preventDefault();
      } else if (e.key === "ArrowLeft" && i > 0) {
        otpInputs[i - 1].focus();
      } else if (e.key === "ArrowRight" && i < 5) {
        otpInputs[i + 1].focus();
      }
    });
    input.addEventListener("paste", (e) => {
      e.preventDefault();
      fillFrom(i, (e.clipboardData || window.clipboardData).getData("text"));
    });
    input.addEventListener("focus", () => input.select());
  });

  $("otp-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const code = otpInputs.map((inp) => inp.value).join("");

    if (code.length < 6) {
      setError("field-otp", "otp-error", "Please enter all 6 digits");
      otpInputs[code.length].focus();
      return;
    }
    if (code !== DEMO_OTP) {
      setError("field-otp", "otp-error", "That code is incorrect. Please try again.");
      clearOtp();
      otpInputs[0].focus();
      return;
    }

    clearInterval(timer);
    pending[verifyIndex].verifiedAt = new Date().toISOString();

    if (verifyIndex < pending.length - 1) {
      verifyIndex += 1;
      showToast("SIM " + pending[verifyIndex - 1].slot + " verified ✓");
      showOtpFor(verifyIndex);
      return;
    }

    const btn = $("verify-btn");
    btn.disabled = true;
    btn.textContent = "Verified ✓";
    saveLinkedPhone();
    setTimeout(() => { location.href = doneUrl; }, 700);
  });

  // New numbers get ids n1, n2, n3… in the order they are linked (see js/data.js)
  function saveLinkedPhone() {
    const acc = getAccount();
    let deviceId = existingDevice && existingDevice.id;
    if (!deviceId) {
      acc.dseq = (acc.dseq || acc.devices.length) + 1;
      deviceId = "d" + acc.dseq;
      acc.devices.push({ id: deviceId, name: device.name, type: device.type, addedAt: new Date().toISOString() });
    }
    for (const entry of pending) {
      acc.seq = (acc.seq || 0) + 1;
      acc.numbers.push({ id: "n" + acc.seq, deviceId, slot: entry.slot, country: entry.country, number: entry.number, label: entry.label, verifiedAt: entry.verifiedAt });
    }
    saveAccount(acc);
  }

  $("edit-number").addEventListener("click", () => {
    clearInterval(timer);
    setStep(2);
  });

  function startResendTimer() {
    let left = RESEND_SECONDS;
    const btn = $("resend-btn");
    const label = $("resend-timer");
    btn.disabled = true;
    label.textContent = "in " + left + "s";
    clearInterval(timer);
    timer = setInterval(() => {
      left -= 1;
      label.textContent = left > 0 ? "in " + left + "s" : "";
      if (left <= 0) {
        clearInterval(timer);
        btn.disabled = false;
      }
    }, 1000);
  }

  $("resend-btn").addEventListener("click", () => {
    clearOtp();
    setError("field-otp", "otp-error", "");
    startResendTimer();
    otpInputs[0].focus();
    showToast("A new code was sent to " + $("otp-number").textContent);
  });

  setStep(existingDevice ? 2 : 1);
  if (existingDevice) $("sim-1-number").focus();
  else $("device-name").focus();
})();
