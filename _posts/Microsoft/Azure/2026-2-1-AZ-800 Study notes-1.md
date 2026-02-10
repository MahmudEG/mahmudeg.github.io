---
title: 1- Deploy and manage identity infrastructure (AZ‑800)
description: Note1
date: 2026-2-1 7:00 +0200
categories:
  - Azure
  - AZ-800
tags:
  - Microsoft
  - Azure
  - Cloud
  - Windows
by: Mahmud
image:
published: true
---
## Introduction to AD DS

Active Directory Domain Services (AD DS) provides a directory database and services that allow organizations to store objects (users, groups, computers, printers) centrally and manage them with defined policies. The **logical components** of an AD DS infrastructure consist of:

|Logical component|Description|
|---|---|
|**Partition**|AD DS data are partitioned into three logical sections: **schema** (definitions of object classes and their attributes), **configuration** (replication topology), and **domain** partitions (data for each domain). Each domain has its own partition that replicates only within the domain.|
|**Schema**|Defines object classes and attributes. It is shared by all domains in a forest. Modifying the schema requires membership in **Schema Admins** and cannot be reversed, so changes must be tested carefully.|
|**Domain**|A logical container for users, groups and computers. The domain partition replicates to all domain controllers in the domain and acts as an administrative and security boundary capable of containing almost two‑billion objects. Domains can form trees and share trusts, and multiple trees can form a **forest**.|
|**Domain tree & forest**|A domain tree is a collection of domains within a contiguous namespace; a forest is a top‑level container that holds one or more domain trees and shares a common schema and global catalog. The forest root domain holds the **schema master** and **domain naming master** roles and contains the **Enterprise Admins** and **Schema Admins** groups. The forest is a replication boundary for configuration and schema partitions.|
|**Organizational Units (OUs)**|Container objects used to group users, computers or other OUs to apply Group Policy Objects (GPOs) and delegate administrative control. Good design recommends shallow hierarchy (no more than 5–10 levels) and using custom OUs instead of the default CN=Computers container to ease management.|
|**Containers**|Built‑in containers such as **Computers**, **Users**, **Foreign Security Principals**, **Managed Service Accounts**, **Domain Controllers**, etc., store objects when no OU is designated. Hidden containers (e.g., **System**, **NTDS Quotas**) are used internally by AD DS.|

Physical components include **domain controllers** that host the AD DS database and respond to authentication and directory requests; the **data store** (NTDS.DIT); **global catalog servers**, which store a searchable, partial replica of all objects in the forest to accelerate cross‑domain searches; **read‑only domain controllers (RODCs)** for branch offices; and **sites and subnets** that map the physical network to optimize replication and authentication traffic.

### Users, groups and computers

- **User objects** contain security identifier (SID), logon name (UPN), password, etc. Administrators can create users via **Active Directory Administrative Center**, **Active Directory Users and Computers**, **Windows Admin Center**, **PowerShell** or the legacy `dsadd` tool. For service accounts, Windows provides **stand‑alone managed service accounts**, **group managed service accounts (gMSA)**, and **delegated Managed Service Accounts (dMSA)**. Before creating gMSAs, you must create a **KDS root key**: `Add-KdsRootKey –EffectiveImmediately`. A gMSA is created with `New-ADServiceAccount -Name <gMSA> -PrincipalsAllowedToRetrieveManagedPassword <servers>`.
    
- **Groups** come in two types: **security groups** (used for granting permissions) and **distribution groups** (email lists). Group scopes include **local** (computer‑specific), **domain‑local** (may include members from any domain and assign permissions within one domain), **global** (members from same domain, can be used in any domain in forest) and **universal** (members from any domain, replicate to the global catalog).
    
- **Computer objects** represent computers joined to the domain. By default, computers are created in the **CN=Computers** container but should be moved to an OU so that policies can be applied and delegated.
    

### Forests, domains and trust relationships

A forest acts as both a **security boundary** and **replication boundary**; administrators cannot cross the forest boundary unless trusts are created. Key trust types include:

