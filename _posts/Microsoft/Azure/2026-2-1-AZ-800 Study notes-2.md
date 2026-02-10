---
title: 2- Deploy and manage identity infrastructure (AZ‑800)
description: Note2
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
image: https://ipspecialist.net/wp-content/uploads/2023/10/az-800-administering-windows-server-hybrid-core-infrastructure-course.png
published: true
---
# Managing Windows Servers & Workloads in a Hybrid Environment – Blog Guide

This blog post walks through the key concepts from Microsoft’s “Manage Windows Servers and workloads in a hybrid environment” learning path. The modules cover secure administration practices, administration tools, post‑installation configuration, remote VM management, hybrid governance with Azure Arc, and Just Enough Administration (JEA). Each section includes concise explanations, tables, bullet lists and practical PowerShell snippets to help you get started.

## 1. Perform secure administration

_Least‑privilege administration_ is the foundation of Windows Server security. Administrators should sign in with minimal rights rather than using powerful domain accounts for daily tasks. Reducing privileges limits the damage that malware or mistakes can cause.

### Sensitive built‑in groups

|Group|Scope|Description|Source|
|---|---|---|---|
|**Enterprise Admins**|Forest‑wide|Universal group; full control across the forest; only the forest root admin is a default member|`AD DS`|
|**Domain Admins**|Domain|Global group with unrestricted access in its domain|`AD DS`|
|**Schema Admins**|Forest‑wide|Can modify the AD schema; membership should remain empty until required|`AD DS`|
|**Administrators**|Domain or local|Domain‑local group that grants full control on a domain or computer|`AD DS`|
|**Other privileged groups**|–|Includes Account Operators, Server Operators, Key Admins and Enterprise Key Admins|`AD DS`|

### Managing group membership and rights

- **Enforce membership** with **Restricted Groups** in a Group Policy Object (GPO). In the GPMC, navigate to _Computer Configuration → Windows Settings → Security Settings → Restricted Groups_, add the group and specify allowed members.
    
- **Review user rights** via the _Local Security Policy_ snap‑in under _Local Policies → User Rights Assignment_. Rights differ from permissions: a right grants the ability to perform an administrative task, while a permission controls access to an object.
    

### User Account Control (UAC)

UAC elevates privileges only when needed. Admin accounts receive a confirmation prompt; standard users are prompted for credentials. Configure UAC policies under _Computer Configuration → Local Policies → Security Options_.

### Delegated administration

Rather than granting domain‑wide rights, delegate only the necessary tasks.

- Use the **Delegation of Control Wizard** in Active Directory Users and Computers to assign tasks such as resetting passwords or joining computers to a domain.
    
- Delegate to groups, not individual users, and review permissions via the OU’s **Security → Advanced** tab.
    

### Privileged Access Workstations and jump servers

- **Privileged Access Workstation (PAW)**: a locked‑down device for administrative tasks only. It should run Windows Defender Application Control, Credential Guard, Device Guard and Exploit Guard. For separation, you can use either dedicated hardware or a dual‑OS arrangement (physical for admin tasks, VM for daily use).
    
- **Jump server**: a hardened intermediate host used to manage devices across security zones. It should enable Credential Guard and Remote Credential Guard and may host Hyper‑V VMs for different admins.
    

## 2. Windows Server administration tools

### Windows Admin Center (WAC)

WAC is a lightweight, web‑based console. It has a gateway component that uses PowerShell Remoting and WMI to manage machines and requires an SSL certificate. WAC can manage clusters and integrate with Azure; install it on Windows Server or Windows 10/11 but not on domain controllers.

To manage servers in another domain or workgroup, configure the local TrustedHosts list:

`# Allow WAC to connect to a specific host or domain Set-Item WSMan:localhost\Client\TrustedHosts -Value "Server01" -Force`

### Server Manager

Server Manager can manage up to 100 remote servers. Use it to rename the server, join a domain, configure network settings, view event logs, monitor services and add roles or features from a single dashboard.

### Remote Server Administration Tools (RSAT)

RSAT provides MMC snap‑ins and command‑line utilities for remote management. Enable RSAT on Windows 10/11 from **Settings → Optional Features → Add a feature**. Key tools include:

- **Active Directory tools**: ADAC, Active Directory Users and Computers, Domains and Trusts, Sites and Services, and command‑line utilities such as `dsquery` and `dcdiag`.
    
