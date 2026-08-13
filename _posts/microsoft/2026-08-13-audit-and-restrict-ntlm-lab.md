---
title: "Audit NTLM Usage, Then Restrict It Safely (Step-by-Step Lab)"
description: "Turn on NTLM auditing across the domain, collect and parse the 8001–8004 events with PowerShell, flag NTLMv1 downgrades, build an exception list, and move to Deny-with-exceptions — the phased path off NTLM without breaking authentication."
date: 2026-08-13 10:00 +0200
categories: [Labs & Projects, Microsoft]
tags:
  - Active Directory
  - Windows Server
  - Security
  - PowerShell
  - Hardening
  - NTLM
  - Kerberos
by: Mahmud
image:
  path: /assets/img/NTLM.png
published: true
---

## What You'll Build

In this lab you turn on **NTLM auditing** across a domain, collect the audit events centrally, parse them with PowerShell into a usable inventory of *who is still using NTLM and against which servers*, and then move a member server from **Audit** to **Deny-with-exceptions** — the exact phased path Microsoft recommends for retiring NTLM without an outage.

By the end you'll have:

- **Audit NTLM authentication in this domain** enabled on the DC, logging **Event 8004** for every NTLM auth that passes through a domain controller.
- **Audit Incoming** and **Outgoing** NTLM auditing enabled on member servers and clients, logging **Events 8001, 8002, and 8003** in the `NTLM/Operational` log.
- A **PowerShell inventory** that pulls those events and turns them into a table of source workstation, target server, account, and calling process.
- A method to **flag NTLMv1** specifically — the downgraded, crackable variant you want gone first.
- A **server exception list** and a member server switched to **Deny all domain accounts**, with the exception applied so approved legacy apps keep working.

NTLM is not being patched anymore. All versions — LM, NTLMv1, NTLMv2 — are deprecated, and network NTLM is slated to be disabled by default in a future Windows Server release. That does not mean you flip a switch; it means you **measure first**. This lab is the measurement-and-first-cut phase done properly.

> Restriction without auditing is how you cause a 2 a.m. outage. Every step here that *blocks* NTLM has an *audit* twin that you run first, for as long as it takes, to build the exception list. Audit is not optional pre-work — it *is* the work.
{: .prompt-tip }

## Lab Environment

| Role | Host | OS | Notes |
| --- | --- | --- | --- |
| Domain Controller | `DC01` | Windows Server 2022 | Where Event 8004 is logged |
| Member server | `FS01` | Windows Server 2022 | File server; where you'll audit then restrict |
| Client | `WS01` | Windows 11 | Generates outgoing NTLM (Event 8001) |
| Domain | `lab.local` | — | Single forest, single domain |

Requirements before you start:

- Membership in **Domain Admins** (to edit the Default Domain Controllers Policy and a member-server GPO), or delegated GPO edit rights.
- The **Group Policy Management** console (RSAT) on your management host.
- A test workstation and a way to *force* NTLM — connecting to a share by **IP address** instead of hostname is the simplest reliable trigger, because Kerberos requires an SPN tied to a name, not an IP.

> This lab configures real restriction policies. Run it in a **lab or an authorized change window** only. Setting *Incoming NTLM traffic* to **Deny all accounts** on a domain controller can lock out administrators — do not test Deny options on `DC01` itself. Scope Deny to member servers first.
{: .prompt-danger }

## Step-by-Step

### Step 1 — Enable domain NTLM auditing on the DC (Event 8004)

Event 8004 is the richest signal you get. Logged on the domain controller, it names the **client workstation**, the **target member server** (the "Secure Channel name"), and the **account** for every NTLM authentication that transits the domain. Start here.

In Group Policy, edit the policy linked to the **Domain Controllers** OU (the *Default Domain Controllers Policy* is fine for a lab) and set:

```
Computer Configuration
  > Policies
    > Windows Settings
      > Security Settings
        > Local Policies
          > Security Options
            Network security: Restrict NTLM: Audit NTLM authentication in this domain
              = Enable all
```

If you prefer to prove the underlying change, this policy maps to a single registry value under Netlogon. Setting it directly (value **7** = audit everything) is equivalent:

```powershell
# On DC01 — audit all NTLM pass-through authentication in the domain
Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\Netlogon\Parameters' `
  -Name 'AuditNTLMInDomain' -Type DWord -Value 7
```

Force the policy to apply and confirm it landed:

```powershell
gpupdate /target:computer /force
Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Services\Netlogon\Parameters' |
  Select-Object AuditNTLMInDomain
