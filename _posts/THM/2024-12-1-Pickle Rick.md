---
title: Day 16 The Wareville’s Key Vault grew three sizes that day.
date: 2024-12-1 00:00:00
categories: Cybersecurity Tryhackme
tags:
  - THM
  - Writeups
  - Advent_of_cyber
by: Mahmud
published: false
---

1. First need to add the ip to `etc/hosts`
2. now can access the website using `http://rick.thm`
3. there is no thing in the page, but view in source mode can see user name `R1ckRul3s`
4. there is no thing appears here can check the root file `http://rick.thm/robots.txt` can see `Wubbalubbadubdub` it seems like password 
5. i will try scan using nmap
6. there is 2 ports that open (port 80 http) (port 22 ssh) lets try to login in SSH using the credential 