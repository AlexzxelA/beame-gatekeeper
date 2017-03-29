#!/bin/bash

# This script does:
# * Creates new user for Beame Gatekeeper service (default: beame-gatekeeper)
# * Uses either provided token or creates one if there are suitable credentials
#   in ~/.beame folder of the sudoer or the running user.
# * Uses the token from the step above to get all credentials for Beame Gatekeeper
#   and places them in ~/.beame folder of Beame Gatekeeper user
# * Sets up systemd service (default: beame-gatekeeper)

set -eu

err_trap_func() {
	echo "ERROR: Installation failed"
}

trap err_trap_func ERR

if [[ $EUID -ne 0 ]]; then
   echo "Installation can not proceed."
   echo "Please run this script as root."
   exit 1
fi

SCRIPT_DIR="$( cd "$( dirname "$( realpath "${BASH_SOURCE[0]}" )" )" && pwd )"

: ${BEAME_GATEKEEPER_USER:=beame-gatekeeper}
: ${BEAME_GATEKEEPER_SVC:=beame-gatekeeper}
: ${BEAME_GATEKEEPER_SYSTEMD_FILE:="/etc/systemd/system/$BEAME_GATEKEEPER_SVC.service"}
: ${BEAME_GATEKEEPER_SYSTEMD_EXTRA:=''}
: ${BEAME_GATEKEEPER_DIR:="$(dirname "$SCRIPT_DIR")"}
: ${BEAME_GATEKEEPER_EMBEDED_SDK:="$BEAME_GATEKEEPER_DIR/node_modules/beame-sdk/src/cli/beame.js"}
: ${BEAME_GATEKEEPER_BIN:="$BEAME_GATEKEEPER_DIR/main.js"}

if type -t node &>/dev/null;then
	: ${BEAME_GATEKEEPER_NODEJS_BIN:=$(which node)}
else
	: ${BEAME_GATEKEEPER_NODEJS_BIN:=$(which nodejs)}
fi

if [[ $BEAME_GATEKEEPER_NODEJS_BIN ]];then
	echo "+ Using NodeJS at $BEAME_GATEKEEPER_NODEJS_BIN"
else
	echo "+ NodeJS not found"
	exit 2
fi

echo "+ Checking NodeJS version. Expecting Node 6."
v="$("$BEAME_GATEKEEPER_NODEJS_BIN" -v)"
v="${v:1}"

if [[ $v =~ ^[6]\. ]];then
	echo "+ Node 6 detected - OK"
else
	echo "+ ERROR: Node version $v detected but beame-gatekeeper requires node version 6"
	exit 10
fi

if ! type -t jq &>/dev/null;then
	echo "+ jq not found. Please install jq."
fi

if getent passwd "$BEAME_GATEKEEPER_USER" >/dev/null 2>&1;then
	echo "+ User $BEAME_GATEKEEPER_USER already exists"
else
	echo "+ Adding user for beame-gatekeeper: $BEAME_GATEKEEPER_USER"
	adduser --system --group --disabled-password --shell /bin/false "$BEAME_GATEKEEPER_USER"
fi

if su -s /bin/bash -c '[[ -e ~/.beame ]]' "$BEAME_GATEKEEPER_USER";then
	echo "+ .beame directory for user $BEAME_GATEKEEPER_USER exists. Not getting credentials."
else
	echo "+ .beame directory for user $BEAME_GATEKEEPER_USER does not exist. Getting credentials."

	if [[ ${1-} ]];then
		echo "+ Using provided token: $1"
		token="$1"
	else
		echo "+ Token not provided as command line argument. Looking for root (top level) credentials to create token with."
		if [[ ${SUDO_USER-} ]];then
			echo "+ Taking root credentials user from SUDO_USER"
			ROOT_CREDENENTIALS_USER=$SUDO_USER
		else
			ROOT_CREDENENTIALS_USER=$(id -un)
		fi
		echo "+ Root credentials user: $ROOT_CREDENENTIALS_USER"
		ROOT_CREDENENTIALS_HOME="$(getent passwd "$ROOT_CREDENENTIALS_USER" | cut -d: -f6 )"
		echo "+ Root credentials home directory: $ROOT_CREDENENTIALS_HOME"

		echo "+ Searching for root credentials"
		ROOT_CREDENENTIALS=$(su -c "'$BEAME_GATEKEEPER_NODEJS_BIN' '$BEAME_GATEKEEPER_EMBEDED_SDK' creds list --format json" "$ROOT_CREDENENTIALS_USER" | jq -r '.[].metadata.fqdn' | grep -E '^.{16}.v1.p.beameio.net' | grep -v '^$' | head -n 1)
		if [[ $ROOT_CREDENENTIALS ]]; then
			echo "+ Root FQDN detected: $ROOT_CREDENENTIALS"
			echo "+ Getting token as child of $ROOT_CREDENENTIALS"
			token=$(su -c "'$BEAME_GATEKEEPER_NODEJS_BIN' '$BEAME_GATEKEEPER_EMBEDED_SDK' creds getRegToken --fqdn '$ROOT_CREDENENTIALS' --name 'Gatekeeper-$HOSTNAME'" "$ROOT_CREDENENTIALS_USER")
			echo "+ Got token: $token"
		else
			echo "+ Root credentials were not found (creds list had no matching entries) and no token supplied. Can not create token."
			echo "----------------------------------------------------------------------------------------------------"
			echo "Please go to https://ypxf72akb6onjvrq.ohkv8odznwh5jpwm.v1.p.beameio.net/gatekeeper and complete your registration process"
			echo "then run this script with the token from email:"
			echo "$0 TOKEN_FROM_EMAL"
			echo "----------------------------------------------------------------------------------------------------"
			exit 5
		fi
	fi

	echo "+ Getting Beame Gatekeeper credentials"
	su -s /bin/bash -c "'$BEAME_GATEKEEPER_NODEJS_BIN' '$BEAME_GATEKEEPER_BIN' creds getCreds --regToken '$token'" "$BEAME_GATEKEEPER_USER"
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

echo "+ Installation complete."
echo "+ Starting service $BEAME_GATEKEEPER_SVC"
service "$BEAME_GATEKEEPER_SVC" start

echo "+ All operations finished successfully."
echo ""
echo "You can use convenience script beame-gatekeeper-ctl to manage Beame Gatekeeper service."
echo "Running it for you with 'info' command and then with 'admin' command."
echo ""

bash $BEAME_GATEKEEPER_DIR/install/ctl.sh info
echo ""
bash $BEAME_GATEKEEPER_DIR/install/ctl.sh admin