```

> "Audit" values only *log* — they never block. `AuditNTLMInDomain = 7` and the GPO's *Enable all* are safe to leave running in production for weeks while you gather data. The corresponding **Restrict** setting is a different value and is what actually denies traffic; we don't touch it until Step 6.
{: .prompt-warning }

### Step 2 — Enable incoming and outgoing NTLM auditing on servers and clients

Event 8004 tells you an NTLM auth happened and against which server, but the **calling process** lives in Events 8001/8003 on the endpoints. Turn those on with a GPO linked to your member servers and clients (or apply per-host for the lab).

Two settings drive the endpoint events:

- **Audit Incoming NTLM Traffic** → *Enable auditing for all accounts*. This surfaces **Event 8001** on the machine and **8003** on servers receiving the request.
- **Outgoing NTLM traffic to remote servers** → *Audit all*. This surfaces **Events 8002 and 8003** on remote/member servers.

```
Computer Configuration > Policies > Windows Settings > Security Settings
  > Local Policies > Security Options
    Network security: Restrict NTLM: Audit Incoming NTLM Traffic
      = Enable auditing for all accounts
    Network security: Restrict NTLM: Outgoing NTLM traffic to remote servers
      = Audit all
```

The registry equivalents, if you want to script it onto `FS01` and `WS01`:

```powershell
# Audit incoming NTLM for all accounts (value 2 = enable for all accounts)
Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\Lsa\MSV1_0' `
  -Name 'AuditReceivingNTLMTraffic' -Type DWord -Value 2

# Audit outgoing NTLM to remote servers (value 1 = Audit all)
Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\Lsa\MSV1_0' `
  -Name 'RestrictSendingNTLMTraffic' -Type DWord -Value 1

gpupdate /target:computer /force
```

> `RestrictSendingNTLMTraffic = 1` means **Audit all** — it logs but does not block. Value **2** on that same key is **Deny all**, which *does* block outgoing NTLM. One digit is the difference between visibility and an outage. Double-check the value before you leave the host.
{: .prompt-danger }

### Step 3 — Generate some NTLM traffic to audit

An empty log proves nothing. From `WS01`, force an NTLM authentication by reaching `FS01` over **IP** instead of its name — Kerberos can't issue a ticket for a bare IP, so Windows falls back to NTLM:

```powershell
# On WS01 — first resolve FS01's address, then connect by IP to force NTLM
$ip = (Resolve-DnsName FS01.lab.local -Type A).IPAddress
net use \\$ip\C$ /user:lab\labadmin
```

Provide the password when prompted. Whether or not the mapping succeeds, the authentication attempt is what generates the events. Now go collect them.

### Step 4 — Collect and parse the audit events with PowerShell

The events land in **Applications and Services Logs → Microsoft → Windows → NTLM → Operational** on each host. The channel name is `Microsoft-Windows-NTLM/Operational`. Pull Event 8004 from the DC first — it's the map that points you at everything else.

```powershell
# On DC01 — pull domain NTLM audit events (8004) and shape them into a table
$events = Get-WinEvent -FilterHashtable @{
    LogName = 'Microsoft-Windows-NTLM/Operational'
    Id      = 8004
} -ErrorAction SilentlyContinue

