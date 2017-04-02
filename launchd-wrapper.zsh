#!/usr/bin/env zsh

# http://elevated-dev.com/TechTips/Launchd%20&%20Logging/

NODEJS_PATH=${1:A:h}
export PATH="$NODEJS_PATH:$PATH"

T="beame-gatekeeper"
exec > >(logger -t "$T" -p user.info) 2> >(logger -t "$T" -p user.error)
exec "$@"
