---
title: Deployment, and Monitoring of a Private 5G Standalone Core Network Using Open5GS**
description: Graduation project submitted in partial fulfillment of the Bachelor’s degree in Electrical and Electronic Engineering (Telecommunications) from University of Tripoli.
date: 2025-012-5 19:50 +0200
categories:
  - Telecom
tags:
  - Networking
  - 5G
  - 5G_Core
  - linux
  - prometus
  - grafana
by: Mahmud
image: https://media.licdn.com/dms/image/v2/D4D2DAQFDF7rUOWMJzQ/profile-treasury-image-shrink_1280_1280/B4DZ1dBDXsK4AQ-/0/1775382051453?e=1775988000&v=beta&t=sVAlf7WY9Qc6zstBWxTQVkcGMRYTriIFri_t2nvNBsA
published: true
---
## Introduction

As part of my Bachelor’s degree in Electrical and Electronic Engineering (Telecommunications) from University of Tripoli, I developed a graduation project focused on building a private 5G Standalone (SA) core network.

The objective of this project was to design, deploy, and analyze a fully functional 5G core using open-source tools, while demonstrating key concepts such as control and user plane separation, scalability, and real-time performance monitoring.

This project was successfully completed with a final grade of **92% (Excellent)**.

---

##  Project Objectives

The main goals of this project were:

- Build a virtualized 5G Standalone core network
- Implement distributed User Plane Functions (UPFs)
- Simulate real-world user behavior using multiple UEs
- Measure key performance indicators (KPIs)
- Visualize network performance in real time

---

## System Architecture

The system was designed using a **5 Virtual Machine (VM) architecture**, where each component plays a specific role:

- **VM1:** Open5GS Core (AMF, SMF, NRF, AUSF, UDM, PCF)
- **VM2:** UPF1
- **VM3:** UPF2
- **VM4:** UERANSIM (gNB + UE simulation)
- **VM5:** Monitoring (Prometheus + Grafana)

This architecture enables separation between control plane and user plane, improving scalability and flexibility.

---

## Implementation  

The project was implemented in structured stages:

### 1. Planning and Design

- Defined KPIs (throughput, latency, jitter, packet loss)
- Designed network interfaces (N2, N3, N4, N6)
- Planned IP addressing and topology

### 2. Environment Setup

- Created and configured 5 virtual machines
- Assigned static IPs and verified connectivity

### 3. Control Plane Deployment

- Installed Open5GS
- Configured AMF and SMF
- Registered network functions with NRF

### 4. User Plane Configuration

- Deployed two UPFs for load balancing
- Configured GTP-U, PFCP, and routing
- Set up OGSTUN interface for UE IP allocation

### 5. RAN and UE Simulation

- Used UERANSIM to simulate gNB and UEs
- Configured subscriber database (500 users)
- Verified successful UE registration

### 6. PDU Session Establishment

- Established data sessions between UE and network
- Verified IP allocation and traffic flow

### 7. Traffic Testing

- Used iperf3 to generate TCP and UDP traffic
- Measured throughput, latency, jitter, and packet loss

### 8. Monitoring and Visualization

- Deployed Prometheus and Grafana
- Built dashboards for real-time KPI monitoring

---

## Results and Analysis

The project produced several important results:

### 🔹 Throughput Performance

- Achieved up to **~994 Mbps** using dual UPFs
- Reduced to ~704 Mbps when only one UPF was active

### 🔹 Security Algorithm Impact

- Standard algorithms: ~11 seconds registration time
- High-performance algorithms (NIA2/NEA2): ~6 seconds

### 🔹 Network Slicing

Two slices were implemented:

- **eMBB:** High throughput
- **URLLC:** Low latency

Results showed:

- Improved throughput for eMBB
- Reduced latency for URLLC

---

## Technologies Used

- Open5GS
- UERANSIM
- Prometheus
- Grafana
- Linux (Ubuntu)
- VMware ESXi
- Networking protocols (TCP/IP, GTP-U, PFCP)

---

## Key Learnings

Through this project, I gained practical experience in:

- 5G core network architecture
- Virtualized network deployment
- Network performance analysis
- Monitoring and observability tools
- Troubleshooting complex distributed systems

---

## Conclusion

This project successfully demonstrated the design and deployment of a private 5G Standalone core network with distributed user plane architecture.

It highlights the importance of scalability, performance optimization, and real-time monitoring in modern telecommunications systems.

The experience gained from this project provides a strong foundation for working with next-generation mobile networks and cloud-based telecom infrastructure.