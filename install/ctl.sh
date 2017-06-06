#!/bin/bash

set -eu

err_trap_func() {
	echo "ERROR: Command failed"
}

trap err_trap_func ERR

if [[ $EUID -ne 0 ]]; then
   echo "Please run this script as root."
   exit 1
fi

if [[ $(uname -s) == Darwin ]];then
	SCRIPT_DIR=$(zsh -c 'echo ${0:A:h}' "$0")
	exec "$SCRIPT_DIR/ctl.zsh" "$@"
fi

SCRIPT_DIR="$( cd "$( dirname "$( realpath "${BASH_SOURCE[0]}" )" )" && pwd )"

: ${BEAME_GATEKEEPER_USER:=beame-gatekeeper}
: ${BEAME_GATEKEEPER_SVC:=beame-gatekeeper}
: ${BEAME_GATEKEEPER_SYSTEMD_FILE:="/etc/systemd/system/$BEAME_GATEKEEPER_SVC.service"}
: ${BEAME_GATEKEEPER_DIR:="$(dirname "$SCRIPT_DIR")"}
: ${BEAME_GATEKEEPER_EMBEDED_SDK:="$BEAME_GATEKEEPER_DIR/node_modules/beame-sdk/src/cli/beame.js"}
: ${BEAME_GATEKEEPER_BIN:="$BEAME_GATEKEEPER_DIR/main.js"}
: ${BEAME_GATEKEEPER_USER_HOMEDIR:="$(getent passwd "$BEAME_GATEKEEPER_USER" | cut -d: -f6)"}

if type -t node &>/dev/null;then
	: ${BEAME_GATEKEEPER_NODEJS_BIN:=$(which node)}
else
	: ${BEAME_GATEKEEPER_NODEJS_BIN:=$(which nodejs)}
fi

if [[ ! $BEAME_GATEKEEPER_NODEJS_BIN ]];then
	echo "+ NodeJS not found"
	exit 2
fi

if [[ ! ${1-} ]];then
	echo "Usage:"
	echo ""
	echo "$0 start"
	echo "  Starts Beame Gatekeeper"
	echo ""
	echo "$0 stop"
	echo "  Stops Beame Gatekeeper"
	echo ""
	echo "$0 restart"
	echo "  Restarts Beame Gatekeeper"
	echo ""
	echo "$0 status"
	echo "  Shows Beame Gatekeeper status"
	echo ""
	echo "$0 info"
	echo "  Shows Beame Gatekeeper most important configuration"
	echo ""
	echo "$0 admin"
	echo "  Get admin URL"
	echo ""
	echo "$0 name YOUR_SERVICE_NAME"
	echo "  Set service name (will restart the service)"
	echo ""
	echo "$0 delete-systemd-service"
	echo "  Deletes systemd service ($BEAME_GATEKEEPER_SVC)"
	echo ""
	echo "$0 delete-all"
	echo "  Deletes home directory ($BEAME_GATEKEEPER_USER_HOMEDIR)"
	echo "  Deletes user $BEAME_GATEKEEPER_USER."
	exit 1
fi

case "$1" in
	start|stop|status|restart)
		service "$BEAME_GATEKEEPER_SVC" "$1"
		;;
	info)
		echo "+ Getting info"
		if ! type -t jq &>/dev/null;then
			echo "+ jq not found. Please install jq."
		fi
		echo "--- Most important configuration --------------------------------------------------"
		gw=$(su -s /bin/bash -c "cat ~/.beame_server/creds/creds.json" "$BEAME_GATEKEEPER_USER" | jq .GatewayServer.fqdn -r)
		echo "Gatekeeper URL: https://$gw"
		echo "-----------------------------------------------------------------------------------"
		;;
	admin)
		echo "+ Getting admin URL"
		su -s /bin/bash -c "'$BEAME_GATEKEEPER_NODEJS_BIN' '$BEAME_GATEKEEPER_BIN' creds admin" "$BEAME_GATEKEEPER_USER"
		;;
	name)
		if [[ ! ${2-} ]];then
			echo "ERROR: you must provide service name as command line argument"
			exit 1
		fi
		echo "+ Setting service name: $2"
		su -s /bin/bash -c "'$BEAME_GATEKEEPER_NODEJS_BIN' '$BEAME_GATEKEEPER_BIN' config setName --name $2" "$BEAME_GATEKEEPER_USER"
		echo "+ Restarting the service"
		service "$BEAME_GATEKEEPER_SVC" restart
		;;
	delete-systemd-service)
		# https://superuser.com/questions/513159/how-to-remove-systemd-services
		$0 stop
		systemctl disable "$BEAME_GATEKEEPER_SVC"
		rm "$BEAME_GATEKEEPER_SYSTEMD_FILE"
		# remove symlinks???
		systemctl daemon-reload
		systemctl reset-failed
		echo "OK"
		;;
	delete-all)
		if $0 delete-systemd-service;then
			echo "+ Removed systemd service."
		else
			echo "+ Failed to remove the service. Ignoring and continuing"
		fi
		if [[ -e "$BEAME_GATEKEEPER_USER_HOMEDIR" ]];then
			echo "+ Removing home directory $BEAME_GATEKEEPER_USER_HOMEDIR"
			rm -rf "$BEAME_GATEKEEPER_USER_HOMEDIR"
		fi
		if id -u "$BEAME_GATEKEEPER_USER" &>/dev/null;then
			echo "+ Removing user $BEAME_GATEKEEPER_USER"
			userdel "$BEAME_GATEKEEPER_USER"
		else
			echo "+ User $BEAME_GATEKEEPER_USER does not exist"
		fi
		echo "OK"
		;;
esac
