---
title: "Detect and Remediate an AD CS ESC1 Certificate Template (Step-by-Step Lab)"
description: "Find the certificate template that lets any domain user request a cert as Domain Admin, prove the exposure, and close it: audit templates with PowerShell, enable CA auditing, and remove ENROLLEE_SUPPLIES_SUBJECT — with verification at every step."
date: 2026-07-16 10:00 +0200
categories: [Labs & Projects, Microsoft]
tags:
  - Active Directory
  - AD CS
  - PKI
  - Security
  - PowerShell
  - Hardening
  - Zero Trust
by: Mahmud
image:
  path: https://techcommunity.microsoft.com/t5/s/gxcuf89792/images/bS00NDYzMjQwLU0yRnlBUQ?revision=4
published: true
---

## What You'll Build

ESC1 is the single most common Active Directory Certificate Services (AD CS) misconfiguration, and it hands a low-privileged user a straight path to Domain Admin. The mechanism is simple: a certificate template that (1) lets the **enrollee supply the subject**, (2) carries an **authentication EKU**, and (3) is **enrollable by ordinary users without manager approval**. Put those three together and any domain user can request a certificate that names them as `Administrator`, then authenticate with it.

In this lab you'll stand up the vulnerable condition on purpose in an isolated environment, then do the part that actually matters operationally:

- **Enumerate every certificate template** in the forest and flag the ones that meet all three ESC1 conditions, using nothing but the AD PowerShell module.
- **Turn on CA-level auditing** so certificate requests and issuance land in the Security log (Event IDs 4886 / 4887).
- **Remediate** the template three ways — remove `ENROLLEE_SUPPLIES_SUBJECT`, restrict enrollment rights, and apply manager approval as a compensating control.
- **Verify** the fix by re-running the detection script and confirming the audit filter is live.

You finish with a reusable detection script you can run against any production CA, and a template that no longer trusts the requester to name themselves.

> This lab intentionally creates an exploitable AD CS configuration. Build it **only** in an isolated lab forest you own and can throw away — never on a domain that shares trust, DNS, or network reachability with production.
{: .prompt-danger }

## Lab Environment

| Role | Host | OS | Notes |
| --- | --- | --- | --- |
| Domain Controller | `DC01` | Windows Server 2022 | Forest/domain `lab.local` |
| Enterprise CA | `CA01` | Windows Server 2022 | AD CS role, Enterprise Root CA |
| Member / admin host | `MGMT01` | Windows Server 2022 | RSAT + AD PowerShell module |
| Low-priv account | `lab\jdoe` | — | Standard domain user, used to prove exposure |

Requirements before you start:

- An **Enterprise CA** already installed (`Add Certificate Templates` snap-in available on the CA).
- The **Active Directory module** for PowerShell on your admin host (`Import-Module ActiveDirectory`).
- Membership in a role that can edit templates and CA settings — typically **Enterprise Admins** plus **Cert Publishers / CA Administrator** rights.
- A standard domain user (`jdoe`) with no special privileges, to confirm the exposure is real and not an artifact of running everything as admin.

> AD CS objects live in the forest **Configuration** partition, so a template misconfiguration is a *forest-wide* exposure — every domain in the forest can enroll. Treat your CA as a Tier 0 asset alongside your domain controllers.
{: .prompt-warning }

## Step-by-Step

### Step 1 — Create the vulnerable template (lab setup only)

Duplicate the built-in **User** template and deliberately weaken it so you have a known-bad target to detect and fix.

1. On `CA01`, open **Certificate Templates Console** (`certtmpl.msc`).
2. Right-click the **User** template → **Duplicate Template**.
3. On the **General** tab, set the display name to `Lab-VulnUser`.
4. On the **Subject Name** tab, select **Supply in the request**. Acknowledge the security warning — this is the flag that makes ESC1 possible.
5. On the **Extensions** tab, confirm **Application Policies** includes **Client Authentication** (it does by default for User).
6. On the **Security** tab, ensure **Domain Users** (or **Authenticated Users**) has **Read** and **Enroll**.
7. On the **Issuance Requirements** tab, leave **CA certificate manager approval** *unchecked*.
8. Click **OK**, then publish it: **Certification Authority** console (`certsrv.msc`) → right-click **Certificate Templates** → **New → Certificate Template to Issue** → select `Lab-VulnUser`.

You now have a template that satisfies all three ESC1 conditions.

