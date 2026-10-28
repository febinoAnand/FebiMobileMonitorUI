// Find my phone: the phone's GPS location on a map, its location history, and Ring / Lost mode / Erase.
// On the phone itself (mobile view) "Locate now" reads the real GPS through the browser.
// Admins follow the View switch: one user's phone, or every user's phone on one map.
// UI only: sample locations stand in for what the app on each phone reports; the backend will store real ones.

(function () {
  // Known places, used for the sample routes and to describe a GPS fix ("near MG Road, Bengaluru")
  const PLACES = [
    { name: "MG Road, Bengaluru", lat: 12.9756, lng: 77.6066 },
    { name: "Koramangala, Bengaluru", lat: 12.9352, lng: 77.6245 },
    { name: "Indiranagar, Bengaluru", lat: 12.9719, lng: 77.6412 },
    { name: "Whitefield, Bengaluru", lat: 12.9698, lng: 77.7500 },
    { name: "Anna Salai, Chennai", lat: 13.0604, lng: 80.2496 },
    { name: "T. Nagar, Chennai", lat: 13.0418, lng: 80.2341 },
    { name: "Adyar, Chennai", lat: 13.0012, lng: 80.2565 }
  ];
  const NETWORKS = ["Wi-Fi", "4G", "5G", "4G"];

  const hashOf = (text) => [...text].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const LOC_KEY = (u) => "smsReader.location." + u;
  const FIND_KEY = (u) => "smsReader.find." + u;

  // Distance in km between two points
  function km(a, b) {
    const R = 6371, rad = (d) => (d * Math.PI) / 180;
    const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }

  function describe(point) {
    const near = PLACES.map((p) => ({ p, d: km(point, p) })).sort((a, b) => a.d - b.d)[0];
    if (near.d < 0.4) return near.p.name;
    if (near.d < 40) return near.d.toFixed(1) + " km from " + near.p.name;
    return point.lat.toFixed(4) + ", " + point.lng.toFixed(4);
  }

  // A day of movement between two places for each user (the same every time for the same user)
  function sampleHistory(username) {
    const h = hashOf(username);
    const home = PLACES[h % PLACES.length];
    const sameCity = PLACES.filter((p) => p !== home && p.name.split(", ")[1] === home.name.split(", ")[1]);
    const work = sameCity[h % sameCity.length];
    const points = [];
    const now = Date.now();
    for (let i = 0; i < 14; i++) {
      // Every 3 hours over the last week-ish, newest first; mornings at work, evenings at home
      const time = now - (5 + i * 180) * 60000 - (h % 40) * 60000;
      const hour = new Date(time).getHours();
      const at = hour >= 9 && hour < 18 ? work : home;
      const jitter = (n) => ((hashOf(username + i + n) % 1000) / 1000 - 0.5) * 0.006;
      // Each person lives and works in a slightly different street
      const spread = (n) => ((hashOf(username + n) % 1000) / 1000 - 0.5) * 0.035;
      points.push({ lat: at.lat + spread("lat") + jitter("a"), lng: at.lng + spread("lng") + jitter("b"), time: new Date(time).toISOString(), accuracy: 8 + (hashOf(username + i) % 30), source: "app" });
    }
    return points;
  }

  // Everything known about a user's phone location, newest first
  function locationsOf(username) {
    const saved = readJSON(localStorage, LOC_KEY(username)) || [];
    return [...saved, ...sampleHistory(username)].sort((a, b) => b.time.localeCompare(a.time));
  }

  function findState(username) {
    return readJSON(localStorage, FIND_KEY(username)) || { sharing: true, lost: null, erased: null };
  }

  function saveFindState(username, state) {
    writeJSON(localStorage, FIND_KEY(username), state);
  }

  function phoneStatus(username) {
    const h = hashOf(username + new Date().toDateString());
    return { battery: 35 + (h % 60), network: NETWORKS[h % NETWORKS.length] };
  }

  // ---------- Who is on screen ----------

  const me = myUsername();
  const users = scopeUsernames();
  const allMode = showOwnerTags();
  const owner = users[0];
  const ownerAccount = accountByUsername(owner);
  const ownerName = owner === me ? "My phone" : (ownerAccount ? ownerAccount.name + "'s phone" : owner);
  const onThisPhone = getView() === "mobile" && owner === me;

  document.querySelectorAll("[data-icon]").forEach((el) => { el.innerHTML = ICONS[el.dataset.icon]; });
  $("loc-title").textContent = allMode ? "All users' phones" : ownerName;

  // ---------- Map ----------

  let map = null;
  let layers = [];
  const hasMap = typeof L !== "undefined";

  function setupMap() {
    if (!hasMap) {
      $("loc-map").hidden = true;
      $("loc-map-fallback").hidden = false;
      return;
    }
    map = L.map("loc-map", { zoomControl: true, attributionControl: true }).setView([12.97, 77.6], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);
  }

  function clearMap() {
    layers.forEach((layer) => layer.remove());
    layers = [];
  }

  // A round marker with the person's initials
  function personIcon(account, live) {
    const color = avatarColor({ id: account ? account.id : "x" });
    const text = account ? initials({ name: account.name }) : "?";
    return L.divIcon({
      className: "",
      html: '<span class="map-pin' + (live ? " live" : "") + '" style="--pin:' + color + '">' + text + "</span>",
      iconSize: [38, 38],
      iconAnchor: [19, 19]
    });
  }

  // ---------- One phone ----------

  function renderOne() {
    const state = findState(owner);
    const history = locationsOf(owner);
    const last = history[0];
    const status = phoneStatus(owner);

    $("loc-sharing").checked = state.sharing;
    $("loc-sharing").disabled = owner !== me;
    $("loc-sharing-note").textContent = owner === me
      ? "Lets SMS Reader find this phone if it's lost."
      : "Only " + (ownerAccount ? ownerAccount.name : owner) + " can change this on their phone.";

    if (!state.sharing) {
      $("loc-off").hidden = false;
      $("loc-details").hidden = true;
      $("loc-updated").textContent = "Location sharing is off";
      clearMap();
      renderHistory([]);
    } else {
      $("loc-off").hidden = true;
      $("loc-details").hidden = false;
      $("loc-place").textContent = last.label || describe(last);
      $("loc-coords").textContent = last.lat.toFixed(5) + ", " + last.lng.toFixed(5);
      $("loc-seen").textContent = formatListTime(new Date(last.time)) + (relativeDay(new Date(last.time)) === "Today" ? "" : " · " + formatTime(new Date(last.time)));
      $("loc-seen").title = new Date(last.time).toLocaleString();
      $("loc-accuracy").textContent = "± " + Math.round(last.accuracy) + " m";
      $("loc-battery").textContent = status.battery + "%";
      $("loc-battery").className = status.battery < 20 ? "low" : "";
      $("loc-network").textContent = status.network;
      $("loc-source").textContent = last.source === "gps" ? "Live GPS from this phone" : "Reported by the app";
      $("loc-directions").href = "https://www.google.com/maps/dir/?api=1&destination=" + last.lat + "," + last.lng;
      $("loc-fallback-coords").textContent = last.lat.toFixed(5) + ", " + last.lng.toFixed(5);
      $("loc-fallback-link").href = "https://www.openstreetmap.org/?mlat=" + last.lat + "&mlon=" + last.lng + "#map=16/" + last.lat + "/" + last.lng;
      $("loc-updated").textContent = "Updated " + formatListTime(new Date(last.time)).toLowerCase();
      renderHistory(history);
    }

    // Lost mode / erase status
    const box = $("find-status");
    box.hidden = !state.lost && !state.erased;
    box.className = "find-status" + (state.erased ? " erased" : "");
    box.innerHTML = "";
    if (state.lost) {
      box.innerHTML = '<strong>Lost mode is on</strong><span class="lost-preview"><span class="lost-lock">🔒</span><span><em></em><small></small></span></span><button type="button" class="link link-btn" id="lost-off">Turn off lost mode</button>';
      box.querySelector("em").textContent = state.lost.message;
      box.querySelector("small").textContent = state.lost.contact ? "Call " + state.lost.contact : "";
      $("lost-off").addEventListener("click", () => {
        const s = findState(owner);
        s.lost = null;
        saveFindState(owner, s);
        showToast("Lost mode turned off");
        renderOne();
      });
    }
    if (state.erased) {
      const p = document.createElement("p");
      p.textContent = "Erase requested " + formatListTime(new Date(state.erased)).toLowerCase() + ". It runs as soon as the phone is online. (Demo: nothing was deleted.)";
      box.appendChild(p);
    }
    $("act-lost").classList.toggle("on", !!state.lost);
  }

  function renderHistory(history) {
    const range = $("loc-range").value;
    const since = Date.now() - (range === "week" ? 7 * 24 : 24) * 3600 * 1000;
    const points = history.filter((p) => new Date(p.time).getTime() >= since);
    const list = $("loc-history");
    list.innerHTML = "";
    if (!points.length) {
      list.innerHTML = '<li class="empty-note">No locations in this period</li>';
    }
    points.forEach((p, i) => {
      const li = document.createElement("li");
      li.className = "loc-step" + (i === 0 ? " latest" : "");
      li.innerHTML = '<span class="loc-dot"></span><div><strong></strong><small></small></div>';
      li.querySelector("strong").textContent = p.label || describe(p);
      li.querySelector("small").textContent = formatListTime(new Date(p.time)) + (relativeDay(new Date(p.time)) === "Today" ? "" : " · " + formatTime(new Date(p.time))) + (p.source === "gps" ? " · GPS" : "");
      li.tabIndex = 0;
      li.addEventListener("click", () => map && map.setView([p.lat, p.lng], 16));
      li.addEventListener("keydown", (e) => { if (e.key === "Enter" && map) map.setView([p.lat, p.lng], 16); });
      list.appendChild(li);
    });

    if (!map) return;
    clearMap();
    if (!points.length) return;
    const path = points.map((p) => [p.lat, p.lng]);
    layers.push(L.polyline(path, { color: "#6366f1", weight: 3, opacity: 0.6, dashArray: "6 6" }).addTo(map));
    points.slice(1).forEach((p) => layers.push(L.circleMarker([p.lat, p.lng], { radius: 5, color: "#fff", weight: 2, fillColor: "#6366f1", fillOpacity: 0.9 })
      .bindTooltip((p.label || describe(p)) + " · " + formatListTime(new Date(p.time))).addTo(map)));
    const last = points[0];
    layers.push(L.circle([last.lat, last.lng], { radius: last.accuracy, color: "#10b981", weight: 1, fillColor: "#10b981", fillOpacity: 0.15 }).addTo(map));
    layers.push(L.marker([last.lat, last.lng], { icon: personIcon(ownerAccount, true), zIndexOffset: 1000 })
      .bindPopup("<strong>" + escapeHtml(ownerName) + "</strong><br>" + escapeHtml(last.label || describe(last))).addTo(map));
    map.fitBounds(L.latLngBounds(path).pad(0.3), { maxZoom: 15 });
  }

  // ---------- All users ----------

  function renderAll() {
    $("loc-one").hidden = true;
    $("loc-people").hidden = false;
    $("loc-refresh").hidden = true;
    const list = $("loc-people-list");
    list.innerHTML = "";
    const bounds = [];
    let latest = null;
    for (const username of users) {
      const account = accountByUsername(username);
      const state = findState(username);
      const last = locationsOf(username)[0];
      const status = phoneStatus(username);
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "loc-person";
      btn.innerHTML = '<span class="loc-person-text"><strong></strong><small></small></span><span class="loc-person-meta"></span>';
      btn.prepend(createAvatar({ id: account.id, name: account.name }));
      btn.querySelector("strong").textContent = account.name + (username === me ? " (you)" : "");
      btn.querySelector("small").textContent = state.sharing ? describe(last) : "Location sharing is off";
      btn.querySelector(".loc-person-meta").textContent = state.sharing ? formatListTime(new Date(last.time)) + " · 🔋 " + status.battery + "%" : "";
      if (state.lost) btn.classList.add("lost");
      btn.addEventListener("click", () => {
        setViewUser(username === me ? "me" : username);
        location.reload();
      });
      li.appendChild(btn);
      list.appendChild(li);
      if (map && state.sharing) {
        bounds.push([last.lat, last.lng]);
        layers.push(L.marker([last.lat, last.lng], { icon: personIcon(account, false) })
          .bindTooltip(account.name + " · " + describe(last)).addTo(map));
      }
      if (state.sharing && (!latest || last.time > latest)) latest = last.time;
    }
    $("loc-updated").textContent = users.length + " phones" + (latest ? " · latest " + formatListTime(new Date(latest)).toLowerCase() : "");
    if (map && bounds.length) map.fitBounds(L.latLngBounds(bounds).pad(0.2), { maxZoom: 13 });
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // ---------- Locate now ----------

  function saveFix(point) {
    const saved = readJSON(localStorage, LOC_KEY(owner)) || [];
    saved.unshift(point);
    writeJSON(localStorage, LOC_KEY(owner), saved.slice(0, 50));
  }

  $("loc-refresh").addEventListener("click", () => {
    if (!findState(owner).sharing) {
      showToast("Turn on location sharing first");
      return;
    }
    const btn = $("loc-refresh");
    btn.disabled = true;
    btn.textContent = "Locating…";
    const done = (msg) => {
      btn.disabled = false;
      btn.textContent = "Locate now";
      renderOne();
      showToast(msg);
    };

    // On the phone: the real GPS
    if (onThisPhone && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const p = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, time: new Date().toISOString(), source: "gps" };
          p.label = describe(p);
          saveFix(p);
          done("Location updated from GPS");
        },
        (err) => {
          btn.disabled = false;
          btn.textContent = "Locate now";
          showToast(err.code === 1 ? "Allow location access in your browser to use GPS" : "Couldn't get a GPS fix. Try again outdoors.");
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
      return;
    }

    // From a computer: the phone reports in (demo: a fresh fix near the last one)
    setTimeout(() => {
      const last = locationsOf(owner)[0];
      const move = () => (Math.random() - 0.5) * 0.002;
      saveFix({ lat: last.lat + move(), lng: last.lng + move(), accuracy: 6 + Math.round(Math.random() * 12), time: new Date().toISOString(), source: "app" });
      done("The phone reported its location");
    }, 1200);
  });

  $("loc-range").addEventListener("change", () => renderOne());

  $("loc-sharing").addEventListener("change", (e) => {
    const s = findState(owner);
    s.sharing = e.target.checked;
    saveFindState(owner, s);
    showToast(s.sharing ? "Location sharing is on" : "Location sharing is off");
    renderOne();
  });

  // ---------- Ring ----------

  let ringTimer = null;
  let audio = null;

  function stopRing() {
    clearInterval(ringTimer);
    ringTimer = null;
    if (audio) {
      audio.close();
      audio = null;
    }
    if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(0);
    $("act-ring").classList.remove("on");
    $("ring-label").textContent = "Ring";
  }

  // A loud two-tone alarm; on a real phone the app plays it even on silent
  function playAlarm() {
    try {
      audio = new (window.AudioContext || window.webkitAudioContext)();
      const beep = (at, freq) => {
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        osc.type = "square";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, audio.currentTime + at);
        gain.gain.exponentialRampToValueAtTime(0.25, audio.currentTime + at + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + at + 0.28);
        osc.connect(gain).connect(audio.destination);
        osc.start(audio.currentTime + at);
        osc.stop(audio.currentTime + at + 0.3);
      };
      for (let s = 0; s < 30; s++) {
        beep(s, 1320);
        beep(s + 0.35, 990);
      }
    } catch {
      // no audio available
    }
    // Phones only vibrate after a real tap
    const tapped = !navigator.userActivation || navigator.userActivation.hasBeenActive;
    if (navigator.vibrate && tapped) navigator.vibrate(Array(30).fill([400, 600]).flat());
  }

  $("act-ring").addEventListener("click", () => {
    if (ringTimer) {
      stopRing();
      showToast("Stopped ringing");
      return;
    }
    let left = 30;
    $("act-ring").classList.add("on");
    $("ring-label").textContent = "Stop ringing (" + left + "s)";
    // The sound plays here only when this is the phone itself
    if (onThisPhone) playAlarm();
    showToast(onThisPhone ? "Ringing this phone" : "Ringing " + ownerName.replace("My phone", "your phone") + " for 30 seconds");
    ringTimer = setInterval(() => {
      left -= 1;
      $("ring-label").textContent = "Stop ringing (" + left + "s)";
      if (left <= 0) stopRing();
    }, 1000);
  });

  // ---------- Lost mode ----------

  const lostModal = $("lost-modal");
  $("act-lost").addEventListener("click", () => {
    const s = findState(owner);
    $("lost-message").value = s.lost ? s.lost.message : "This phone has been lost. Please call me.";
    $("lost-contact").value = s.lost ? s.lost.contact : (currentAccount() && currentAccount().number ? formatPhone(currentAccount().country, currentAccount().number) : "");
    $("lost-error").textContent = "";
    openDialog(lostModal);
    $("lost-message").focus();
  });
  $("lost-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const message = $("lost-message").value.trim();
    if (!message) {
      $("lost-error").textContent = "Write a short message for whoever finds the phone";
      return;
    }
    const s = findState(owner);
    s.lost = { message, contact: $("lost-contact").value.trim(), since: new Date().toISOString() };
    saveFindState(owner, s);
    lostModal.close();
    showToast("Lost mode is on: the phone is locked and shows your message");
    renderOne();
  });

  // ---------- Erase ----------

  const eraseModal = $("erase-modal");
  $("act-erase").addEventListener("click", () => {
    $("erase-confirm").value = "";
    $("erase-btn").disabled = true;
    openDialog(eraseModal);
    $("erase-confirm").focus();
  });
  $("erase-confirm").addEventListener("input", (e) => {
    $("erase-btn").disabled = e.target.value.trim().toUpperCase() !== "ERASE";
  });
  $("erase-btn").addEventListener("click", () => {
    const s = findState(owner);
    s.erased = new Date().toISOString();
    saveFindState(owner, s);
    eraseModal.close();
    showToast("Erase requested");
    renderOne();
  });

  // ---------- Start ----------

  wireDialogs();
  setupMap();
  if (allMode) renderAll();
  else renderOne();
  // The map measures its box once the page has its final size
  if (map) setTimeout(() => map.invalidateSize(), 300);
})();
