---
title: "Deploy a Group Managed Service Account (gMSA) for a Scheduled Task (Step-by-Step Lab)"
description: "Replace a static service-account password with a domain-managed gMSA: create the KDS root key, provision the account, authorize member hosts, install it, and run a scheduled task under it — with verification at every step."
date: 2026-07-09 10:00 +0200
categories: [Labs & Projects, Microsoft]
tags:
  - Active Directory
  - Windows Server
  - Security
  - PowerShell
  - gMSA
  - Hardening
  - Identity
by: Mahmud
image:
  path: /assets/img/gMSApost.png
published: true
---

## What You'll Build

In this lab you replace a service running under a static, manually-rotated user account with a **group Managed Service Account (gMSA)** — a domain account whose password is generated and rotated by the domain controllers (every 30 days by default), never known to an administrator, and never typed into a config box.

By the end you'll have:

- A **KDS root key** in the forest (the master key DCs use to generate gMSA passwords).
- A gMSA named `gmsa-Backup$` that only your authorized hosts can retrieve the password for.
- A security group controlling **which computers** are allowed to use the account.
- The gMSA installed on a member server and validated with `Test-ADServiceAccount`.
- A **scheduled task running under the gMSA** — no password stored, no annual "the service account expired at 2 a.m." incident.

The same pattern applies to Windows services, IIS application pools, and SQL Server. A scheduled task is the cleanest place to prove the mechanics end to end.

> A gMSA password is 240 bytes, randomly generated, and rotated automatically by the KDC. Nobody — including you — ever sees it. That is the entire point: you cannot leak, phish, or forget a credential you were never issued.
{: .prompt-tip }

## Lab Environment

| Role | Host | OS | Notes |
| --- | --- | --- | --- |
| Domain Controller | `DC01` | Windows Server 2022 | Forest/domain functional level 2016+ |
| Member server | `FS01` | Windows Server 2022 | Where the scheduled task runs |
| Domain | `lab.local` | — | Single forest, single domain |

Requirements before you start:

- Domain and forest functional level **Windows Server 2012 or later** (2016+ recommended). gMSA relies on the Key Distribution Service introduced in 2012.
- You are a member of **Domain Admins** (or have delegated rights to create `msDS-GroupManagedServiceAccount` objects).
- A **64-bit** management host — the AD PowerShell cmdlets for gMSA require 64-bit.
- The **Active Directory module** for PowerShell. On a non-DC, install RSAT and run `Import-Module ActiveDirectory`.

> **Failover clusters do not support a gMSA as the cluster identity itself.** Services that *run on top of* the Cluster service — a Windows service, an IIS app pool, or a scheduled task — can still use one. Scope your design accordingly.
{: .prompt-warning }

## Step-by-Step

### Step 1 — Create the KDS root key (once per forest)

The KDS root key is the master secret DCs use to derive every gMSA password. You create it **once per forest**. Creating a second one will cause gMSAs to break after their first password rotation, so check before you create.

Check whether a key already exists:

```powershell
Get-KdsRootKey
```

If that returns nothing, create one. In **production**, run this and wait — DCs deliberately hold off for up to 10 hours so the key can replicate to every DC before any gMSA password is generated:

```powershell
Add-KdsRootKey -EffectiveImmediately
```

> Despite the name, `-EffectiveImmediately` is **not** immediate for the forest. The key is usable on the DC that created it right away, but other DCs — and therefore gMSA creation and retrieval — must wait for AD replication plus the 10-hour safety window. Plan the key creation a day ahead of the rollout.
{: .prompt-warning }

In a **single-DC lab only**, you can backdate the effective time to skip the 10-hour wait:

```powershell
# LAB ONLY — do not backdate the key in production
Add-KdsRootKey -EffectiveTime ((Get-Date).AddHours(-10))
```

Confirm the key registered by checking for **Event ID 4004** in the KDS operational log:

```powershell
Get-WinEvent -LogName 'Microsoft-Windows-Kdssvc/Operational' |
  Where-Object Id -eq 4004 | Select-Object -First 1 TimeCreated, Id, Message
```

