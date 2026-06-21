# LinkedIn Post #1 — LSA Protection (RunAsPPL)
## Ready to publish — Tuesday July 1

---

We enabled LSA Protection (RunAsPPL) across our enterprise.

Here's what broke — and what nobody tells you before you flip that switch.

**What RunAsPPL does:** It runs the Local Security Authority process as a Protected Process Light, blocking tools like Mimikatz from reading credentials directly from LSASS memory. On paper, it's a no-brainer for any org serious about credential protection.

In practice? We hit three immediate breaks:

**1. MFA agent stopped working.**
Our on-prem MFA agent loaded a DLL into LSASS at startup. RunAsPPL blocks unsigned or non-PPL-compatible DLLs. The agent silently failed — no error in the UI, just broken MFA. Fix: update the agent to a PPL-compatible version. Not all vendors have one.

**2. AV/EDR stopped intercepting auth events.**
The security product we run also injected into LSASS for credential event monitoring. Same problem — it wasn't PPL-aware. We had to coordinate with the vendor on a driver-based alternative. That took two weeks.

**3. VPN client broke on some machines.**
Older VPN clients that hooked into LSASS for SSO auth failed silently on login. Users just got "authentication failed" with no useful log. Traced it to an incompatible SSPI module.

---

**The lesson:** RunAsPPL is the right control. But in a mature environment with a lot of agents touching LSASS, you'll break things before you harden anything.

Test in a pilot OU first. Check `HKLM\SYSTEM\CurrentControlSet\Control\Lsa\RunAsPPL`. Review every third-party product that touches authentication. Read the WDEG/PPL compat list.

The friction is worth it — but go in with your eyes open.

---

If you're planning to roll this out, happy to share the testing checklist we built.

What security hardening have you pushed that came with unexpected compatibility pain? Drop it in the comments 👇

#WindowsServer #ActiveDirectory #CyberSecurity #ZeroTrust #Microsoft #IdentityHardening #InfoSec

---
**Notes for publishing:**
- Post on Tuesday July 1
- If you have a screenshot of the registry key or Event Viewer showing the PPL flag, add it — visual posts get 2x engagement
- Pin a comment with the link to your blog once you write the full lab post
