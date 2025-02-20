---
title: Day 16 The Wareville’s Key Vault grew three sizes that day.
date: 2024-12-20 00:00:00
categories: Cybersecurity
tags:
  - THM
  - Writeups
  - Advent_of_cyber
by: Mahmud
---

## Learning Objectives

- Learn about Azure, what it is and why it is used.
- Learn about Azure services like Azure Key Vault and Microsoft Entra ID.
- Learn how to interact with an Azure tenant using Azure Cloud Shell.
### Azure Overview

Azure is a **Cloud Service Provider (CSP)** like AWS or Google Cloud. It offers **on-demand resources** like servers and storage, letting users scale up or down as needed. Key advantages include:

- **Pay-as-you-go**: Only pay for what you use.
- **Scalability**: Easily handle increased demand during busy times.
- **Wide range of services**: Over 200 services for tasks like identity management, data processing, and app development.

### Key Azure Services

1. **Azure Key Vault**:
    
    - Stores sensitive data like passwords, API keys, and certificates securely.
    - Vault owners control access and can track who accesses the data.
2. **Microsoft Entra ID (formerly Azure AD)**:
    
    - Manages user identities and permissions.
    - Ensures only authorized users/apps can access resources.

### Assumed Breach Scenario

This is a security test where it’s assumed an attacker already has access to the system. The goal is to:

- Explore how far they can go.
- Identify weaknesses in the system.
- Strengthen defenses against potential threat


### Practical
1. Start the cloud lab and use the given credential
2. when ask for authentication select **Ask Later**
3. now you are in the azure dashboard
   ![[Pasted image 20241227193531.png]]
   1. click on Azure CLI and select Bash
   2. the terminal will start
   3. the password is `R3c0v3r_s3cr3ts!` it can be found under `wvusr-backupware` when you use command 
	```bash
 	az ad user list --filter "startsWith('wvusr-', displayName)"
 	```
 1.  the ID of Secret Recovery Group is `7d96660a-02e1-4112-9515-1762d0cb66b7` can be found using command
```bash
az ad group list
```
1. the 
```bash
az keyvault secret list --vault-name warevillesecrets
```
1. log out usng `az account clear`
2. now log in `az login -u wvusr-backupware@aoc2024.onmicrosoft.com -p R3c0v3r_s3cr3ts!`
3. search for vault with warevillesecrets name 
```bash
az keyvault secret list --vault-name warevillesecrets
```
1. find name of vault secret is `aoc2024`
2.  find the content on it using
```shell-session
az keyvault secret show --vault-name warevillesecrets --name aoc2024
```
1. the content is `WhereIsMyMind1999`