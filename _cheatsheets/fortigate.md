---
title: FortiGate CLI
slug: fortigate
category: Security
icon: shield
description: FortiOS command line — system checks, interfaces, routing, firewall policies, NAT, session table, packet capture, debug flow, IPsec, and HA.
updated: 2026-08-12
tags: [FortiGate, FortiOS, Firewall, Fortinet]
---

Everything here is FortiOS 7.x CLI, run from the console or SSH. Commands that change
configuration are shown with the full `config … end` block so they can be pasted as-is.

> Run `config system console` → `set output standard` → `end` first. It turns off the
> `--More--` pager, which otherwise breaks copy-paste on long outputs.
{: .tip }

## Console basics

```shell
get system status                 # model, firmware, serial, HA mode
show                              # non-default config of the current scope
show full-configuration           # everything, including defaults
show | grep <keyword>             # filter the running config
end                               # commit and leave the current block
abort                             # leave WITHOUT committing
next                              # save current entry, stay in the table
```

Editing is always the same shape: enter a table, `edit` an entry, `set` fields, then
`next` (more entries) or `end` (done).

```shell
config system global
    set hostname FGT-EDGE-01
    set timezone 60
    set admintimeout 30
end
```

## System health

```shell
get system performance status     # CPU, memory, sessions, uptime
get system performance top        # per-process CPU, refreshes live (q to quit)
diagnose sys top 5 20             # same idea, 5s refresh, 20 processes
get system status | grep Version  # firmware only
diagnose hardware sysinfo memory  # detailed memory
execute date                      # clock — check this before debugging anything
get system ntp                    # NTP sync state
```

Conserve mode kills throughput and is easy to miss:

```shell
diagnose hardware sysinfo conserve
```

## Interfaces

```shell
show system interface             # all interfaces
show system interface port1       # one interface
get system interface physical     # link state, speed, duplex
diagnose hardware deviceinfo nic port1   # driver counters, errors, drops
```

```shell
config system interface
    edit port1
        set mode static
        set ip 192.168.10.1 255.255.255.0
        set allowaccess ping https ssh
        set alias WAN-PRIMARY
        set description "ISP handoff"
    next
end
```

`set allowaccess` **replaces** the list — include every protocol you still need, or you
will lock yourself out.
{: .warn }

## Routing

```shell
get router info routing-table all      # full RIB
get router info routing-table database # all learned routes, including inactive
get router info kernel                 # what the kernel is actually using
get system arp                         # ARP table
```

```shell
config router static
    edit 1
        set dst 0.0.0.0 0.0.0.0
        set gateway 192.168.10.254
        set device port1
        set distance 10
    next
end
```

## Firewall objects

```shell
config firewall address
    edit "SRV-FILE-01"
        set subnet 10.20.0.15 255.255.255.255
    next
end

config firewall addrgrp
    edit "GRP-SERVERS"
        set member "SRV-FILE-01" "SRV-APP-01"
    next
end

config firewall service custom
    edit "TCP-8443"
        set tcp-portrange 8443
    next
end
```

## Firewall policies

```shell
show firewall policy                   # all policies
show firewall policy 12                # one policy
diagnose firewall iprope list          # compiled policy list in memory
```

```shell
config firewall policy
    edit 0
        set name "LAN-to-WAN"
        set srcintf "port2"
        set dstintf "port1"
        set srcaddr "GRP-SERVERS"
        set dstaddr "all"
        set service "HTTPS" "DNS"
        set schedule "always"
        set action accept
        set nat enable
        set logtraffic all
    next
end
```

`edit 0` creates a new policy and assigns the next free ID. Policies match **top-down** —
move it after creating it:

```shell
config firewall policy
    move 17 before 5
end
```

Hit counters tell you whether a policy is even being used:

```shell
diagnose firewall iprope show 100004 <policy-id>
```

## NAT

```shell
# Source NAT with a pool
config firewall ippool
    edit "POOL-OUT"
        set startip 203.0.113.10
        set endip 203.0.113.10
    next
end

# Destination NAT (port forward)
config firewall vip
    edit "VIP-WEB"
        set extip 203.0.113.20
        set extintf "port1"
        set mappedip 10.20.0.30
        set portforward enable
        set extport 443
        set mappedport 443
    next
end
```

