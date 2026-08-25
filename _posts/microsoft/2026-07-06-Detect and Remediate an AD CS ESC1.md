---
title: "Deploy Microsoft Defender ASR Rules the Audit-to-Block Way (Step-by-Step Lab)"
description: "Roll out Attack Surface Reduction rules without breaking a line-of-business app: enable the standard-protection rules in Block, put the high-value rules in Audit, parse the 1121/1122 events with PowerShell to find false positives, add per-rule exclusions, then promote Audit to Block — with verification at every stage."
date: 2026-08-25 10:00 +0200
categories: [Labs & Projects, Microsoft]
tags:
  - Microsoft Defender
  - Windows Server
  - Security
  - PowerShell
  - Hardening
  - Group Policy
  - Zero Trust
by: Mahmud
image:
  path: /assets/img/MSD-ASR.png
  alt: "Configure Attack Surface Reduction rules in Group Policy — Defender ASR audit-to-block lab"
published: true
---

## What You'll Build

In this lab you deploy Microsoft Defender **Attack Surface Reduction (ASR) rules** the way they survive contact with production: a small set of low-risk **standard-protection rules straight into Block**, the rest into **Audit** first, then a measured promotion to Block *after* you've read the telemetry and written exclusions.

ASR rules block the behaviours attackers rely on — Office spawning child processes, macros calling Win32 APIs, scripts launching downloaded executables, credential theft from LSASS, persistence through WMI. The rules are free with Microsoft Defender Antivirus; you don't need a Defender for Endpoint licence to *enforce* them locally. The risk is never the block itself — it's blocking a legitimate line-of-business app that happens to behave like malware. Audit mode is how you find those apps before they find you at 2 a.m.

By the end you'll have:

- The three **standard-protection rules** (vulnerable signed drivers, LSASS credential theft, WMI persistence) enabled in **Block** on a test host.
- Ten high-value rules enabled in **Audit** via PowerShell — and, as an alternative, via **Group Policy** for domain-wide rollout.
- A **PowerShell parser** that pulls **Event 1121/1122** from the `Windows Defender/Operational` log and turns them into a table of *rule, offending process, and target file* — your false-positive shortlist.
- A **per-rule exclusion** applied so an approved app keeps working.
- One rule **promoted from Audit to Block**, verified end-to-end.

> Everything here runs against a single throwaway VM. Do not point Block-mode rules at production endpoints until you've completed the audit-and-exclude phase for *your* environment — your app estate is not this lab's.
{: .prompt-warning }

## Lab Environment

| Role | Host | OS | Notes |
| --- | --- | --- | --- |
| Domain controller | `DC01` | Windows Server 2022 | For the Group Policy rollout section |
| Test endpoint | `WS01` | Windows 11 23H2 | Microsoft Defender Antivirus in **active** mode |
| Management | Elevated PowerShell on `WS01` | — | Run everything **Run as administrator** |

Prerequisites worth stating plainly:

- **Microsoft Defender Antivirus must be the active AV** and *not* in passive mode. ASR rules are silently ignored when a third-party AV owns real-time protection. Confirm with `Get-MpComputerStatus`.
- **Real-time protection** and **cloud-delivered protection** should be on; several rules (notably the prevalence rule) depend on cloud lookups.
- These local `Set-MpPreference`/GPO settings are the lowest precedence. If the device is later managed by **Intune** or **Configuration Manager**, that management overwrites conflicting local settings on startup. Deploy in *one* place per environment.

## Step-by-Step

### Step 1 — Confirm Defender is in the driver's seat

```powershell
Get-MpComputerStatus | Select-Object AMRunningMode, AntivirusEnabled, RealTimeProtectionEnabled, IsTamperProtected
```

`AMRunningMode` must read **Normal**. If it says **Passive** or **EDR Block**, a third-party AV is active and ASR rules won't apply — stop and fix that first.

Check what's already configured so you have a clean baseline to compare against:

```powershell
$p = Get-MpPreference
0..([math]::Min($p.AttackSurfaceReductionRules_Ids.Count, $p.AttackSurfaceReductionRules_Actions.Count) - 1) |
  ForEach-Object {
    [pscustomobject]@{ Id = $p.AttackSurfaceReductionRules_Ids[$_]; Action = $p.AttackSurfaceReductionRules_Actions[$_] }
  } | Format-Table -AutoSize
```

On a fresh host this returns nothing. Good — you're starting from zero.

### Step 2 — Enable the standard-protection rules in Block

