---
title: Nmap
slug: nmap
category: Security
description: Host discovery, scan techniques, port selection, service and OS detection, NSE scripts, timing, evasion, and output formats — with the recipes worth memorising.
updated: 2026-08-12
tags: [Nmap, Scanning, Recon, Security]
---

Nmap changes behaviour depending on privileges: as root it defaults to a SYN scan
(`-sS`), as a normal user it falls back to a full TCP connect (`-sT`). Almost everything
below assumes root.

> Scan only what you own or have written permission to test. Port scanning a third party
> without authorisation is unlawful in most jurisdictions.
{: .warn }

## Start here

Five commands that cover most of what you'll ever need:

```shell
nmap -sn 10.0.0.0/24                          # what's alive on this subnet?
nmap -p- -T4 10.0.0.15                        # every TCP port on one host
nmap -sV -sC -p 22,80,443 10.0.0.15           # versions + default scripts
nmap -A 10.0.0.15                             # everything: -sV -O -sC --traceroute
sudo nmap -sU --top-ports 20 10.0.0.15        # the UDP ports that actually matter
```

## Choosing targets

```shell
nmap 10.0.0.15                    # one host
nmap 10.0.0.1-50                  # a range in the last octet
nmap 10.0.0.0/24                  # CIDR block
nmap scanme.nmap.org              # hostname
nmap -iL targets.txt              # one target per line from a file
nmap -iR 100                      # 100 random internet hosts (rarely what you want)
```

Trim the list without editing it:

```shell
nmap 10.0.0.0/24 --exclude 10.0.0.1,10.0.0.254
nmap 10.0.0.0/24 --excludefile do-not-scan.txt
```

## Host discovery

Discovery decides which hosts get port-scanned at all. Getting this wrong is the most
common reason a scan "finds nothing".

```shell
nmap -sn 10.0.0.0/24        # ping sweep only — no port scan
nmap -Pn 10.0.0.15          # skip discovery, assume the host is up
nmap -PR 10.0.0.0/24        # ARP ping — the fastest and most reliable on a local LAN
```

On a local segment nmap uses ARP automatically, and ARP cannot be firewalled by the host,
so `-PR` results are trustworthy in a way ICMP never is.

Pick specific probes when ICMP is filtered:

```shell
nmap -PS22,80,443 10.0.0.0/24    # TCP SYN ping to those ports
nmap -PA80 10.0.0.0/24           # TCP ACK ping — gets through some stateless filters
nmap -PU53,161 10.0.0.0/24       # UDP ping
nmap -PE -PP -PM 10.0.0.0/24     # ICMP echo, timestamp, netmask
```

`-Pn` is the blunt instrument: it treats every address as alive, so a /24 becomes 254 full
port scans. Correct against hosts that drop ICMP, painfully slow against an empty range.
{: .warn }

DNS is often the hidden cost of a large scan:

```shell
nmap -n 10.0.0.0/24                        # never resolve — much faster
nmap -R 10.0.0.0/24                        # always resolve, even for down hosts
nmap --dns-servers 8.8.8.8 10.0.0.0/24     # resolve via a specific server
```

## Scan techniques

```shell
nmap -sS 10.0.0.15    # SYN — default as root, never completes the handshake
nmap -sT 10.0.0.15    # full TCP connect — the fallback without privileges
nmap -sU 10.0.0.15    # UDP
nmap -sA 10.0.0.15    # ACK — maps firewall rules, does not find open ports
nmap -sW 10.0.0.15    # TCP window
nmap -sN 10.0.0.15    # null — no flags set
nmap -sF 10.0.0.15    # FIN
nmap -sX 10.0.0.15    # Xmas — FIN, PSH and URG set
```

Null, FIN and Xmas scans rely on RFC-compliant behaviour, so they distinguish *closed*
from *open|filtered* on many Unix stacks but return useless results against Windows.

`-sA` is the one people forget. It never reports a port as open — it reports whether a
port is **filtered**, which tells you what the firewall in front of the host is doing.

## Selecting ports

```shell
nmap -p 22 10.0.0.15                    # one port
nmap -p 22,80,443 10.0.0.15             # a list
nmap -p 1-1024 10.0.0.15                # a range
nmap -p- 10.0.0.15                      # all 65,535 — always worth it on a single host
nmap -F 10.0.0.15                       # fast: the top 100 ports
nmap --top-ports 1000 10.0.0.15         # the N most common ports
nmap -p U:53,161,T:21-25,80 10.0.0.15   # mixed protocols (needs -sU -sS)
nmap -p http,https 10.0.0.15            # by service name
nmap -r 10.0.0.15                       # scan ports in order, not randomised
```

The default with no `-p` is the top 1000 TCP ports — **not** all of them. A service on
8443 or 9000 will be missed unless you ask for it.
{: .warn }

## Service and version detection

```shell
nmap -sV 10.0.0.15                        # probe open ports for product + version
nmap -sV --version-intensity 9 10.0.0.15  # 0 = light and fast, 9 = try everything
nmap -sV --version-light 10.0.0.15        # same as intensity 2
nmap -sV --version-all 10.0.0.15          # same as intensity 9
nmap -sV --version-trace 10.0.0.15        # show the probes being sent
```

## OS detection

```shell
nmap -O 10.0.0.15                     # TCP/IP stack fingerprinting
nmap -O --osscan-guess 10.0.0.15      # accept near matches instead of giving up
nmap -O --osscan-limit 10.0.0.0/24    # only fingerprint promising hosts — much faster
nmap -O --max-os-tries 1 10.0.0.15    # one attempt per host
```

OS detection needs at least one open and one closed port to be accurate, so it is
unreliable against a heavily filtered host.

## The scripting engine