The VIP still needs a policy with `set dstaddr "VIP-WEB"` before traffic flows.

## Session table

The fastest way to answer "is traffic even reaching the firewall?".

```shell
diagnose sys session filter clear
diagnose sys session filter dst 8.8.8.8
diagnose sys session filter proto 6
diagnose sys session list                # matching sessions in full
diagnose sys session stat                # totals
diagnose sys session clear               # clear ONLY the filtered sessions
```

In the output, `policy_id=` shows which rule accepted the session, and `state=` with
`may_dirty` means it will be re-evaluated on the next config change.

## Packet capture

```shell
diagnose sniffer packet any 'host 10.20.0.30 and port 443' 4 0 a
```

The arguments, in order:

| Argument | Meaning |
|---|---|
| `any` | interface, or `port1` for one |
| `'…'` | BPF filter, same syntax as tcpdump |
| `4` | verbosity — `4` shows interface names, `6` includes hex |
| `0` | packet count, `0` = until Ctrl+C |
| `a` | absolute timestamps |

Verbosity `3` and above can be piped into a `.pcap` for Wireshark using Fortinet's
`fgt2eth.pl` converter.

## Debug flow

When the session table shows nothing, this shows *why* a packet was dropped.

```shell
diagnose debug reset
diagnose debug flow filter clear
diagnose debug flow filter addr 10.20.0.30
diagnose debug flow filter port 443
diagnose debug flow show function-name enable
diagnose debug flow show iprope enable
diagnose debug flow trace start 20
diagnose debug enable
```

Generate the traffic, then **always** stop it — debug output at scale will hurt the CPU:

```shell
diagnose debug flow trace stop
diagnose debug disable
diagnose debug reset
```

Lines worth recognising in the output: `Denied by forward policy check` means no policy
matched, and `reverse path check fail, drop` means asymmetric routing.

## IPsec VPN

```shell
get vpn ipsec tunnel summary       # up/down and traffic per tunnel
diagnose vpn ike gateway list      # phase 1 state
diagnose vpn tunnel list           # phase 2 SAs, encryption, packet counters
```

```shell
# Bring a tunnel down and back up to force renegotiation
diagnose vpn ike gateway clear name "VPN-BRANCH-01"
```

```shell
# Phase 1 / phase 2 negotiation debug
diagnose vpn ike log filter clear
diagnose vpn ike log filter name "VPN-BRANCH-01"
diagnose debug application ike -1
diagnose debug enable
```

## High availability

```shell
get system ha status               # role, priority, sync state
diagnose sys ha status             # detailed cluster state
diagnose sys ha checksum show      # config checksums — must match across members
execute ha manage <index> <admin>  # SSH into another cluster member
execute ha failover set 1          # force this unit to give up primary
execute ha failover set 0          # release the forced failover
```

If checksums differ, the cluster is out of sync — that is the first thing to check when a
config change "disappears" after a failover.

## Logging

```shell
execute log filter category 0        # 0 = traffic
execute log filter device 0          # 0 = memory, 1 = disk
execute log filter field srcip 10.20.0.30
execute log display
execute log filter reset
```

```shell
diagnose log test                    # generate test entries for every log type
get log memory global-setting        # where logs are going
```

## Backup, restore, firmware

```shell
execute backup config tftp fgt-backup.conf 10.0.0.50
execute backup config usb fgt-backup.conf
execute restore config tftp fgt-backup.conf 10.0.0.50

execute restore image tftp image.out 10.0.0.50   # firmware upgrade, reboots
execute reboot
execute shutdown
```

Take a backup before every change window. `execute backup` includes the full config but
**not** the certificates' private keys unless the config is password-protected.

## Handy one-liners

```shell
execute ping-options source 10.20.0.1        # ping from a specific interface IP
execute ping 8.8.8.8
execute traceroute 8.8.8.8
execute telnet 10.20.0.30 443                # quick TCP port test
execute ssh admin@10.0.0.1

diagnose sys session filter policy <id>      # sessions matched by one policy
diagnose test application dnsproxy 6         # DNS cache stats
diagnose sys flash list                      # firmware partitions
execute factoryreset                         # wipes everything — no confirmation twice
```
