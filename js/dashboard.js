// Dashboard page: summary tiles, messages-per-day chart, top contacts and recent messages.

(function () {
  const now = new Date();
  const user = getUser();

  // ---------- Greeting ----------
  const hour = now.getHours();
  const part = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = user && user.name ? user.name.split(" ")[0] : "";
  const greeting = document.createElement("span");
  greeting.textContent = part + (firstName ? ", " + firstName : "");
  const date = document.createElement("span");
  date.className = "subtitle-date";
  date.textContent = now.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" });
  $("greeting").append(greeting, date);

  // ---------- Stat tiles ----------
  document.querySelectorAll("[data-icon]").forEach((el) => { el.innerHTML = ICONS[el.dataset.icon]; });

  const messages = visibleMessages();
  const calls = visibleCalls();
  $("stat-messages").textContent = messages.length;
  $("stat-unread").textContent = messages.filter(isUnread).length;
  $("stat-calls").textContent = calls.length;
  $("stat-missed").textContent = calls.filter((c) => c.type === "missed").length;

  // ---------- Chart: messages per day, last 7 days ----------
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const day = new Date(now);
    day.setDate(now.getDate() - i);
    const msgs = messages.filter((m) => isSameDay(new Date(m.time), day));
    days.push({
      date: day,
      received: msgs.filter((m) => m.direction === "in").length,
      sent: msgs.filter((m) => m.direction === "out").length
    });
  }

  const maxCount = Math.max(...days.map((d) => d.received + d.sent));
  const axisMax = Math.max(2, Math.ceil(maxCount / 2) * 2); // even number so the middle line is whole

  $("chart-axis").innerHTML = [axisMax, axisMax / 2, 0]
    .map((v, i) => '<span style="bottom:' + (100 - i * 50) + '%">' + v + "</span>")
    .join("");

  const plot = $("chart-plot");
  const tbody = $("chart-table").querySelector("tbody");

  days.forEach((d, i) => {
    const total = d.received + d.sent;
    const isToday = i === days.length - 1;
    const longDay = d.date.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });

    const col = document.createElement("div");
    col.className = "bar-col" + (isToday ? " today" : "");
    col.tabIndex = 0;
    col.setAttribute("aria-label", longDay + ": " + total + " messages, " + d.received + " received, " + d.sent + " sent");

    const track = document.createElement("div");
    track.className = "bar-track";
    track.style.setProperty("--h", (total / axisMax) * 100 + "%");

    const bar = document.createElement("div");
    bar.className = "bar" + (total ? "" : " empty");
    bar.style.animationDelay = i * 0.06 + "s";

    const tip = document.createElement("div");
    tip.className = "bar-tip";
    tip.innerHTML = "<strong></strong><br><span></span>";
    tip.querySelector("strong").textContent = total + (total === 1 ? " message" : " messages");
    tip.querySelector("span").textContent = longDay + " · " + d.received + " in, " + d.sent + " out";

    const label = document.createElement("div");
    label.className = "bar-day";
    label.textContent = isToday ? "Today" : d.date.toLocaleDateString([], { weekday: "short" });

    track.append(bar, tip);
    col.append(track, label);
    plot.appendChild(col);

    const row = document.createElement("tr");
    [longDay, d.received, d.sent, total].forEach((v) => {
      const cell = document.createElement("td");
      cell.textContent = v;
      row.appendChild(cell);
    });
    tbody.appendChild(row);
  });

  // ---------- Your numbers: activity per number; tap one to view only that number ----------
  const selected = getSelectedNumberId();
  const numberList = $("number-list");
  for (const n of readableNumbers()) {
    const msgCount = scopeItems("messages", n.slot).length;
    const missed = scopeItems("calls", n.slot).filter((c) => c.type === "missed").length;

    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "number-row" + (selected === n.id ? " active" : "");
    btn.style.setProperty("--num-color", numberColor(n.id));
    btn.innerHTML =
      '<span class="number-dot"></span>' +
      '<span class="number-main"><strong></strong><small></small></span>' +
      '<span class="number-stats"><span class="ns-msgs"></span><span class="ns-missed"></span></span>';
    btn.querySelector("strong").textContent = n.allUsers ? "SIM " + n.slot + " · all users" : numberDisplay(n);
    btn.querySelector("small").textContent = n.allUsers ? scopeUsernames().length + " users" : "SIM " + n.slot + " · " + n.label;
    btn.querySelector(".ns-msgs").textContent = msgCount + (msgCount === 1 ? " message" : " messages");
    btn.querySelector(".ns-missed").textContent = missed ? missed + " missed" : "";
    btn.title = selected === n.id ? "Showing this number — click to show all numbers" : "Show only this number";
    btn.addEventListener("click", () => {
      setSelectedNumberId(selected === n.id ? "all" : n.id);
      location.reload();
    });
    li.appendChild(btn);
    numberList.appendChild(li);
  }

  // ---------- Recent calls ----------
  const callList = $("recent-calls");
  calls.slice(0, 5).forEach((call) => callList.appendChild(createCallItem(call)));
  if (calls.length === 0) callList.innerHTML = '<li class="empty-note">No calls on this number yet.</li>';

  // ---------- Recent messages (received) ----------
  const recent = messages
    .filter((m) => m.direction === "in")
    .sort((a, b) => new Date(b.time) - new Date(a.time))
    .slice(0, 5);

  const recentList = $("recent-list");
  for (const m of recent) {
    const contact = getContact(m.contactId);
    const li = document.createElement("li");
    const link = document.createElement("a");
    link.className = "list-item" + (isUnread(m) ? " unread" : "");
    link.href = conversationUrl(contact.id, m.owner);

    const main = document.createElement("div");
    main.className = "item-main";
    main.innerHTML = '<div class="item-top"><span class="item-name"></span><span class="item-time"></span></div><div class="item-sub"></div>';
    main.querySelector(".item-name").textContent = displayName(contact);
    if (showOwnerTags()) main.querySelector(".item-top").insertBefore(ownerTag(m.owner), main.querySelector(".item-time"));
    main.querySelector(".item-time").textContent = formatListTime(new Date(m.time));
    main.querySelector(".item-sub").textContent = m.text;

    link.append(createAvatar(contact), main);
    li.appendChild(link);
    recentList.appendChild(li);
  }
})();