```shell
nmap -sC 10.0.0.15                              # the "default" script category
nmap --script=vuln 10.0.0.15                    # a whole category
nmap --script=smb-enum-shares,smb-os-discovery 10.0.0.15
nmap --script "http-*" -p 80,443 10.0.0.15      # wildcard match
nmap --script=ssl-enum-ciphers -p 443 10.0.0.15 # TLS ciphers and grades
```

Categories worth knowing: `default`, `safe`, `discovery`, `version`, `auth`, `vuln`,
`intrusive`, `brute`, `dos`, `exploit`, `malware`.

`vuln`, `intrusive`, `brute`, `dos` and `exploit` send traffic that can crash or lock out
the target. Never run them outside an authorised test.
{: .warn }

```shell
nmap --script-help=smb-enum-shares      # what does this script do?
nmap --script-updatedb                  # rebuild the script database
nmap --script=http-title --script-args http.useragent="Mozilla/5.0" 10.0.0.15
nmap --script=smb-enum-users --script-args smbuser=admin,smbpass=secret 10.0.0.15
```

## Timing and performance

```shell
nmap -T0 …   # paranoid — serial, 5 min between probes, for IDS evasion
nmap -T1 …   # sneaky
nmap -T2 …   # polite — reduced parallelism, easier on fragile hosts
nmap -T3 …   # normal (default)
nmap -T4 …   # aggressive — a sane default on a modern LAN
nmap -T5 …   # insane — fast, and starts dropping accuracy
```

Tune it directly when `-T` is too blunt:

```shell
nmap --min-rate 1000 10.0.0.0/24        # at least N packets per second
nmap --max-rate 100 10.0.0.15           # cap the rate
nmap --max-retries 1 10.0.0.0/24        # stop re-probing — the biggest speed win
nmap --host-timeout 15m 10.0.0.0/24     # give up on slow hosts
nmap --scan-delay 1s 10.0.0.15          # wait between probes
nmap --min-hostgroup 128 10.0.0.0/24    # scan hosts in larger batches
```

A full `-p-` scan of a /24 is a fundamentally slow operation. Reducing `--max-retries` and
raising `--min-rate` helps far more than jumping to `-T5`.

## Firewall and IDS evasion

```shell
nmap -f 10.0.0.15                        # fragment packets
nmap --mtu 16 10.0.0.15                  # custom fragment size (multiple of 8)
nmap -D RND:5 10.0.0.15                  # 5 random decoy source addresses
nmap -D 10.0.0.5,10.0.0.6,ME 10.0.0.15   # explicit decoys, ME = your real position
nmap -S 10.0.0.99 -e eth0 10.0.0.15      # spoof the source address
nmap -g 53 10.0.0.15                     # source port 53 — slips past naive rules
nmap --data-length 25 10.0.0.15          # pad packets to defeat signature matching
nmap --ttl 64 10.0.0.15                  # set IP TTL
nmap --spoof-mac Cisco 10.0.0.15         # MAC from a vendor, or a literal address, or 0 for random
nmap --badsum 10.0.0.15                  # bad checksums — responses reveal some firewalls
nmap --randomize-hosts 10.0.0.0/24       # shuffle host order
```

`-S` only produces useful output when you can also see the replies — otherwise you are
scanning on someone else's behalf and reading nothing back.

## Output

```shell
nmap -oN scan.txt 10.0.0.15       # normal, human readable
nmap -oX scan.xml 10.0.0.15       # XML — for Metasploit, reporting, parsing
nmap -oG scan.gnmap 10.0.0.15     # grepable, one host per line
nmap -oA scan 10.0.0.15           # all three at once, scan.nmap/.xml/.gnmap
```

```shell
nmap -v 10.0.0.15                 # verbose; -vv for more
nmap --open 10.0.0.15             # only show open ports
nmap --reason 10.0.0.15           # why nmap called each port open or closed
nmap --packet-trace 10.0.0.15     # every packet sent and received
nmap --append-output -oN log.txt 10.0.0.15
nmap --resume scan.gnmap          # continue an interrupted scan
```

`-oA` costs nothing and saves re-running a long scan because you wanted a different
format. Use it by default on anything that takes more than a minute.

## Recipes

```shell
# Fast, thorough sweep of a subnet: find hosts, then scan only what answered
nmap -sn 10.0.0.0/24 -oG - | awk '/Up$/{print $2}' > live.txt
nmap -sS -sV -p- -T4 --max-retries 1 -iL live.txt -oA full-scan
```

```shell
# What is this box actually running?
nmap -A -T4 -p- 10.0.0.15 -oA deep
```

```shell
# The UDP services worth checking, without waiting an hour
sudo nmap -sU --top-ports 25 --max-retries 1 -T4 10.0.0.15
```

```shell
# Web-facing surface across a range
nmap -p 80,443,8080,8443 --open -sV --script=http-title 10.0.0.0/24
```

```shell
# SMB posture on a Windows subnet
nmap -p 445 --script=smb-os-discovery,smb-security-mode,smb2-security-mode 10.0.0.0/24
```

```shell
# TLS certificate and cipher review
nmap -p 443 --script=ssl-cert,ssl-enum-ciphers 10.0.0.15
```

```shell
# Compare two scans over time
nmap -oX before.xml 10.0.0.0/24
# … later …
nmap -oX after.xml 10.0.0.0/24
ndiff before.xml after.xml
```

## Handy extras

```shell
nmap -6 2001:db8::1           # IPv6
nmap --iflist                 # interfaces and routes as nmap sees them
nmap -V                       # version and compiled-in features
nmap --traceroute 10.0.0.15   # trace the path to each host
nmap -sO 10.0.0.15            # which IP protocols the host supports
```