- **Group Policy Management**, **DNS Manager**, **DHCP Manager**, **Failover Clustering**, **IPAM**, **Storage Migration Service**, **Storage Replica**, **Shielded VM tools** and many others.
    

### PowerShell basics

- PowerShell cmdlets follow a `Verb‑Noun` pattern (e.g., `Get-Service`, `Set-ADUser`). Use `Get-Command` to discover commands and `Get-Help` for help.
    
- Use the **PowerShell ISE** or Visual Studio Code with the PowerShell extension for script authoring.
    

#### PowerShell remoting

Enable remoting and start interactive or script‑based sessions:

`# Enable remote management Enable-PSRemoting -Force  # Run a command on multiple servers Invoke-Command -ComputerName Server1, Server2 -ScriptBlock {     Get-EventLog -LogName Security -Newest 5 }  # Start an interactive session Enter-PSSession -ComputerName Server1 # When finished Exit-PSSession`

PowerShell remoting uses ports 5985 (HTTP) and 5986 (HTTPS). Use `New-PSSession` to create persistent sessions or run local scripts remotely via `Invoke-Command -FilePath`.

## 3. Post‑installation configuration

Immediately after installing Windows Server, the OS uses a generic computer name, workgroup membership, DHCP networking, default time zone and locale, minimal roles and features, and firewall enabled. You should rename the server, join a domain, configure networking and install required roles.

### Tools for configuration

- **Server Manager** and **Windows Admin Center** provide graphical interfaces to rename the server, join a domain and add roles.
    
- **Sconfig** (Server Core) offers a text‑based menu to configure domain membership, computer name, network settings, remote management, Windows Update, time zone and activation:
    

`# Run Sconfig on Server Core sconfig # Choose option 2 to rename the computer # Choose option 1 to join a domain or workgroup # Choose option 8 to configure network settings`

- **Desired State Configuration (DSC)** uses declarative PowerShell scripts to maintain the desired server state. A simple configuration to install the Web Server role looks like this:
    

`Configuration InstallIIS {     Node "localhost" {         WindowsFeature WebServer {             Ensure = 'Present'             Name   = 'Web-Server'         }     } } # Compile and apply the configuration InstallIIS -OutputPath ./IIS Start-DscConfiguration -Path ./IIS -Wait -Verbose`

- **Answer files**: Use Windows SIM to create an `Autounattend.xml` with components under the **specialize** pass (e.g., `Microsoft-Windows-TCPIP`, `UnattendedJoin`, `Shell-Setup` for computer name). Place the file on installation media for automated deployment.
    

## 4. Remote management of Azure IaaS VMs

### Choosing an administration tool

|Tool|Key points|When to use|
|---|---|---|
|**Windows Admin Center**|Web‑based management; requires direct connectivity (public IP or VPN) to Azure VM|Managing many roles/features through a graphical interface|
|**Azure PowerShell (Az modules)**|Extends PowerShell; authenticate with `Connect-AzAccount`; available in Azure Cloud Shell|Scripting infrastructure tasks, automation|
|**Azure CLI**|Cross‑platform CLI; authenticate with `az login`|Cross‑platform scripts and automation|
|**Run Command**|Runs scripts inside the VM via agent; includes commands like `RunPowerShellScript`, `DisableNLA`, `EnableRemotePS`, `RDPSettings`|Execute quick tasks without exposing RDP/SSH|
|**Azure Cloud Shell**|Browser‑based Bash or PowerShell environment; automatically authenticated|Running ad‑hoc commands in a portable environment|

### Securing remote access with Azure Bastion

Azure Bastion is a managed service that provides RDP and SSH through the Azure portal using TLS. No public IP is required, which reduces the attack surface and simplifies NSG rules.

Steps to deploy Bastion:

1. Create a subnet named **AzureBastionSubnet** with a /26 prefix in your VNet.
    
2. In the Azure portal, deploy a **Bastion** resource specifying the subscription, resource group, region, VNet, subnet and a public IP address.
    
3. Assign the **Reader** role on the VM, its NIC and the Bastion resource to the users who will connect..
    

To connect, open the VM in the Azure portal, choose **Connect → Bastion**, and sign in. Connections use port 443.

### Just‑in‑time VM access

Just‑in‑time (JIT) VM access, available through Microsoft Defender for Cloud, automatically closes management ports and opens them only on request. To enable JIT:

