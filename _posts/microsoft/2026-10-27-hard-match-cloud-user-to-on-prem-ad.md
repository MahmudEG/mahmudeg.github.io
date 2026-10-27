---
title: "One On-Prem Account, Two Cloud Identities: Hard-Matching an Existing M365 User to AD"
description: "Why Entra Connect soft match creates duplicate cloud users, and the step-by-step hard match fix that links an existing Microsoft 365 user to on-prem AD without losing the mailbox or OneDrive, including the July 2026 hard match protections."
date: 2026-10-27 09:00 +0200
categories: [Microsoft, Hybrid Identity]
tags:
  - Entra ID
  - Entra Connect
  - Active Directory
  - Hybrid Identity
  - PowerShell
  - Microsoft Graph
by: Mahmud
image: /assets/img/Hard-matching.jpg
published: true
---

## What You'll Fix

You have an active, cloud-only Microsoft 365 user with a mailbox and OneDrive. You also have an on-prem AD account for the same person. When the AD account entered sync scope, Entra Connect didn't link the two accounts. Instead you got either:

- a **second cloud user** (`jdoe1234@contoso.onmicrosoft.com` or similar) with no mailbox, or
- an **`InvalidSoftMatch`** / **`AttributeValueMustBeUnique`** export error in Entra Connect.

This post links the AD account to the **original** cloud user with a hard match. The mailbox and OneDrive both belong to that cloud user's object ID. If you keep that object, the mailbox and OneDrive stay with it. If you delete it, they go with it.

> Never delete the original cloud user to "let sync recreate it". The new object gets a new object ID, a new empty mailbox and a new empty OneDrive. Recovery from that point is a restore project, not a sync fix.
{: .prompt-danger }

## Why Soft Match Fails

When a **new** object arrives from AD, Entra ID tries to find an existing cloud object in this order:

1. **Hard match**: the incoming `sourceAnchor` equals a cloud user's `onPremisesImmutableId`.
2. **Soft match**: the incoming `userPrincipalName` or **primary** SMTP address (`SMTP:` in uppercase, never aliases) equals a cloud user's.

A cloud-only user has no `onPremisesImmutableId`, so everything rests on soft match. That fails when:

| Cause | Result |
|---|---|
| UPN typo or different UPN suffix on-prem (`john.doe@contoso.local` vs `john.doe@contoso.com`) | No match → duplicate cloud user |
| On-prem primary SMTP differs, or the address is only an alias in the cloud | No match → duplicate cloud user |
| Address already used as a proxy address on another object | `AttributeValueMustBeUnique` |
| Cloud user already has a **different** `onPremisesImmutableId` | `InvalidSoftMatch` |
| Cloud user holds an Entra admin role | Soft match refused → "Existing Admin Role Conflict" |

Matching is evaluated only when the object is first provisioned. Correcting the UPN in AD *after* the duplicate exists won't merge the two accounts. You have to clean up and hard match.

## What Changed in July 2026

Beginning **July 1, 2026**, Entra ID enforces hard match security hardening in the cloud, for both Entra Connect Sync and Cloud Sync, regardless of client version. A hard match is blocked if the target cloud user:

- is **assigned** a privileged Entra role,
- is **eligible** for a privileged Entra role (PIM), or
- already has `onPremisesObjectIdentifier` set.

Blocked attempts surface as `InvalidHardMatch` (103) or `AttributeUpdateNotAllowed` (96). Hard match also fails if the tenant has `BlockCloudObjectTakeoverThroughHardMatchEnabled` turned on. The procedure below handles all of these.

## Prerequisites

- **Entra Connect server**: local admin, ADSync module.
- **AD**: rights to move the user between OUs and edit `userPrincipalName` / `proxyAddresses`.
- **Microsoft Graph PowerShell SDK**, and an account with User Administrator plus Privileged Role Administrator (or Hybrid Identity Administrator where noted).
- An OU that is **excluded** from the sync scope (for example `OU=NoSync`).