$events | ForEach-Object {
    $x = [xml]$_.ToXml()
    [pscustomobject]@{
        Time            = $_.TimeCreated
        SecureChannel   = ($x.Event.EventData.Data | Where-Object Name -eq 'SChannelName').'#text'
        User            = ($x.Event.EventData.Data | Where-Object Name -eq 'UserName').'#text'
        Domain          = ($x.Event.EventData.Data | Where-Object Name -eq 'DomainName').'#text'
        Workstation     = ($x.Event.EventData.Data | Where-Object Name -eq 'Workstation').'#text'
    }
} | Sort-Object Time -Descending | Format-Table -AutoSize
```

Each 8004 row reads as: *account `User` on workstation `Workstation` used NTLM against member server `SecureChannel`.* That is your inventory. Group it to see the worst offenders:

```powershell
# Which servers absorb the most NTLM? Which workstations send it?
$parsed = $events | ForEach-Object {
    $x = [xml]$_.ToXml()
    [pscustomobject]@{
        Server      = ($x.Event.EventData.Data | Where-Object Name -eq 'SChannelName').'#text'
        Workstation = ($x.Event.EventData.Data | Where-Object Name -eq 'Workstation').'#text'
        User        = ($x.Event.EventData.Data | Where-Object Name -eq 'UserName').'#text'
    }
}
$parsed | Group-Object Server      | Sort-Object Count -Descending | Select Count, Name
$parsed | Group-Object Workstation | Sort-Object Count -Descending | Select Count, Name
```

On `FS01`, pull **8003** (incoming) to get the **PID** of the receiving process; on `WS01`, pull **8001** (outgoing) for the **calling process name** and the **target server** — the field that tells you whether the app used a name (Kerberos-capable) or a raw IP (NTLM-forced):

```powershell
# On WS01 — outgoing NTLM (8001): what process, aimed at what target?
Get-WinEvent -FilterHashtable @{
    LogName = 'Microsoft-Windows-NTLM/Operational'; Id = 8001
} -ErrorAction SilentlyContinue | ForEach-Object {
    $x = [xml]$_.ToXml()
    [pscustomobject]@{
        Time    = $_.TimeCreated
        Target  = ($x.Event.EventData.Data | Where-Object Name -eq 'TargetName').'#text'
        Process = ($x.Event.EventData.Data | Where-Object Name -eq 'ProcessName').'#text'
        User    = ($x.Event.EventData.Data | Where-Object Name -eq 'SuppliedUser').'#text'
    }
} | Format-Table -AutoSize
```

> Field names inside the event XML vary slightly by OS build (e.g. `SChannelName` vs `SecureChannelName`). If a column comes back blank, run `$events[0].ToXml()` once and read the real `Data Name=` attributes for that build, then adjust the `Where-Object` filters. Never assume the schema — verify it against a live event.
{: .prompt-tip }

### Step 5 — Flag NTLMv1 specifically

NTLMv1 is the version to eliminate first: its response is trivially crackable and any appearance means a client or app is *downgrading* below NTLMv2. The `NTLM/Operational` events don't cleanly separate the versions, but the **Security log logon events (4624)** do, under *Detailed Authentication Information → Package Name (NTLM only)*.

```powershell
# On FS01 — surface any NTLM V1 logons recorded in the Security log
Get-WinEvent -FilterHashtable @{ LogName = 'Security'; Id = 4624 } -MaxEvents 2000 |
  ForEach-Object {
      $x = [xml]$_.ToXml()
      [pscustomobject]@{
          Time    = $_.TimeCreated
          Account = ($x.Event.EventData.Data | Where-Object Name -eq 'TargetUserName').'#text'
          Package = ($x.Event.EventData.Data | Where-Object Name -eq 'LmPackageName').'#text'
          Source  = ($x.Event.EventData.Data | Where-Object Name -eq 'WorkstationName').'#text'
      }
  } | Where-Object { $_.Package -eq 'NTLM V1' } | Format-Table -AutoSize
```

If that returns rows, raise the **LAN Manager authentication level** so clients refuse to *send* LM/NTLMv1 and servers refuse to *accept* it. Level **5** = *Send NTLMv2 response only; refuse LM & NTLM*:

```
Network security: LAN Manager authentication level
  = Send NTLMv2 response only. Refuse LM & NTLM   (LmCompatibilityLevel = 5)
```

```powershell
# Enforce NTLMv2-only; refuse LM and NTLMv1
Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\Lsa' `
  -Name 'LmCompatibilityLevel' -Type DWord -Value 5
```

> Level 5 refuses NTLMv1 but still permits **NTLMv2** — it is a downgrade guard, not a full NTLM block. Roll it out in audit-adjacent fashion: confirm Step 4's inventory shows no critical app depending on NTLMv1 before enforcing, or those apps will fail to authenticate.
{: .prompt-warning }

### Step 6 — Move a member server to Deny-with-exceptions

Once the inventory is stable and you know which legacy servers *legitimately* need NTLM, you make the first real cut. On `FS01`, set **Incoming NTLM traffic** to **Deny all domain accounts**, and on the DC add the servers that must keep working to the **exception list** so clients may still use NTLM against them.

On `FS01`:

```
Network security: Restrict NTLM: Incoming NTLM traffic
  = Deny all domain accounts
```

```powershell
# On FS01 — deny incoming NTLM for domain accounts
# (value 1 = Deny all domain accounts; value 2 = Deny all accounts, which also blocks local sign-in)
Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\Lsa\MSV1_0' `
  -Name 'RestrictReceivingNTLMTraffic' -Type DWord -Value 1
```

On `DC01`, set the domain policy to **Deny for domain accounts to domain servers** and populate the exception list with the FQDNs that still need NTLM (wildcards allowed):

```
Network security: Restrict NTLM: NTLM authentication in this domain
  = Deny for domain accounts to domain servers
Network security: Restrict NTLM: Add server exceptions in this domain
  = legacyapp.lab.local
    *.legacy.lab.local
