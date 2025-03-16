---
title: Day 13 It came without buffering! It came without lag!
date: 2024-12-17 00:00:00 +0200
categories: Cybersecurity Tryhackme
tags:
  - THM
  - Writeups
  - Advent_of_cyber
by: Mahmud
--- 
### Learning Objectives

- Learn about WebSockets and their vulnerabilities.
- Learn how WebSocket Message Manipulation can be done.


### Concept 
#### Introduction to WebSockets
WebSockets let your browser and a server keep a constant, open connection for fast, real-time communication. Unlike traditional HTTP, which sends a request and then closes the connection, WebSockets keep the "line open," allowing both sides to send updates anytime. This makes them perfect for live chat apps, games, or real-time data feeds.

#### WebSockets vs. HTTP
- **HTTP:** Your browser asks the server for updates (polling) repeatedly. This is slow and resource-heavy.
- **WebSockets:** The connection stays open, so updates come instantly without repeated requests. It’s like leaving the door open for continuous updates instead of knocking each time.

#### WebSocket Security Risks
WebSockets boost performance but come with security challenges:
1. **Weak Authentication:** WebSockets don’t handle user logins automatically. Without extra checks, attackers could sneak in.
2. **Message Tampering:** Hackers can intercept and change messages if encryption isn’t used.
3. **Cross-Site Attacks:** Attackers might trick browsers into connecting to malicious WebSocket servers.
4. **DoS Attacks:** Open connections can be overloaded, slowing or crashing the server.

#### What Is WebSocket Message Manipulation?
This is when an attacker intercepts and changes messages between a browser and a server. Since WebSockets allow real-time data flow, tampered messages can cause big problems.

#### Dangers of Message Manipulation:
- **Unauthorized Actions:** Hackers could impersonate users, transfer money, or change account settings.
- **Extra Privileges:** Attackers might grant themselves admin access or sensitive info.
- **Corrupted Data:** Fake data could disrupt apps or break shared tools.
- **System Crashes:** Overloading the server with bad requests could bring it down.

#### Protect Your WebSockets:
To stay safe, use strong authentication, encryption, and message validation. Without these, attackers can exploit the open connection for serious damage.

### Practical
1. we will use **Burpsuite** so start it change proxy on **foxyproxy** and go to **Proxy --> Intercept --> Proxy setting** make sure the first to option under websockets interception rules are enabled 
2. now let's start first go to the `http://VM_IP`  to enter wareville car tracker
3. Enable **intercept** option under intruder in brupsuite 
4. go back to the browser and press track 
  ![](./assets/img/Pasted image 20241220202435.png){: .shadow }
5. change `userID` to from 5 to 8 and click forward, as we can see the first flag is `THM{dude_where_is_my_car}`
 ![](./assets/img/Pasted image 20241220202933.png){: .shadow }
  
6. to get the second flag we should manipulate the community report massages (send massage behalf of someone else) so lets go back to browser and enter any massage then press send as you can see the massage is EEE and the sender ID is 5 (glitch), we can try to change it to mayor malware ID (8) and see what will happend
  ![](./assets/img/Pasted image 20241220204335.png){: .shadow }

7. as you can see the flag is  `THM{my_name_is_malware._mayor_malware}`
    ![](./assets/img/Pasted image 20241220204350.png){: .shadow }