|Trust type|Direction|Transitivity|Description|
|---|---|---|---|
|**Parent/child & tree‑root trusts**|Two‑way|Transitive|Created automatically when you add a new child domain or new tree to a forest; allows authentication across the forest.|
|**External trust**|One‑ or two‑way|Non‑transitive|Used to connect a domain to a domain in another forest (e.g., migration or resource sharing). Only the two specified domains trust each other.|
|**Realm trust**|One‑ or two‑way|Non‑transitive|Connects a Windows Server forest to a Kerberos V5 realm (UNIX/other Kerberos realms).|
|**Forest trust**|One‑ or two‑way|Transitive|Connects two entire forests. All domains within the forests trust each other.|
|**Shortcut trust**|One‑ or two‑way|Transitive|Created manually between two domains in a forest to optimize authentication across domain tree boundaries.|

### Managing objects and delegation

Use tools such as **Active Directory Administrative Center**, **Active Directory Users and Computers**, **Active Directory Sites and Services**, **Active Directory Domains and Trusts**, **Windows Admin Center** (over port 6516 or 443) and **PowerShell**. Routine tasks include creating users and groups, moving objects, resetting passwords, delegating control, managing OUs, and enabling the **AD Recycle Bin**. The AD Recycle Bin allows restoration of deleted objects (within default 180 days) without downtime, but it cannot roll back attribute changes.

## Manage AD DS domain controllers & FSMO roles

### Deploy domain controllers

When deploying domain controllers, consider:

- **New forest vs additional domain controller**—decide if you need a new forest/tree or an additional domain controller. Provide DNS name and choose appropriate forest/domain functional level. Decide whether to install DNS, the Global Catalog, or a **Read‑Only Domain Controller (RODC)**; determine the Directory Services Restore Mode (DSRM) password; choose a NetBIOS name; and configure storage locations for NTDS database, logs and SYSVOL.
    
- **Server Core** vs GUI—Windows Server Core reduces footprint. Install AD DS using the `Install-ADDSDomainController` cmdlet or **Windows Admin Center**. For branch offices, deploying an **RODC** can reduce replication traffic and improve security.
    
- **Azure deployment**—when deploying domain controllers on Azure VMs, plan network and site topology carefully. Use static private IP addresses, configure DNS resolution (Windows DNS or Azure Private DNS zones to host SRV records), ensure site‑to‑site connectivity for hybrid scenarios, and place the NTDS database and SYSVOL on separate disks (cache disabled).
    

### Maintain domain controllers

- Deploy at least **two domain controllers per domain/site** for redundancy.
    
- **Backups & restore**: use **system state backup** and test restoration procedures. A **non‑authoritative restore** brings a domain controller back online and relies on replication to update objects. An **authoritative restore** marks selected objects as authoritative using `ntdsutil.exe` or Windows Server Backup; used when an object needs to be undeleted or rolled back while preventing replication from overwriting it.
    
- **AD Recycle Bin**: enable to allow self‑service recovery of deleted objects. Deleted objects remain in the **Deleted Objects** container for 180 days by default.
    

### Global catalog & operations master roles

- **Global catalog**: a domain controller hosting a partial, read‑only replica of all objects in the forest; enables cross‑domain searches and membership evaluations. It is recommended to configure all domain controllers in a single‑domain forest as global catalog servers; in multi‑domain or multi‑site forests, evaluate replication traffic and place global catalogs accordingly.
    
- **FSMO roles** (Flexible Single Master Operations):
    

|Role|Scope|Responsibilities|
|---|---|---|
|**Schema master**|Forest|Controls schema modifications. Only one per forest. If unavailable, no schema changes can occur.|
|**Domain naming master**|Forest|Adds or removes domains and application partitions. Required when creating or deleting domains.|
|**Relative ID (RID) master**|Domain|Allocates pools of RIDs to domain controllers; necessary for creating objects.|
|**PDC emulator**|Domain|Emulates a Windows NT PDC for backwards compatibility, handles password changes and lockout processes, acts as time source, and manages GPO edits.|
|**Infrastructure master**|Domain|Updates cross‑domain object references and maintains group memberships.|

Transfer FSMO roles via appropriate snap‑ins (Active Directory Schema, Domains and Trusts, or Users and Computers) or with PowerShell: `Move-ADDirectoryServerOperationsMasterRole -Identity <Server> -OperationsMasterRole <Role>`; to seize roles (when current holder is unrecoverable), use the `-Force` parameter.

### AD DS schema

