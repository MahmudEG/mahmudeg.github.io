/* mahmud_eg landing — UI behaviour (noob mode + shared mode toggle) */
(function () {
  "use strict";

  var SITE = "https://mahmudeg.github.io";
  var BLOG = SITE + "/blog";
  // When the landing is served on the same host as the blog (production, or a
  // local preview of the assembled _site), prefer the same-origin copy.
  var LOCAL_BLOG = window.location.origin + "/blog";
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // search.json urls are site-root-relative and include the /blog prefix once
  // the blog is built with baseurl "/blog"; tolerate both old and new shapes.
  function postUrl(u) {
    if (u.indexOf("http") === 0) return u;
    return u.indexOf("/blog/") === 0 ? SITE + u : BLOG + u;
  }
  function blogRelative(u) { return u.replace(/^\/blog(?=\/)/, ""); }

  function fetchIndex() {
    return fetch(LOCAL_BLOG + "/assets/js/data/search.json", { cache: "no-cache" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .catch(function () {
        return fetch(BLOG + "/assets/js/data/search.json", { cache: "no-cache" })
          .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
      });
  }

  /* ---------- mode toggle (noob <-> pro) ---------- */
  var root = document.documentElement;
  var toggle = document.getElementById("mode-toggle");
  var termRoot = document.getElementById("terminal-root");

  function setMode(mode, persist) {
    root.setAttribute("data-mode", mode);
    toggle.setAttribute("aria-checked", mode === "pro" ? "true" : "false");
    termRoot.hidden = mode !== "pro";
    document.body.style.overflow = mode === "pro" ? "hidden" : "";
    if (persist) { try { localStorage.setItem("mode", mode); } catch (e) {} }
    if (mode === "pro" && window.__termBoot) window.__termBoot();
  }
  window.__setMode = setMode;

  toggle.addEventListener("click", function () {
    setMode(root.getAttribute("data-mode") === "pro" ? "noob" : "pro", true);
  });
  var footerPro = document.getElementById("footer-pro");
  if (footerPro) footerPro.addEventListener("click", function () { setMode("pro", true); });

  var saved = null;
  try { saved = localStorage.getItem("mode"); } catch (e) {}
  if (saved === "pro") setMode("pro", false);

  /* ---------- nav clock ---------- */
  var clockEl = document.getElementById("clock-time");
  function tick() {
    var d = new Date();
    clockEl.textContent =
      String(d.getHours()).padStart(2, "0") + ":" +
      String(d.getMinutes()).padStart(2, "0") + ":" +
      String(d.getSeconds()).padStart(2, "0");
  }
  tick();
  setInterval(tick, 1000);

  /* ---------- hero typing effect ---------- */
  var typed = document.getElementById("typed-sub");
  var fullText = typed.getAttribute("data-text")
    .replace(/&amp;/g, "&");
  if (reducedMotion) {
    typed.textContent = fullText;
  } else {
    var i = 0;
    (function type() {
      if (i <= fullText.length) {
        typed.textContent = fullText.slice(0, i++);
        setTimeout(type, i < 20 ? 34 : 18);
      }
    })();
  }

  /* ---------- scroll reveal ---------- */
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) {
        en.target.classList.add("is-in");
        io.unobserve(en.target);
      }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll(".reveal").forEach(function (el) { io.observe(el); });

  /* ---------- blog feed ---------- */
  // Static fallback: hand-written summaries from the source-of-truth audit (§7).
  var FALLBACK = [
    { title: "Detect and Remediate an AD CS ESC1 Certificate Template (Step-by-Step Lab)",
      url: "/posts/deploy-hybrid-file-share-azure-file-sync/", date: "2026-07-16",
      tags: ["Active Directory", "AD CS", "Security"],
      excerpt: "Find the certificate template that lets any domain user request a cert as Domain Admin, prove the exposure, and close it — with verification at every step." },
    { title: "Deploy a Group Managed Service Account (gMSA) for a Scheduled Task (Step-by-Step Lab)",
      url: "/posts/deploy-gmsa-scheduled-task/", date: "2026-07-09",
      tags: ["Active Directory", "gMSA", "PowerShell"],
      excerpt: "Replace a static service-account password with a domain-managed gMSA: KDS root key, provisioning, member hosts, and a scheduled task running under it." },
    { title: "Fix Windows UUID/SID Conflict in EVE-NG Labs (Domain Join Issue)",
      url: "/posts/fix-windows-uuid-sid-conflict-eve-ng/", date: "2026-04-22",
      tags: ["EVE-NG", "Sysprep", "Domain Join"],
      excerpt: "Cloned Windows Server VMs share the same SID and Machine GUID, so AD rejects domain joins. The root cause and the Sysprep/PowerShell fix." },
    { title: "Windows Hello for Business in a Hybrid Environment: Key Trust + MFA Deployment",
      url: "/posts/windows-hello-for-business-hybrid/", date: "2025-10-23",
      tags: ["Entra ID", "MFA", "Passwordless"],
      excerpt: "Deploying WHfB (Key Trust) with Azure AD MFA across hybrid AD and Entra ID — prerequisites, the provisioning flow, and the blockers that break it in production." },
    { title: "Azure for the On-Prem Sysadmin: What Actually Changes",
      url: "/posts/azure-for-the-on-prem-sysadmin/", date: "2025-07-15",
      tags: ["Azure", "Hybrid", "Cloud"],
      excerpt: "Azure explained for sysadmins coming from Windows Server and AD — what maps over, what doesn't, and the identity and networking concepts that matter." },
    { title: "Redundancy Protocols Lab: STP, HSRP, and VRRP in EVE-NG",
      url: "/posts/redundancy-protocols-lab/", date: "2025-03-07",
      tags: ["Networking", "Cisco", "EVE-NG"],
      excerpt: "STP, HSRP, and VRRP compared in a multi-switch EVE-NG topology — configuration, failover testing, and what actually happens when a link drops." }
  ];

  var grid = document.getElementById("posts-grid");
  var status = document.getElementById("feed-status");

  function renderPosts(posts, live) {
    grid.innerHTML = "";
    posts.forEach(function (p, idx) {
      var a = document.createElement("a");
      a.className = "post";
      a.href = postUrl(p.url);
      a.target = "_blank";
      a.rel = "noopener";

      var date = document.createElement("span");
      date.className = "post__date mono";
      date.textContent = p.date;

      var h = document.createElement("h3");
      h.textContent = p.title;

      var ex = document.createElement("p");
      ex.textContent = p.excerpt;

      var tags = document.createElement("div");
      tags.className = "post__tags mono";
      (p.tags || []).slice(0, 3).forEach(function (t) {
        var c = document.createElement("span");
        c.className = "chip";
        c.textContent = t;
        tags.appendChild(c);
      });

      a.append(date, h, ex, tags);
      grid.appendChild(a);
      if (reducedMotion) { a.classList.add("is-in"); }
      else { setTimeout(function () { a.classList.add("is-in"); }, 60 * idx); }
    });
    status.textContent = live
      ? "// live feed — " + posts.length + " most recent of the archive"
      : "// showing cached list — live feed unreachable";
  }

  function normalizeDate(s) {
    // "2026-07-16 10:00:00 +0200" -> Date (parse consistently across browsers)
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(s);
  }

  /* Everything below derives from the blog's own search index, so new posts
     show up here (and in the topic counts) with no landing-page edits. */
  fetchIndex()
    .then(function (raw) {
      var posts = raw.map(function (p) {
        var d = normalizeDate(p.date);
        var m = /^(\d{4}-\d{2}-\d{2})/.exec(p.date);
        return {
          title: p.title,
          url: p.url,
          _d: d,
          date: m ? m[1] : p.date,
          categories: p.categories ? p.categories.split(", ") : [],
          tags: p.tags ? p.tags.split(", ") : [],
          excerpt: (p.content || p.snippet || "").slice(0, 150).trim() + "…"
        };
      }).sort(function (a, b) { return b._d - a._d; });

      updateTopicCounts(posts);

      var latest = posts.slice(0, 6);
      // Prefer the hand-written summaries over raw body truncation when we have them.
      latest.forEach(function (p) {
        var known = FALLBACK.find(function (f) { return f.url === blogRelative(p.url); });
        if (known) p.excerpt = known.excerpt;
      });
      renderPosts(latest, true);
    })
    .catch(function () { renderPosts(FALLBACK, false); });

  /* keep the topic-card counts honest as the archive grows */
  function updateTopicCounts(posts) {
    function count(fn) { return posts.filter(fn).length; }
    var el;
    if ((el = document.getElementById("count-cyber"))) {
      el.textContent = count(function (p) { return p.categories.indexOf("Cybersecurity") !== -1; })
        + " posts → hardening + writeups";
    }
    if ((el = document.getElementById("count-systems"))) {
      var n = count(function (p) {
        return p.tags.indexOf("Active Directory") !== -1 || p.tags.indexOf("Windows Server") !== -1;
      });
      el.textContent = "core focus → " + n + " labs & counting";
    }
  }

  /* ---------- obfuscated email (same trick the blog uses) ---------- */
  var emailLink = document.getElementById("email-link");
  var emailText = document.getElementById("email-text");
  var revealed = false;
  emailLink.addEventListener("click", function (e) {
    var addr = ["mahmudeg2000", "gmail.com"].join("@");
    if (!revealed) {
      e.preventDefault();
      emailText.textContent = addr;
      emailLink.href = "mailto:" + addr;
      revealed = true;
    }
  });
})();