> `certtmpl.msc` writes directly to the Configuration partition. Never test "Supply in the request" on a template that is already published in production — publishing propagates within minutes.
{: .prompt-danger }

### Step 2 — Understand what makes it ESC1

Three attributes on the template object decide everything. Knowing the exact bits is what lets you detect this at scale instead of clicking through every template by hand.

| Attribute | ESC1 condition | Value to look for |
| --- | --- | --- |
| `msPKI-Certificate-Name-Flag` | Enrollee supplies subject | `CT_FLAG_ENROLLEE_SUPPLIES_SUBJECT` = `0x00000001` bit set |
| `pKIExtendedKeyUsage` | Certificate is valid for authentication | Client Authentication `1.3.6.1.5.5.7.3.2`, Smart Card Logon `1.3.6.1.4.1.311.20.2.2`, PKINIT Client Auth `1.3.6.1.5.2.3.4`, or Any Purpose `2.5.29.37.0` |
| `msPKI-Enrollment-Flag` | No manager approval | `CT_FLAG_PEND_ALL_REQUESTS` = `0x00000002` bit **not** set |

A template is ESC1 when the subject flag is set, an authentication EKU is present, approval is **not** required, and a low-privileged group holds **Enroll**.

### Step 3 — Detect ESC1 across the whole forest with PowerShell

Run this from `MGMT01`. It reads every template object out of the Configuration partition and applies the three-condition test above. No third-party tooling — just `ActiveDirectory`.

```powershell
Import-Module ActiveDirectory

$configNC     = (Get-ADRootDSE).ConfigurationNamingContext
$templatePath = "CN=Certificate Templates,CN=Public Key Services,CN=Services,$configNC"

# EKUs that make a certificate usable for AD authentication
$authEKUs = @(
    '1.3.6.1.5.5.7.3.2',       # Client Authentication
    '1.3.6.1.4.1.311.20.2.2',  # Smart Card Logon
    '1.3.6.1.5.2.3.4',         # PKINIT Client Authentication
    '2.5.29.37.0'              # Any Purpose
)

Get-ADObject -SearchBase $templatePath -LDAPFilter '(objectClass=pKICertificateTemplate)' `
    -Properties displayName, 'msPKI-Certificate-Name-Flag', 'msPKI-Enrollment-Flag', pKIExtendedKeyUsage |
ForEach-Object {
    $nameFlag   = [int]$_.'msPKI-Certificate-Name-Flag'
    $enrollFlag = [int]$_.'msPKI-Enrollment-Flag'
    $ekus       = @($_.pKIExtendedKeyUsage)

    $suppliesSubject = ($nameFlag   -band 0x1) -eq 0x1   # ENROLLEE_SUPPLIES_SUBJECT
    $managerApproval = ($enrollFlag -band 0x2) -eq 0x2   # PEND_ALL_REQUESTS
    $matchedEKU      = $ekus | Where-Object { $_ -in $authEKUs }

    if ($suppliesSubject -and $matchedEKU -and -not $managerApproval) {
        [pscustomobject]@{
            Template        = $_.displayName
            SuppliesSubject = $true
            AuthEKU         = ($matchedEKU -join ', ')
            ManagerApproval = $managerApproval
        }
    }
} | Format-Table -AutoSize
```

`Lab-VulnUser` should appear in the output. On a real CA, treat **every** row this returns as a finding to close.

> This detects the template configuration. It does **not** check *who* can enroll. Combine it with an ACL review (Step 6) — a template is only exploitable if a low-privileged principal actually holds the Enroll right.
{: .prompt-tip }

### Step 4 — (Optional) Prove the exposure from a low-priv account

If you want to *see* the escalation before you fix it, this is where the attacker's view lives. Tools like **Certify** and **Certipy** enumerate and abuse ESC1 automatically; a defender running them in a lab understands exactly what the telemetry should look like.

```text
# Enumerate vulnerable templates (attacker view)
Certify.exe find /vulnerable

# Request a cert as jdoe but name the SAN as a Domain Admin
Certify.exe request /ca:CA01.lab.local\lab-CA01-CA /template:Lab-VulnUser /altname:Administrator
```

The CA issues a certificate whose subject alternative name is `Administrator`, which can then be used with Kerberos PKINIT to authenticate as that account.

> Offensive tooling (Certify, Certipy, Rubeus) is shown for defender understanding **only**. Run it exclusively in an isolated lab you own and are authorized to test. Using it against systems without explicit written authorization is illegal.
{: .prompt-danger }

### Step 5 — Enable CA auditing so requests are recorded

Before you change the template, make sure issuance is being logged — you want to detect abuse against any template you *haven't* fixed yet. On `CA01`:

```powershell
# Turn on all AD CS audit categories (127 = 0x7F = every event class)
certutil -setreg CA\AuditFilter 127