```powershell
Connect-MgGraph -Scopes "User.ReadWrite.All","Directory.ReadWrite.All",
    "RoleManagement.ReadWrite.Directory","OnPremDirectorySynchronization.ReadWrite.All"

$CloudUpn = 'john.doe@contoso.com'   # the ORIGINAL user with the mailbox
$SamName  = 'jdoe'                   # the on-prem AD account
```

## Step-by-Step

### Step 1 — Take the AD user out of sync scope

Move the AD account into the non-synced OU so Entra Connect stops trying to provision it while you work:

```powershell
# On a DC or a host with RSAT
Get-ADUser $SamName | Move-ADObject -TargetPath 'OU=NoSync,DC=contoso,DC=local'
```

```powershell
# On the Entra Connect server
Start-ADSyncSyncCycle -PolicyType Delta
```

If a duplicate cloud user exists, this delta cycle soft-deletes it, because its source object left scope.

### Step 2 — If a duplicate exists: copy its ImmutableId, then hard-delete it

**Before** it disappears, record the duplicate's `onPremisesImmutableId`. It already holds the correct source anchor for the AD user, so it doubles as a cross-check for Step 4.

```powershell
# Run BEFORE Step 1 if you can, while the duplicate is still active
$Dup = Get-MgUser -Filter "startswith(userPrincipalName,'jdoe')" `
        -Property Id,UserPrincipalName,OnPremisesImmutableId,OnPremisesSyncEnabled |
       Where-Object OnPremisesSyncEnabled
$Dup | Select-Object Id, UserPrincipalName, OnPremisesImmutableId
$DupImmutableId = $Dup.OnPremisesImmutableId
```

After Step 1, the duplicate sits in the Entra recycle bin. **The soft-deleted copy still holds the ImmutableId, UPN and proxy addresses.** If you leave it there, stamping the same ImmutableId on the original user fails as a duplicate value. Permanently delete it:

```powershell
Get-MgDirectoryDeletedItemAsUser -All |
    Where-Object { $_.Id -eq $Dup.Id } |
    Select-Object Id, UserPrincipalName, DeletedDateTime

Remove-MgDirectoryDeletedItem -DirectoryObjectId $Dup.Id
```

> Check that you're deleting the **duplicate** (the synced object without a mailbox), not the original. Compare object IDs against `Get-MgUser -UserId $CloudUpn` before running `Remove-MgDirectoryDeletedItem`. This deletion is irreversible.
{: .prompt-warning }

### Step 3 — Remove admin roles from the original cloud user, active and eligible

Record the roles first so you can put them back exactly:

```powershell
$Cloud = Get-MgUser -UserId $CloudUpn -Property Id,UserPrincipalName,OnPremisesImmutableId

# Active assignments
$Active = Get-MgRoleManagementDirectoryRoleAssignment -Filter "principalId eq '$($Cloud.Id)'" -ExpandProperty RoleDefinition
# PIM-eligible assignments
$Eligible = Get-MgRoleManagementDirectoryRoleEligibilitySchedule -Filter "principalId eq '$($Cloud.Id)'" -ExpandProperty RoleDefinition

$Active   | Select-Object @{n='Role';e={$_.RoleDefinition.DisplayName}}, RoleDefinitionId, DirectoryScopeId | Export-Csv .\roles-active.csv -NoTypeInformation
$Eligible | Select-Object @{n='Role';e={$_.RoleDefinition.DisplayName}}, RoleDefinitionId, DirectoryScopeId | Export-Csv .\roles-eligible.csv -NoTypeInformation
```

Remove them:

```powershell
# Active assignments
$Active | ForEach-Object {
    Remove-MgRoleManagementDirectoryRoleAssignment -UnifiedRoleAssignmentId $_.Id
}