The schema defines classes and attributes for all objects. Each attribute includes data type, syntax, and whether it is mandatory/optional. Since there is only one schema per forest, changes are replicated forest‑wide. Avoid extending the schema unless necessary. Schema deletions are not supported; test modifications thoroughly and maintain documentation.

## Implement Group Policy Objects (GPOs)

### Definition and scope

Group Policy provides centralized configuration management for users and computers. A **GPO** is a collection of policy settings stored in a Group Policy container (metadata in Active Directory) and a Group Policy template (files in the domain’s `SYSVOL\Policies\{GPOGUID}` folder). Each policy setting can be **Not Configured**, **Enabled** or **Disabled**. **Starter GPOs** allow administrators to create a baseline set of settings stored in the `\SYSVOL\Domain\StarterGPOs` folder.

### Linking & processing

GPOs apply by linking to **sites**, **domains** or **OUs**. Scope can be narrowed with **security filtering** (limit to specific users/computers) or **WMI filters**. The processing order is **Local GPO → Site → Domain → OU → child OUs**; later GPOs override earlier ones. **Inheritance** means child OUs inherit settings from parent containers; you can block inheritance at the OU level or enforce GPO links to prevent them from being overridden. Use the **Group Policy Inheritance** tab in Group Policy Management Console (GPMC) to view the resulting precedence.

### Default GPOs

- **Default Domain Policy**: linked to the domain and applies to Authenticated Users. It defines password, account lockout and Kerberos policies; avoid mixing unrelated settings—create separate GPOs for other settings.
    
- **Default Domain Controllers Policy**: linked to the Domain Controllers OU; defines user rights and auditing policies for domain controllers.
    

### Creating & managing GPOs

Use **GPMC**, **Group Policy Management Editor** and **PowerShell**. Key PowerShell cmdlets:

|Cmdlet|Description|
|---|---|
|`New-GPO -Name <name>`|Creates a blank GPO.|
|`New-GPLink -Name <GPOName> -Target <OU/Domain>`|Links a GPO to a scope.|
|`Get-GPInheritance -Target <OU/Domain>`|Displays inheritance and link order.|
|`Set-GPInheritance -Target <OU/Domain> -IsBlocked $True`|Blocks inheritance for a container.|
|`Get-GPO -All`|Lists existing GPOs.|

Categories of settings include **Security** (password policies, user rights), **Desktop & application settings**, **Software deployment**, **Folder Redirection**, and **Network settings**. Use **Resultant Set of Policy (RSoP)** tools—**Group Policy Results Wizard**, **Modeling Wizard**, or `gpresult.exe`—to troubleshoot and determine effective policies.

### GPO storage and replication

A GPO consists of a **Group Policy container** (stored in Active Directory and replicated via AD DS) and a **Group Policy template** (stored in SYSVOL and replicated using **Distributed File System Replication**). Each GPO has version numbers to keep the container and template in sync; replication can become temporarily out of sync if version numbers differ.

### Administrative templates

Administrative templates (.ADMX and .ADML files) provide thousands of registry‑based policy settings. **ADMX** files are language‑neutral; **ADML** files contain language‑specific resources. Policies are arranged under **Computer Configuration → Administrative Templates** (Control Panel, Network, Printers, System, etc.) and **User Configuration → Administrative Templates** (Control Panel, Desktop, Network, Start Menu and Taskbar, etc.). To ensure all administrators use the same templates, create a **Central Store** in the `\FQDN\SYSVOL\FQDN\Policies\PolicyDefinitions` folder and copy the latest ADMX/ADML files; update them after Windows/Office updates.

## Manage advanced features of AD DS

### Trust relationships

In multi-domain or multi-forest scenarios, design trust relationships thoughtfully. In addition to the built‑in parent/child and tree‑root trusts, you can create **External**, **Realm**, **Forest** and **Shortcut** trusts (see table above). For forest‑to‑forest trusts, DNS name resolution must be configured. When creating trusts, consider advanced options:

- **SID filtering**: prevents malicious SID history injection by filtering SIDs from incoming trust referrals.
    
- **Selective authentication**: restricts which users from a trusted forest can authenticate to resources; trust is not automatically extended to all users. Configure selective authentication by setting the trust to selective and granting the **Allowed to Authenticate** permission on resource computers.
    

### ESAE (Enhanced Security Administrative Environment) forests

