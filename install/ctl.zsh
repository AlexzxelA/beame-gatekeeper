#!/usr/bin/env zsh

set -eu

TRAPZERR () {
	echo "ERROR: Beame Gatekeeper launchd setup failed"
}

if [[ $EUID -ne 0 ]]; then
   echo "Please run this script as root."
   exit 1
fi

: ${BEAME_GATEKEEPER_USER:=_beame-gatekeeper}
: ${BEAME_GATEKEEPER_DIR:=${0:A:h:h}}
: ${BEAME_GATEKEEPER_EMBEDED_SDK:="$BEAME_GATEKEEPER_DIR/node_modules/beame-sdk/src/cli/beame.js"}
: ${BEAME_GATEKEEPER_BIN:="$BEAME_GATEKEEPER_DIR/main.js"}
: ${BEAME_GATEKEEPER_USER_HOMEDIR:="$(dscl . read "/Users/$BEAME_GATEKEEPER_USER" NFSHomeDirectory 2>/dev/null | awk '{print $2}' || true)"}
: ${BEAME_GATEKEEPER_LAUNCHD_PLIST:="/Library/LaunchDaemons/io.beame.gatekeeper.plist"}

if type node &>/dev/null;then
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
	echo "$0 delete-launchd-service"
	echo "  Deletes launchd service (io.beame.gatekeeper)"
	echo ""
	echo "$0 delete-all"
	if [[ $BEAME_GATEKEEPER_USER_HOMEDIR ]];then
		echo "  Deletes home directory ($BEAME_GATEKEEPER_USER_HOMEDIR)"
	fi
	echo "  Deletes user $BEAME_GATEKEEPER_USER (if exists)."
	exit 1
fi

BEAME_GATEKEEPER_LAUNCHD_PLIST="/Library/LaunchDaemons/io.beame.gatekeeper.plist"

case "$1" in
	start)
		echo "+ Starting the service"
		launchctl load "$BEAME_GATEKEEPER_LAUNCHD_PLIST"
		echo "OK"
		;;
	stop)
		echo "+ Stopping the service"
		launchctl unload "$BEAME_GATEKEEPER_LAUNCHD_PLIST"
		echo "OK"
		;;
	restart)
		$0 stop
		$0 start
		;;
	status)
		pid=$(launchctl list | awk '$3 == "io.beame.gatekeeper" {print $1}')
		if [[ -z "$pid" ]];then
			echo "+ Beame Gatekeeper is not running. Service is not registered."
			exit 1
		fi
		if [[ $pid == - ]];then
			echo "+ Beame Gatekeeper is not running. Service is stopped."
			exit 1
		fi
		echo "+ Beame Gatekeeper is running. PID: $pid"
		;;
	info)
		echo "+ Getting info"
		if ! type jq &>/dev/null;then
			echo "+ jq not found. Please install jq."
		fi
		echo "--- Most important configuration --------------------------------------------------"
		gw=$(SHELL=/bin/zsh sudo -H -u "$BEAME_GATEKEEPER_USER" -s "cat ~/.beame_server/creds/creds.json" | jq .GatewayServer.fqdn -r)
		echo "Gatekeeper URL: https://$gw"
		echo "-----------------------------------------------------------------------------------"
		;;
	admin)
		echo "+ Getting admin URL"
		SHELL=/bin/zsh sudo -H -u "$BEAME_GATEKEEPER_USER" -s "'$BEAME_GATEKEEPER_NODEJS_BIN' '$BEAME_GATEKEEPER_BIN' creds admin"
		;;
	name)
		if [[ ! ${2-} ]];then
			echo "ERROR: you must provide service name as command line argument"
			exit 1
		fi
		echo "+ Setting service name: $2"
		SHELL=/bin/zsh sudo -H -u "$BEAME_GATEKEEPER_USER" -s "'$BEAME_GATEKEEPER_NODEJS_BIN' '$BEAME_GATEKEEPER_BIN' config setName --name '$2'"
		$0 restart
		;;
	delete-launchd-service)
		$0 stop
		if [[ -e "$BEAME_GATEKEEPER_LAUNCHD_PLIST" ]];then
			rm "$BEAME_GATEKEEPER_LAUNCHD_PLIST"
		fi
		echo "OK"
		;;
	delete-all)
		if $0 delete-launchd-service;then
			echo "+ Removed launchd service."
		else
			echo "+ Failed to remove the service. Ignoring and continuing"
		fi
		if [[ "$BEAME_GATEKEEPER_USER_HOMEDIR" ]];then
			if [[ -e "$BEAME_GATEKEEPER_USER_HOMEDIR" ]];then
				echo "+ Removing home directory $BEAME_GATEKEEPER_USER_HOMEDIR"
				rm -rf "$BEAME_GATEKEEPER_USER_HOMEDIR"
				echo "OK"
			fi
		fi

		if dscl . read "/Users/$BEAME_GATEKEEPER_USER" &>/dev/null;then
			echo "+ Removing user $BEAME_GATEKEEPER_USER"
			dscl . -delete "/Users/$BEAME_GATEKEEPER_USER"
		else
			echo "+ User $BEAME_GATEKEEPER_USER does not exist"
		fi
		echo "OK"
		;;
esac
