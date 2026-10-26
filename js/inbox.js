// Messages page: conversations newest first, grouped by Today / Yesterday / This week / Earlier.

let inboxFilter = "all";

function buildThreads() {
  return CONTACTS
    .map((contact) => {
      const msgs = messagesFor(contact.id);
      return {
        contact,
        last: msgs[msgs.length - 1],
        unread: msgs.filter(isUnread).length,
        allText: msgs.map((m) => m.text).join(" ")
      };
    })
    .filter((t) => t.last)
    .sort((a, b) => new Date(b.last.time) - new Date(a.last.time));
}

function renderFilters(threads) {
  const box = $("inbox-filter");
  box.innerHTML = "";
  const options = [
    { key: "all", label: "All", count: threads.length },
    { key: "unread", label: "Unread", count: threads.filter((t) => t.unread).length }
  ];
  for (const opt of options) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip" + (opt.key === inboxFilter ? " active" : "");
    chip.setAttribute("aria-pressed", opt.key === inboxFilter);
    chip.innerHTML = '<span></span><span class="chip-count"></span>';
    chip.firstChild.textContent = opt.label;
    chip.lastChild.textContent = opt.count;
    chip.addEventListener("click", () => {
      inboxFilter = opt.key;
      renderThreads($("search").value.trim());
    });
    box.appendChild(chip);
  }
}

function renderThreads(query) {
  const list = $("thread-list");
  const q = query.toLowerCase();
  const threads = buildThreads();
  const visible = threads
    .filter((t) => inboxFilter === "all" || t.unread)
    .filter(({ contact, allText }) =>
      !q ||
      displayName(contact).toLowerCase().includes(q) ||
      contact.phone.toLowerCase().includes(q) ||
      allText.toLowerCase().includes(q)
    );

  renderFilters(threads);
  list.innerHTML = "";

  if (visible.length === 0) {
    const empty = document.createElement("li");
    empty.className = "no-results" + (inboxFilter === "unread" && !q ? " all-read" : "");
    empty.textContent = inboxFilter === "unread" && !q ? "You're all caught up" : "No messages found";
    list.appendChild(empty);
  }

  let currentBucket = null;
  for (const { contact, last, unread } of visible) {
    const bucket = dayBucket(new Date(last.time));
    if (bucket !== currentBucket) {
      currentBucket = bucket;
      const label = document.createElement("li");
      label.className = "group-label";
      label.textContent = bucket;
      list.appendChild(label);
    }

    const li = document.createElement("li");
    const link = document.createElement("a");
    link.className = "list-item" + (unread ? " unread" : "");
    link.href = conversationUrl(contact.id);

    const main = document.createElement("div");
    main.className = "item-main";

    const top = document.createElement("div");
    top.className = "item-top";

    const name = document.createElement("span");
    name.className = "item-name";
    name.textContent = displayName(contact);

    const time = document.createElement("span");
    time.className = "item-time";
    time.textContent = formatListTime(new Date(last.time));

    const bottom = document.createElement("div");
    bottom.className = "item-bottom";

    const preview = document.createElement("span");
    preview.className = "item-sub";
    preview.textContent = (last.direction === "out" ? "You: " : "") + last.text;
    bottom.appendChild(preview);

    if (unread) {
      const count = document.createElement("span");
      count.className = "count-badge";
      count.textContent = unread;
      count.setAttribute("aria-label", unread + " unread");
      bottom.appendChild(count);
    }

    top.append(name);
    if (showNumberTags()) top.append(numberTag(last.numberId));
    top.append(time);
    main.append(top, bottom);
    link.append(createAvatar(contact), main);
    li.appendChild(link);
    list.appendChild(li);
  }

  const totalUnread = threads.reduce((sum, t) => sum + t.unread, 0);
  $("unread-count").textContent = totalUnread;
  $("unread-count").hidden = totalUnread === 0;
  refreshNavBadges();
}

$("search").addEventListener("input", (e) => renderThreads(e.target.value.trim()));

renderThreads("");

// Coming back with the browser's back button can restore a cached page; refresh unread state
window.addEventListener("pageshow", (e) => {
  if (e.persisted) renderThreads($("search").value.trim());
});