An ESAE forest (red forest) is a separate, locked‑down forest used solely for administration. It uses a one‑way trust from production to ESAE (production forest trusts administrative accounts), providing a secure environment for privileged accounts. Implementation guidelines:

- Create a single‑domain forest and configure a **one‑way trust** where production trusts the ESAE forest but not vice versa.
    
- Host only administrative accounts and groups; no end‑user or server workloads.
    
- Use secure installation media and enable protections like **Secure Boot**, **BitLocker**, **Credential Guard** and **Device Guard**; disable removable storage.
    
- Ensure the ESAE environment is isolated physically or virtually and apply the **clean source principle**—all upstream services must be trustworthy.
    

### Monitoring and troubleshooting

Monitor domain controllers’ CPU, memory, disk and network usage using **Task Manager**, **Resource Monitor** and **Performance Monitor**. Important replication counters include **NTDS\DRA Inbound/Outbound Bytes/sec**, **NTDS\DRA Inbound Objects/sec**, and **NTDS\DRA Pending Replication Synchronizations**. Use tools:

- **Repadmin.exe**: `repadmin /showrepl` shows replication status; `/showconn` displays connection objects; `/showobjmeta` shows metadata; `/replsummary` provides an overview.
    
- **Dcdiag.exe**: performs tests such as **Replications**, **Topology**, **VerifyReplicas**, **KccEvent**; run `dcdiag /v` for verbose output.
    
- **PowerShell AD DS Replication cmdlets**: `Get-ADReplicationPartnerMetadata`, `Get-ADReplicationFailure`, `Sync-ADObject` etc..
    

### Custom AD DS partitions (application partitions)

AD DS supports **configuration**, **schema** and **domain** partitions. **Application partitions** replicate to selected domain controllers. They are used by services like **Active Directory‑integrated DNS** (creating `domainDnsZones` and `forestDnsZones` partitions). Use `ntdsutil.exe` to create, manage and delete custom application partitions. When creating a partition, plan naming, specify replication scope (subset of domain controllers), and ensure appropriate DNS conditional forwarding.

## Implement hybrid identity with Windows Server

### Select a Microsoft Entra integration model

**Microsoft Entra ID (formerly Azure AD)** is a cloud-based identity and access management service. It is multitenant and PaaS-based, uses modern authentication protocols (SAML, OAuth, OpenID Connect) and provides features such as multifactor authentication, conditional access, identity protection and self-service password reset. It does **not** support OUs or GPOs; management is via REST APIs and portal.

Integration options:

|Integration model|Description|
|---|---|
|**Extend on‑premises AD DS to Azure**|Deploy Windows Server VMs in Azure, promote them as domain controllers and join them to your on‑premises AD DS forest. Suitable for applications that require Kerberos authentication but need to stay within the on‑premises directory.|
|**Directory synchronization (Microsoft Entra Connect)**|Replicates users, groups and contacts from on‑premises AD DS to Entra ID. Provides a single identity but by default passwords are separate. Configurable to include **password hash synchronization** for same‑password sign‑in, **pass‑through authentication** for real‑time verification, or **AD FS** for full federation.|
|**Password hash synchronization**|A component of directory synchronization that syncs password hashes to Entra ID. Users sign in to Entra resources using the same password as on-premises, but must re-enter credentials (not seamless).|
|**Pass‑through authentication with seamless SSO**|A lightweight agent installed on-premises passes encrypted user credentials through a service bus to on-prem AD DS for verification. Combined with **Seamless Single Sign‑On**, domain‑joined users access Entra resources without retyping passwords. Does not require inbound connections to on-premises; uses outbound port 443.|
|**AD FS (federation)**|Provides SSO using security tokens issued by AD FS. Requires additional infrastructure (AD FS servers, Web Application Proxy) and is more complex than pass‑through authentication. Used when policies require on-premises authentication or integration with other SAML/OAuth applications.|

### Plan for Entra integration

**Directory synchronization** replicates identity data one‑way from on-premises AD DS to Entra ID. To prepare:

- Verify domain names: ensure the UPN suffix you plan to use is a verified, routable domain (avoid `.local`). Custom UPN suffixes must be added and verified in Entra ID.
    
- Clean up directory data: remove invalid characters, duplicate `proxyAddresses` and `userPrincipalName` values; update non‑conforming UPNs. Tools such as **IdFix** identify and remediate attribute issues and **ADModify.NET** can perform bulk changes.
    
