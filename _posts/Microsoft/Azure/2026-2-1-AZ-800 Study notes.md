---
title: "AZ-800: Administering Windows Server Hybrid Core Infrastructure"
description: Administering Windows Server Hybrid Core Infrastructure
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

## Deploy and manage identity infrastructure
---
### Define AD DS – Notes

**Active Directory Domain Services (AD DS)** is the foundation of enterprise networks that run Windows.  
It provides a **centralized, secure directory** that stores information about **users, computers, and groups**, and controls how they authenticate and access resources.

AD DS gives you:

- Central identity management
    
- Authentication and authorization
    
- Policy-based configuration and security
    

The AD DS database is stored in a single file called **`Ntds.dit`**, but it is logically divided into multiple parts.

---

### What AD DS Is Used For

AD DS supports many enterprise-level operations, not just user logons:

- Installing, configuring, and updating applications
    
- Managing security infrastructure
    
- Enabling Remote Access Service and DirectAccess
    
- Issuing and managing digital certificates (with AD CS)
    
- Applying configuration and security settings using policies
    

---

### AD DS Components

AD DS consists of:

- **Logical components** → how AD is structured and managed
    
- **Physical components** → where AD runs and how it is deployed
    

Understanding both is required to design, manage, and troubleshoot AD environments.

---

### Logical Components (Structure of AD DS)

### Partitions (Naming Contexts)

Even though AD DS uses one database file (`Ntds.dit`), data is logically separated into partitions.

- **Schema partition**
    
    - Stores definitions of all object types and attributes
        
    - Replicated to every domain controller in the forest
        
- **Configuration partition**
    
    - Stores forest-wide configuration data
        
- **Domain partition**
    
    - Stores domain-specific objects (users, computers, groups)
        

> Exam focus:  
> Schema and Configuration partitions replicate **forest-wide**.

---

#### Schema

The schema is the **blueprint** of Active Directory.

- Defines what objects can exist (user, computer, group, etc.)
    
- Defines which attributes those objects have
    
- Changes are rare and risky
    
- Controlled by the **Schema Master FSMO role**
    

---

### Domain

A **domain** is a logical administrative container.

- Contains users, computers, and groups
    
- Has its own domain partition
    
- Uses replication between DCs inside the domain
    
- Can be linked to other domains using parent–child relationships
    

Domains are the **core unit of administration** in AD DS.

---

### Domain Tree

A **domain tree** is a hierarchical structure of domains that:

- Share a common root domain
    
- Share a contiguous DNS namespace
    
- Automatically trust each other
    

Example:

```
contoso.com
  └── europe.contoso.com
```

---

### Forest

A **forest** is the highest-level AD DS structure.

- Contains one or more domain trees
    
- All domains share:
    
    - A common schema
        
    - A common global catalog
        
- Represents a **security boundary**
    

> Key point: Trust does not automatically exist between forests.

---

### OU vs Container (Important Comparison)

|Feature|OU|Container|
|---|---|---|
|Can hold users/computers|Yes|Yes|
|GPO linking|Yes|No|
|Delegation|Yes|Limited|
|Nesting|Yes|No|

OUs are used for **administration and policy application**.  
Containers are basic organizational objects with limited functionality.

---

## Physical Components (Deployment of AD DS)

### Domain Controllers (DCs)

A domain controller:

- Hosts a copy of the AD DS database
    
- Authenticates users and computers
    
- Accepts changes and replicates them to other DCs
    

> AD DS uses a **multi-master replication model**.

---

### AD DS Data Store

- Database file: **`Ntds.dit`**
    
- Log files stored in the same location
    
- Default path:
    

```
C:\Windows\NTDS
```

---

### Global Catalog Server

A **Global Catalog (GC)** server is a domain controller that:

- Holds a partial, read-only copy of all objects in the forest
    
- Enables fast searches across domains
    
- Is critical in multi-domain forests
    

---

### Writable DC vs RODC (Comparison)

|Feature|Writable DC|RODC|
|---|---|---|
|Database|Read/Write|Read-only|
|Accepts changes|Yes|No|
|Replication|Full|One-way|
|Typical location|Main sites|Branch offices|
|Security exposure|Higher|Lower|

RODCs are used where physical security or local IT expertise is limited.

---

### Sites vs Domains (Conceptual Difference)

|Aspect|Domain|Site|
|---|---|---|
|Purpose|Logical administration|Physical location|
|Objects|Users, groups, computers|Computers and services|
|Affects|Security and policies|Replication and logon|
|Based on|DNS|IP subnets|

---

### Subnets

- A subnet is a range of IP addresses
    
- Subnets are associated with sites
    
- Used to determine which site a computer belongs to
    
- A site can contain multiple subnets
    

---

### Define Users, Groups, and Computers – Notes

AD DS doesn’t only consist of high-level structures like forests and domains.  
At the operational level, you mainly work with **users, service accounts, groups, and computers**.

---

### User Objects

Every person who needs access to network resources must have a **user account** in AD DS.

A **user account**:

- Allows authentication to the domain
    
- Grants access to network resources
    
- Acts as a **security principal**
    

Each user account contains:

- Username
    
- Password
    
- Group memberships
    
- Additional attributes (department, title, logon restrictions, etc.)
    

The **username and password** are the sign-in credentials, but most access decisions are based on **group membership**, not the user directly.

---

### Managing User Accounts

User objects can be created and managed using multiple tools:

- Active Directory Administrative Center
    
- Active Directory Users and Computers (ADUC)
    
