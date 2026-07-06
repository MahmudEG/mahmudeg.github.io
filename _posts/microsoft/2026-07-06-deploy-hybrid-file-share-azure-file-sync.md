---
title: "Deploy a Hybrid File Share Solution with Azure File Sync (Step-by-Step Lab)"
description: "Step-by-step lab: deploy an Azure Files share, sync it with an on-prem file server using Azure File Sync, authenticate users with AD DS credentials, and front it with DFS Namespaces for transparent failover."
date: 2026-07-06 10:00 +0200
categories: [Microsoft, Azure]
tags:
  - Azure
  - Azure Files
  - Azure File Sync
  - DFS Namespaces
  - Active Directory
  - Hybrid
  - Windows Server
  - PowerShell
by: Mahmud
image: https://learn.microsoft.com/en-us/azure/storage/files/media/storage-sync-files-deployment-guide/azure-file-sync-deployment.png
published: true
---

## What You'll Build

In this lab you deploy a **hybrid file share**: an on-premises Windows file server and an Azure Files share kept continuously in sync, presented to users through a single unchanging path. Users authenticate with their existing Active Directory credentials, and DFS Namespaces lets clients fail over from the local server to the cloud share (and back) without any change to drive mappings or permissions.

By the end you'll have:

- An **Azure Files** share holding a full copy of the data, enforcing NTFS ACLs.
- **Azure File Sync** replicating files and permissions bidirectionally, delta-only.
- **AD DS identity-based authentication** so users open the cloud share with their normal domain credentials.
- **DFS Namespaces** exposing one path (`\\corp.local\Files\Share`) with two targets — local server (primary) and Azure share (standby).
- **Private Endpoint over VPN** so SMB (TCP 445) never traverses the public internet.

```
                 ┌───────────────────────────┐
   Users ──►  \\corp.local\Files  (DFS-N)     │
                 │   Target 1: FS01  (priority)│  ◄── primary
                 │   Target 2: Azure share     │  ◄── standby
                 └───────────────────────────┘
                         │                 │
                 ┌───────▼──────┐   ┌──────▼─────────────────┐
                 │  FS01 (on-prem)│  │ Azure Files share       │
                 │  AFS agent     │◄─┤ (SMB, NTFS ACLs)        │
                 │  D:\Shares\Files│ │ AD DS identity auth     │
                 └───────┬────────┘  └──────┬─────────────────┘
                         │  Azure File Sync  │
                         └───────(sync)──────┘
             SMB 445 rides a private endpoint over the VPN tunnel
```

---

## Lab Environment

- **DC01** — Windows Server 2022, AD DS domain `corp.local`
- **FS01** — Windows Server 2022, domain-joined, share at `D:\Shares\Files`
- **Azure subscription** with a resource group, and a **site-to-site VPN or ExpressRoute** connecting the lab VNet to on-prem
- **Client workstation** — domain-joined, for testing the DFS path
- **Tooling:** `Az` PowerShell module, the **AzFilesHybrid** module, RSAT (DFS Management), and the Azure File Sync agent

```powershell
# On a management box
Install-Module Az -Scope CurrentUser
Install-Module Az.StorageSync -Scope CurrentUser
Connect-AzAccount
$rg   = "rg-hybridfiles"
$loc  = "italynorth"
$sa   = "sthybridfiles01"     # storage account name (globally unique, lowercase)
$share= "files"
```

---

## Step 1 — Create the Storage Account and File Share

```powershell
New-AzResourceGroup -Name $rg -Location $loc

# StorageV2, Standard, LRS
$storage = New-AzStorageAccount -ResourceGroupName $rg -Name $sa `
  -Location $loc -SkuName Standard_LRS -Kind StorageV2 `
  -EnableLargeFileShare

New-AzRmStorageShare -ResourceGroupName $rg -StorageAccountName $sa `
  -Name $share -QuotaGiB 2048
```

---

## Step 2 — Lock SMB to the Private Network

Azure Files listens on TCP 445, which many ISPs block. Add a **private endpoint** so the share resolves to a private IP reachable over the VPN, and disable public access.

```powershell
# Disable public network access
Set-AzStorageAccount -ResourceGroupName $rg -Name $sa -PublicNetworkAccess Disabled

