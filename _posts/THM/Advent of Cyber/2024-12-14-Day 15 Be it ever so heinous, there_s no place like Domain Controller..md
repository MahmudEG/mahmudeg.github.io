---
title: Day 15 Be it ever so heinous, there_s no place like Domain Controller.
date: 2024-12-19 00:00:00 +0200
categories: Cybersecurity Tryhackme
tags:
  - THM
  - Writeups
  - Advent_of_cyber
by: Mahmud
---

### Learning Objectives

- Learn about the structures of Active Directory.
- Learn about common Active Directory attacks.
- Investigate a breach against an Active Directory.

### RDP Credential
| **Username** | WAREVILLE\Administrator |
| ------------ | ----------------------- |
| **Password** | AOCInvestigations!      |
| **IP**       | MACHINE_IP              |

### Concept
**What is Active Directory (AD)?**
- Active Directory (AD) is a tool that helps organizations manage their networks. It keeps track of everything on a network, like users, computers, and groups, and controls who can access what.

**Main Components of AD:**
1. **Domains:** Groups of resources like users and computers with shared rules and security settings.
2. **Organizational Units (OUs):** Subgroups within a domain that make it easier to manage and apply rules (e.g., by department or location).
3. **Forest:** A collection of domains that share a common setup.
4. **Trust Relationships:** Connections between domains that allow users to share resources across them.

**How AD Works:**
- **Domain Controllers (DCs):** Servers that store AD data and handle tasks like logging in users.
- **Global Catalog (GC):** A searchable database that helps find information across domains.
- **LDAP Protocol:** Allows AD to quickly search for and manage information.
- **Kerberos Authentication:** A secure system for logging in.

**Group Policy:**
- Admins use Group Policy to enforce rules like password requirements or software restrictions. Policies can apply to the whole network or specific groups.

Example: To enforce a password policy:
1. Open Group Policy Management.
2. Create a new policy, name it (e.g., "Password Policy").
3. Set rules like minimum password length and complexity.

**Common Attacks on AD and How to Defend Against Them:**
1. **Golden Ticket Attack:** Hackers forge login tickets to control the domain. Defend by monitoring unusual activity.
2. **Pass-the-Hash:** Hackers use stolen password hashes to log in. Prevent with strong passwords and multi-factor authentication.
3. **Kerberoasting:** Hackers steal and crack service account passwords. Defend by securing service accounts with strong passwords.
4. **Pass-the-Ticket:** Hackers steal and reuse login tickets. Detect with suspicious login monitoring.
5. **Malicious GPOs:** Hackers use policies to spread malware. Regularly check policies for unauthorized changes.
6. **Skeleton Key Attack:** Hackers install a backdoor to log in using a "master" password. Defend by monitoring for malware.

**Investigating Breaches:**
- Use tools like PowerShell to review Group Policy Objects (GPOs) and identify any unauthorized changes or malicious settings.