- Windows Admin Center
    
- Windows PowerShell
    
- `dsadd` command-line tool
    

> Practical note:  
> In real environments, **PowerShell** and **AD Administrative Center** are preferred for consistency and automation.

---

### Service Accounts – Why They Exist

Many applications install **services** that:

- Start automatically with the server
    
- Run in the background
    
- Require authentication to access resources
    

To do this, services use **service accounts**.

Types of service accounts:

- Local accounts:
    
    - Local System
        
    - Network Service
        
    - Local Service
        
- Domain-based accounts (stored in AD DS)
    

---

### Problems with Traditional Domain Service Accounts

Using a normal domain user account as a service account causes issues:

- Passwords must be managed manually
    
- Hard to track where the account is being used
    
- Service Principal Name (SPN) management is complex
    
- High risk if credentials are compromised
    

This is why **managed service accounts** exist.

---

### Managed Service Accounts (MSA)

A **Managed Service Account** is a special AD object designed to run services securely.

MSA benefits:

- Automatic password management
    
- Simplified SPN management
    
- Reduced administrative overhead
    

Limitation:

- Can only be used on **one server**
    

---

### Group Managed Service Accounts (gMSA)

**gMSA** extends MSA functionality to **multiple servers**.

Used when:

- The same service runs on more than one server
    
- Examples:
    
    - IIS server farms
        
    - NLB clusters
        
    - SQL Server farms
        

Benefits:

- Automatic password rotation
    
- Simplified SPN handling
    
- Same account across multiple machines
    

---

#### gMSA Requirements

Before creating a gMSA:

- A **KDS root key** must exist in the domain
    

Command to create it:

```powershell
Add-KdsRootKey -EffectiveImmediately
```

---

#### Creating a gMSA

Use PowerShell:

```powershell
New-ADServiceAccount -Name LondonSQLFarm `
-PrincipalsAllowedToRetrieveManagedPassword SEA-SQL1, SEA-SQL2, SEA-SQL3
```

This defines which servers are allowed to retrieve the managed password.

> Exam note:  
> gMSA = **multi-server service account**

---

### Delegated Managed Service Accounts (dMSA) – Windows Server 2025

Windows Server 2025 introduces **Delegated Managed Service Accounts (dMSA)**.

Purpose:

- Replace traditional service accounts
    
- Use **machine identities instead of user passwords**
    
- Prevent credential harvesting attacks
    

Key characteristics:

- Authentication is tied to the device identity
    
- Original service account passwords are disabled
    
- Uses fully randomized, managed keys
    

---

#### gMSA vs dMSA (Important Comparison)

|Feature|gMSA|dMSA|
|---|---|---|
|Servers|Multiple|Single|
|Managed by|Active Directory|Administrator|
|Password rotation|Automatic|Automatic|
|Machine-bound|No|Yes|
|Credential Guard integration|Limited|Strong|
|Credential theft risk|Possible|Very low|

> Security takeaway:  
> dMSA provides **stronger protection** against credential theft.

---

### Group Objects

Groups are used to **simplify administration**.

Instead of:

- Assigning permissions to users individually
    

You:

- Assign permissions to groups
    
- Add or remove users from groups
    

This approach:

- Scales better
    
- Is easier to manage
    
- Reduces errors
    

> Best practice: **Never assign permissions directly to users**

---

### Group Types

There are **two group types** in Windows Server.

|Group Type|Purpose|
|---|---|
|Security|Used to assign permissions|
|Distribution|Used for email only|

Security groups can also be used for email distribution, but distribution groups **cannot** be used for security.

---

### Group Scopes

Group scope defines:

- Where permissions can be assigned
    
- Where members can come from
    

#### Group Scope Comparison

|Scope|Where Permissions Apply|Members|
|---|---|---|
|Local|Local computer only|Any domain|
|Domain Local|Local domain|Any domain|
|Global|Anywhere in forest|Local domain only|
|Universal|Anywhere in forest|Any domain|

Usage patterns:

- **Global groups** → users with similar roles
    
- **Domain Local groups** → resource permissions
    
- **Universal groups** → multi-domain environments
    

> Exam concept to remember: **AGDLP / AGUDLP**

---

### Computer Objects

Computers in AD DS are also **security principals**, just like users.

A computer account:

- Has a name and password
    
- Automatically changes its password
    
- Authenticates with the domain
    
- Can be a member of groups
    
- Can receive Group Policy
    

---

### Computer Account Lifecycle

After a computer is joined to the domain, admins typically:

- Configure computer properties
    
- Move it between OUs
    
- Apply GPOs
    
- Rename, reset, disable, or delete the account
    

---

### Computers Container

When a computer joins the domain:

- It is placed in the **Computers container** by default
    

Important facts:

- DN: `CN=Computers`
    
- It is **not an OU**
    
- You cannot:
    
    - Create OUs inside it
        
    - Link GPOs to it
        

---

### Computers Container vs OU

|Feature|Computers Container|OU|
|---|---|---|
|Object type|Container|OU|
|GPO support|No|Yes|
|Delegation|No|Yes|
|Subdivision|No|Yes|

> Best practice:  
> Create **custom OUs** for computers and move them out of the Computers container.

---

### Key Notes to Remember

- Users and computers are **security principals**
    
- Group membership controls access
    
- Use groups instead of individual permissions
    
- Prefer managed service accounts over traditional service accounts
    
- gMSA = multiple servers
    
- dMSA = stronger security, machine-bound
    
- Computers container ≠ OU
    

---