# Restart the CA service to apply
Restart-Service certsvc

# Also enable the OS-level audit subcategory so events reach the Security log
auditpol /set /subcategory:"Certification Services" /success:enable /failure:enable
```

With this on, the CA writes **Event ID 4886** (request received) and **Event ID 4887** (request approved / certificate issued) to the Security log. The tell for ESC1 abuse is a 4887 where the issued Subject Alternative Name does not match the requesting account's own UPN.

### Step 6 — Remediate the template

Fix the root cause first, then layer defence in depth. Do these in order.

**6a — Remove "Supply in the request" (the actual fix).** In `certtmpl.msc`, open `Lab-VulnUser` → **Subject Name** tab → select **Build from this Active Directory information**. This clears `ENROLLEE_SUPPLIES_SUBJECT`; the CA now derives the subject from the requesting account instead of trusting the request. This alone kills ESC1.

**6b — Restrict enrollment rights.** On the **Security** tab, remove **Enroll** from **Domain Users** / **Authenticated Users**. Grant Enroll only to a purpose-built group that genuinely needs the template. You can confirm who currently holds the Certificate-Enrollment extended right (`0e10c968-78fb-11d2-90d4-00c04f79dc55`) with:

```powershell
$acl = (Get-ADObject "CN=Lab-VulnUser,$templatePath" -Properties nTSecurityDescriptor).nTSecurityDescriptor
$acl.Access | Where-Object {
    $_.ObjectType -eq '0e10c968-78fb-11d2-90d4-00c04f79dc55'
} | Select-Object IdentityReference, ActiveDirectoryRights, AccessControlType
```

**6c — Require manager approval (compensating control).** For any template you can't immediately flatten, open **Issuance Requirements** → check **CA certificate manager approval**. This sets `CT_FLAG_PEND_ALL_REQUESTS` (`0x2`), forcing a human to approve each request. Use it as a stopgap, not a substitute for 6a.

> Related hardening: make sure your DCs enforce **strong certificate mapping** (KB5014754 / `StrongCertificateBindingEnforcement`). Weak implicit mapping is what let a supplied-SAN certificate impersonate an account in the first place. Full enforcement mode has been the default since February 2025.
{: .prompt-tip }

## Verification

Confirm each control took effect rather than trusting the console.

**1. The template no longer matches ESC1.** Re-run the detection script from Step 3. `Lab-VulnUser` should no longer appear in the output. If it still does, the Configuration partition may not have replicated yet — force it and re-check:

```powershell
repadmin /syncall /AdeP
```

**2. CA auditing is live.** The value should return `0x7f`:

```powershell
certutil -getreg CA\AuditFilter
auditpol /get /subcategory:"Certification Services"
```

**3. Enrollment rights are scoped.** Re-run the ACL query from Step 6b and confirm no broad group (Domain Users, Authenticated Users) retains Enroll.

**4. A supplied-SAN request is now refused.** From `jdoe`, repeating the Step 4 request against the fixed template should fail — the CA ignores the requested SAN and builds the subject from AD, so it can no longer be coerced into naming `Administrator`.

> For continuous coverage, **Microsoft Defender for Identity** ships posture assessments that flag ESC1-style templates ("Prevent users from requesting a certificate valid for arbitrary users"). If you run Defender for Identity, use it to catch the next misconfigured template before an attacker does.
{: .prompt-tip }

## Closing

ESC1 is dangerous precisely because it hides in plain sight: a template someone duplicated years ago, ticked "Supply in the request" for one legitimate use case, and left enrollable by everyone. The fix is boring and permanent — build the subject from Active Directory, scope enrollment to groups that need it, and log issuance so you'd see abuse if it happened.

Your concrete next step today: run the Step 3 detection script against your **production** CA. It's read-only and takes seconds. Every row it returns is a template that can currently mint a Domain Admin certificate — triage those before you touch anything else.

Once you've cleaned up ESC1, the same certificate objects hide ESC2 through ESC16 (agent templates, dangerous EKUs, vulnerable CA ACLs, the `EDITF_ATTRIBUTESUBJECTALTNAME2` flag). Which AD CS finding is highest on your list to tackle next — and is your CA being treated as a Tier 0 asset today?