Microsoft's **standard protection** set is the low-false-positive trio you can turn on without an audit soak. Use `Add-MpPreference` so you *add* rules without wiping anything already present:

```powershell
# Standard protection rules -> Block (action Enabled = Block)
$standardRules = @(
  '56a863a9-875e-4185-98a7-b882c64b5ce5'  # Block abuse of exploited vulnerable signed drivers
  '9e6c4e1f-7d60-472f-ba1a-a39ef669e4b2'  # Block credential stealing from LSASS
  'e6db77e5-3df2-4cf1-b95a-636979351e5b'  # Block persistence through WMI event subscription
)

Add-MpPreference -AttackSurfaceReductionRules_Ids $standardRules `
  -AttackSurfaceReductionRules_Actions ([string[]](@('Enabled') * $standardRules.Count))
```

> Use `Add-MpPreference`, never `Set-MpPreference`, when layering rules. `Set-MpPreference` **overwrites** the entire ASR rule list with only what you pass it — an easy way to silently drop rules you set a minute ago.
{: .prompt-danger }

### Step 3 — Enable the high-value rules in Audit

These ten catch the majority of commodity-malware and hands-on-keyboard behaviour, but they're also the ones most likely to trip a legitimate app. Every one goes to **Audit** (action `AuditMode`) first — Defender logs what it *would* have blocked and blocks nothing.

```powershell
$auditRules = @(
  'd4f940ab-401b-4efc-aadc-ad5f3c50688a'  # Block all Office apps from creating child processes
  '3b576869-a4ec-4529-8536-b80a7769e899'  # Block Office apps from creating executable content
  '75668c1f-73b5-4cf0-bb93-3ecf5cb7cc84'  # Block Office apps from injecting code into other processes
  '92e97fa1-2edf-4476-bdd6-9dd0b4dddc7b'  # Block Win32 API calls from Office macros
  'be9ba2d9-53ea-4cdc-84e5-9b1eeee46550'  # Block executable content from email client and webmail
  '5beb7efe-fd9a-4556-801d-275e5ffc04cc'  # Block execution of potentially obfuscated scripts
  'd3e037e1-3eb8-44c8-a917-57927947596d'  # Block JS/VBScript from launching downloaded executable content
  'd1e49aac-8f56-4280-b9ba-993a6d77406c'  # Block process creations from PSExec and WMI commands
  '01443614-cd74-433a-b99e-2ecdc07bfc25'  # Block untrusted/unprevalent executables (prevalence, age, trusted list)
  'b2b3f03d-6a65-4f7b-a9c7-1c7ef74a9ba4'  # Block untrusted and unsigned processes that run from USB
)

Add-MpPreference -AttackSurfaceReductionRules_Ids $auditRules `
  -AttackSurfaceReductionRules_Actions ([string[]](@('AuditMode') * $auditRules.Count))
```

> The **PSExec and WMI** rule (`d1e49aac…`) can be noisy if you manage endpoints with Configuration Manager or scripted WMI — expect audit hits and plan an exclusion or a management-source carve-out before you ever set it to Block.
{: .prompt-tip }

Confirm the mix — you want three rules at `1` (Block) and ten at `2` (Audit):

```powershell
$p = Get-MpPreference
0..($p.AttackSurfaceReductionRules_Ids.Count - 1) |
  ForEach-Object {
    [pscustomobject]@{ Id = $p.AttackSurfaceReductionRules_Ids[$_]; Action = $p.AttackSurfaceReductionRules_Actions[$_] }
  } | Sort-Object Action | Format-Table -AutoSize
```

Action values: `0` Off, `1` Block, `2` Audit, `5` Not configured, `6` Warn.

### Step 4 — (Alternative) Roll the same rules out with Group Policy

For a domain, drive this from a GPO instead of touching each host. On `DC01`, open **Group Policy Management**, edit a GPO linked to your test-endpoint OU, and navigate to:

```text
Computer Configuration
  > Administrative Templates
    > Windows Components
      > Microsoft Defender Antivirus
        > Microsoft Defender Exploit Guard
          > Attack Surface Reduction
```

Open **Configure Attack Surface Reduction rules**, set it to **Enabled**, click **Show…**, and add each rule as a value:

- **Value name** = the rule **GUID** (no braces, no quotes, no leading/trailing spaces).
- **Value** = the mode: `1` Block, `2` Audit, `6` Warn, `0` Off.

