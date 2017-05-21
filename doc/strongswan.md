# Managing StrongSwan VPN using Beame Gatekeeper

## Configuring VPN in Beame Gatekeeper

This section assumes that you have [installed Beame Gatekeeper](../README.md) and are able to access its administration console. 

* Go to the "Creds" tab and create a credential
* Go to the "VPN" tab and mark the created credential as "VPN root" and name the VPN.
* Take note of VPN name and the VPN root FQDN, you will need these later.

## StrongSwan VPN plugin setup

The following steps should be performed after Beame Gatekeeper is installed and VPN is defined in its web interface. VPN ID and FQDN from the web interface are needed to configure the cron job that synchronizes credentials from Beame Gatekeeper to StrongSwan configuration.

### StrongSwan

	sudo apt-get -y install strongswan

### NGS

Using StrongSwan plugin of Beame Gatekeeper requires [NGS](https://github.com/ilyash/ngs) to be installed, as the [script that updates StrongSwan](plugins/strongswan/update-strongswan-config.ngs) configuration is written in NGS. For your convenience, here are the instructions to install NGS on Debian Jessie (8), Debian Stretch (9) and Ubuntu Xenial (16.04). Run as root:

	apt update

	# For Ubuntu only - start
	apt install -y software-properties-common wget
	# WARNING: You might want to update /etc/apt/sources.list yourself instead of the next command.
	#          Make sure you have "universe" listed.
	add-apt-repository "deb http://archive.ubuntu.com/ubuntu $(lsb_release -sc) main universe"
	apt update
	# For Ubuntu only - end

	apt install -y uthash-dev libgc-dev libffi6 libffi-dev libjson-c-dev peg libpcre3-dev pandoc make cmake pkg-config build-essential
	wget https://github.com/ilyash/ngs/archive/v0.1.0.tar.gz
	tar xzf v0.1.0.tar.gz
	cd ngs-0.1.0
	mkdir build
	cd build
	cmake .. && make && ctest && make install

### Cron job

The script that updates StrongSwan should run each minute, from cron. Suggested layout is to place the following cron configuration in `/etc/cron.d/gatekeeper-strongswan`:

	SHELL=/bin/bash
	PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/opt/beame/insta-server
	* * * * * root /FULL/PATH/TO/GATEKEEPER/plugins/strongswan/update-strongswan-config.ngs VPN_FQDN_HERE VPN_ID_HERE 2>&1 | logger -t update-strongswan

Full path to Beame Gatekeeper is typically `/usr/local/lib/node_modules/beame-gatekeeper`.

### StrongSwan configuration files

* Using `/FULL/PATH/TO/GATEKEEPER/plugins/strongswan/example-etc-ipsec.conf` as an example, configure your `/etc/ipsec.conf`. The example configuration is usable as it is but you probably would like to customize it.  
* Using `/FULL/PATH/TO/GATEKEEPER/plugins/strongswan/example-etc-ipsec.conf.gatekeeper.template` as an example, configure `/etc/ipsec.conf.gatekeeper.template`. Again, the example configuration is usable as it is but you probably would like to customize it.

