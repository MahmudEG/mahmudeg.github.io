---
title: Fix Windows UUID/SID Conflict in EVE-NG Labs (Domain Join Issue)
description: " Problem: When cloning Windows Server VMs in EVE-NG, all clones share the same SID and Machine GUID. This causes Active Directory to reject domain joins with a “UUID matches another server” error."
date: 2026-4-22 19:50 +0200
categories:
  - Networking
tags:
  - linux
  - Windows
  - eve-ng
by: Mahmud
image:
published: true
---

> **Problem:** When cloning Windows Server VMs in EVE-NG, all clones share the same SID and Machine GUID. This causes Active Directory to reject domain joins with a “UUID matches another server” error.

-----

## Why This Happens

EVE-NG clones nodes from a base qcow2 disk image. If that image was never sysprepped, every clone boots with an **identical SID and Machine GUID** — AD sees them as the same machine and refuses to join more than one.

-----

## Important: “Export CFG” Does NOT Work for Windows

The **Export CFG** button in EVE-NG only works for network devices (routers, switches). For Windows VMs you will get error **“not supported”**. You must work directly with the **qcow2 disk image** on the EVE-NG server.

-----

## The Fix: Sysprep Once → Reuse Forever

### Step 1 — Boot Your Base Windows Server VM and Run Sysprep

Open CMD as Administrator on the Windows VM:

```cmd
C:\Windows\System32\Sysprep\sysprep.exe /generalize /oobe /shutdown
```

Wait for the VM to fully shut down before proceeding.

-----

### Step 2 — SSH Into Your EVE-NG Server and Locate the qcow2 File

```bash
# Running lab node disks are stored here:
ls /opt/unetlab/tmp/0/<lab-id>/<node-id>/

# Base template images are stored here:
ls /opt/unetlab/addons/qemu/
```

> Replace `<lab-id>` and `<node-id>` with your actual values.

-----

### Step 3 — Commit the Node Disk Back to a Clean Base Image

```bash
cd /opt/unetlab/tmp/0/<lab-id>/<node-id>/

# Flatten and commit the sysprepped state into the base image
/opt/qemu/bin/qemu-img commit hda.qcow2
```

-----

### Step 4 — Copy It as a New Reusable Template

```bash
cp hda.qcow2 /opt/unetlab/addons/qemu/win2019-sysprepped/hda.qcow2
```

> Name the folder something meaningful like `win2019-sysprepped` so you can identify it later.

-----

### Step 5 — Fix Permissions

```bash
/opt/unetlab/wrappers/unl_wrapper -a fixpermissions
```

-----

## Result

Every new node you create from this template will:

- ✅ Boot with a **unique SID** generated automatically on first boot
- ✅ Have a **unique Machine GUID** — no more UUID conflicts
- ✅ Join the domain without any issues
- ✅ Require **zero additional sysprep steps** in the future

-----

## Bonus: Quick Fix for Already-Running Clones (No Full Sysprep)

If you have existing conflicting VMs already running in a lab, run this PowerShell on each one instead of a full sysprep — much faster:

```powershell
# Regenerate Machine GUID
$guid = [System.Guid]::NewGuid().ToString().ToUpper()
Set-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Cryptography" -Name "MachineGuid" -Value $guid

# Rename the computer (each server must have a unique name)
Rename-Computer -NewName "SRV-02" -Force -Restart
```

> Change `SRV-02` to the appropriate hostname for each server.

-----

## Summary Table

|Scenario                                  |Solution                                    |
|------------------------------------------|--------------------------------------------|
|Setting up a new base image               |Sysprep → commit qcow2 → save as template   |
|Already have running clones with conflicts|PowerShell GUID reset + rename              |
|“Export CFG” not working                  |Expected — use qcow2 method instead         |
|Want to avoid this forever                |Always build from a sysprepped base template|

-----

*Tested on EVE-NG Community with Windows Server 2019/2022*