```

```powershell
# On DC01 — enable domain restriction and register an exception host
Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\Netlogon\Parameters' `
  -Name 'RestrictNTLMInDomain' -Type DWord -Value 1
Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\Netlogon\Parameters' `
  -Name 'DCAllowedNTLMServers' -Type MultiString -Value @('legacyapp.lab.local','*.legacy.lab.local')
gpupdate /target:computer /force
```

> Build the exception list **from Step 4's data**, not from guesswork. Every FQDN you add is a documented, time-boxed exception with an owner and a remediation date — not a permanent carve-out. The goal is an exception list that shrinks to zero.
{: .prompt-tip }

## Verification

Confirm the audit pipeline and the restriction both behave as designed.

**1. Audit events are flowing.** After Step 3, the DC should show 8004 and the endpoints 8001/8003:

```powershell
# On DC01
(Get-WinEvent -FilterHashtable @{ LogName='Microsoft-Windows-NTLM/Operational'; Id=8004 } `
  -ErrorAction SilentlyContinue).Count
```

A non-zero count means auditing is live and the events are being captured.

**2. The policy values are what you think they are.** Read them back rather than trusting the console:

```powershell
# On DC01
Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Services\Netlogon\Parameters' |
  Select-Object AuditNTLMInDomain, RestrictNTLMInDomain, DCAllowedNTLMServers
# On FS01
Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\Lsa\MSV1_0' |
  Select-Object AuditReceivingNTLMTraffic, RestrictReceivingNTLMTraffic
```

**3. Deny actually denies (and the exception actually excepts).** From `WS01`, an NTLM attempt against a **restricted** `FS01` should now fail with a logon/authentication error, while an attempt against a host on the **exception list** still succeeds. On `FS01`, a **blocked** attempt is recorded — the same event family, now showing the request was denied rather than merely audited:

```powershell
# On FS01 — most recent NTLM operational events, blocked or audited
Get-WinEvent -FilterHashtable @{ LogName='Microsoft-Windows-NTLM/Operational' } -MaxEvents 20 |
  Select-Object TimeCreated, Id, LevelDisplayName | Format-Table -AutoSize
```

**4. Kerberos took over where it could.** For a target reached by **name** (not IP), a fresh connection should now produce a Kerberos ticket instead of NTLM:

```powershell
# On WS01 — force a clean auth to FS01 by name, then check for a ticket
klist purge
Test-Path \\FS01.lab.local\C$   # triggers auth
klist | Select-String 'FS01'    # a cifs/FS01 ticket = Kerberos, not NTLM
```

A `cifs/FS01.lab.local` entry in `klist` confirms the connection used Kerberos — exactly the outcome you're driving toward.

## Closing

You now have the two halves that make NTLM retirement safe: an **audit pipeline** that produces a real inventory of NTLM usage down to the calling process, and a **restriction model** — Deny-with-exceptions plus an NTLMv2-only floor — that you apply against that inventory instead of against your assumptions. This is the phased path Microsoft itself recommends: audit, analyze, fix or except, then deny.

**Your concrete next step today:** enable Step 1 (`AuditNTLMInDomain = 7`) on your domain controllers and leave it running. Auditing is passive and safe; a week of 8004 data will tell you more about your environment's real dependencies than any architecture diagram. Schedule the Step 4 collection script to export to CSV daily, and in a week you'll have a ranked list of exactly which servers and apps to tackle first.

Which surprises you more when you actually look — *how much* NTLM is still flowing, or *which* applications turn out to be the ones generating it? Run the audit and find out.

---

*Sources: [Restrict NTLM: NTLM authentication in this domain](https://learn.microsoft.com/en-us/previous-versions/windows/it-pro/windows-10/security/threat-protection/security-policy-settings/network-security-restrict-ntlm-ntlm-authentication-in-this-domain), [Restrict NTLM: Incoming NTLM traffic](https://learn.microsoft.com/en-us/windows/security/threat-protection/security-policy-settings/network-security-restrict-ntlm-incoming-ntlm-traffic), [Restrict NTLM: Outgoing NTLM traffic to remote servers](https://learn.microsoft.com/en-us/previous-versions/windows/it-pro/windows-10/security/threat-protection/security-policy-settings/network-security-restrict-ntlm-outgoing-ntlm-traffic-to-remote-servers), [Viewing events for assessing NTLM usage](https://learn.microsoft.com/en-us/previous-versions/windows/it-pro/windows-server-2008-r2-and-2008/jj865682(v=ws.10)), [Advancing Windows security: Disabling NTLM by default](https://techcommunity.microsoft.com/blog/windows-itpro-blog/advancing-windows-security-disabling-ntlm-by-default/4489526).*
