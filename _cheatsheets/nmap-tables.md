---
title: Nmap — Quick Tables
slug: nmap-tables
category: Security
description: Every Nmap flag worth knowing, as scannable reference tables — targets, discovery, scan types, ports, detection, NSE, timing, evasion, and output.
updated: 2026-08-12
tags: [Nmap, Scanning, Recon, Reference]
---

Pure lookup format — no walkthrough. For the same material with explanation and worked
recipes, see the [Nmap sheet](/cheatsheet/nmap/).

## Target specification

| Syntax | Scans |
|---|---|
| `nmap 10.0.0.15` | A single host |
| `nmap 10.0.0.1-50` | A range in the last octet |
| `nmap 10.0.0.0/24` | A CIDR block |
| `nmap 10.0.0.*` | Wildcard, same as the /24 |
| `nmap host.example.com` | A hostname |
| `-iL targets.txt` | Targets from a file, one per line |
| `-iR 100` | 100 random hosts |
| `--exclude 10.0.0.1,10.0.0.2` | Skip these addresses |
| `--excludefile skip.txt` | Skip addresses listed in a file |
| `-6` | IPv6 target |

## Host discovery

| Flag | Does |
|---|---|
| `-sn` | Ping sweep only, no port scan |
| `-Pn` | Skip discovery, treat every host as up |
| `-PR` | ARP ping — fastest and most reliable on a local LAN |
| `-PS<ports>` | TCP SYN ping to the given ports |
| `-PA<ports>` | TCP ACK ping |
| `-PU<ports>` | UDP ping |
| `-PE` | ICMP echo request |
| `-PP` | ICMP timestamp request |
| `-PM` | ICMP netmask request |
| `-PO<protos>` | IP protocol ping |
| `-n` | Never do DNS resolution (much faster) |
| `-R` | Always resolve, even for hosts that are down |
| `--dns-servers <ip>` | Resolve using specific servers |
| `--traceroute` | Trace the path to each host |

## Scan techniques

| Flag | Scan | Notes |
|---|---|---|
| `-sS` | TCP SYN | Default as root; never completes the handshake |
| `-sT` | TCP connect | Fallback without privileges |
| `-sU` | UDP | Slow; pair with `--top-ports` |
| `-sA` | TCP ACK | Maps firewall rules; never reports open |
| `-sW` | TCP window | ACK variant that can infer open ports |
| `-sM` | TCP Maimon | FIN/ACK probe |
| `-sN` | Null | No flags set |
| `-sF` | FIN | FIN flag only |
| `-sX` | Xmas | FIN, PSH and URG set |
| `-sI <zombie>` | Idle | Scan via a third host; your IP never touches the target |
| `-sO` | IP protocol | Which protocols the host supports |
| `-sY` / `-sZ` | SCTP INIT / COOKIE-ECHO | SCTP equivalents |
| `--scanflags <flags>` | Custom | Set TCP flags by hand |

## Port specification

| Flag | Selects |
|---|---|
| `-p 22` | One port |
| `-p 22,80,443` | A list |
| `-p 1-1024` | A range |
| `-p-` | All 65,535 ports |
| `-F` | Fast mode — top 100 ports |
| `--top-ports <n>` | The N most common ports |
| `-p U:53,T:80` | Per-protocol selection |
| `-p http,https` | By service name |
| `-r` | Scan sequentially instead of randomising |
| *(no flag)* | Top 1000 TCP ports — **not** all ports |

## Service and OS detection

| Flag | Does |
|---|---|
| `-sV` | Probe open ports for product and version |
| `--version-intensity <0-9>` | How hard to probe; 0 light, 9 exhaustive |
| `--version-light` | Intensity 2 |
| `--version-all` | Intensity 9 |
| `--version-trace` | Show version probes as they are sent |
| `-O` | OS fingerprinting |
| `--osscan-guess` | Accept near matches |
| `--osscan-limit` | Only fingerprint promising hosts |
| `--max-os-tries <n>` | Limit fingerprint attempts |
| `-A` | Aggressive: `-sV -O -sC --traceroute` |

## Scripting engine (NSE)

