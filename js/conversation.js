// Conversation page: every message with one contact, grouped by day.

(function () {
  const contact = getContact(getParam("id"));

  if (!contact) {
    renderNotFound($("card"), "This conversation could not be found.");
    return;
  }

  const msgs = messagesFor(contact.id);
  markRead(msgs);

  document.title = displayName(contact) + " · SMS Reader";
  wireBackButton($("back-btn"));

  setAvatar($("conv-avatar"), contact);
  $("conv-name").textContent = displayName(contact);
  $("conv-number").textContent = contact.name ? contact.phone : (contact.label || "Unknown");
  $("contact-link").href = contactUrl(contact.id);
  $("info-link").href = contactUrl(contact.id);

  const list = $("message-list");
  let prevDate = null;

  for (const m of msgs) {
    const date = new Date(m.time);

    if (!prevDate || !isSameDay(prevDate, date)) {
      const divider = document.createElement("div");
      divider.className = "day-divider";
      divider.textContent = formatDayDivider(date);
      list.appendChild(divider);
    }
    prevDate = date;

    const wrap = document.createElement("div");
    wrap.className = "message " + m.direction;

    const bubble = document.createElement("div");
    bubble.className = "bubble";
    bubble.textContent = m.text;

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = (m.direction === "in" ? displayName(contact) : "You") + " · " + formatTime(date);
    meta.title = date.toLocaleString();
    // With several numbers on screen, show which SIM each message used
    if (showNumberTags()) meta.append(" ", numberTag(m.numberId));

    wrap.append(bubble, meta);
    list.appendChild(wrap);
  }

  if (msgs.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-note";
    empty.textContent = "No messages with " + displayName(contact) + (getSelectedNumberId() === "all" && getNumbers().length > 1 ? " on your numbers." : " on this number.");
    list.appendChild(empty);
  }

  // Newest message in view: the list scrolls on the web, the whole screen scrolls on mobile
  list.scrollTop = list.scrollHeight;
  const screen = document.querySelector(".m-app");
  if (screen) screen.scrollTop = screen.scrollHeight;
})();
