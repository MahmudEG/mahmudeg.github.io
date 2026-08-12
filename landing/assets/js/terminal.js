/* PRO mode — Kali-style terminal reader for the whole site.
   Everything printable here mirrors the noob-mode content; posts are fetched
   live from the blog's search.json with a static fallback. */
(function () {
  "use strict";

  var SITE = "https://mahmudeg.github.io";
  var BLOG = SITE + "/blog";
  var LOCAL_BLOG = window.location.origin + "/blog";
  // search.json urls include the /blog prefix once baseurl is set; tolerate both.
  function postUrl(u) {
    if (u.indexOf("http") === 0) return u;
    return u.indexOf("/blog/") === 0 ? SITE + u : BLOG + u;
  }
  var out = document.getElementById("term-output");
  var input = document.getElementById("term-input");
  var screen = document.getElementById("term-screen");

  var history = [];
  var histIdx = -1;
  var booted = false;
  var posts = null; // filled by `posts` command

  /* ---------- printing helpers ---------- */
  function esc(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  // tiny markup: [g]..[/g] green, [b]..[/b] bright, [d]..[/d] dim, [w]..[/w] white,
  // [r]..[/r] red, [y]..[/y] yellow, [u:url]label[/u] link
  function fmt(s) {
    return esc(s)
      .replace(/\[g\]/g, '<span class="t-green">').replace(/\[\/g\]/g, "</span>")
      .replace(/\[b\]/g, '<span class="t-bright">').replace(/\[\/b\]/g, "</span>")
      .replace(/\[d\]/g, '<span class="t-dim">').replace(/\[\/d\]/g, "</span>")
      .replace(/\[w\]/g, '<span class="t-white">').replace(/\[\/w\]/g, "</span>")
      .replace(/\[r\]/g, '<span class="t-red">').replace(/\[\/r\]/g, "</span>")
      .replace(/\[y\]/g, '<span class="t-yellow">').replace(/\[\/y\]/g, "</span>")
      .replace(/\[u:([^\]]+)\]([^[]*)\[\/u\]/g,
        '<a href="$1" target="_blank" rel="noopener">$2</a>');
  }
  function print(s) {
    var div = document.createElement("div");
    div.innerHTML = fmt(s == null ? "" : s);
    out.appendChild(div);
    screen.scrollTop = screen.scrollHeight;
  }
  function printLines(lines) { lines.forEach(print); }
  function echoCmd(cmd) {
    print('[g]mahmud@mahmudeg[/g][d]:[/d][b]~[/b][d]$[/d] [w]' + cmd + "[/w]");
  }

  /* ---------- content ---------- */
  var BANNER = [
    "",
    "[g]  ███╗   ███╗ █████╗ ██╗  ██╗███╗   ███╗██╗   ██╗██████╗[/g]",
    "[g]  ████╗ ████║██╔══██╗██║  ██║████╗ ████║██║   ██║██╔══██╗[/g]",
    "[g]  ██╔████╔██║███████║███████║██╔████╔██║██║   ██║██║  ██║[/g]",
    "[g]  ██║╚██╔╝██║██╔══██║██╔══██║██║╚██╔╝██║██║   ██║██║  ██║[/g]",
    "[g]  ██║ ╚═╝ ██║██║  ██║██║  ██║██║ ╚═╝ ██║╚██████╔╝██████╔╝[/g]",
    "[g]  ╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝     ╚═╝ ╚═════╝ ╚═════╝[/g]",
    "  [d]────────────────────────────────────────────────────────[/d]",
    "  [w]Mahmud Elgoueri[/w] [d]//[/d] hybrid microsoft infrastructure engineer",
    "  [d]Windows Server · Active Directory · Azure & Entra ID[/d]",
    ""
  ];

  var HELP = [
    "",
    "[w]Available commands:[/w]",
    "",
    "  [g]help[/g], [g]/?[/g]        show this help",
    "  [g]whoami[/g]          about me",
    "  [g]experience[/g]      professional experience",
    "  [g]skills[/g]          technical skills",
    "  [g]projects[/g]        key projects",
    "  [g]certs[/g]           certifications",
    "  [g]cv[/g]              download my CV (pdf)",
    "  [g]topics[/g]          what the blog covers (honest sizing)",
    "  [g]posts[/g]           list posts from the live blog feed",
    "  [g]open[/g] [d]<n>[/d]        open post <n> from the last listing",
    "  [g]featured[/g]        the flagship AD CS ESC1 lab",
    "  [g]ctf[/g]             the Advent of Cyber 2024 series",
    "  [g]blog[/g]            open mahmudeg.github.io",
    "  [g]social[/g]          all channels & links",
    "  [g]contact[/g]         reveal email",
    "  [g]neofetch[/g]        system info, obviously",
    "  [g]banner[/g]          reprint the banner",
    "  [g]clear[/g]           clear the screen",
    "  [g]gui[/g], [g]exit[/g]       back to noob mode",
    ""
  ];

  var FALLBACK_POSTS = [
    ["2026-07-16", "Detect and Remediate an AD CS ESC1 Certificate Template (Step-by-Step Lab)", "/posts/deploy-hybrid-file-share-azure-file-sync/"],
    ["2026-07-09", "Deploy a Group Managed Service Account (gMSA) for a Scheduled Task (Step-by-Step Lab)", "/posts/deploy-gmsa-scheduled-task/"],
    ["2026-04-22", "Fix Windows UUID/SID Conflict in EVE-NG Labs (Domain Join Issue)", "/posts/fix-windows-uuid-sid-conflict-eve-ng/"],
    ["2025-10-23", "Windows Hello for Business in a Hybrid Environment: Key Trust + MFA Deployment", "/posts/windows-hello-for-business-hybrid/"],
    ["2025-07-15", "Azure for the On-Prem Sysadmin: What Actually Changes", "/posts/azure-for-the-on-prem-sysadmin/"],
    ["2025-03-07", "Redundancy Protocols Lab: STP, HSRP, and VRRP in EVE-NG", "/posts/redundancy-protocols-lab/"],
    ["2025-01-11", "TryHackMe: Sticker Shop", "/posts/tryhackme-sticker-shop/"]
  ].map(function (p) { return { date: p[0], title: p[1], url: BLOG + p[2] }; });

  /* ---------- commands ---------- */
  var commands = {
    "help": function () { printLines(HELP); },
    "/?": function () { printLines(HELP); },

    "whoami": function () {
      printLines([
        "",
        "[w]Mahmud Elgoueri[/w] [d]— systems & hybrid infrastructure engineer · Tripoli, Libya[/d]",
        "",
        "Telecommunications Engineering background with hands-on enterprise",
        "infrastructure experience. I design and support hybrid environments",
        "spanning on-prem Windows Server and Azure / Entra ID, harden AD and",
        "Group Policy, and deliver network segmentation across switches and",
        "firewalls. Also at home in Linux, Docker, Prometheus, and Grafana.",
        "",
        "[d]Education:[/d] B.Sc. Electrical & Electronic Eng. (Telecom), University of Tripoli",
        "[d]Languages:[/d] Arabic (native) · English (professional)",
        "[d]More:[/d] [g]experience[/g] · [g]skills[/g] · [g]projects[/g] · [g]certs[/g]",
        ""
      ]);
    },

    "certs": function () {
      printLines([
        "",
        "[g][✓][/g] [w]AZ-800 / AZ-801[/w]  Windows Server Hybrid Administrator — 2026",
        "[g][✓][/g] [w]AZ-104[/w]           Azure Administrator Associate — 2026",
        "[g][✓][/g] [w]FCA[/w]              Fortinet Certified Associate · FortiGate 7.4 Operator",
        "[g][✓][/g] [w]HCIA-Security[/w]    Huawei Certified ICT Associate — 2025",
        "[g][✓][/g] [w]AZ-900[/w]           Azure Fundamentals",
        "[g][+][/g] [w]Bootcamp[/w]         Cybersecurity — LATI & NETSCOUT (6-week intensive)",
        "",
        "[d]verify:[/d] [u:https://learn.microsoft.com/en-us/users/]learn.microsoft.com[/u] [d]·[/d] [u:https://e.huawei.com/en/talent/cert/]e.huawei.com/talent[/u]",
        ""
      ]);
    },

    "experience": function () {
      printLines([
        "",
        "[w]System Engineer — IT Infrastructure[/w]",
        "[g]Electron Technology Solutions[/g] [d]· Tripoli, Libya · Jun 2025 — present[/d]",
        "",
        "  [g]>[/g] Managed & supported Windows Server environments and Active",
        "    Directory; documented procedures and knowledge-base articles",
        "  [g]>[/g] Configured & supported network devices (routers, switches)",
        "    and endpoints",
        "  [g]>[/g] Troubleshot LAN/WAN connectivity and VPN issues; remote",
        "    support via RDP and AnyDesk",
        "  [g]>[/g] Software installations, OS updates, and system configuration",
        "  [g]>[/g] Documented recurring issues; contributed to the team KB",
        ""
      ]);
    },
    "exp": function () { commands.experience(); },

    "cv": function () {
      print("[g][+][/g] fetching Mahmud_Elgoueri_CV.pdf …");
      var a = document.createElement("a");
      a.href = "assets/Mahmud_Elgoueri_CV.pdf";
      a.download = "Mahmud_Elgoueri_CV.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
    },

    "skills": function () {
      printLines([
        "",
        "[w]Technical skills[/w]",
        "",
        "  [g]identity & directory[/g]   AD DS · GPO design/audit · Entra Connect · Entra ID",
        "  [g]cloud & hybrid[/g]         Azure (AZ-104) · hybrid DC · M365",
        "  [g]windows & virt[/g]         Windows Server 2016–2025 · VMware/vCenter · PowerShell",
        "  [g]network & security[/g]     VLANs · FortiGate · pfSense · hardening",
        "  [g]linux & containers[/g]     Ubuntu · Docker/Compose · Prometheus · Grafana",
        "  [g]delivery[/g]               design docs · runbooks · assessments · training",
        ""
      ]);
    },

    "projects": function () {
      printLines([
        "",
        "[w]Key projects[/w]",
        "",
        "  [g]1[/g]  [w]5G Standalone Core[/w] [d](2025, graduation project)[/d]",
        "     containerised 5G SA core on Docker + Prometheus/Grafana KPI pipeline",
        "  [g]2[/g]  [w]Home Lab & Technical Blog[/w] [d](ongoing)[/d]",
        "     virtualisation + Docker lab → the write-ups on the blog",
        ""
      ]);
    },

    "topics": function () {
      printLines([
        "",
        "[w]Content pillars[/w] [d](sized honestly — real post distribution)[/d]",
        "",
        "  [g]systems & identity[/g]  ████████████░░  [d]the center of gravity[/d]",
        "  [g]cybersecurity[/g]       ██████████░░░░  [d]10 posts — hardening + CTF[/d]",
        "  [g]cloud[/g]               ████░░░░░░░░░░  [d]growing pillar[/d]",
        "  [g]networking[/g]          ██░░░░░░░░░░░░  [d]one deep lab[/d]",
        "",
        "[d]browse:[/d] [u:" + BLOG + "/categories/]" + BLOG.replace("https://", "") + "/categories/[/u]",
        ""
      ]);
    },

    "posts": function () {
      print("");
      print("[d]fetching " + BLOG + "/assets/js/data/search.json …[/d]");
      fetch(LOCAL_BLOG + "/assets/js/data/search.json", { cache: "no-cache" })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .catch(function () {
          return fetch(BLOG + "/assets/js/data/search.json", { cache: "no-cache" })
            .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
        })
        .then(function (raw) {
          posts = raw.map(function (p) {
            var m = /^(\d{4}-\d{2}-\d{2})/.exec(p.date) || [null, p.date];
            return { date: m[1], title: p.title, url: postUrl(p.url) };
          }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
          listPosts(true);
        })
        .catch(function () {
          posts = FALLBACK_POSTS;
          listPosts(false);
        });
    },

    "open": function (arg) {
      var n = parseInt(arg, 10);
      if (!posts) { print("[r][!][/r] no listing yet — run [g]posts[/g] first"); return; }
      if (!n || n < 1 || n > posts.length) {
        print("[r][!][/r] usage: open <1-" + posts.length + ">");
        return;
      }
      var p = posts[n - 1];
      print("[g][+][/g] opening [w]" + p.title + "[/w] …");
      window.open(p.url, "_blank", "noopener");
    },

    "featured": function () {
      printLines([
        "",
        "[y][FLAGSHIP][/y] [w]Detect and Remediate an AD CS ESC1 Certificate Template[/w]",
        "",
        "Find the certificate template that lets any domain user request a cert",
        "as Domain Admin, prove the exposure, and close it: audit templates with",
        "PowerShell, enable CA auditing, and remove ENROLLEE_SUPPLIES_SUBJECT —",
        "with verification at every step.",
        "",
        "[d]→[/d] [u:" + BLOG + "/posts/deploy-hybrid-file-share-azure-file-sync/]read the lab[/u]",
        ""
      ]);
    },

    "ctf": function () {
      printLines([
        "",
        "[w]Advent of Cyber 2024[/w] [d]— 8-part TryHackMe write-up series[/d]",
        "",
        "  [g]d9[/g]  GRC fundamentals          [g]d13[/g] WebSocket manipulation",
        "  [g]d10[/g] phishing & macro payloads [g]d14[/g] SOC operations",
        "  [g]d11[/g] Wi-Fi / WPA cracking      [g]d15[/g] AD breach investigation",
        "  [g]d12[/g] race conditions & HTTP/2  [g]d16[/g] Azure Key Vault & Entra ID",
        "",
        "[d]→[/d] [u:" + BLOG + "/tags/advent-of-cyber/]read the series[/u]",
        ""
      ]);
    },

    "blog": function () {
      print("[g][+][/g] opening " + BLOG + " …");
      window.open(BLOG + "/", "_blank", "noopener");
    },

    "social": function () {
      printLines([
        "",
        "  [d]blog[/d]      [u:" + BLOG + "/]mahmudeg.github.io[/u]",
        "  [d]github[/d]    [u:https://github.com/MahmudEG]github.com/MahmudEG[/u]",
        "  [d]linkedin[/d]  [u:https://www.linkedin.com/in/mahmud-elgoueri/]linkedin.com/in/mahmud-elgoueri[/u]",
        "  [d]reddit[/d]    [u:https://www.reddit.com/user/Mahmud-Eg/]reddit.com/user/Mahmud-Eg[/u]",
        "  [d]rss[/d]       [u:" + BLOG + "/feed.xml]feed.xml[/u]",
        ""
      ]);
    },

    "contact": function () {
      var addr = ["mahmudeg2000", "gmail.com"].join("@");
      var num = ["+218", "92", "778", "5022"].join(" ");
      printLines([
        "",
        "[g][+][/g] decrypting… [w]" + addr + "[/w]",
        "[g][+][/g] phone       [w]" + num + "[/w]",
        "[d]    (LinkedIn is the primary channel for opportunities)[/d]",
        ""
      ]);
    },

    "neofetch": function () {
      printLines([
        "",
        "[g]        ▄▄▄▄▄▄▄[/g]        [w]mahmud[/w][d]@[/d][w]mahmudeg[/w]",
        "[g]      ▄█████████▄[/g]      [d]─────────────────[/d]",
        "[g]     ███[/g][w]▀▀[/w][g]█[/g][w]▀▀[/w][g]███[/g]      [d]OS:[/d]     Hybrid (on-prem + cloud)",
        "[g]     ███████████[/g]      [d]Host:[/d]   GitHub Pages",
        "[g]     ▀███[/g][w]▄▄▄[/w][g]███▀[/g]      [d]Shell:[/d]  PowerShell 7 [d]+ bash when forced[/d]",
        "[g]       ▀█████▀[/g]        [d]DC:[/d]     never cloned without sysprep",
        "[g]        ▀▀▀▀▀[/g]         [d]Uptime:[/d] since Dec 2024 · 15 posts",
        "                       [d]Theme:[/d]  terminal-green on #1b1b1e",
        ""
      ]);
    },

    "banner": function () { printLines(BANNER); },

    "clear": function () { out.innerHTML = ""; },

    "gui": function () {
      print("[g][+][/g] switching to noob mode…");
      window.__setMode("noob", true);
    },
    "exit": function () { commands.gui(); },

    "sudo": function () {
      print("[r]mahmud is not in the sudoers file. This incident will be reported.[/r]");
    },
    "ls": function () {
      print("[g]whoami[/g]  [g]experience[/g]  [g]skills[/g]  [g]projects[/g]  [g]certs[/g]  [g]cv[/g]  [g]topics[/g]  [g]posts[/g]  [g]featured[/g]  [g]ctf[/g]  [g]social[/g]  [g]contact[/g]");
    },
    "pwd": function () { print("/home/mahmud/landing"); },
    "date": function () { print(new Date().toString()); },
    "echo": function (arg) { print(arg || ""); }
  };

  function listPosts(live) {
    print(live ? "[g][+][/g] live feed — " + posts.length + " posts"
               : "[y][!][/y] feed unreachable — cached listing");
    print("");
    posts.forEach(function (p, i) {
      var n = String(i + 1).padStart(2, " ");
      print("  [g]" + n + "[/g]  [d]" + p.date + "[/d]  [w]" + p.title + "[/w]");
    });
    print("");
    print("[d]type[/d] [g]open <n>[/g] [d]to read one[/d]");
    print("");
  }

  /* ---------- input handling ---------- */
  function run(raw) {
    var line = raw.trim();
    echoCmd(line);
    if (!line) return;
    history.push(line);
    histIdx = history.length;

    var sp = line.indexOf(" ");
    var cmd = (sp === -1 ? line : line.slice(0, sp)).toLowerCase();
    var arg = sp === -1 ? "" : line.slice(sp + 1).trim();

    if (commands[cmd]) {
      commands[cmd](arg);
    } else {
      print("[r]" + cmd + ": command not found[/r] [d]— try[/d] [g]help[/g] [d]or[/d] [g]/?[/g]");
    }
  }

  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      run(input.value);
      input.value = "";
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (histIdx > 0) { histIdx--; input.value = history[histIdx] || ""; }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (histIdx < history.length - 1) { histIdx++; input.value = history[histIdx]; }
      else { histIdx = history.length; input.value = ""; }
    } else if (e.key === "Tab") {
      e.preventDefault();
      var v = input.value.toLowerCase();
      if (!v) return;
      var match = Object.keys(commands).filter(function (c) { return c.indexOf(v) === 0; });
      if (match.length === 1) input.value = match[0] + " ";
      else if (match.length > 1) print("[d]" + match.join("   ") + "[/d]");
    } else if (e.key === "l" && e.ctrlKey) {
      e.preventDefault();
      commands.clear();
    }
  });

  /* keep focus on the input whenever the terminal is clicked */
  screen.addEventListener("click", function () {
    if (!window.getSelection().toString()) input.focus();
  });

  /* ---------- boot sequence ---------- */
  window.__termBoot = function () {
    input.focus();
    if (booted) return;
    booted = true;
    printLines(BANNER);
    var boot = [
      "[g][ OK ][/g] mounting /home/mahmud/blog",
      "[g][ OK ][/g] loading certifications … AZ-800 AZ-801 AZ-104 AZ-900 HCIA-Sec",
      "[g][ OK ][/g] link established → " + BLOG,
      "",
      "Welcome to [w]PRO mode[/w]. Type [g]help[/g] or [g]/?[/g] to see the available commands.",
      ""
    ];
    var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) { printLines(boot); return; }
    var i = 0;
    (function next() {
      if (i < boot.length) {
        print(boot[i++]);
        setTimeout(next, 140);
      }
    })();
  };
})();
