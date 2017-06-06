#!/bin/bash

set -eu

err_trap_func() {
	echo "ERROR: Installation as service failed"
}

trap err_trap_func ERR

if [[ $EUID -ne 0 ]]; then
   echo "Please run this script as root."
   exit 1
fi

if [[ $(uname -s) == Darwin ]];then
	echo "+ Running Mac OS installation"
	SCRIPT_DIR=$(zsh -c 'echo ${0:A:h}' "$0")
	exec "$SCRIPT_DIR/launchd-service.zsh" "$@"
else
	echo "+ Running systemd installation"
	SCRIPT_DIR="$( cd "$( dirname "$( realpath "${BASH_SOURCE[0]}" )" )" && pwd )"
	exec "$SCRIPT_DIR/systemd-service.sh" "$@"
fi
