// Calls page: call log for the numbers on screen — incoming, outgoing, missed and rejected —
// grouped by day, with totals and filters.

(function () {
  const FILTERS = [
    { key: "all", label: "All" },
    { key: "missed", label: "Missed" },
    { key: "incoming", label: "Incoming" },
    { key: "outgoing", label: "Outgoing" },
    { key: "rejected", label: "Rejected" }
  ];
  let filter = getParam("filter") && FILTERS.some((f) => f.key === getParam("filter")) ? getParam("filter") : "all";

  const calls = visibleCalls();

  // ---------- Totals ----------
  document.querySelectorAll("[data-icon]").forEach((el) => { el.innerHTML = ICONS[el.dataset.icon]; });
  const talkTime = calls.reduce((sum, c) => sum + c.duration, 0);
  $("cs-total").textContent = calls.length;
  $("cs-missed").textContent = calls.filter((c) => c.type === "missed").length;
  $("cs-rejected").textContent = calls.filter((c) => c.type === "rejected").length;
  $("cs-talk").textContent = formatDuration(talkTime);

  function renderFilters() {
    const box = $("call-filter");
    box.innerHTML = "";
    for (const f of FILTERS) {
      const count = f.key === "all" ? calls.length : calls.filter((c) => c.type === f.key).length;
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip" + (f.key === filter ? " active" : "") + (f.key === "missed" ? " chip-danger" : "");
      chip.setAttribute("aria-pressed", f.key === filter);
      chip.innerHTML = '<span></span><span class="chip-count"></span>';
      chip.firstChild.textContent = f.label;
      chip.lastChild.textContent = count;
      chip.addEventListener("click", () => {
        filter = f.key;
        render();
      });
      box.appendChild(chip);
    }
  }

  function render() {
    const q = $("search").value.trim().toLowerCase();
    const visible = calls
      .filter((c) => filter === "all" || c.type === filter)
      .filter((c) => {
        if (!q) return true;
        const contact = getContact(c.contactId);
        return displayName(contact).toLowerCase().includes(q) || contact.phone.toLowerCase().includes(q);
      });

    renderFilters();
    const list = $("call-list");
    list.innerHTML = "";

    if (visible.length === 0) {
      const empty = document.createElement("li");
      empty.className = "no-results";
      empty.textContent = filter === "missed" && !q ? "No missed calls" : "No calls found";
      list.appendChild(empty);
      return;
    }

    let currentBucket = null;
    for (const call of visible) {
      const bucket = dayBucket(new Date(call.time));
      if (bucket !== currentBucket) {
        currentBucket = bucket;
        const label = document.createElement("li");
        label.className = "group-label";
        label.textContent = bucket;
        list.appendChild(label);
      }
      list.appendChild(createCallItem(call, { groupedByDay: bucket === "Today" || bucket === "Yesterday" }));
    }
  }

  $("search").addEventListener("input", render);
  render();
})();