> Group Policy rejects quotation marks, leading/trailing spaces, and stray characters in these values. A single trailing space is enough to make a rule silently not apply.
{: .prompt-warning }

Force a refresh on `WS01` and confirm the GPO landed:

```powershell
gpupdate /force
Get-MpPreference | Select-Object -ExpandProperty AttackSurfaceReductionRules_Ids
```

### Step 5 — Generate a benign detection to prove the pipeline

You don't need malware to see the logging work. The **Block executable content from email/webmail** and **Office child-process** rules are easy to exercise safely, but the cleanest reproducible signal is a script-based one. From an elevated prompt on `WS01`, have a script attempt a behaviour the obfuscated-script or child-process rules watch for — for example, a macro-enabled test document from Microsoft's demo scenarios, or the official **ASR evaluation** steps. Because the relevant rules are in **Audit**, nothing is blocked; Defender simply writes **Event 1122**.

> Only run attack-simulation payloads inside an isolated lab VM you own and are authorised to test. Never execute demo malware or living-off-the-land payloads on a production or shared machine.
{: .prompt-danger }

### Step 6 — Read the audit telemetry with PowerShell

ASR events live in **Applications and Services Logs > Microsoft > Windows > Windows Defender > Operational**. The IDs you care about:

| Event ID | Meaning |
| --- | --- |
| 1121 | Rule fired in **Block** mode |
| 1122 | Rule fired in **Audit** mode |
| 1129 | User overrode a **Warn**-mode block |
| 5007 | ASR settings changed |

Pull and flatten them into a review table:

```powershell
$asrNames = @{
  '56a863a9-875e-4185-98a7-b882c64b5ce5' = 'Vulnerable signed drivers'
  '9e6c4e1f-7d60-472f-ba1a-a39ef669e4b2' = 'LSASS credential theft'
  'e6db77e5-3df2-4cf1-b95a-636979351e5b' = 'WMI persistence'
  'd4f940ab-401b-4efc-aadc-ad5f3c50688a' = 'Office -> child process'
  '3b576869-a4ec-4529-8536-b80a7769e899' = 'Office -> executable content'
  '75668c1f-73b5-4cf0-bb93-3ecf5cb7cc84' = 'Office code injection'
  '92e97fa1-2edf-4476-bdd6-9dd0b4dddc7b' = 'Win32 API from macro'
  'be9ba2d9-53ea-4cdc-84e5-9b1eeee46550' = 'Email/webmail executable'
  '5beb7efe-fd9a-4556-801d-275e5ffc04cc' = 'Obfuscated script'
  'd3e037e1-3eb8-44c8-a917-57927947596d' = 'JS/VBScript -> download exec'
  'd1e49aac-8f56-4280-b9ba-993a6d77406c' = 'PSExec / WMI process creation'
  '01443614-cd74-433a-b99e-2ecdc07bfc25' = 'Untrusted/unprevalent exec'
  'b2b3f03d-6a65-4f7b-a9c7-1c7ef74a9ba4' = 'Untrusted USB process'
}

Get-WinEvent -FilterHashtable @{
    LogName = 'Microsoft-Windows-Windows Defender/Operational'
    Id      = 1121, 1122
} -ErrorAction SilentlyContinue | ForEach-Object {
    $x = [xml]$_.ToXml()
    $d = @{}
    $x.Event.EventData.Data | ForEach-Object { $d[$_.Name] = $_.'#text' }
    [pscustomobject]@{
        Time    = $_.TimeCreated
        Mode    = if ($_.Id -eq 1121) { 'BLOCK' } else { 'AUDIT' }
        Rule    = $asrNames[$d['ID']]
        Process = $d['ProcessName']
        Target  = $d['TargetFilename']
    }
} | Sort-Object Time -Descending | Format-Table -AutoSize
```

Every **AUDIT** row is a decision: is this a real threat, or a legitimate app that behaves like one? The `Process`/`Target` columns are what you build exclusions from. For fleet-wide review, the **Microsoft Defender portal ASR rules report** aggregates the same events across devices — but the raw log is the source of truth on a single host.

Prefer clicking? Import a ready-made custom view. Save this as `asr-events.xml` and use **Event Viewer > Action > Import Custom View…**:

```xml
<QueryList>
  <Query Id="0" Path="Microsoft-Windows-Windows Defender/Operational">
   <Select Path="Microsoft-Windows-Windows Defender/Operational">*[System[(EventID=1121 or EventID=1122 or EventID=1129 or EventID=5007)]]</Select>
   <Select Path="Microsoft-Windows-Windows Defender/WHC">*[System[(EventID=1121 or EventID=1122 or EventID=1129 or EventID=5007)]]</Select>
  </Query>
</QueryList>
```

