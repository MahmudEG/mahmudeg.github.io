---
title: "Configure DNS Aging and Scavenging on AD-Integrated DNS (Step-by-Step Lab)"
description: "Turn on DNS aging and scavenging the safe way: set no-refresh and refresh intervals, enable aging per zone, pin scavenging to a single DC, age existing records, and prove stale records get removed — with verification at every step."
date: 2026-07-30 10:00 +0200
categories: [Labs & Projects, Microsoft]
tags:
  - Active Directory
  - Windows Server
  - DNS
  - PowerShell
  - Hardening
  - Identity
by: Mahmud
image:
  path: /assets/img/dns-scavenging.png
published: true
---

## What You'll Build

In this lab you enable **DNS aging and scavenging** on an Active Directory–integrated forward lookup zone, then watch a stale record actually get removed. Aging and scavenging is the built-in mechanism that timestamps dynamically registered records and deletes the ones that stop refreshing — the laptops that were re-imaged, the VMs that were deleted, the DHCP clients that moved subnets and never cleaned up after themselves.

It ships **disabled by default**, and for good reason: enabled carelessly, it will delete records you meant to keep. This lab does it the controlled way.

By the end you'll have:

- A zone (`lab.local`) with **aging enabled** and explicit no-refresh and refresh intervals.
- **Server-level scavenging** turned on with a defined scavenging cycle.
- Scavenging **pinned to a single DC** so two domain controllers don't fight over the same zone.
- Existing static-timestamp records **aged in** so they participate instead of living forever.
- Proof, via `Get-DnsServerZoneAging` and a forced scavenge, that a genuinely stale record is deleted while a live one survives.

Everything here is PowerShell (`DnsServer` module) so it's repeatable and auditable. The DNS console does the same thing through checkboxes, but you can't put a checkbox in source control.

> Scavenging only ever removes records that carry a **non-zero timestamp**. Records added manually or loaded from a zone file get a timestamp of `0` and are immune. That's a safety feature — and the reason Step 5 exists.
{: .prompt-tip }

## Lab Environment

| Role | Host | OS | Notes |
| --- | --- | --- | --- |
| Domain Controller (primary scavenger) | `DC01` | Windows Server 2022 | Holds the DNS role, AD-integrated zones |
| Domain Controller | `DC02` | Windows Server 2022 | Also runs DNS; will *not* scavenge |
| Domain | `lab.local` | — | Single forest, single domain |

Requirements before you start:

- The zone must be a **primary** (AD-integrated counts as primary). Scavenging does not apply to secondary or stub zones.
- Records must arrive via **dynamic update** to be eligible — statically created records need Step 5 to opt in.
- You're a member of **DnsAdmins** or **Domain Admins**, running an elevated PowerShell session.
- The **DnsServer** module is present (installed with the DNS role, or via RSAT on a management host): `Import-Module DnsServer`.

> The maximum for both the no-refresh and refresh intervals is **8760 hours**, and the scavenging period has a **one-hour minimum**. Don't set the refresh interval shorter than the longest refresh cycle any client uses — Windows clients re-register every 24 hours, DHCP and cluster/Netlogon services on their own schedules. Set it too low and you'll scavenge records that are still perfectly valid.
{: .prompt-warning }

## Understanding the Two Intervals (30 seconds, saves hours)

Every eligible record carries a timestamp. Two per-zone intervals decide its fate:

- **No-refresh interval** (default 7 days) — a quiet window after a timestamp is written during which the server *ignores* refresh attempts. This exists purely to cut down write/replication traffic to AD; a laptop re-registering every 24 hours shouldn't rewrite the directory every time.
- **Refresh interval** (default 7 days) — the window *after* no-refresh during which the record can be refreshed. If a refresh lands, the timestamp resets and the clock starts over.

A record becomes eligible for deletion when:

```text
timestamp + NoRefreshInterval + RefreshInterval  <  current server time
```

With the 7 + 7 defaults, a record that stops refreshing survives **up to 14 days**, then gets removed on the next scavenging pass. Budget for that patience — records don't vanish the moment you flip the switch.