### Step 2 — Create a security group for authorized hosts

Rather than naming individual computers on the gMSA, point it at a group. Adding or removing a host later becomes a one-line group change instead of an account modification.

```powershell
New-ADGroup -Name 'gMSA-Backup-Hosts' `
  -SamAccountName 'gMSA-Backup-Hosts' `
  -GroupScope Global `
  -GroupCategory Security `
  -Path 'OU=Groups,DC=lab,DC=local' `
  -Description 'Computers authorized to retrieve the gmsa-Backup password'

# Add the member server that will run the task (note the trailing $ on computer accounts)
Add-ADGroupMember -Identity 'gMSA-Backup-Hosts' -Members 'FS01$'
```

### Step 3 — Create the gMSA

Create the account and authorize the group from Step 2 to retrieve its password. The `-DNSHostName` is mandatory and must be a valid FQDN.

```powershell
New-ADServiceAccount -Name 'gmsa-Backup' `
  -DNSHostName 'gmsa-Backup.lab.local' `
  -PrincipalsAllowedToRetrieveManagedPassword 'gMSA-Backup-Hosts' `
  -ManagedPasswordIntervalInDays 30 `
  -Enabled $true
```

A few things worth knowing:

- The **SamAccountName** becomes `gmsa-Backup$` — the trailing `$` is how you reference it when assigning the task principal later.
- gMSA names must be **unique across the entire forest**, not just the domain.
- `-ManagedPasswordIntervalInDays` can **only** be set at creation. To change the rotation interval, you must delete and recreate the account. 30 days is the default; leave it unless you have a specific reason.

> The account name (`sAMAccountName`) is limited to **15 characters** including the trailing `$` — so 14 usable characters. `gmsa-Backup` fits; longer prefixes get truncated and cause confusing logon failures. Keep gMSA names short.
{: .prompt-tip }

### Step 4 — Install the gMSA on the member host

Membership in `gMSA-Backup-Hosts` is only read into the computer's Kerberos ticket at boot. If you added `FS01$` to the group while `FS01` was running, **reboot it** (or `gpupdate` won't help — the group SID must be in the machine's token).

On **FS01**, in an elevated PowerShell session:

```powershell
# Ensure the AD cmdlets are present (RSAT AD PowerShell)
Import-Module ActiveDirectory

# Install the gMSA locally — caches the account so the host can log on as it
Install-ADServiceAccount -Identity 'gmsa-Backup'
```

### Step 5 — Register a scheduled task that runs as the gMSA

Build the action, trigger, and principal, then register the task. The critical piece is the **principal**: point `-UserId` at the gMSA (with its trailing `$`) and use `-LogonType Password`, which instructs Task Scheduler to retrieve the managed password from AD at run time rather than prompting for one.

```powershell
$action = New-ScheduledTaskAction -Execute 'powershell.exe' `
  -Argument '-NoProfile -ExecutionPolicy Bypass -File "C:\Scripts\NightlyBackup.ps1"'

$trigger = New-ScheduledTaskTrigger -Daily -At 2:00AM

$principal = New-ScheduledTaskPrincipal -UserId 'lab\gmsa-Backup$' `
  -LogonType Password -RunLevel Highest

$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable `
  -DontStopOnIdleEnd -ExecutionTimeLimit (New-TimeSpan -Hours 2)

Register-ScheduledTask -TaskName 'Nightly Backup (gMSA)' `
  -Action $action -Trigger $trigger -Principal $principal -Settings $settings
