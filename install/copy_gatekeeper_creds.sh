#!/bin/bash

set -eu

err_trap_func() {
	echo "ERROR: Installation failed"
}

trap err_trap_func ERR

if [[ $EUID -ne 0 ]]; then
   echo "Installation failed" 
   echo "Please run this script as root" 
   exit 1
fi

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
: ${CURENT_USER:=`whoami`}
: ${BEAME_GATEKEEPER_USER:=beame-gatekeeper}
: ${BEAME_GATEKEEPER_SVC:=beame-gatekeeper}
: ${BEAME_GATEKEEPER_NODEJS_BIN:=$(which nodejs)}
: ${BEAME_GATEKEEPER_SYSTEMD_FILE:="/etc/systemd/system/$BEAME_GATEKEEPER_SVC.service"}
: ${BEAME_GATEKEEPER_SYSTEMD_EXTRA:=''}
: ${BEAME_GATEKEEPER_DIR:="$(dirname "$SCRIPT_DIR")"}

if [[ $BEAME_GATEKEEPER_NODEJS_BIN ]];then
	echo "+ Will be using NodeJS at $BEAME_GATEKEEPER_NODEJS_BIN"
else
	echo "+ NodeJS not found"
	exit 2
fi

"$SCRIPT_DIR/check-nodejs-version.sh" "$BEAME_GATEKEEPER_NODEJS_BIN"

if getent passwd "$BEAME_GATEKEEPER_USER" >/dev/null 2>&1;then
	echo "+ User $BEAME_GATEKEEPER_USER already exists"
else
	echo "+ Adding user for beame-gatekeeper: $BEAME_GATEKEEPER_USER"
	adduser --system --group --disabled-password --shell /bin/false "$BEAME_GATEKEEPER_USER"
fi

echo "+ Creating $BEAME_GATEKEEPER_SYSTEMD_FILE file for beame-gatekeeper"
cat >"$BEAME_GATEKEEPER_SYSTEMD_FILE" <<E
[Service]
Type=simple
Environment=NODE_ENV=production
User=$BEAME_GATEKEEPER_USER
WorkingDirectory=$BEAME_GATEKEEPER_DIR
ExecStart=$BEAME_GATEKEEPER_NODEJS_BIN main.js server start
Restart=always
RestartSec=10

$BEAME_GATEKEEPER_SYSTEMD_EXTRA

[Install]
WantedBy=multi-user.target
E

echo "+ Enabling the $BEAME_GATEKEEPER_SVC service"
systemctl enable "$BEAME_GATEKEEPER_SVC"

echo "+ Reloading systemd"
systemctl daemon-reload

echo "+ SUCCESS. Installation complete."
