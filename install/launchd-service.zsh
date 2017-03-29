#!/usr/bin/env zsh

set -eu

err_trap_func() {
	echo "ERROR: Command failed"
}

find_unused_id() {
	typeset -A ids
	for id in $("$@" | awk '{print $2}');do
		ids[$id]=1
	done
	for ((candidate_id=500; candidate_id>0; candidate_id--));do
		if [[ ! ${ids[$candidate_id]-} ]];then
			echo $candidate_id
			return
		fi
	done
	echo "Could not find free ID in output of command: $@" >&2
	exit 1
}

trap err_trap_func ERR

if [[ $EUID -ne 0 ]]; then
   echo "Please run this script as root."
   exit 1
fi

: ${BEAME_GATEKEEPER_USER:=_beame-gatekeeper}
: ${BEAME_GATEKEEPER_GROUP:="$BEAME_GATEKEEPER_USER"}
: ${BEAME_GATEKEEPER_SVC:=beame-gatekeeper}
: ${BEAME_GATEKEEPER_SYSTEMD_FILE:="/etc/systemd/system/$BEAME_GATEKEEPER_SVC.service"}
: ${BEAME_GATEKEEPER_SYSTEMD_EXTRA:=''}
: ${BEAME_GATEKEEPER_DIR:=${0:A:h:h}}
: ${BEAME_GATEKEEPER_EMBEDED_SDK:="$BEAME_GATEKEEPER_DIR/node_modules/beame-sdk/src/cli/beame.js"}
: ${BEAME_GATEKEEPER_BIN:="$BEAME_GATEKEEPER_DIR/main.js"}

if type node;then
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

if ! type jq &>/dev/null;then
	echo "+ jq not found. Please install jq."
fi

if dscl . -read "/Groups/$BEAME_GATEKEEPER_GROUP" &>/dev/null;then
	echo "+ Group $BEAME_GATEKEEPER_GROUP already exists"
else
	echo "+ Adding group for Beame Gatekeeper: $BEAME_GATEKEEPER_GROUP"
	gid=$(find_unused_id dscl /Local/Default -ls Groups gid)
	base_argv=(dscl . -create "/Groups/$BEAME_GATEKEEPER_GROUP")
	"${base_argv[@]}"
	"${base_argv[@]}" Password '*'
	"${base_argv[@]}" PrimaryGroupID "$gid"
	"${base_argv[@]}" RealName "Beame Gatekeeper"
	"${base_argv[@]}" RecordName "$BEAME_GATEKEEPER_GROUP" "${BEAME_GATEKEEPER_GROUP/_/}"
fi

if dscl . -read "/Users/$BEAME_GATEKEEPER_USER" &>/dev/null;then
	echo "+ User $BEAME_GATEKEEPER_USER already exists"
else
	echo "+ Adding user for Beame Gatekeeper: $BEAME_GATEKEEPER_USER"
fi