- Understand service accounts: Entra Connect creates service accounts like **MSOL_<GUID>** (used by the sync service) and **AAD_<GUID>** (used by Express Installation). Do not modify or delete these accounts; doing so breaks synchronization.
    
- Choose a **Source Anchor** (immutable ID) for linking objects: default is `objectGUID`; alternatives include `msDSConsistencyGuid` or custom attributes.
    

### Install and configure directory synchronization (Entra Connect)

Steps:

1. Verify your custom domain in Entra ID and add a TXT record.
    
2. Download and install **Microsoft Entra Connect** on an on-premises server. Choose **Express Setup** (password hash sync) or **Custom** for pass‑through authentication or federation. In custom installation, you can select a custom SQL server, existing service account, or specify OU‑based filtering.
    
3. Provide credentials for a **Global Administrator** in Entra ID and an **Enterprise Administrator** in AD DS; the wizard creates necessary sync service accounts.
    
4. Choose the **sign‑in method** (password hash sync, pass-through authentication, or AD FS) and optional features such as password writeback, Exchange hybrid deployment, or group writeback.
    
5. Configure sync scope (specific OUs or groups). Review and finish.
    

### Implement Seamless Single Sign‑On and pass‑through authentication

Pass‑through authentication uses a lightweight **Authentication Agent** installed by Entra Connect. The agent establishes an outbound connection to Azure and listens for authentication requests. When users sign in, their username and password are encrypted and queued in Azure. The agent retrieves the credentials via Azure Service Bus, validates them against AD DS, and returns the result to Entra ID; no inbound firewall changes are necessary. Supported scenarios include web‑based and modern Office applications, POP/IMAP protocols, modern Skype for Business, and Windows 10 domain joins; not supported are legacy Office clients, Exchange 2010 calendar sharing, and protocols requiring full federation. **Seamless SSO** adds a non‑expiring computer account (**AZUREADSSOACC**) and automatically signs in domain‑joined users.

### Microsoft Entra Domain Services (Managed Domain)

Microsoft Entra Domain Services (Entra DS) is a managed AD DS service integrated with Entra ID. It provides domain join, LDAP, Kerberos and Group Policy capabilities without the need to deploy domain controllers. Key points:

- Entra DS runs in a separate managed forest linked to your Entra tenant via synchronization. There are no Enterprise Admins or Schema Admins groups; you cannot extend the schema or add domain controllers.
    
- OU structure is flat: there are built‑in **AADDC Computers** and **AADDC Users** OUs with default GPOs; custom OUs can be created for service accounts or application needs but cannot be nested.
    
- Passwords must be synchronized from Entra ID. For cloud‑only accounts, users must change their password after Entra DS is enabled to generate NTLM/Kerberos hashes.
    
- When enabling Entra DS, choose a DNS domain name (routable custom domain is recommended), forest type (**User forest** replicates all objects; **Resource forest** replicates only cloud users and groups), region and VNet. The service creates enterprise applications **Domain Controller Services** and **AzureActiveDirectoryDomainControllerServices**; do not remove these.
    

Administration tasks for the managed domain are performed by members of the **AAD DC Administrators** group. They can manage built-in GPOs, create OUs, manage DNS and local administrators on joined VMs. They cannot extend the schema or RDP to the managed domain controllers.

## Deploy and manage Azure IaaS AD DS domain controllers

### Choosing a deployment model

- **Add an additional domain controller in Azure**: In a hybrid environment, deploy an extra AD DS domain controller on an Azure VM to reduce latency and ensure high availability for cloud workloads. Configure site‑to‑site VPN or ExpressRoute and ensure proper site configuration and static IP addresses.
    
- **Deploy a separate forest/domain in Azure**: Create a new forest in Azure to segregate workloads or support migration. Establish trust relationships with on-premises domains when necessary. This can be used for staging or dedicated workloads, where cross‑premises authentication is controlled by trust.
    

### Deployment considerations for Azure domain controllers

When deploying domain controllers in Azure VMs:

- **Network**: Assign a **static, private IP address** to each domain controller’s NIC; do not assign public IP addresses. Configure the VNet’s **Network Security Groups** to allow inbound and outbound traffic to/from on‑premises resources.
    