## Step-by-Step

### Step 1 — Confirm the starting state

Check the server and the target zone before changing anything, so you can prove what you changed:

```powershell
Import-Module DnsServer

# Server-level scavenging (ScavengingInterval 0 = disabled)
Get-DnsServerScavenging

# Zone-level aging
Get-DnsServerZoneAging -Name "lab.local"
```

On a default install `AgingEnabled` is `False` and `ScavengingInterval` is `00:00:00`. That's the baseline.

### Step 2 — Enable aging on the zone with explicit intervals

Set the intervals deliberately rather than relying on defaults. Here: 7-day no-refresh, 7-day refresh.

```powershell
Set-DnsServerZoneAging -Name "lab.local" `
    -Aging $true `
    -RefreshInterval 7.00:00:00 `
    -NoRefreshInterval 7.00:00:00 `
    -PassThru
```

The `TimeSpan` format is `dd.hh:mm:ss`, so `7.00:00:00` is exactly seven days.

### Step 3 — Enable server-level scavenging and set the cycle

Zone aging only *timestamps* records. Something still has to run the scavenging pass. `ScavengingInterval` both enables that pass and sets how often it repeats:

```powershell
Set-DnsServerScavenging -ComputerName "DC01" `
    -ScavengingState $true `
    -ScavengingInterval 7.00:00:00 `
    -PassThru
```

`ScavengingState $true` sets the *default* aging behaviour for **newly created** zones; `ScavengingInterval 7.00:00:00` tells DC01 to run a scavenging cycle every seven days. Leave it at `0` and no automatic scavenging ever happens, no matter how many zones have aging enabled.

> With the 7/7 intervals from Step 2 and a 7-day cycle here, worst case a dead record lingers for roughly **no-refresh + refresh + one cycle ≈ 21 days** before it's gone. That is expected and safe — never shorten these to force faster deletes on a production zone.
{: .prompt-warning }

### Step 4 — Pin scavenging to one DC

By default, **every** DC that loads an AD-integrated zone will try to scavenge it. That's redundant and makes the "who deleted this record" question harder to answer. Nominate DC01 as the sole scavenger for the zone:

```powershell
# Restrict scavenging of lab.local to DC01's IP
Set-DnsServerZoneAging -Name "lab.local" `
    -Aging $true `
    -ScavengeServers 10.10.0.10 `
    -PassThru
```

Only the DNS server(s) whose IPs you list here will scavenge this zone. Aging (timestamping) still happens everywhere; only the delete pass is constrained.

### Step 5 — Age existing records so they participate

Records that predate aging — anything created statically or loaded before you flipped the switch — carry timestamp `0` and will never be scavenged. If you want the existing dynamic-style records to opt in, stamp them with the current time:

```powershell
# Preview first — see exactly what would be timestamped
Set-DnsServerResourceRecordAging -ZoneName "lab.local" -Recurse -WhatIf

# Apply once you're satisfied
Set-DnsServerResourceRecordAging -ZoneName "lab.local" -Recurse -Force
```

> This touches **every** node in the zone. Genuinely static infrastructure records — the A records for your DCs, a hard-coded record for a network appliance — should *keep* their `0` timestamp so they're never eligible. Either scope the command to a node with `-NodeName`, or leave those records static and don't run `-Recurse` blindly across a zone that mixes static and dynamic entries.
{: .prompt-danger }

### Step 6 — Create a test record to watch

Add a throwaway record you can safely let die. Set its timestamp to a point already past the deletion threshold so you don't have to wait 14 days for the demo:

```powershell
# Create a test host record
Add-DnsServerResourceRecordA -ZoneName "lab.local" `
    -Name "stale-test" -IPv4Address 10.10.0.200 -AgeRecord