# PIM eligibility
$Eligible | ForEach-Object {
    New-MgRoleManagementDirectoryRoleEligibilityScheduleRequest -BodyParameter @{
        Action           = 'adminRemove'
        PrincipalId      = $Cloud.Id
        RoleDefinitionId = $_.RoleDefinitionId
        DirectoryScopeId = $_.DirectoryScopeId
        Justification    = 'Temporary removal for Entra Connect hard match'
    }
}
```

If the role is PIM-active rather than permanently assigned, `Remove-MgRoleManagementDirectoryRoleAssignment` can fail. In that case, remove it with `New-MgRoleManagementDirectoryRoleAssignmentScheduleRequest` and `Action = 'adminRemove'`.

Also check the other two blockers while you're here:

```powershell
# onPremisesObjectIdentifier must be empty on the target
Invoke-MgGraphRequest -Method GET `
  "https://graph.microsoft.com/beta/users/$($Cloud.Id)?`$select=onPremisesObjectIdentifier,onPremisesImmutableId"

# Tenant-wide hard match block
(Get-MgDirectoryOnPremiseSynchronization).Features.BlockCloudObjectTakeoverThroughHardMatchEnabled
```

If `onPremisesObjectIdentifier` has a value, first confirm this really is the right person. Then clear it to `null`, using a Graph beta `PATCH` or `Clear-ADSyncToolsOnPremisesAttribute -Id <userId> -onPremisesObjectIdentifier` (ADSyncTools 2.5.0+). If the tenant flag is `True`, set it to `False` for this change window and turn it back on afterwards.

### Step 4 — Get the ImmutableId from AD

Entra Connect's default source anchor is `mS-DS-ConsistencyGuid`. On first export it's populated from `objectGUID`, so the two normally match. Use ConsistencyGuid if it's populated and fall back to objectGUID if it isn't:

```powershell
$AdUser = Get-ADUser $SamName -Properties 'mS-DS-ConsistencyGuid', ObjectGUID

$ImmutableId = if ($AdUser.'mS-DS-ConsistencyGuid') {
    [Convert]::ToBase64String($AdUser.'mS-DS-ConsistencyGuid')
} else {
    [Convert]::ToBase64String($AdUser.ObjectGUID.ToByteArray())
}
$ImmutableId

# Cross-check against the value copied from the duplicate in Step 2
if ($DupImmutableId) { $ImmutableId -ceq $DupImmutableId }   # must be True
```

> Older deployments that chose `objectGUID` as the source anchor at install time never use ConsistencyGuid. If you're unsure, check the duplicate's value from Step 2. That's the value Entra Connect actually computed for this user, so treat it as the reference.
{: .prompt-tip }

### Step 5 — Align on-prem attributes, then stamp the cloud user

The hard match overwrites cloud attributes with the on-prem values. Before linking, make sure AD carries what the mailbox needs:

```powershell
Set-ADUser $SamName -UserPrincipalName 'john.doe@contoso.com' -EmailAddress 'john.doe@contoso.com'
Set-ADUser $SamName -Replace @{ proxyAddresses = @(
    'SMTP:john.doe@contoso.com',         # primary (uppercase)
    'smtp:jdoe@contoso.com',             # every cloud alias you want to keep
    'smtp:john.doe@contoso.onmicrosoft.com'
)}
```

Pull the current aliases from Exchange Online (`(Get-EXOMailbox $CloudUpn).EmailAddresses`) so you don't silently drop one.

Then stamp the original cloud user:

```powershell
Update-MgUser -UserId $Cloud.Id -OnPremisesImmutableId $ImmutableId

Get-MgUser -UserId $Cloud.Id -Property UserPrincipalName,OnPremisesImmutableId |
    Select-Object UserPrincipalName, OnPremisesImmutableId
```

> If the user's UPN is in a **federated** domain, Entra ID can reject the ImmutableId change. Temporarily switch the cloud UPN to the `onmicrosoft.com` domain, stamp the value, and let sync restore the real UPN.
{: .prompt-warning }

### Step 6 — Resume sync and run a delta cycle

Move the AD user back into a synced OU and sync:

```powershell
Get-ADUser $SamName | Move-ADObject -TargetPath 'OU=Users,OU=Corp,DC=contoso,DC=local'
```

```powershell
Start-ADSyncSyncCycle -PolicyType Delta
```

Entra ID finds a cloud user whose `onPremisesImmutableId` equals the incoming source anchor and takes it over. Source of authority moves to AD, and the object ID, mailbox and OneDrive stay as they were.

Then put back what you removed in Step 3. Re-add the active roles with `New-MgRoleManagementDirectoryRoleAssignment` and eligibility with `New-MgRoleManagementDirectoryRoleEligibilityScheduleRequest -Action adminAssign`, using the CSVs you exported. If you disabled `BlockCloudObjectTakeoverThroughHardMatchEnabled`, set it back to `True`.

## Verification

```powershell
Get-MgUser -UserId $CloudUpn -Property Id,UserPrincipalName,OnPremisesSyncEnabled,OnPremisesImmutableId,OnPremisesLastSyncDateTime |
    Select-Object Id, UserPrincipalName, OnPremisesSyncEnabled, OnPremisesImmutableId, OnPremisesLastSyncDateTime