- In Defender for Cloud, select the VM, choose **Enable JIT**, and configure allowed ports (e.g., 3389/RDP, 22/SSH), protocols, source IPs and maximum session duration.
    
- After configuration, users request access specifying the port and their IP; the NSG rule is opened temporarily and then removed automatically.
    

## 5. Managing hybrid workloads with Azure Arc

### What is Azure Arc?

Azure Arc brings Azure management to on‑premises or multi‑cloud environments. By installing the **Connected Machine agent**, servers become first‑class Azure resources, enabling governance through Azure Policy, monitoring via Azure Monitor and security via Defender and Sentinel.

### Onboarding servers

- Supported OS: Windows Server 2012 R2 and later. Required roles include **Azure Connected Machine Onboarding** and **Resource Administrator**.
    
- Deployment methods include: portal script (single server), service principal for at‑scale onboarding, Configuration Manager, Group Policy, Windows Admin Center or Azure Automation.
    

To onboard a server from the portal:

`# Generate and run onboarding script from Azure portal # The script downloads and installs the Connected Machine agent # and registers the server with Azure Arc .\Onboard-ArcServer.ps1 -SubscriptionId <subId> -ResourceGroup <rgName> -TenantId <tenantId>`

The agent creates services and sends heartbeat messages every five minutes.

### Governance and RBAC

- **Azure Policy** for Arc‑enabled servers can enforce tagging, deploy extensions (e.g., Log Analytics), audit configuration or remediate non‑compliance.
    
- **Role‑based access control (RBAC)** applies at the resource (server) level and Log Analytics workspace level. In the portal, use **Access control (IAM)** to assign roles, review access and manage deny assignments.
    

## 6. Just Enough Administration (JEA)

JEA secures PowerShell remoting by limiting which commands users can run. A JEA endpoint uses role capability files (`.psrc`) to define allowed cmdlets/functions and session configuration files (`.pssc`) to map security groups to those roles.

### Registering a JEA endpoint

1. **Create a role capability file** using `New-PSRoleCapabilityFile` and populate `VisibleCmdlets`, `VisibleFunctions`, `VisibleExternalCommands` and `VisibleProviders`.
    
2. **Create a session configuration file** using `New-PSSessionConfigurationFile` with settings:
    
    - `SessionType = 'RestrictedRemoteServer'` (enables JEA)
        
    - `RoleDefinitions = @{ 'CONTOSO\DNSAdmins' = @{ RoleCapabilities = 'DNSOps' } }`
        
    - `RunAsVirtualAccount = $true` and `RunAsVirtualAccountGroup` to map the virtual account to a group.
        
3. **Register the endpoint** on the target server:
    

`Register-PSSessionConfiguration -Name DNSOps -Path .\DNSOps.pssc`

Check existing endpoints with:

`Get-PSSessionConfiguration | Select-Object Name`

Multiple machines can be configured using DSC and the JEA DSC resource.

### Connecting to a JEA endpoint

- **Interactive session:**
    

`Enter-PSSession -ComputerName localhost -ConfigurationName DNSOps # Note: JEA runs in NoLanguage mode; you cannot store data in variables. # Use piping instead of variables, for example: Get-VM -Name MyVM | Start-VM`

- **Implicit remoting:**
    

`$session = New-PSSession -ComputerName 'MyServer' -ConfigurationName 'DNSOps' Import-PSSession -Session $session -Prefix 'DNSOps' # Now you can run imported commands like DNSOps\Get-DnsServerZone`

- **Programmatic access:** Write scripts or apps that connect via normal PowerShell remoting APIs; JEA endpoints behave like other endpoints but restrict available commands.
    
- **PowerShell Direct:** For Hyper‑V VMs, connect directly from the host using `Enter-PSSession -VMName <VM> -ConfigurationName <Endpoint>` and create dedicated JEA accounts for Hyper‑V administrators.
    

## Conclusion

The **AZ‑800** exam covers a wide range of Windows Server administration topics. To succeed in hybrid scenarios, you need to understand least‑privilege administration, delegation, and secure workstations; master management tools like Windows Admin Center, Server Manager, RSAT and PowerShell; configure servers with DSC or answer files; secure remote access with Azure Bastion and JIT; onboard and govern servers via Azure Arc; and implement fine‑grained PowerShell access using JEA. Practising the commands and techniques illustrated in this article will prepare you for real‑world administration and the exam.