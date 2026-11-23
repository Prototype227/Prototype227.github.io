// Portfolio scripts: no build step, no dependencies.

(function () {
  "use strict";

  // ----- Footer year -----
  var year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  // ----- Gameplay clips -----
  function showPending(el) {
    var note = document.createElement("div");
    note.className = "clip-pending";
    note.textContent = "Clip coming soon";
    if (el.parentNode) el.parentNode.removeAttribute("data-paused");
    el.replaceWith(note);
  }

  // A YouTube embed still pointing at the VIDEO_ID placeholder gets a
  // "coming soon" card instead of YouTube's "video unavailable" player.
  var embeds = document.querySelectorAll('.clip iframe[src*="/embed/VIDEO_ID"]');
  Array.prototype.forEach.call(embeds, showPending);

  // ----- Silent loops -----
  // <video> elements in .clip wrappers are short muted MP4s used like GIFs.
  // The markup ships with `controls` so they still work without JS. With JS
  // they play only while on screen, and click/tap or Enter/Space pauses them.
  // Visitors who prefer reduced motion keep the normal player controls.
  // A file that isn't in clips/ yet shows the "coming soon" card.
  var loops = document.querySelectorAll(".clip video");
  var reduceMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var observer = (!reduceMotion && "IntersectionObserver" in window)
    ? new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          var video = entry.target;
          if (entry.isIntersecting && !video.userPaused) play(video);
          else if (!entry.isIntersecting) video.pause();
        });
      }, { threshold: 0.25 })
    : null;

  function play(video) {
    var p = video.play();
    if (p && p.catch) p.catch(function () {}); // missing file: handled by "error"
  }

  function toggle(video) {
    video.userPaused = !video.paused;
    if (video.userPaused) video.pause();
    else play(video);
    video.parentNode.setAttribute("data-paused", video.userPaused ? "true" : "false");
  }

  Array.prototype.forEach.call(loops, function (video) {
    video.addEventListener("error", function () {
      if (observer) observer.unobserve(video);
      showPending(video);
    });
    if (video.error) return showPending(video);
    if (!observer) return;

    video.muted = true;
    video.controls = false;
    video.tabIndex = 0;
    video.addEventListener("click", function () { toggle(video); });
    video.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle(video);
      }
    });
    observer.observe(video);
  });

  // ----- Pi status footer -----
  // ~/bin/pi-status.sh on the Pi writes status.json every minute:
  //   {"tempC": 48, "uptimeSec": 123456, "updated": "2026-11-19T09:00:00+08:00"}
  // It's git-ignored, so on GitHub Pages (or file://) the fetch fails and the
  // plain-text line already in the HTML stays as it is.
  var statusEl = document.getElementById("pi-status");
  if (!statusEl || !window.fetch) return;

  var STALE_MS = 5 * 60 * 1000; // cron writes every minute; 5 min of silence = stale
  var REFRESH_MS = 60 * 1000;
  var timer = null;

  function plural(n, word) {
    return n + " " + word + (n === 1 ? "" : "s");
  }

  function formatUptime(sec) {
    var mins = Math.floor(sec / 60);
    var hours = Math.floor(mins / 60);
    var days = Math.floor(hours / 24);
    if (days >= 1) return plural(days, "day") + (hours % 24 ? ", " + plural(hours % 24, "hour") : "");
    if (hours >= 1) return plural(hours, "hour");
    if (mins >= 1) return plural(mins, "minute");
    return "less than a minute";
  }

  function render(s) {
    var text = "Served live from a Raspberry Pi 4 in my room · up " +
      formatUptime(s.uptimeSec) + " · CPU " + s.tempC + " °C";

    var updated = Date.parse(s.updated);
    var stale = !isNaN(updated) && Date.now() - updated > STALE_MS;
    if (stale) {
      text += " · as of " + new Date(updated).toLocaleString([], {
        dateStyle: "medium",
        timeStyle: "short"
      });
    }

    statusEl.textContent = text;
    statusEl.setAttribute("data-live", "true");
    statusEl.setAttribute("data-stale", stale ? "true" : "false");
  }

  function load() {
    return fetch("status.json", { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (s) {
        if (!s || typeof s.uptimeSec !== "number" || typeof s.tempC !== "number") {
          throw new Error("unexpected status.json shape");
        }
        render(s);
        return true;
      })
      .catch(function () {
        return false; // keep whatever the line currently says
      });
  }

  load().then(function (ok) {
    // Only keep polling where status.json exists (i.e. on the Pi).
    if (ok) timer = setInterval(load, REFRESH_MS);
  });

  document.addEventListener("visibilitychange", function () {
    if (!timer) return; // never went live: nothing to pause or resume
    clearInterval(timer);
    if (document.hidden) {
      timer = -1; // paused
      return;
    }
    load();
    timer = setInterval(load, REFRESH_MS);
  });
})();
