Podman Compose launcher for this project

Usage:

- From the project root run using the helper script (no sudo):

```bash
./podman/up.sh    # build and start
./podman/down.sh  # stop and remove
```

The scripts try `podman compose` then `podman-compose` if available. If Podman isn't installed, install it first.

Notes:
- We remove explicit `container_name` entries to improve compatibility with Podman.
- Rootless Podman may require additional networking setup if ports fail to bind.
