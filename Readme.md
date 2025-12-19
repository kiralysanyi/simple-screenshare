# Simple Screenshare

A lightweight screen sharing web application written in TypeScript/JavaScript using **mediasoup**.

## Table of Contents

* [Environment Variables](#environment-variables)
* [Setup Notes](#setup-notes)
* [Example Docker Compose with Host Networking](#example-docker-compose-with-host-networking)
* [Example Docker Compose with IPVLAN](#example-docker-compose-with-ipvlan)
* [Why I Started This Project](#why-i-started-this-project)
* [How It Went](#how-it-went)

## Environment Variables

* `HOST_PASS_ENABLE=1` – Enable password protection for starting streams.
* `HOST_PASS="valamijelszo"` – Password for authenticating streamers.
* `ANNOUNCED_IPS=127.0.0.1,192.168.1.165` – IPs to announce for clients (must be accessible from all clients, otherwise video may not display).
* `HTTP_PORT=9000` – Port for the HTTP server.
* `RTC_MIN_PORT=40000` – Optional: minimum UDP port for RTC (default: 40000).
* `RTC_MAX_PORT=40500` – Optional: maximum UDP port for RTC (default: 40500).

## Setup Notes

This project uses a **mediasoup SFU**, which requires open, directly accessible UDP ports on the server. Using a bridge network or NAT is not practical, as it would require opening a large number of RTP ports. The recommended approach is either **host network mode** or **IPVLAN**.

## Example Docker Compose with Host Networking

```yaml
name: screenshare

services:
  server:
    container_name: simple-screenshare
    image: ghcr.io/kiralysanyi/simple-screenshare:latest # or :testing for newer but untested versions
    network_mode: host # required because WebRTC doesn't play well with NAT
    restart: unless-stopped
    healthcheck:
      disable: false
    environment:
      - HOST_PASS_ENABLE=1
      - HOST_PASS=valamijelszo
      - ANNOUNCED_IPS=127.0.0.1,192.168.1.165
      - HTTP_PORT=9000
      - RTC_MIN_PORT=40000
      - RTC_MAX_PORT=40500
```

## Example Docker Compose with IPVLAN

```yaml
name: screenshare

services:
  server:
    container_name: simple-screenshare
    image: ghcr.io/kiralysanyi/simple-screenshare:latest
    networks:
      vlan_net:
        ipv4_address: 192.168.1.20
    restart: unless-stopped
    healthcheck:
      disable: false
    environment:
      - HOST_PASS_ENABLE=1
      - HOST_PASS=valamijelszo
      - ANNOUNCED_IPS=127.0.0.1,192.168.1.165
      - HTTP_PORT=8888
      - RTC_MIN_PORT=40000
      - RTC_MAX_PORT=40500

networks:
  vlan_net:
    driver: ipvlan
    driver_opts:
      parent: eth0
      ipvlan_mode: l2
    ipam:
      config:
        - subnet: 192.168.1.0/24
          gateway: 192.168.1.1
```

## Why I Started This Project

In my school, classroom layouts sometimes made it hard for all students to see what the teacher projected on the board. Initially, we used Google Meet to solve this, but unreliable internet made that solution unfeasible. I developed this application to provide a stable, local screen sharing solution.

## How It Went

The first version used **PeerJS**, but the teacher’s laptop struggled as more students joined, resulting in lag and freezes. Each student required a separate connection to the teacher, which wasn’t scalable.

I then explored **SFUs** and chose **mediasoup** for its efficient handling of multiple streams. After a few days of rewriting the frontend and implementing mediasoup on the backend, the application now runs smoothly, even with multiple clients connected.