```

- `Id` is **unchanged** from before the fix.
- `OnPremisesSyncEnabled` = `True`, and `OnPremisesLastSyncDateTime` is recent.
- Only one user has this UPN: `Get-MgUser -Filter "startswith(displayName,'John Doe')"` returns one object.
- Entra Connect shows no export errors for the object (Synchronization Service Manager → **Connector Space Object Properties**, or the Connect Health sync errors blade).
- The mailbox still has all its addresses: `(Get-EXOMailbox $CloudUpn).EmailAddresses`.
- The user signs in with the **on-prem password**. With password hash sync, the AD hash replaces the cloud password. Tell the user before the change, not after.
- Roles are restored: compare `Get-MgRoleManagementDirectoryRoleAssignment` / `...EligibilitySchedule` against your CSVs.

## The Root Cause Sits in AD

Almost every case above starts in on-prem AD, with a `.local` UPN suffix, a primary SMTP that doesn't match the mailbox, or a proxy address that already exists elsewhere. **IdFix** used to catch those before Entra Connect ever ran: duplicates, invalid characters, formatting errors, with suggested fixes.

Microsoft ended IdFix support on **June 30, 2026**, archived the GitHub repo in July, and hasn't named a replacement. The pre-sync check is now the admin's job. A minimal version you can run today:

```powershell
$Users = Get-ADUser -Filter * -Properties proxyAddresses, mail, userPrincipalName

# Duplicate UPNs
$Users | Group-Object userPrincipalName | Where-Object Count -gt 1 |
    Select-Object Name, @{n='Accounts';e={$_.Group.SamAccountName -join ', '}}

# Duplicate SMTP proxy addresses (case-insensitive)
$Users | ForEach-Object {
    foreach ($p in $_.proxyAddresses) { if ($p -match '^smtp:') {
        [pscustomobject]@{ Address = $p.Substring(5).ToLower(); Sam = $_.SamAccountName } } }
} | Group-Object Address | Where-Object Count -gt 1 |
    Select-Object Name, @{n='Accounts';e={$_.Group.Sam -join ', '}}

# UPNs on non-routable suffixes
$Users | Where-Object { $_.userPrincipalName -match '\.(local|lan|corp|internal)$' } |
    Select-Object SamAccountName, userPrincipalName
```

This won't replace every IdFix rule (character validation, length limits, mail vs. proxyAddresses mismatches), but it catches the three conditions behind most duplicate-account tickets.

## Closing

Hard match is a controlled takeover: pause the user, clear the duplicate, remove the blockers, stamp the anchor, resume. Keep the original object and everything attached to it survives.

**Next step:** run the duplicate-UPN and duplicate-proxy queries above against your forest before the next user goes into sync scope, and fix whatever they return in AD.

What's your go-to IdFix alternative today: a script of your own, Entra Connect Health sync errors, or a third-party tool?

**References**

- [Configure Microsoft Entra Connect for an existing tenant (hard match vs. soft match, July 2026 protections)](https://learn.microsoft.com/en-us/entra/identity/hybrid/connect/how-to-connect-install-existing-tenant)
- [Understanding errors during Microsoft Entra synchronization (InvalidHardMatch, InvalidSoftMatch)](https://learn.microsoft.com/en-us/entra/identity/hybrid/connect/tshoot-connect-sync-errors)
- [Microsoft IdFix (archived)](https://github.com/microsoft/idfix)