| Flag | Does |
|---|---|
| `-sC` | Run the `default` script category |
| `--script=<name>` | Run a named script |
| `--script=<category>` | Run a whole category |
| `--script "http-*"` | Wildcard match on script names |
| `--script-args k=v,k2=v2` | Pass arguments to scripts |
| `--script-args-file args.txt` | Arguments from a file |
| `--script-help=<name>` | Describe a script without running it |
| `--script-updatedb` | Rebuild the script database |
| `--script-trace` | Show all script traffic |

| Category | Contains |
|---|---|
| `default` | What `-sC` runs — safe and generally useful |
| `safe` | Will not crash or overload the target |
| `discovery` | Enumerates services, shares, directories |
| `version` | Extends `-sV` |
| `auth` | Authentication handling and bypasses |
| `vuln` | Checks for known vulnerabilities |
| `intrusive` | May crash, lock out, or alert |
| `brute` | Credential guessing |
| `dos` | Denial of service — will disrupt |
| `exploit` | Actively exploits |
| `malware` | Detects backdoors and infections |

## Timing and performance

| Flag | Effect |
|---|---|
| `-T0` | Paranoid — serial, 5 minutes between probes |
| `-T1` | Sneaky |
| `-T2` | Polite — lower parallelism |
| `-T3` | Normal (default) |
| `-T4` | Aggressive — sensible on a modern LAN |
| `-T5` | Insane — fastest, least accurate |
| `--min-rate <n>` | At least N packets per second |
| `--max-rate <n>` | Cap packets per second |
| `--max-retries <n>` | Retries per port; lowering this is the biggest speed win |
| `--host-timeout <t>` | Give up on a host after this long |
| `--scan-delay <t>` | Wait between probes to one host |
| `--min-parallelism <n>` | Minimum concurrent probes |
| `--min-hostgroup <n>` | Scan hosts in larger batches |

## Firewall and IDS evasion

| Flag | Technique |
|---|---|
| `-f` | Fragment packets |
| `--mtu <n>` | Custom fragment size (multiple of 8) |
| `-D <d1,d2,ME>` | Decoy source addresses |
| `-D RND:<n>` | N random decoys |
| `-S <ip>` | Spoof the source address |
| `-e <iface>` | Send from a specific interface |
| `-g` / `--source-port <p>` | Fixed source port, e.g. 53 or 80 |
| `--data-length <n>` | Pad packets with random data |
| `--ttl <n>` | Set the IP TTL |
| <code>--spoof-mac &lt;mac&#124;vendor&#124;0&gt;</code> | Spoof MAC; `0` is random |
| `--badsum` | Send an invalid checksum |
| `--proxies <url>` | Relay through HTTP/SOCKS4 proxies |
| `--randomize-hosts` | Shuffle target order |

## Output

| Flag | Produces |
|---|---|
| `-oN <file>` | Normal, human-readable |
| `-oX <file>` | XML, for tooling and reporting |
| `-oG <file>` | Grepable, one host per line |
| `-oA <base>` | All three formats at once |
| `--append-output` | Append rather than overwrite |
| `--resume <file>` | Continue an interrupted scan |
| `-v` / `-vv` | Verbose / more verbose |
| `-d` / `-dd` | Debug output |
| `--open` | Show only open ports |
| `--reason` | Explain each port state |
| `--packet-trace` | Show every packet |
| `--stylesheet <xsl>` | XSL for the XML output |

## Port states

| State | Meaning |
|---|---|
| `open` | An application is accepting connections |
| `closed` | Reachable, but nothing is listening |
| `filtered` | A firewall dropped the probe; state unknown |
| `unfiltered` | Reachable but open/closed undetermined (ACK scan) |
| <code>open&#124;filtered</code> | No response; open or filtered (UDP, null, FIN, Xmas) |
| <code>closed&#124;filtered</code> | Closed or filtered (idle scan only) |

## Runtime keys

Press these during a running scan:

| Key | Does |
|---|---|
| `Enter` | Print a status line with percentage complete |
| `v` / `V` | Increase / decrease verbosity |
| `d` / `D` | Increase / decrease debugging |
| `p` / `P` | Turn packet tracing on / off |
| `Ctrl+C` | Stop the scan |
