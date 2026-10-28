// Contacts page: an address book of contact cards, A–Z, filterable by label.
// Unnamed numbers and sender IDs come last.

let labelFilter = "All";

function groupKey(contact) {
  const first = (contact.name || "").charAt(0).toUpperCase();
  return /[A-Z]/.test(first) ? first : "#";
}

function renderLabelFilter() {
  const people = contactsInView();
  const labels = ["All", ...new Set(people.map((c) => c.label).filter(Boolean))];
  const box = $("label-filter");
  box.innerHTML = "";
  for (const label of labels) {
    const count = label === "All" ? people.length : people.filter((c) => c.label === label).length;
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip" + (label === labelFilter ? " active" : "");
    chip.setAttribute("aria-pressed", label === labelFilter);
    chip.innerHTML = '<span></span><span class="chip-count"></span>';
    chip.firstChild.textContent = label;
    chip.lastChild.textContent = count;
    chip.addEventListener("click", () => {
      labelFilter = label;
      renderContacts($("search").value.trim());
    });
    box.appendChild(chip);
  }
}

function actionButton(href, icon, label) {
  const a = document.createElement("a");
  a.className = "icon-btn" + (href ? "" : " disabled");
  a.innerHTML = icon;
  a.title = label;
  a.setAttribute("aria-label", label);
  if (href) a.href = href;
  else a.setAttribute("aria-disabled", "true");
  return a;
}

function renderContacts(query) {
  const grid = $("contact-list");
  const q = query.toLowerCase();

  const visible = contactsInView()
    .filter((c) => labelFilter === "All" || c.label === labelFilter)
    .filter((c) =>
      !q ||
      displayName(c).toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q) ||
      (c.company || "").toLowerCase().includes(q)
    )
    .sort((a, b) => {
      const ka = groupKey(a), kb = groupKey(b);
      if (ka !== kb) return ka === "#" ? 1 : kb === "#" ? -1 : ka.localeCompare(kb);
      return displayName(a).localeCompare(displayName(b));
    });

  renderLabelFilter();
  grid.innerHTML = "";

  if (visible.length === 0) {
    grid.innerHTML = '<div class="no-results">No contacts found</div>';
  }

  visible.forEach((contact, i) => {
    const msgCount = messagesFor(contact.id).length;
    const isPhoneNumber = /^\+?[\d\s()-]+$/.test(contact.phone);

    const card = document.createElement("article");
    card.className = "contact-card";
    card.style.setProperty("--card-color", avatarColor(contact));
    card.style.animationDelay = Math.min(i, 8) * 0.04 + "s";

    // Whole card opens the contact; the action buttons sit above this link
    const link = document.createElement("a");
    link.className = "contact-card-link";
    link.href = contactUrl(contact.id);
    link.setAttribute("aria-label", "View " + displayName(contact));

    const name = document.createElement("h3");
    name.textContent = displayName(contact);

    const phone = document.createElement("p");
    phone.className = "card-phone";
    phone.textContent = contact.name ? contact.phone : (contact.company || "Unknown sender");

    const pill = document.createElement("span");
    pill.className = "pill";
    pill.textContent = contact.label || "";

    const meta = document.createElement("p");
    meta.className = "card-meta";
    const callCount = callsFor(contact.id).length;
    meta.textContent = msgCount + (msgCount === 1 ? " message" : " messages") + " · " + callCount + (callCount === 1 ? " call" : " calls");

    const actions = document.createElement("div");
    actions.className = "card-actions";
    actions.append(
      actionButton(msgCount ? conversationUrl(contact.id) : null, ICONS.messages, "Message " + displayName(contact)),
      actionButton(isPhoneNumber ? "tel:" + contact.phone.replace(/\s/g, "") : null, ICONS.call, "Call " + displayName(contact))
    );

    card.append(link, createAvatar(contact), name, phone, pill, meta, actions);
    grid.appendChild(card);
  });

  $("contact-count").textContent = contactsInView().length;
}

$("search").addEventListener("input", (e) => renderContacts(e.target.value.trim()));
attachSuggest($("search"), "contacts");

renderContacts("");
