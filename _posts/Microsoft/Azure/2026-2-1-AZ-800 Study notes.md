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