```

> For gMSA scheduled tasks, `-LogonType Password` is the reliable choice: it tells Task Scheduler to pull the managed password from Active Directory. You do **not** supply a password — none exists to supply. If you script this against a service or app pool instead, the `sc.exe config <svc> obj= lab\gmsa-Backup$ password=` form takes an empty password for the same reason.
{: .prompt-tip }

### Step 6 — Grant "Log on as a batch job" (if needed)

A scheduled task requires the **Log on as a batch job** right. Domain-joined member servers usually grant this to authenticated accounts via the default policy, but in hardened environments it is restricted. If the task fails to start with a logon-rights error, add the gMSA to that right — ideally via a GPO scoped to the host, or locally for the lab:

```text
Local Security Policy → Local Policies → User Rights Assignment
  → "Log on as a batch job" → add  lab\gmsa-Backup$
```

## Verification

Work through these in order. Each one isolates a different failure point.

**1. The host can retrieve the password.** On FS01, this must return `True`:

```powershell
Test-ADServiceAccount -Identity 'gmsa-Backup'
```

`False` almost always means the computer isn't in `gMSA-Backup-Hosts`, or it is but hasn't rebooted since being added.

**2. The account object looks right.** On DC01:

```powershell
Get-ADServiceAccount -Identity 'gmsa-Backup' -Properties PrincipalsAllowedToRetrieveManagedPassword, msDS-ManagedPasswordInterval |
  Select-Object Name, Enabled, PrincipalsAllowedToRetrieveManagedPassword, msDS-ManagedPasswordInterval
```

Confirm `Enabled` is `True` and the `PrincipalsAllowed...` field points at your group.

**3. The task is registered under the gMSA.** On FS01:

```powershell
(Get-ScheduledTask -TaskName 'Nightly Backup (gMSA)').Principal |
  Select-Object UserId, LogonType, RunLevel
```

You should see `UserId : lab\gmsa-Backup$` and `LogonType : Password`.

**4. It actually runs.** Force a run and read the result — `LastTaskResult` of `0` means success:

```powershell
Start-ScheduledTask -TaskName 'Nightly Backup (gMSA)'
Start-Sleep -Seconds 5
Get-ScheduledTaskInfo -TaskName 'Nightly Backup (gMSA)' |
  Select-Object TaskName, LastRunTime, LastTaskResult
```

**5. Kerberos confirms the identity at run time.** Have the task script write `whoami` to a log, or check the Security event log on FS01 for a logon by `gmsa-Backup$`. Seeing the gMSA as the executing principal — not your admin account — is the proof the whole chain worked.

> If retrieval fails on a host that *is* in the group and *has* rebooted, check for a **second KDS root key** (`Get-KdsRootKey` returning more than one) and for **time skew** — Kerberos rejects authentication when host clocks drift more than five minutes from the DC.
{: .prompt-warning }

## Closing

You now have a service identity that rotates itself, is scoped to exactly the hosts you authorized, and carries a password no human will ever handle. That removes a whole class of operational debt: expiry incidents, credentials sitting in scripts and config files, and the audit finding that says "service account password last changed: 847 days ago."

**Your concrete next step today:** run an inventory of every account currently used to run a service or scheduled task and flag the ones that are plain user accounts with static passwords. On any DC:

```powershell
Get-ADUser -Filter 'ServicePrincipalName -like "*"' -Properties PasswordLastSet, ServicePrincipalName |
  Select-Object Name, PasswordLastSet, @{n='SPNs';e={$_.ServicePrincipalName -join '; '}} |
  Sort-Object PasswordLastSet
```

Pick the one with the oldest `PasswordLastSet` and migrate it to a gMSA first — it's your highest-risk, highest-value target.

Which of your service accounts is the scariest to touch, and what's stopping you from moving it to a gMSA — a clustered dependency, a vendor app that doesn't support it, or just the fear of breaking something at 2 a.m.?

---

*Sources: [Manage group Managed Service Accounts](https://learn.microsoft.com/en-us/windows-server/identity/ad-ds/manage/group-managed-service-accounts/group-managed-service-accounts/manage-group-managed-service-accounts) and [Create a Key Distribution Service (KDS) root key](https://learn.microsoft.com/en-us/windows-server/identity/ad-ds/manage/group-managed-service-accounts/group-managed-service-accounts/create-the-key-distribution-services-kds-root-key) — Microsoft Learn.*
