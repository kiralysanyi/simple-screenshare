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
    image: ghcr.io/kiralysanyi/simple-screenshare
    restart: always
    healthcheck:
      disable: false
    ports:
      - 9000:9000
    environment:
      - HOST_PASS_ENABLE=1
      - HOST_PASS=valamijelszo

```