# Backdate its timestamp to 30 days ago (well past 7+7)
$rr = Get-DnsServerResourceRecord -ZoneName "lab.local" -Name "stale-test" -RRType A
$new = $rr.Clone()
$new.TimeStamp = (Get-Date).AddDays(-30)
Set-DnsServerResourceRecord -ZoneName "lab.local" -OldInputObject $rr -NewInputObject $new
```

The `-AgeRecord` switch on creation gives the record a live (non-zero) timestamp so it's eligible from the start.

## Verification

### 1. Confirm the configuration took

```powershell
Get-DnsServerZoneAging -Name "lab.local"
```

Expect `AgingEnabled : True`, `RefreshInterval` and `NoRefreshInterval` of `7.00:00:00`, and `ScavengeServers` listing `10.10.0.10`.

```powershell
Get-DnsServerScavenging -ComputerName "DC01"
```

Expect `ScavengingState : True` and `ScavengingInterval : 7.00:00:00`.

### 2. Confirm the test record's timestamp

```powershell
Get-DnsServerResourceRecord -ZoneName "lab.local" -Name "stale-test" -RRType A |
    Select-Object HostName, @{n='TimeStamp';e={$_.TimeStamp}}
```

You should see a timestamp roughly 30 days in the past — past `timestamp + 7 + 7`, so it qualifies for removal.

### 3. Force a scavenge and confirm deletion

You don't have to wait for the scheduled cycle. Trigger one immediately:

```powershell
Start-DnsServerScavenging -ComputerName "DC01" -Force -Verbose
```

Give it a moment, then confirm the stale record is gone while a live one (e.g. `DC01`'s own record) remains:

```powershell
# Should return nothing / an error — record scavenged
Get-DnsServerResourceRecord -ZoneName "lab.local" -Name "stale-test" -RRType A

# Should still be present — recent timestamp, not stale
Get-DnsServerResourceRecord -ZoneName "lab.local" -Name "dc01" -RRType A
```

### 4. Confirm it in the event log

Scavenging writes DNS Server event **2501** (records scavenged) or **2502** (nothing to scavenge) — a clean audit trail for change reviews:

```powershell
Get-WinEvent -LogName "DNS Server" -MaxEvents 20 |
    Where-Object { $_.Id -in 2501,2502 } |
    Select-Object TimeCreated, Id, Message
```

Event 2501 with a non-zero count is your proof the pass ran and removed records.

## Closing

You now have aging and scavenging running on `lab.local` the controlled way: explicit intervals sized to your clients' refresh behaviour, the delete pass pinned to a single DC, static infrastructure records deliberately left immune, and a forced pass verified against the event log. The stale record died; the live one didn't. That's the whole contract.

The concrete next step: **run `Get-DnsServerZoneAging` against every primary zone in your environment today and list which ones still show `AgingEnabled : False`.** Those are the zones quietly accumulating dead records. Enable them one at a time, size the intervals to the noisiest client on each zone, and always let the first automatic cycle run before you judge the results — Microsoft's own guidance on this is literally titled "don't be afraid of DNS scavenging, just be patient."

How does your environment handle stale DNS today — full scavenging, a scheduled cleanup script, or is it still the Wild West? I'd like to hear what's worked.

## References

- [DNS Aging and Scavenging in Windows Server — Microsoft Learn](https://learn.microsoft.com/en-us/windows-server/networking/dns/aging-scavenging)
- [Don't be afraid of DNS scavenging, just be patient — Microsoft Learn](https://learn.microsoft.com/en-us/troubleshoot/windows-server/networking/dns-scavenging-setup)
- [Set-DnsServerScavenging — Microsoft Learn](https://learn.microsoft.com/en-us/powershell/module/dnsserver/set-dnsserverscavenging)
- [Set-DnsServerZoneAging — Microsoft Learn](https://learn.microsoft.com/en-us/powershell/module/dnsserver/set-dnsserverzoneaging)
- [Set-DnsServerResourceRecordAging — Microsoft Learn](https://learn.microsoft.com/en-us/powershell/module/dnsserver/set-dnsserverresourcerecordaging)
- [Start-DnsServerScavenging — Microsoft Learn](https://learn.microsoft.com/en-us/powershell/module/dnsserver/start-dnsserverscavenging)
