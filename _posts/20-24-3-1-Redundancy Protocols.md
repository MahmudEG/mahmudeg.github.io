---
title: RedundancyProtocols
date: 2025-03-07 19:50
categories: Networking
tags:
  - HSRP
  - VRRP
  - GLBP
  - Networking
  - Cisco
  - eve-ng
by: Mahmud
---
# 1. Overview of Redundancy Protocols

### What meant by redundancy network

### Top Redundancy Protocols
1. **HSRP:**  
   
2. **VRRP**: 
   
3. **GLBP**: 
   

# 2. Topology

![[Pasted image 20250307201636.png]]

![](./assets/img/Pasted image 20250307201636.png){: .shadow }
*the mesh topology is used cause it suited the redundancy configration*

### 2.1 IP Table

| Rudndncy Protocol | Device | Interface |      IP       |      Mask       |    Gateway     |
| :---------------: | :----: | :-------: | :-----------: | :-------------: | :------------: |
|         /         |  ISP   |   Gi0/0   |  192.168.1.1  | 255.255.255.252 |       /        |
|         /         |  ISP   |   Gi0/1   |  192.168.1.5  | 255.255.255.252 |       /        |
|         /         |  ISP   |   Gi0/2   |  192.168.1.9  | 255.255.255.252 |       /        |
|         /         |  ISP   |   Gi0/3   | 192.168.1.13  | 255.255.255.252 |       /        |
|         /         |  ISP   |   Gi0/4   | 192.168.1.17  | 255.255.255.252 |       /        |
|         /         |  ISP   |   Gi0/5   | 192.168.1.21  | 255.255.255.252 |       /        |
|         /         |  ISP   |   Gi0/6   |     DHCP      | 255.255.255.252 |       /        |
|       HSRP        |   R1   |   Gi0/0   |  192.168.1.2  | 255.255.255.252 |       /        |
|       HSRP        |   R1   |   Gi0/1   | 192.168.10.1  |  255.255.255.0  |       /        |
|       HSRP        |   R1   |   Gi0/2   | 192.168.11.1  |  255.255.255.0  |       /        |
|       HSRP        |   R2   |   Gi0/0   |  192.168.1.6  | 255.255.255.252 |       /        |
|       HSRP        |   R2   |   Gi0/1   | 192.168.10.2  |  255.255.255.0  |       /        |
|       HSRP        |   R2   |   Gi0/2   | 192.168.11.2  |  255.255.255.0  |       /        |
|       HSRP        | Linux1 |    e0     | 192.168.10.10 |  255.255.255.0  | 192.168.20.254 |
|       HSRP        | Linux2 |    e0     | 192.168.11.10 |  255.255.255.0  | 192.168.21.254 |
|       VRRP        |   R3   |   Gi0/0   | 192.168.1.10  | 255.255.255.252 |       /        |
|       VRRP        |   R3   |   Gi0/1   | 192.168.20.1  |  255.255.255.0  |       /        |
|       VRRP        |   R3   |   Gi0/2   | 192.168.21.1  |  255.255.255.0  |       /        |
|       VRRP        |   R4   |   Gi0/0   | 192.168.1.14  | 255.255.255.252 |       /        |
|       VRRP        |   R4   |   Gi0/1   | 192.168.20.2  |  255.255.255.0  |       /        |
|       VRRP        |   R4   |   Gi0/2   | 192.168.21.2  |  255.255.255.0  |       /        |
|       VRRP        | Linux3 |    e0     | 192.168.20.10 |  255.255.255.0  | 192.168.20.254 |
|       VRRP        | Linux4 |    e0     | 192.168.21.10 |  255.255.255.0  | 192.168.21.254 |
|       GLBP        |   R5   |   Gi0/0   | 192.168.1.18  | 255.255.255.252 |       /        |
|       GLBP        |   R5   |   Gi0/1   | 192.168.30.1  |  255.255.255.0  |       /        |
|       GLBP        |   R5   |   Gi0/2   | 192.168.31.1  |  255.255.255.0  |       /        |
|       GLBP        |   R6   |   Gi0/0   | 192.168.1.22  | 255.255.255.252 |       /        |
|       GLBP        |   R6   |   Gi0/1   | 192.168.30.2  |  255.255.255.0  |       /        |
|       GLBP        |   R6   |   Gi0/2   | 192.168.31.2  |  255.255.255.0  |       /        |
|       GLBP        | Linux5 |    e0     | 192.168.30.10 |  255.255.255.0  | 192.168.30.254 |
|       GLBP        | Linux6 |    e0     | 192.168.31.10 |  255.255.255.0  | 192.168.31.254 |

### 2.2 images 

| Device | Image name                                       |
| ------ | ------------------------------------------------ |
| Router | vios-adventerprisek9-m.spa.159-3.m6              |
| Switch | vios_l2-adventerprisek9-m.ssa.high_iron_20200929 |
| PC     | TinyCore Linux                                   |



# 3 Device Configuration

## 3.1 ISP Router Configuration

