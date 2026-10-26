// Contact page: details, message and call stats, and recent calls for one contact.

(function () {
  const contact = getContact(getParam("id"));

  if (!contact) {
    renderNotFound($("card"), "This contact could not be found.");
    return;
  }

  const msgs = messagesFor(contact.id);
  const calls = callsFor(contact.id);

  document.title = displayName(contact) + " · SMS Reader";
  wireBackButton($("back-btn"));

  setAvatar($("contact-avatar"), contact);
  $("contact-name").textContent = displayName(contact);
  $("contact-label").textContent = contact.label || "";
  $("contact-phone").textContent = contact.phone || "—";
  $("contact-email").textContent = contact.email || "—";
  $("contact-address").textContent = contact.address || "—";
  $("contact-company").textContent = contact.company || "—";
  $("contact-notes").textContent = contact.notes || "—";

  // Last time you heard from them, by message or call
  const times = [...msgs, ...calls].map((x) => new Date(x.time));
  const last = times.length ? new Date(Math.max(...times)) : null;
  $("stat-total").textContent = msgs.length;
  $("stat-calls").textContent = calls.length;
  $("stat-last").textContent = last ? formatListTime(last) : "-";

  // Recent calls
  const list = $("contact-calls");
  calls.slice(0, 5).forEach((call) => list.appendChild(createCallItem(call, { showContact: false })));
  if (calls.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty-note";
    empty.textContent = "No calls with " + displayName(contact) + (getSelectedNumberId() === "all" && getNumbers().length > 1 ? " on your numbers." : " on this number.");
    list.appendChild(empty);
  }

  // Quick actions (disabled when there is nothing to act on)
  const isPhoneNumber = /^\+?[\d\s()-]+$/.test(contact.phone);
  setAction("action-message", msgs.length ? conversationUrl(contact.id) : null);
  setAction("action-call", isPhoneNumber ? "tel:" + contact.phone.replace(/\s/g, "") : null);
  setAction("action-email", contact.email ? "mailto:" + contact.email : null);

  function setAction(id, href) {
    const el = $(id);
    if (href) {
      el.href = href;
    } else {
      el.removeAttribute("href");
      el.classList.add("disabled");
      el.setAttribute("aria-disabled", "true");
    }
  }
})();
