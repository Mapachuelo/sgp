#!/bin/bash
export NETAVARK_FW=none
exec podman-compose up "$@"