# Private endpoint (VNet/subnet already connected to on-prem via VPN)
$vnet   = Get-AzVirtualNetwork -Name "vnet-hub" -ResourceGroupName $rg
$subnet = $vnet.Subnets | Where-Object Name -eq "snet-endpoints"

$plsConn = New-AzPrivateLinkServiceConnection -Name "pe-files-conn" `
  -PrivateLinkServiceId $storage.Id -GroupId "file"

New-AzPrivateEndpoint -Name "pe-$sa-file" -ResourceGroupName $rg -Location $loc `
  -Subnet $subnet -PrivateLinkServiceConnection $plsConn
```

Create the **Private DNS zone** `privatelink.file.core.windows.net`, link it to the VNet, and make sure on-prem clients resolve the storage FQDN to the private IP (a conditional forwarder or DNS forwarder to Azure Private DNS).

> If on-prem clients resolve `sthybridfiles01.file.core.windows.net` to the public IP instead of the private endpoint, SMB will be blocked. Fix DNS resolution first.
{: .prompt-warning }

---

## Step 3 — Domain-Join the Storage Account to AD DS

This lets users open the cloud share with their existing credentials. Use the **AzFilesHybrid** module from a machine that can reach the domain.

```powershell
# Download AzFilesHybrid: https://github.com/Azure-Samples/azure-files-samples/releases
Import-Module .\AzFilesHybrid.psd1
Connect-AzAccount

Join-AzStorageAccountForAuth `
  -ResourceGroupName $rg `
  -StorageAccountName $sa `
  -DomainAccountType ComputerAccount `
  -OrganizationalUnitDistinguishedName "OU=AzureStorage,DC=corp,DC=local"
```

Verify the join and Kerberos setup:

```powershell
Debug-AzStorageAccountAuth -ResourceGroupName $rg -StorageAccountName $sa -Verbose
```

This creates an AD object with the SPN `cifs/sthybridfiles01.file.core.windows.net`, so domain clients can get a Kerberos ticket for the share. ([Enable AD DS authentication for Azure Files](https://learn.microsoft.com/en-us/azure/storage/files/storage-files-identity-ad-ds-enable))

---

## Step 4 — Grant Access: Share-Level RBAC + File-Level NTFS

Azure Files enforces **two permission layers** — configure both.

**a) Share-level (Azure RBAC)** — assign a role to the AD group (synced to Entra ID via Entra Connect):

```powershell
$grp = "fileusers@corp.local"
$scope = "$($storage.Id)/fileServices/default/fileshares/$share"

New-AzRoleAssignment -SignInName $grp `
  -RoleDefinitionName "Storage File Data SMB Share Contributor" `
  -Scope $scope
```

Roles: **Reader**, **Contributor**, **Elevated Contributor** (the last can modify NTFS ACLs).

**b) File/folder-level (NTFS ACLs)** — mount once with the storage account key to set the initial ACLs:

```powershell
$key = (Get-AzStorageAccountKey -ResourceGroupName $rg -Name $sa)[0].Value
net use Z: \\$sa.file.core.windows.net\$share /user:Azure\$sa $key

icacls Z:\ /grant "corp\fileusers:(OI)(CI)M"
icacls Z:\ /remove "Authenticated Users"
net use Z: /delete
```

Once File Sync runs, ACLs replicated from FS01 flow into the share automatically.

---

## Step 5 — Deploy Azure File Sync and Register FS01

```powershell
New-AzStorageSyncService -ResourceGroupName $rg -Name "afs-hybridfiles" -Location $loc
```

On **FS01**, install the Azure File Sync agent (Microsoft download), then register the server:

```powershell
# On FS01, after installing the agent MSI
Import-Module "C:\Program Files\Azure\StorageSyncAgent\StorageSync.Management.ServerCmdlets.dll"
Register-AzStorageSyncServer -ResourceGroupName $rg -StorageSyncServiceName "afs-hybridfiles"
```

---

## Step 6 — Create the Sync Group (Cloud + Server Endpoints)

The sync group ties the Azure file share (**cloud endpoint**) to the FS01 folder (**server endpoint**).

```powershell
New-AzStorageSyncGroup -ResourceGroupName $rg -StorageSyncServiceName "afs-hybridfiles" `
  -Name "sg-files"

# Cloud endpoint = the Azure file share
New-AzStorageSyncCloudEndpoint -ResourceGroupName $rg `
  -StorageSyncServiceName "afs-hybridfiles" -SyncGroupName "sg-files" `
  -StorageAccountResourceId $storage.Id -AzureFileShareName $share

# Server endpoint = the folder on FS01
$server = Get-AzStorageSyncServer -ResourceGroupName $rg -StorageSyncServiceName "afs-hybridfiles"
New-AzStorageSyncServerEndpoint -ResourceGroupName $rg `
  -StorageSyncServiceName "afs-hybridfiles" -SyncGroupName "sg-files" `
  -ServerResourceId $server.ResourceId `
  -ServerLocalPath "D:\Shares\Files" `
  -CloudTiering:$false
```

