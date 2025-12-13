# Simple screenshare

Simple to use screenshare, easy setup, etc.

## Environment variables

- `HOST_PASS_ENABLE=1` enable password protection for starting streams
- `HOST_PASS="valamijelszo"` the password for authenticating streamers
- `ANNOUNCED_IP=192.168.1.117` ip to announce for clients (this servers ip, should be accessable from all clients, or else you will get blank video)
- `HTTP_PORT=9000` port of the http server
- `RTC_MIN_PORT=40000` optional RTC min udp port default: 40000
- `RTC_MAX_PORT=40500` optional RTC max udp port default: 40500

## Setup notes

The project uses mediasoup SFU, so we need open, directly accessable udp ports on the server. This means that we cant use bridge network/any nat because we would have to open thousands of ports for rtp and that would be painful, so we have to use either host network mode or set up a network with ipvlan.

## Example docker compose with host networking

```yaml

name: screenshare

services:
  server:
    container_name: simple-screenshare
    image: ghcr.io/kiralysanyi/simple-screenshare:latest # or :testing for more recent but untested versions
    network_mode: host # yes, i dont like it, but needed because webrtc is allergic to nat
    restart: unless-stopped
    healthcheck:
      disable: false
    environment:
      - HOST_PASS_ENABLE=1 # optional
      - HOST_PASS=valamijelszo # optional
      - ANNOUNCED_IP=192.168.1.117 # ip to announce for clients (this servers ip, should be accessable from all clients, or else you will get blank video)
      - HTTP_PORT=9000 # port of the http server
      - RTC_MIN_PORT=40000 #optional RTC min udp port default: 40000
      - RTC_MAX_PORT=40500 #optional RTC max udp port default: 40500

```

## Example docker compose with IPVLAN

```yaml

name: screenshare

services:
  server:
    container_name: simple-screenshare
    image: ghcr.io/kiralysanyi/simple-screenshare:latest # or :testing for more recent but untested versions
    networks:
      vlan_net:
        ipv4_address: 192.168.1.20
    restart: unless-stopped
    healthcheck:
      disable: false
    environment:
      - HOST_PASS_ENABLE=1 # optional
      - HOST_PASS=valamijelszo # optional
      - ANNOUNCED_IP=192.168.1.20 # ip to announce for clients (should be accessable from all clients, or else you will get blank video)
      - HTTP_PORT=8888 # port of the http server
      - RTC_MIN_PORT=40000 #optional RTC min udp port default: 40000
      - RTC_MAX_PORT=40500 #optional RTC max udp port default: 40500

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