// Export messages and call logs between a From and To date, as CSV files that open in Excel or Google Sheets.
// Used on the Messages and Calls pages in both views. Includes the phone's SIMs,
// following the "Viewing" switcher (all numbers or one number).

(function () {
  const button = $("export-btn");
  if (!button) return;
  button.querySelector("[data-export-icon]").innerHTML = ICONS.download;

  const pad = (n) => String(n).padStart(2, "0");
  const dateKey = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const today = () => dateKey(new Date());
  const daysAgo = (n) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return dateKey(d);
  };

  // ---------- Dialog (built here so every page gets the same one) ----------

  const dialog = document.createElement("dialog");
  dialog.className = "modal";
  dialog.id = "export-modal";
  dialog.setAttribute("aria-labelledby", "export-title");
  dialog.innerHTML =
    '<form class="modal-card" id="export-form" novalidate>' +
      '<h2 id="export-title">Export</h2>' +
      '<p class="modal-sub" id="export-sub"></p>' +
      '<div class="export-what" role="group" aria-label="What to export">' +
        '<label class="export-check"><input type="checkbox" id="export-messages"><span>' + ICONS.messages + "Messages</span></label>" +
        '<label class="export-check"><input type="checkbox" id="export-calls"><span>' + ICONS.calls + "Call logs</span></label>" +
      "</div>" +
      '<div class="export-presets" role="group" aria-label="Quick ranges">' +
        '<button type="button" class="chip" data-range="0">Today</button>' +
        '<button type="button" class="chip" data-range="6">Last 7 days</button>' +
        '<button type="button" class="chip" data-range="29">Last 30 days</button>' +
      "</div>" +
      '<div class="form-grid">' +
        '<div class="field" id="field-export-from"><label for="export-from">From</label><input type="date" id="export-from"><small class="field-error" id="export-from-error"></small></div>' +
        '<div class="field" id="field-export-to"><label for="export-to">To</label><input type="date" id="export-to"><small class="field-error" id="export-to-error"></small></div>' +
      "</div>" +
      '<p class="export-summary" id="export-summary" role="status"></p>' +
      '<div class="modal-actions">' +
        '<button type="button" class="btn btn-ghost" data-close>Cancel</button>' +
        '<button type="submit" class="btn" id="export-download-btn">Download CSV</button>' +
      "</div>" +
    "</form>";
  const phone = document.querySelector(".m-phone");
  if (phone && !phone.querySelector(".m-dialog-shade")) {
    const shade = document.createElement("div");
    shade.className = "m-dialog-shade";
    phone.appendChild(shade);
  }
  (phone || document.body).appendChild(dialog);
  wireDialogs();

  const from = $("export-from");
  const to = $("export-to");
  const wantMessages = $("export-messages");
  const wantCalls = $("export-calls");

  // ---------- Picking what and when ----------

  function inRange(item) {
    const key = item.time.slice(0, 10);
    return key >= from.value && key <= to.value;
  }

  function rangeError() {
    if (!from.value || !to.value) return "Choose both dates";
    if (from.value > to.value) return "From must be on or before To";
    return "";
  }

  function update() {
    const err = rangeError();
    $("field-export-to").classList.toggle("invalid", !!err);
    $("export-to-error").textContent = err;
    document.querySelectorAll("[data-range]").forEach((chip) => {
      chip.classList.toggle("active", from.value === daysAgo(+chip.dataset.range) && to.value === today());
    });

    const msgs = err || !wantMessages.checked ? 0 : visibleMessages().filter(inRange).length;
    const calls = err || !wantCalls.checked ? 0 : visibleCalls().filter(inRange).length;
    const parts = [];
    if (wantMessages.checked) parts.push(msgs + (msgs === 1 ? " message" : " messages"));
    if (wantCalls.checked) parts.push(calls + (calls === 1 ? " call" : " calls"));
    $("export-summary").textContent = err ? "" : parts.length ? parts.join(" and ") + " will be exported." : "Choose messages, call logs or both.";
    $("export-download-btn").disabled = !!err || msgs + calls === 0;
  }

  [from, to, wantMessages, wantCalls].forEach((el) => el.addEventListener("input", update));
  [wantMessages, wantCalls].forEach((el) => el.addEventListener("change", update));
  document.querySelectorAll("[data-range]").forEach((chip) => chip.addEventListener("click", () => {
    from.value = daysAgo(+chip.dataset.range);
    to.value = today();
    update();
  }));

  button.addEventListener("click", () => {
    // Start with the kind of data on this page, last 7 days
    const page = document.body.dataset.nav;
    wantMessages.checked = page !== "calls";
    wantCalls.checked = page === "calls";
    from.value = daysAgo(6);
    to.value = today();
    from.max = to.max = today();
    $("export-sub").textContent = "From " + document.querySelector("[data-linked-number]").textContent + ". Opens in Excel or Google Sheets.";
    update();
    openDialog(dialog);
  });

  // ---------- CSV files ----------

  const csvCell = (value) => {
    const s = String(value ?? "");
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };

  function download(name, rows) {
    // The BOM makes Excel read the file as UTF-8 (emoji, ₹, accents)
    const csv = "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = name;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      URL.revokeObjectURL(link.href);
      link.remove();
    }, 1000);
  }

  // The phone number and SIM an item came in on (on its owner's phone)
  function yourNumber(numberId, owner) {
    const n = simsOfUser(owner || myUsername()).find((x) => x.id === numberId);
    if (!n) return ["", ""];
    return [numberDisplay(n), "SIM " + n.slot + " · " + n.label];
  }

  function splitTime(iso) {
    const d = new Date(iso);
    return [dateKey(d), pad(d.getHours()) + ":" + pad(d.getMinutes())];
  }

  // One file per export. Choosing both gives one activity log of messages and calls (browsers often
  // block a second automatic download, so we never start two).
  $("export-form").addEventListener("submit", (e) => {
    e.preventDefault();
    if ($("export-download-btn").disabled) return;
    const span = from.value + "-to-" + to.value;
    const messages = wantMessages.checked ? visibleMessages().filter(inRange) : [];
    const calls = wantCalls.checked ? visibleCalls().filter(inRange) : [];
    let rows, name;

    if (messages.length && calls.length) {
      rows = [["Date", "Time", "Kind", "Direction / type", "Contact", "Contact number", "Your number", "SIM", "Message", "Duration (seconds)", "Duration"]];
      const items = [...messages.map((m) => ({ kind: "Message", item: m })), ...calls.map((c) => ({ kind: "Call", item: c }))]
        .sort((x, y) => x.item.time.localeCompare(y.item.time));
      for (const { kind, item } of items) {
        const c = getContact(item.contactId);
        rows.push(kind === "Message"
          ? [...splitTime(item.time), kind, item.direction === "in" ? "Received" : "Sent", displayName(c), c.phone, ...yourNumber(item.numberId, item.owner), item.text, "", ""]
          : [...splitTime(item.time), kind, CALL_TYPES[item.type].label, displayName(c), c.phone, ...yourNumber(item.numberId, item.owner), "", item.duration, formatDuration(item.duration)]);
      }
      name = "sms-reader-messages-and-calls-" + span + ".csv";
    } else if (messages.length) {
      rows = [["Date", "Time", "Direction", "Contact", "Contact number", "Your number", "SIM", "Message"]];
      messages.sort((x, y) => x.time.localeCompare(y.time)).forEach((m) => {
        const c = getContact(m.contactId);
        rows.push([...splitTime(m.time), m.direction === "in" ? "Received" : "Sent", displayName(c), c.phone, ...yourNumber(m.numberId, m.owner), m.text]);
      });
      name = "sms-reader-messages-" + span + ".csv";
    } else {
      rows = [["Date", "Time", "Type", "Contact", "Contact number", "Your number", "SIM", "Duration (seconds)", "Duration"]];
      calls.sort((x, y) => x.time.localeCompare(y.time)).forEach((call) => {
        const c = getContact(call.contactId);
        rows.push([...splitTime(call.time), CALL_TYPES[call.type].label, displayName(c), c.phone, ...yourNumber(call.numberId, call.owner), call.duration, formatDuration(call.duration)]);
      });
      name = "sms-reader-calls-" + span + ".csv";
    }

    if (getViewUser() !== "me") {
      const owners = (messages.length && calls.length
        ? [...messages, ...calls].sort((x, y) => x.time.localeCompare(y.time))
        : (messages.length ? messages : calls)).map((x) => (accountByUsername(x.owner) || {}).name || x.owner);
      rows = rows.map((r, i) => (i === 0 ? ["User", ...r] : [owners[i - 1], ...r]));
      name = name.replace("sms-reader-", "sms-reader-" + (getViewUser() === "all" ? "all-users" : getViewUser()) + "-");
    }
    download(name, rows);
    dialog.close();
    showToast("Downloading " + (messages.length && calls.length ? "messages and call logs" : messages.length ? "messages" : "call logs"));
  });
})();