```
en

config t

int gi0/0

ip address 192.168.1.1 255.255.255.252

no sh

int gi0/1

ip address 192.168.1.5 255.255.255.252

no sh

int gi0/2

ip add 192.168.1.9 255.255.255.252

no sh

int gi0/3

ip add 19.168.1.13 255.255.255.252

no sh

int gi0/4

ip add 192.168.1.17 255.255.255.252

no sh

int gi0/5

ip add 192.168.1.21 255.255.255.252

no sh

exit

router ospf 1

network 192.168.1.0 0.0.0.3 area 0

network 192.168.1.4 0.0.0.3 area 0

network 192.168.1.8 0.0.0.3 area 0

network 192.168.1.12 0.0.0.3 area 0

network 192.168.1.16 0.0.0.3 area 0

network 192.168.1.20 0.0.0.3 area 0

end

wr
```

## 3.2 HSRP Configuration
### R1

```
en

config t

int gi0/0

ip address 192.168.1.2 255.255.255.252

no sh

int gi0/1

ip address 192.168.10.1 255.255.255.0

standby 1 ip 192.168.10.254

standby 1 priority 110

standby 1 preempt

no sh

int gi0/2

ip address 192.168.11.1 255.255.255.0

standby 2 ip 192.168.11.254

standby 2 priority 110

standby 2 preempt

no sh

exit

router ospf 1

network 192.168.10.0 0.0.0.255 area 0

network 192.168.11.0 0.0.0.255 area 0

network 192.168.1.0 0.0.0.3 area 0

end

wr
```
### R2

```
en

config t

int gi0/0

ip address 192.168.1.6 255.255.255.252

no sh

int gi0/1

ip address 192.168.10.2 255.255.255.0

standby 1 ip 192.168.10.254

standby 1 priority 90

standby 1 preempt

no sh

int gi0/2

ip address 192.168.11.2 255.255.255.0

standby 2 ip 192.168.11.254

standby 2 priority 90

standby 2 preempt

no sh

exit

router ospf 1

network 192.168.10.0 0.0.0.255 area 0

network 192.168.11.0 0.0.0.255 area 0

network 192.168.1.4 0.0.0.3 area 0

end

wr
```

## 3.3 VRRP Configuration

### R3

```
en

config t

int gi0/0

ip address 192.168.1.10 255.255.255.252

no sh

int gi0/1

ip address 192.168.20.1 255.255.255.0

vrrp 1 ip 192.168.20.254

vrrp 1 priority 110

vrrp 1 preempt

no sh

int gi0/2

ip address 192.168.21.1 255.255.255.0

vrrp 2 ip 192.168.21.254

vrrp 2 priority 110

vrrp 2 preempt

no sh

exit

router ospf 1

network 192.168.20.0 0.0.0.255 area 0

network 192.168.21.0 0.0.0.255 area 0

network 192.168.1.8 0.0.0.3 area 0

end

wr
```

### R4

```
en

config t

int gi0/0

ip address 192.168.1.14 255.255.255.252

no sh

int gi0/1

ip address 192.168.20.2 255.255.255.0

vrrp 1 ip 192.168.20.254

vrrp 1 priority 90

vrrp 1 preempt

no sh

int gi0/2

ip address 192.168.21.2 255.255.255.0

vrrp 2 ip 192.168.21.254

vrrp 2 priority 90

vrrp 2 preempt

no sh

exit

router ospf 1

network 192.168.20.0 0.0.0.255 area 0

network 192.168.21.0 0.0.0.255 area 0

network 192.168.1.12 0.0.0.3 area 0

end

wr
```

## 3.4 GLBP Configuration

### R5

```
en

config t

int gi0/0

ip address 192.168.1.18 255.255.255.252

no sh

int gi0/1

ip address 192.168.30.1 255.255.255.0

glbp 1 ip 192.168.30.254

glbp 1 priority 110

glbp 1 preempt

glbp 1 load-balancing round-robin

no sh

int gi0/2

ip address 192.168.31.1 255.255.255.0

glbp 2 ip 192.168.31.254

glbp 2 priority 110

glbp 2 preempt

glbp 2 load-balancing round-robin

no sh

exit

router ospf 1

network 192.168.30.0 0.0.0.255 area 0

network 192.168.31.0 0.0.0.255 area 0

network 192.168.1.16 0.0.0.3 area 0

end

wr
```

### R6
```
en

config t

int gi0/0

ip address 192.168.1.22 255.255.255.252

no sh

int gi0/1

ip address 192.168.30.2 255.255.255.0

glbp 1 ip 192.168.30.254

glbp 1 priority 90

glbp 1 preempt

glbp 1 load-balancing round-robin

no sh

int gi0/2

ip address 192.168.31.2 255.255.255.0

glbp 2 ip 192.168.31.254

glbp 2 priority 90

glbp 2 preempt

glbp 2 load-balancing round-robin

no sh

exit

router ospf 1

network 192.168.30.0 0.0.0.255 area 0

network 192.168.31.0 0.0.0.255 area 0

network 192.168.1.20 0.0.0.3 area 0

end

wr
```

