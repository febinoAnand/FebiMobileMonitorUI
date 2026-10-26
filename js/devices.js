// Phones & numbers page: every phone linked to this login, with the number in each SIM slot.
// Add a phone, add a SIM 2 number, view one number, or remove a number or a whole phone.

(function () {
  let pendingRemoval = null; // { kind: "number" | "device", id }

  function render() {
    const devices = getDevices();
    const numbers = getNumbers();
    $("devices-summary").textContent =
      "One login on " + devices.length + (devices.length === 1 ? " phone" : " phones") +
      " · " + numbers.length + (numbers.length === 1 ? " number" : " numbers");

    const grid = $("device-list");
    grid.innerHTML = "";

    devices.forEach((device, i) => {
      const card = document.createElement("article");
      card.className = "device-card";
      card.style.animationDelay = i * 0.06 + "s";

      const head = document.createElement("header");
      head.className = "device-head";
      head.innerHTML =
        '<span class="device-icon">' + ICONS[device.type === "iphone" ? "iphone" : "android"] + "</span>" +
        '<div class="device-title"><h3></h3><small></small></div>' +
        '<button type="button" class="icon-btn danger" aria-label="Remove phone" title="Remove phone">' + ICONS.trash + "</button>";
      head.querySelector("h3").textContent = device.name;
      head.querySelector("small").textContent =
        (device.type === "iphone" ? "iPhone" : "Android") + " · Added " + formatDate(new Date(device.addedAt)) + " · Synced just now";
      head.querySelector("button").addEventListener("click", () => askRemove("device", device.id));

      const sims = document.createElement("ul");
      sims.className = "sim-list";
      for (const slot of [1, 2]) {
        const n = numbers.find((x) => x.deviceId === device.id && x.slot === slot);
        const li = document.createElement("li");
        if (n) {
          const msgCount = MESSAGES.filter((m) => m.numberId === n.id).length;
          const callCount = CALLS.filter((c) => c.numberId === n.id).length;
          li.className = "sim-row";
          li.style.setProperty("--num-color", numberColor(n.id));
          li.innerHTML =
            '<span class="sim-slot">SIM ' + slot + "</span>" +
            '<div class="sim-info"><strong></strong><small></small></div>' +
            '<div class="sim-actions">' +
              '<button type="button" class="btn btn-ghost btn-sm" data-view-number>View</button>' +
              '<button type="button" class="icon-btn danger" aria-label="Remove number" title="Remove number">' + ICONS.trash + "</button>" +
            "</div>";
          li.querySelector("strong").textContent = numberDisplay(n);
          li.querySelector("small").innerHTML = '<span class="sim-label-text"></span> · <span class="verified">✓ Verified</span><span class="sim-counts"></span>';
          li.querySelector(".sim-label-text").textContent = n.label;
          li.querySelector(".sim-counts").textContent = msgCount + " msgs, " + callCount + " calls";
          li.querySelector("[data-view-number]").addEventListener("click", () => {
            setSelectedNumberId(n.id);
            location.href = "messages.html";
          });
          li.querySelector(".icon-btn").addEventListener("click", () => askRemove("number", n.id));
        } else {
          li.className = "sim-row empty";
          li.innerHTML = '<span class="sim-slot">SIM ' + slot + '</span><a class="sim-add"></a>';
          const add = li.querySelector(".sim-add");
          add.href = ROOT + "connect.html?device=" + encodeURIComponent(device.id);
          add.textContent = "+ Add SIM " + slot + " number";
        }
        sims.appendChild(li);
      }

      card.append(head, sims);
      grid.appendChild(card);
    });

    // A last card that starts the "Add a phone" flow
    const add = document.createElement("a");
    add.className = "device-card device-add";
    add.href = ROOT + "connect.html";
    add.innerHTML = '<span class="device-icon">' + ICONS.plus + "</span><strong>Add another phone</strong><small>Use the same login on a new phone</small>";
    grid.appendChild(add);
  }

  // ---------- Remove a number or a phone ----------

  const modal = $("remove-modal");

  function askRemove(kind, id) {
    pendingRemoval = { kind, id };
    if (kind === "number") {
      const n = numberById(id);
      const device = deviceById(n.deviceId);
      $("remove-title").textContent = "Remove this number?";
      $("remove-text").textContent = numberDisplay(n) + " (" + n.label + ", SIM " + n.slot + ") will be removed from " +
        (device ? device.name : "this phone") + ". Its messages and calls will no longer show here.";
      $("remove-confirm-btn").textContent = "Remove number";
    } else {
      const device = deviceById(id);
      const count = getNumbers().filter((n) => n.deviceId === id).length;
      $("remove-title").textContent = "Remove this phone?";
      $("remove-text").textContent = device.name + " and its " + count + (count === 1 ? " number" : " numbers") +
        " will be removed from your account. You can add it again later.";
      $("remove-confirm-btn").textContent = "Remove phone";
    }
    openDialog(modal);
  }

  $("remove-confirm-btn").addEventListener("click", () => {
    const acc = getAccount();
    let message;
    if (pendingRemoval.kind === "number") {
      const n = acc.numbers.find((x) => x.id === pendingRemoval.id);
      acc.numbers = acc.numbers.filter((x) => x.id !== pendingRemoval.id);
      message = formatPhone(n.country, n.number) + " was removed";
    } else {
      const device = acc.devices.find((d) => d.id === pendingRemoval.id);
      acc.devices = acc.devices.filter((d) => d.id !== pendingRemoval.id);
      acc.numbers = acc.numbers.filter((x) => x.deviceId !== pendingRemoval.id);
      message = device.name + " was removed";
    }
    saveAccount(acc);
    modal.close();

    // Messages need at least one number
    if (acc.numbers.length === 0) {
      location.href = ROOT + "connect.html";
      return;
    }
    render();
    refreshNavBadges();
    showToast(message);
  });

  wireDialogs();
  document.querySelectorAll("[data-icon]").forEach((el) => { el.innerHTML = ICONS[el.dataset.icon]; });
  $("add-phone-btn").href = ROOT + "connect.html";
  render();
})();
