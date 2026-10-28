// My phone page: the phone linked to this login and the SIM in each slot.
// Rename a SIM's label, view one SIM, add a SIM 2 (number + OTP), remove a SIM, and compare SIM activity.
// UI only: the OTP is always 123456.

(function () {
  const LABELS = ["Personal", "Work", "Business", "Other"];
  const DEMO_OTP = "123456";
  let removingId = null;

  function render() {
    const phone = getPhone();
    const sims = getNumbers();

    $("devices-summary").textContent = sims.length === 2 ? "Dual SIM" : "1 SIM";

    const grid = $("device-list");
    grid.innerHTML = "";

    // ---------- The phone and its SIMs ----------
    const card = document.createElement("article");
    card.className = "device-card";

    const head = document.createElement("header");
    head.className = "device-head";
    head.innerHTML =
      '<span class="device-icon">' + ICONS[phone.type === "iphone" ? "iphone" : "android"] + "</span>" +
      '<div class="device-title"><h3></h3><small>SMS ✓ · Call log ✓ · Synced just now</small></div>';
    head.querySelector("h3").textContent = phone.name;

    const list = document.createElement("ul");
    list.className = "sim-list";
    for (const slot of [1, 2]) {
      const n = sims.find((x) => x.slot === slot);
      const li = document.createElement("li");
      if (!n) {
        li.className = "sim-row empty";
        li.innerHTML = '<span class="sim-slot">SIM ' + slot + '</span><button type="button" class="sim-add link-btn"></button>';
        li.querySelector("button").textContent = "+ Add SIM " + slot + " number";
        li.querySelector("button").addEventListener("click", () => openAddSim(slot));
        list.appendChild(li);
        continue;
      }
      li.className = "sim-row";
      li.style.setProperty("--num-color", numberColor(n.id));
      li.innerHTML =
        '<span class="sim-slot">SIM ' + slot + "</span>" +
        '<div class="sim-info"><strong></strong><small><select class="sim-label-select" aria-label="SIM ' + slot + ' label"></select><span class="verified">✓ Verified</span></small></div>' +
        '<div class="sim-actions">' +
          '<button type="button" class="btn btn-ghost btn-sm" data-view-number>View</button>' +
          '<button type="button" class="icon-btn danger" data-remove-sim aria-label="Remove SIM ' + slot + '" title="Remove SIM ' + slot + '">' + ICONS.trash + "</button>" +
        "</div>";
      li.querySelector("strong").textContent = numberDisplay(n);

      // Rename the SIM: Personal / Work / Business / Other
      const select = li.querySelector(".sim-label-select");
      for (const label of LABELS) {
        const opt = document.createElement("option");
        opt.textContent = label;
        select.appendChild(opt);
      }
      select.value = LABELS.includes(n.label) ? n.label : "Other";
      select.addEventListener("change", () => {
        const acc = getAccount();
        acc.numbers.find((x) => x.id === n.id).label = select.value;
        saveAccount(acc);
        render();
        refreshShell();
        showToast("SIM " + slot + " is now " + select.value);
      });

      li.querySelector("[data-view-number]").addEventListener("click", () => {
        setSelectedNumberId(n.id);
        location.href = "messages.html";
      });

      // The account's number (SIM 1) stays; an added SIM can be removed
      const remove = li.querySelector("[data-remove-sim]");
      if (sims.length < 2) remove.hidden = true;
      else remove.addEventListener("click", () => askRemove(n.id));
      list.appendChild(li);
    }

    card.append(head, list);
    grid.appendChild(card);

    // ---------- SIM activity side by side ----------
    const stats = document.createElement("article");
    stats.className = "device-card sim-activity";
    stats.innerHTML = '<h3>SIM activity</h3><p class="sim-activity-sub"></p><div class="sim-activity-grid"></div>';
    stats.querySelector(".sim-activity-sub").textContent = sims.length === 2
      ? "Both SIMs are shown together. Use the SIM switch at the top to see one at a time."
      : "Add a SIM 2 number if your phone is dual SIM.";
    const statGrid = stats.querySelector(".sim-activity-grid");
    for (const n of sims) {
      const msgs = messagesOf(myUsername(), [n.id]);
      const calls = callsOf(myUsername(), [n.id]);
      const col = document.createElement("div");
      col.className = "sim-activity-col";
      col.style.setProperty("--num-color", numberColor(n.id));
      col.innerHTML =
        '<span class="sim-slot">SIM ' + n.slot + '</span><strong class="sim-activity-label"></strong>' +
        '<dl><div><dt>Messages</dt><dd></dd></div><div><dt>Unread</dt><dd></dd></div><div><dt>Calls</dt><dd></dd></div><div><dt>Missed</dt><dd></dd></div></dl>';
      col.querySelector(".sim-activity-label").textContent = n.label;
      const values = [msgs.length, msgs.filter(isUnread).length, calls.length, calls.filter((c) => c.type === "missed").length];
      col.querySelectorAll("dd").forEach((dd, i) => { dd.textContent = values[i]; });
      statGrid.appendChild(col);
    }
    grid.appendChild(stats);
  }

  // Keep the SIM switch and badges in step after a change on this page
  function refreshShell() {
    const select = $("number-select");
    if (!select) return;
    const fresh = select.cloneNode(false);
    select.replaceWith(fresh);
    buildNumberSelect(fresh);
    $("ns-caption").textContent = selectedNumberCaption();
    fillLinkedNumberText();
    refreshNavBadges();
  }

  // ---------- Add a SIM: number -> OTP (built here so both views share it) ----------

  const addDialog = document.createElement("dialog");
  addDialog.className = "modal";
  addDialog.id = "add-sim-modal";
  addDialog.setAttribute("aria-labelledby", "add-sim-title");
  addDialog.innerHTML =
    '<form class="modal-card" id="add-sim-form" novalidate>' +
      '<h2 id="add-sim-title">Add SIM 2</h2>' +
      '<p class="modal-sub" id="add-sim-sub">The number in the second SIM slot of your phone.</p>' +
      '<div id="add-sim-step-number">' +
        '<div class="field" id="field-add-sim">' +
          '<label for="add-sim-number">Mobile number</label>' +
          '<div class="phone-input"><select id="add-sim-country" aria-label="Country code"></select>' +
          '<input id="add-sim-number" type="tel" inputmode="numeric" autocomplete="off" placeholder="91234 56789"></div>' +
          '<small class="field-error" id="add-sim-error"></small>' +
        "</div>" +
        '<div class="field"><label for="add-sim-label">Label</label><select id="add-sim-label"></select><small class="field-error"></small></div>' +
      "</div>" +
      '<div id="add-sim-step-otp" hidden>' +
        '<div class="field" id="field-add-sim-otp">' +
          '<label id="add-sim-otp-label">Code sent to <strong id="add-sim-otp-number"></strong></label>' +
          '<div class="otp-boxes" id="add-sim-otp-boxes" role="group" aria-labelledby="add-sim-otp-label"></div>' +
          '<small class="field-error" id="add-sim-otp-error"></small>' +
        "</div>" +
        '<p class="form-note">The code fills in automatically when the SMS arrives.</p>' +
      "</div>" +
      '<div class="modal-actions">' +
        '<button type="button" class="btn btn-ghost" data-close>Cancel</button>' +
        '<button type="submit" class="btn" id="add-sim-btn">Send OTP</button>' +
      "</div>" +
    "</form>";
  const phoneFrame = document.querySelector(".m-phone");
  (phoneFrame || document.body).appendChild(addDialog);

  fillCountrySelect($("add-sim-country"));
  for (const label of LABELS) {
    const opt = document.createElement("option");
    opt.textContent = label;
    $("add-sim-label").appendChild(opt);
  }
  $("add-sim-number").addEventListener("input", (e) => {
    e.target.value = e.target.value.replace(/[^\d\s]/g, "");
    $("field-add-sim").classList.remove("invalid");
    $("add-sim-error").textContent = "";
  });
  const otp = setupOtpBoxes($("add-sim-otp-boxes"), $("add-sim-form"));
  let adding = null; // { slot, country, number, label } once the OTP is sent

  function openAddSim(slot) {
    adding = null;
    $("add-sim-title").textContent = "Add SIM " + slot;
    $("add-sim-form").dataset.slot = slot;
    $("add-sim-number").value = "";
    $("add-sim-label").value = slot === 2 ? "Work" : "Personal";
    $("add-sim-step-number").hidden = false;
    $("add-sim-step-otp").hidden = true;
    $("add-sim-btn").textContent = "Send OTP";
    $("field-add-sim").classList.remove("invalid");
    $("add-sim-error").textContent = "";
    openDialog(addDialog);
    $("add-sim-number").focus();
  }

  $("add-sim-form").addEventListener("submit", (e) => {
    e.preventDefault();

    // Step 1: check the number and "send" the OTP
    if (!adding) {
      const country = $("add-sim-country").value;
      const number = $("add-sim-number").value.replace(/\D/g, "");
      const msg = validatePhone(country, number) ||
        (getNumbers().some((n) => n.country === country && n.number === number) ? "This number is already on your phone" : "");
      $("field-add-sim").classList.toggle("invalid", !!msg);
      $("add-sim-error").textContent = msg;
      if (msg) {
        $("add-sim-number").focus();
        return;
      }
      adding = { slot: +$("add-sim-form").dataset.slot, country, number, label: $("add-sim-label").value };
      $("add-sim-otp-number").textContent = formatPhone(country, number);
      $("add-sim-step-number").hidden = true;
      $("add-sim-step-otp").hidden = false;
      $("add-sim-btn").textContent = "Verify & add";
      otp.clear();
      otp.focus();
      otp.autofill(DEMO_OTP); // fills in from the SMS by itself
      return;
    }

    // Step 2: check the OTP and add the SIM
    const code = otp.code();
    const err = code.length < 6 ? "Please enter all 6 digits" : code !== DEMO_OTP ? "That code is incorrect. Please try again." : "";
    $("field-add-sim-otp").classList.toggle("invalid", !!err);
    $("add-sim-otp-error").textContent = err;
    if (err) {
      if (code.length === 6) otp.clear();
      otp.focus();
      return;
    }
    const acc = getAccount();
    acc.seq = Math.max(acc.seq || 0, ...acc.numbers.map((n) => +n.id.slice(1))) + 1;
    acc.numbers.push({ id: "n" + acc.seq, deviceId: acc.devices[0].id, slot: adding.slot, country: adding.country, number: adding.number, label: adding.label, verifiedAt: new Date().toISOString() });
    saveAccount(acc);
    addDialog.close();
    render();
    refreshShell();
    showToast("SIM " + adding.slot + " added ✓");
  });

  // ---------- Remove a SIM ----------

  const removeDialog = $("remove-modal");

  function askRemove(id) {
    removingId = id;
    const n = numberById(id);
    $("remove-title").textContent = "Remove SIM " + n.slot + "?";
    $("remove-text").textContent = numberDisplay(n) + " (" + n.label + ") will be removed. Its messages and calls will no longer show here.";
    $("remove-confirm-btn").textContent = "Remove SIM";
    openDialog(removeDialog);
  }

  $("remove-confirm-btn").addEventListener("click", () => {
    const acc = getAccount();
    const n = acc.numbers.find((x) => x.id === removingId);
    acc.numbers = acc.numbers.filter((x) => x.id !== removingId);
    saveAccount(acc);
    removeDialog.close();
    render();
    refreshShell();
    showToast("SIM " + n.slot + " was removed");
  });

  wireDialogs();
  render();
})();
