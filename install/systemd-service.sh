#!/bin/bash

# first user gets this script using curl and execuites it. we create a new user, with name beame-gatekeepr.
# then we check if the current system user alrady has credentials, and if not instruct the user to the website, read token from stdin, 
# recive credentials, (beame.js creds getCreds --regToken), to set up L0, and then execute all the commands under the new user with this token.
# 
#

set -eu
set -x

err_trap_func() {
	echo "ERROR: Installation failed"
}

trap err_trap_func ERR

if [[ $EUID -ne 0 ]]; then
   echo "Installation failed" 
   echo "Please run this script as root" 
   exit 1
fi

returnCleanFolder() {
   return "rm -rf .beame_"
}

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

: ${BEAME_GATEKEEPER_USER:=beame-gatekeeper}
: ${BEAME_GATEKEEPER_SVC:=beame-gatekeeper}
: ${BEAME_GATEKEEPER_NODEJS_BIN:=$(which nodejs)}
: ${BEAME_GATEKEEPER_SYSTEMD_FILE:="/etc/systemd/system/$BEAME_GATEKEEPER_SVC.service"}
: ${BEAME_GATEKEEPER_SYSTEMD_EXTRA:=''}
: ${BEAME_GATEKEEPER_DIR:="$(dirname "$SCRIPT_DIR")"}
: ${BEAME_GATEKEEPER_EMBEDED_SDK:="$BEAME_GATEKEEPER_DIR/node_modules/beame-sdk/src/cli/beame.js"}
: ${BEAME_GATEKEEPER_MAIN_EXECUTABLE:="$BEAME_GATEKEEPER_DIR/main.js"}
: ${BEAME_GATEKEEPER_USER_HOMEDIR:="$(getent passwd "$BEAME_GATEKEEPER_USER"| cut -d: -f6 )"};

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
#echo "$1";
if [ "$#" -ne "0" ]; then
	if [ "$1" = 'wipeConfig' ]; then
	  echo "current content of the folder is " $(sudo -u "$BEAME_GATEKEEPER_USER" ls "$BEAME_GATEKEEPER_USER_HOMEDIR"/.beame_*)
	  sudo -u "$BEAME_GATEKEEPER_USER" rm -rf "$BEAME_GATEKEEPER_USER_HOMEDIR"/.beame_*
	  echo "after delettion" $(sudo -u "$BEAME_GATEKEEPER_USER" ls "$BEAME_GATEKEEPER_USER_HOMEDIR"/.beame_*)
	  exit 0;
	fi 

	if [ "$1" = 'wipeCreds' ]; then
	  echo "deleting credentials folder " $(sudo -u "$BEAME_GATEKEEPER_USER" rm -rf "$BEAME_GATEKEEPER_USER_HOMEDIR"/.beame/*)
	  echo "hope thats what you wanted (:-"
	  exit 0;
	fi


	if [ "$1" = 'getAdminToken' ]; then
	  #  failed to understand the command needed to generare the admin creds. the cli needs alot of help -(;
	  echo $(sudo -u "$BEAME_GATEKEEPER_USER" "$BEAME_GATEKEEPER_MAIN_EXECUTABLE" creds getCreds ) 
	  exit 0;
	fi
	if [ "$1" = 'getWebApiToken' ]; then
	  #  failed to understand the command needed to generare the admin creds. the cli needs alot of help -(;
	  echo $(sudo -u "$BEAME_GATEKEEPER_USER" "$BEAME_GATEKEEPER_MAIN_EXECUTABLE" creds getCreds ) 
	  exit 0;
	fi
	
fi



echo "*******************"
echo "$BEAME_GATEKEEPER_NODEJS_BIN" "$BEAME_GATEKEEPER_EMBEDED_SDK"

setRootFqdn() {
	ROOT_CREDENENTIALS=$("$BEAME_GATEKEEPER_NODEJS_BIN" "$BEAME_GATEKEEPER_EMBEDED_SDK" creds list --format json | jq -r '.[].metadata.fqdn' | grep -E '^.{16}.v1.p.beameio.net' | grep -v '^$' | head -n 1)
	echo "$ROOT_CREDENENTIALS"
}

# ROOT_CREDENENTIALS=$("$BEAME_GATEKEEPER_NODEJS_BIN" "$BEAME_GATEKEEPER_EMBEDED_SDK" creds list --format json | jq -r '.[].metadata.fqdn')

setRootFqdn



if [[ "$ROOT_CREDENENTIALS" = *[!\ ]* ]]; then
    echo "L0 credentials found " "$ROOT_CREDENENTIALS"
    l0present=true;
    
else
    echo "root credentials not found"
    echo "Please got to https://ypxf72akb6onjvrq.ohkv8odznwh5jpwm.v1.p.beameio.net/ and complete your registration proccess..."
    echo "Please enter token from your email"
    read token
    "$BEAME_GATEKEEPER_NODEJS_BIN" "$BEAME_GATEKEEPER_EMBEDED_SDK" creds getCreds --token $token
    setRootFqdn
    l0present=true 
fi

if "$l0present"; then
  token=$("$BEAME_GATEKEEPER_NODEJS_BIN" "$BEAME_GATEKEEPER_EMBEDED_SDK" creds getRegToken --fqdn "$ROOT_CREDENENTIALS" --name "Gatekeeper-"$HOSTNAME);
  sudo -u "$BEAME_GATEKEEPER_USER" "$BEAME_GATEKEEPER_MAIN_EXECUTABLE" creds getCreds --regToken $token
  echo $token;
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
echo "+ Starting service "
service "BEAME_GATEKEEPER_SVC" start

