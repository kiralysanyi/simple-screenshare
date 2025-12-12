# Simple screenshare

Simple to use screenshare, easy setup, etc.

## Environment variables

- `HOST_PASS_ENABLE=1` enable password protection for starting streams
- `HOST_PASS="valamijelszo"` the password for authenticating users (i was not willing to add mariadb as a dependency for one password, sorry)

## Example docker compose

```yaml

name: screenshare

services:
  server:
    container_name: simple-screenshare
    image: ghcr.io/kiralysanyi/simple-screenshare:testing # or :latest for a kinda stable version
    network_mode: host # yes, i dont like it, but needed because webrtc is allergic to nat
    restart: unless-stopped
    healthcheck:
      disable: false
    environment:
      - HOST_PASS_ENABLE=1 # optional
      - HOST_PASS=valamijelszo # optional
      - ANNOUNCED_IP=192.168.1.117 # ip to announce for clients (this servers ip, should be accessable from all clients, or else you will get blank video)
      - HTTP_PORT=8888 # port of the http server

```