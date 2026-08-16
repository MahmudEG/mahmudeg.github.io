/* Cheat sheets — index filtering + per-sheet TOC and copy buttons.
   One file serves both pages; each half no-ops if its markup is absent. */
(function () {
  "use strict";

  /* ================= index: category filter + text search ================= */
  var search = document.getElementById("cs-search");
  var filters = document.getElementById("cs-filters");

  if (search && filters) {
    var cards = Array.prototype.slice.call(document.querySelectorAll(".cs-card"));
    var groups = Array.prototype.slice.call(document.querySelectorAll(".cs-group"));
    var empty = document.getElementById("cs-empty");
    var activeCat = "all";

    function apply() {
      var q = search.value.trim().toLowerCase();
      var shown = 0;

      cards.forEach(function (card) {
        var catOk = activeCat === "all" || card.dataset.cat === activeCat;
        var textOk = !q || card.dataset.search.indexOf(q) !== -1;
        var visible = catOk && textOk;
        card.hidden = !visible;
        if (visible) shown++;
      });

      // hide a category heading when nothing under it survived the filter
      groups.forEach(function (g) {
        var any = g.querySelector(".cs-card:not([hidden])");
        g.hidden = !any;
      });

      if (empty) empty.hidden = shown !== 0;
    }

    filters.addEventListener("click", function (e) {
      var btn = e.target.closest(".cs-chip");
      if (!btn) return;
      activeCat = btn.dataset.cat;
      filters.querySelectorAll(".cs-chip").forEach(function (b) {
        b.classList.toggle("is-active", b === btn);
      });
      apply();
    });

    search.addEventListener("input", apply);
    search.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { search.value = ""; apply(); }
    });
  }

  /* ================= sheet: table of contents ================= */
  var content = document.getElementById("cs-content");
  var tocList = document.getElementById("cs-toc-list");

  if (content && tocList) {
    var heads = Array.prototype.slice.call(content.querySelectorAll("h2"));
    heads.forEach(function (h, i) {
      if (!h.id) {
        h.id = (h.textContent || "section")
          .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "section-" + i;
      }
      var a = document.createElement("a");
      a.href = "#" + h.id;
      a.textContent = h.textContent;
      tocList.appendChild(a);
    });

    var links = Array.prototype.slice.call(tocList.querySelectorAll("a"));
    if (heads.length) {
      var spy = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          links.forEach(function (l) {
            l.classList.toggle("is-active", l.getAttribute("href") === "#" + en.target.id);
          });
        });
      }, { rootMargin: "-80px 0px -70% 0px" });
      heads.forEach(function (h) { spy.observe(h); });
    }
  }

  /* ================= sheet: copy buttons on code blocks ================= */
  if (content && navigator.clipboard) {
    // div.highlighter-rouge only — inline <code> shares the class.
    content.querySelectorAll("div.highlighter-rouge").forEach(function (block) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cs-copy mono";
      btn.textContent = "copy";
      btn.setAttribute("aria-label", "Copy code to clipboard");

      btn.addEventListener("click", function () {
        // With Chirpy's global line numbers the code lives in td.rouge-code;
        // fall back to the <pre> when it doesn't.
        var src = block.querySelector("td.rouge-code") || block.querySelector("pre");
        if (!src) return;
        navigator.clipboard.writeText(src.innerText.replace(/\n+$/, "")).then(function () {
          btn.textContent = "copied";
          btn.classList.add("is-done");
          setTimeout(function () {
            btn.textContent = "copy";
            btn.classList.remove("is-done");
          }, 1600);
        });
      });

      block.appendChild(btn);
    });
  }
})();
