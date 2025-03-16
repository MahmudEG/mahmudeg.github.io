---
title: Day 12 If I can’t steal their money, I’ll steal their joy!
date: 2024-12-16 00:00:00 +0200
categories: Cybersecurity Tryhackme
tags:
  - THM
  - Writeups
  - Advent_of_cyber
by: Mahmud
---
### Learning Objectives
- Understand the concept of race condition vulnerabilities
- Identify the gaps introduced by HTTP2
- Exploit race conditions in a controlled environment
- Learn how to fix the race

### Concept

#### Web Timing and Race Conditions: Understanding and Mitigation

Web timing attacks and race conditions exploit subtle flaws in how web applications handle time and concurrency, leading to vulnerabilities that can leak sensitive information or allow unintended actions. Let’s unpack the key concepts, examples, and countermeasures for such vulnerabilities.

#### **Web Timing Attacks**

Web timing attacks analyze the time taken by a server to process requests to infer sensitive information. By observing response time variations, attackers can infer:

1. **Data Characteristics**: The presence or absence of specific data (e.g., checking if a username exists).
2. **Encryption Keys**: Subtle time differences in cryptographic operations can leak bits of encryption keys.

#### **HTTP/2: A Double-Edged Sword**

The adoption of HTTP/2 introduces **single-packet multi-requests**, enabling the stacking of requests within the same TCP packet. This eliminates **network latency** as a factor, focusing solely on **server latency**, which makes timing issues easier to detect and exploit.

#### **Race Conditions**

Race conditions arise when multiple concurrent requests manipulate shared resources without proper synchronization. This can lead to unintended actions or inconsistent states in the application.

#### **Example: Coupon Code Exploitation**

1. **Scenario**:
    - A user submits a coupon code.
    - The server checks if the code is valid.
    - The server applies the discount and updates the code as used.
2. **Vulnerability**:
    - If two requests are processed simultaneously before the code is marked as used, both requests may successfully apply the discount.

#### **Time-of-Check to Time-of-Use (TOCTOU)**

A common form of race condition, TOCTOU flaws occur when a system checks a condition (e.g., resource availability) but does not enforce it before an action is completed.

#### **Example**:

- **Scenario**: Checking whether a file exists before opening it.
- **Exploit**: Between the check and the use, an attacker could replace the file, leading to unintended consequences (e.g., accessing sensitive files).

#### **Detection Techniques**

1. **Observation of Response Times**:
    - Measure response time differences for specific inputs.
2. **Concurrency Testing**:
    - Simulate multiple simultaneous requests to detect inconsistencies or duplicated operations.

#### **Mitigation Strategies**

1. **Atomic Operations**:
    - Ensure checks and updates are performed as a single, indivisible operation.
    - Example: Use database transactions or locks.

2. **Idempotent Operations**:
    - Design APIs to handle duplicate requests without unintended side effects.
    - Example: Duplicate coupon application logic.

3. **Input Validation and Rate Limiting**: 
    - Validate inputs rigorously.
    - Limit the number of requests a user can make in a short period.

4. **Timestamp Validation**:
    - Include server-side timestamps to verify the freshness of requests.

5. **Enhanced Logging**:
    - Log request timestamps and processing details to identify anomalies.

#### **Tools for Detection and Exploitation**

1. **Burp Suite**:
    - Extensions like **Turbo Intruder** for timing-based exploitation.
2. **OWASP ZAP**:
    - Analyze and simulate race conditions.
3. **Custom Scripts**:
    - Use scripting languages (e.g., Python) with libraries like **Requests** or **aiohttp** to send parallel requests.

### Practical
   1. first go to `http://VM_IP:5555`
   2. open `brupsuite` on Kali (Attackbox)
   3. i will use regular browser with `foxy proxy` extension to intercept the page request and foreword it to `burpsuite`  
   4. go back to browser and make sure you change proxy to `burbsuite` port then go to `http://VM_IP:5555` , then go back to `burpsuite` and enter Proxy tab then HTTP history
   5. you will see om GET request 
      ![](./assets/img/Pasted image 20241220193559.png){: .shadow }
   7. to identify race condition we will login and send money transaction to get the POST request so lets login using the given credential and ACCOUNT NUMBER : 101   PASSWORD: glitch
   8. as you can see there is 2000$ 
   ![](./assets/img/Pasted image 20241220194501.png){: .shadow } in the account we need to transfer more then the 2000$ to **111** account so we will try race condition to do that
   9. first apply regular money transfer lets say 800$ 
      ![](./assets/img/Pasted image 20241220194554.png){: .shadow }
      

10. now when go back to `burpsuite` we should see transfer POST request 
    ![](./assets/img/Pasted image 20241220194751.png){: .shadow }
11. to preform race condition the request should be send to repeater and duplicate for lets say 5 times and send all of them in parallel to the server server
![](./assets/img/Pasted image 20241220195526.png){: .shadow }
    
12. this method approve success 
![](./assets/img/Pasted image 20241220195249.png){: .shadow }
13. and the flag is `THM{WON_THE_RACE_007}`