- **Inter‑site connectivity**: Use site‑to‑site VPN or **ExpressRoute** for secure, reliable connectivity between Azure and on-premises. A VPN server with a static public IP and a dynamic gateway is required. ExpressRoute uses private dedicated circuits and offers higher reliability and throughput.
    
- **Active Directory sites**: Create an **Azure site** in AD DS so that replication is scheduled and optimized. Intra‑site replication occurs frequently; inter‑site replication can be scheduled and is optimized for low bandwidth and reliability.
    
- **Trust relationships**: If the Azure domain is in a different forest, create external or forest trusts as required. Determine whether the trust should be one‑way (incoming/outgoing) or two‑way based on which users need access.
    
- **Read‑Only Domain Controllers (RODCs)**: Consider using RODCs in Azure to reduce egress traffic; not suitable if applications require writes to AD DS.
    
- **Global Catalog & FSMO roles**: Configure Azure-based domain controllers as global catalog servers to avoid cross-premises lookups. If they are in a separate forest, host the schema and domain naming master roles in Azure; for a separate domain, host the PDC emulator, RID master and infrastructure master in Azure.
    
- **Availability**: Deploy at least **two domain controllers** per domain in Azure and use **availability sets** to protect against host failures. Do not rely on Azure load balancers, because clients automatically locate domain controllers via DNS.
    
- **Back up and restore**: Use standard on-premises procedures to back up system state. Do not clone virtual hard disks, as this can cause USN rollback. Always shut down and restart from within the guest OS; shutting down from the Azure portal deallocates the VM and resets the **VM-GenerationID**, requiring non‑authoritative SYSVOL restore.
    
- **Monitoring**: Use **Azure Monitor** and **Application Insights** to track performance metrics and logs for domain controller VMs.
    

### Installing a replica domain controller in Azure

To deploy an additional domain controller in Azure:

1. **Create an Azure VNet with site‑to‑site VPN**: Define the VNet, DNS server addresses (pointing to on-premises DNS), site‑to‑site VPN gateway and local network address space. Ensure address spaces do not overlap. You may instead set up **ExpressRoute** by importing the ExpressRoute module (`Import-Module '…\ExpressRoute.psd1'`), listing service providers (`Get-AzureDedicatedCircuitServiceProvider`), creating a circuit (`New-AzureDedicatedCircuit`), provisioning through the provider, and linking your VNet.
    
2. **Create a storage account**: Use the Azure portal to create a storage account. Select premium performance, general purpose v2 account kind, zone‑ or geo‑redundant replication, and the Hot access tier for frequently accessed data.
    
3. **Create a VM & assign static IP**: Create a NIC with a private IP address using `az network nic create`, then create the VM with `az vm create --image Win2019Datacenter --admin-username <user> --nics <NIC>`. Attach additional data disks and ensure the OS and data disks are in the same storage account.
    
4. **Install AD DS & DNS roles**: Use **Add Roles and Features** or PowerShell: `Add-WindowsFeature ADDS-Domain-Controller` to add the AD DS role and `Add-WindowsFeature DNS` for DNS. Promote the server to a domain controller using `Install-ADDSDomainController` specifying the domain, site, and whether it is a global catalog or RODC. Store the AD database on a data drive with caching disabled.
    

### Installing a new AD forest in Azure

If you need a standalone AD DS environment in Azure (for example, for testing or isolated workloads), follow similar steps but you do not need cross-premises connectivity. Create a VNet, specify the DNS server as the IP address of your new domain controller, create VMs for domain controller and DNS, and install AD DS and DNS roles. Since this forest will likely have only one site, all domain controllers should be global catalog servers. You can secure access through network security groups and restrict endpoints.

## Summary

This learning path covers deploying and managing identity infrastructure using Windows Server AD DS and integrating with Microsoft Entra ID. The modules span foundational concepts (forests, domains, OUs), domain controller deployment and maintenance (including FSMO roles, backups, global catalog), Group Policy creation and management, advanced features like trusts and ESAE forests, monitoring and replication troubleshooting, hybrid identity planning and implementation with Entra Connect, and deploying domain controllers in Azure. By understanding these components, administrators can design a resilient, secure identity infrastructure that extends on‑premises AD DS into the cloud while leveraging Entra ID services for seamless and secure hybrid identity.