The first sync uploads FS01's existing files and ACLs to the cloud endpoint — no manual copy needed. Keep **cloud tiering off** so FS01 retains a full local copy. Track progress in the portal or with `Get-AzStorageSyncServerEndpoint`.

---

## Step 7 — Build the DFS Namespace

The namespace is the path users map. It holds one folder with **two targets**: FS01 (primary) and the Azure share (standby).

```powershell
# Domain-based namespace root (on a namespace server, e.g. DC01)
New-DfsnRoot -TargetPath "\\corp.local\Files" -Type DomainV2 -Path "\\corp.local\Files"

# Primary target = FS01
New-DfsnFolderTarget -Path "\\corp.local\Files\Share" `
  -TargetPath "\\FS01\Files" -ReferralPriorityClass GlobalHigh

# Standby target = Azure file share (private endpoint FQDN)
New-DfsnFolderTarget -Path "\\corp.local\Files\Share" `
  -TargetPath "\\$sa.file.core.windows.net\$share" -ReferralPriorityClass GlobalLow
```

`\\corp.local\Files\Share` now prefers FS01 and refers clients to the Azure target only when FS01 is unavailable.

> Lower the DFS referral TTL (default 300s) if you want clients to pick up failover faster instead of caching the primary referral.
{: .prompt-tip }

---

## Step 8 — Test Failover and Failback

**Simulate the local server going offline:**
```powershell
# On FS01
Stop-Service LanmanServer -Force
```

On the client, re-open `\\corp.local\Files\Share` — DFS refers you to the Azure target. Confirm you authenticated with your **domain** identity, not a storage key:

```powershell
klist   # expect a ticket: cifs/sthybridfiles01.file.core.windows.net
Get-SmbConnection | Select-Object ServerName, ShareName, UserName
```

**Bring the local server back:**
```powershell
Start-Service LanmanServer
```

Azure File Sync reconciles delta changes both ways, and DFS referrals return to FS01 (GlobalHigh). Only changed files sync — never a full re-upload.

---

## Verification

- **Identity:** `klist` shows a `cifs/<account>.file.core.windows.net` Kerberos ticket during failover.
- **Permission parity:** set a restrictive ACL on FS01, confirm it appears on the Azure share after sync, and that an unauthorized user is denied on both.
- **Delta-only sync:** add a file to the cloud share while FS01 is stopped, restart FS01, and confirm only that file syncs down (File Sync event log 9302/9102 on FS01).
- **Transparency:** the mapped drive and `\\corp.local\Files\Share` path are identical before, during, and after failover.

```powershell
Get-AzStorageSyncServerEndpoint -ResourceGroupName $rg `
  -StorageSyncServiceName "afs-hybridfiles" -SyncGroupName "sg-files" |
  Select-Object ServerLocalPath, SyncStatus, LastSyncSuccessTimestamp
```

---

## Closing

That's a working hybrid file share: Azure Files as the cloud copy, Azure File Sync keeping it current with delta-only reconciliation, AD DS handling authentication so nobody needs a new credential, and DFS Namespaces presenting one path that survives failover. Build it in a lab and run the Step 8 test before relying on it — DNS resolution to the private endpoint and the Kerberos join are the two things worth double-checking.

*Have you deployed Azure File Sync with DFS-N for failover, or used it mainly for cloud tiering? Curious which pattern people landed on.*

Sources: [Azure File Sync deployment](https://learn.microsoft.com/en-us/azure/storage/files/storage-sync-files-deployment-guide) · [Enable AD DS authentication for Azure Files](https://learn.microsoft.com/en-us/azure/storage/files/storage-files-identity-ad-ds-enable) · [On-prem AD DS authentication overview](https://learn.microsoft.com/en-us/azure/storage/files/storage-files-identity-ad-ds-overview)