### Step 7 — Add a per-rule exclusion for a confirmed false positive

Say the audit table shows your line-of-business app `C:\Apps\LOB\reporter.exe` tripping the **Office child-process** rule during a legitimate export. Exclude just that file, scoped to just that rule:

```powershell
Add-MpPreference `
  -AttackSurfaceReductionRules_RuleSpecificExclusions_Id 'd4f940ab-401b-4efc-aadc-ad5f3c50688a' `
  -AttackSurfaceReductionRules_RuleSpecificExclusions 'C:\Apps\LOB\reporter.exe'
```

Prefer **per-rule** exclusions over the global `-AttackSurfaceReductionOnlyExclusions`. A path added globally is carved out of *every* ASR rule — a much wider hole than you usually intend. Scope tightly to a full path and filename, never a broad folder.

### Step 8 — Promote a clean rule from Audit to Block

Once a rule has run in Audit long enough to show either no hits or only excluded ones, promote it. Re-issue the rule with action `Enabled`; Defender updates that rule's mode in place:

```powershell
# Promote "Block execution of potentially obfuscated scripts" to Block
Add-MpPreference -AttackSurfaceReductionRules_Ids 5beb7efe-fd9a-4556-801d-275e5ffc04cc `
  -AttackSurfaceReductionRules_Actions Enabled
```

Promote **one rule at a time**, leaving a gap between each, so any new block is unambiguously traceable to the rule you just changed.

## Verification

Confirm the final state is what you intended — standard-protection rules at Block, promoted rule at Block, the rest still Audit:

```powershell
$p = Get-MpPreference
$map = @{ 0='Off'; 1='Block'; 2='Audit'; 5='NotConfigured'; 6='Warn' }
0..($p.AttackSurfaceReductionRules_Ids.Count - 1) |
  ForEach-Object {
    [pscustomobject]@{
      Rule = $asrNames[$p.AttackSurfaceReductionRules_Ids[$_]]
      Mode = $map[[int]$p.AttackSurfaceReductionRules_Actions[$_]]
    }
  } | Sort-Object Mode, Rule | Format-Table -AutoSize
```

Then prove enforcement actually changed. Re-run the benign obfuscated-script test from Step 5. Because that rule is now in **Block**, the action is stopped and Defender writes **Event 1121** instead of 1122:

```powershell
Get-WinEvent -FilterHashtable @{
    LogName = 'Microsoft-Windows-Windows Defender/Operational'; Id = 1121
} -MaxEvents 5 | Format-List TimeCreated, Id, Message
```

Finally, confirm your exclusion is registered and scoped to the right rule:

```powershell
(Get-MpPreference).AttackSurfaceReductionRules_RuleSpecificExclusions_Id
(Get-MpPreference).AttackSurfaceReductionRules_RuleSpecificExclusions
```

A rule showing **Block** in `Get-MpPreference`, a matching **1121** in the log, and the exclusion listed against the correct GUID means the full audit-to-block loop is closed.

## Closing

You now have a repeatable pattern that scales from one VM to a domain: safe rules to Block immediately, everything else to Audit, telemetry-driven exclusions, then a measured promotion — the opposite of flipping every rule to Block and fielding the helpdesk calls.

**Your concrete next step today:** take the Step 6 parser, point it at a real workstation that's been running the standard-protection rules for a week, and see what's already firing. Even with only the three low-risk rules enabled, you'll usually find at least one LSASS-access hit worth understanding.

When you move to fleet scale, will you enforce ASR through **Group Policy** or **Intune** — and how will you keep the two from silently overwriting each other on the endpoints that end up managed by both?

---

*Sources — Microsoft Learn:*
[ASR rules reference](https://learn.microsoft.com/en-us/defender-endpoint/attack-surface-reduction-rules-reference) ·
[Configure ASR rules and exclusions](https://learn.microsoft.com/en-us/defender-endpoint/attack-surface-reduction-rules-configure) ·
[ASR rules deployment guide](https://learn.microsoft.com/en-us/defender-endpoint/attack-surface-reduction-rules-deployment) ·
[ASR events in Windows Event Viewer](https://learn.microsoft.com/en-us/defender-endpoint/attack-surface-reduction-windows-events)
