<img align="right" src="img/beame.png">

# Beame Gatekeeper

## What is Beame Gatekeeper?

beame-gatekeeper allows remote authenticated access to systems using your mobile device as primary ID or secondary authentication factor.

This instantly makes on-premises software products accessible through HTTPS tunnels. There is no need for firewalls, nor DNS configuration.

How? We made a new breed of ID - cryptographic identity that lives on your mobile ([get Beame Authenticator to your iOS device](https://itunes.apple.com/il/app/beame-authenticator/id1214704177?mt=8)). Now it's easy to put a super-secure cryptographic identity on mobile and IoT devices. We never see any of your secret keys. So the device can prove your identity by providing proof of possession of a secret key. No more databases with sensitive data.

_Click on the link below, to see Beame Gatekeeper demo on Youtube_  
[![Alt Beame Gatekeeper demo #1](https://github.com/beameio/beame-gatekeeper/blob/dev/img/GKdemo.png)](https://youtu.be/Oxk6GB5iMqw)

[More details (PDF)](doc/beame-gatekeeper.pdf) - The purpose of this paper is to describe the particular beame-gatekeeper use case as a tool for remote access to enterprise networks or IoT devices with mobile authentication. It provides an overview of possible product integration options. The document contains technical overview and description of provisioning and login processes.

[User guide (PDF)](https://www.beame.io/pdf/Beame+Gatekeeper+Technical+Presentation.pdf) - what you can do with Beame Gatekeeper and how.  

Continue with instructions below, to get your own Gatekeeper. Install it as a system service to keep your applications accessible. Or, if you want to just try it out first, install it as a standalone application. Go with the guide and in fast and easy process your Gatekeeper will be up and running.  

## Get started in three quick steps!
(if you use Windows, see [Windows System Requirements](#Windows System Requirements) below before Step 1)

Step 1:
First you must install the gatekeeper nodejs application (it takes some time)

for Mac/Linux: Run `sudo npm install -g beame-gatekeeper` (**please make sure you are using NodeJS 6, version 6.9.X or newer**). Depending on your configuration you might want to run `npm install -g beame-gatekeeper` instead (if you are using [`n`](https://github.com/tj/n) or other methods for creating per-user NodejS installations).

for Windows: Run `npm install -g beame-gatekeeper` (**please make sure you are using NodeJS 6, version 6.9.X or newer**).

Step 2: 
Sign up [here!](https://ypxf72akb6onjvrq.ohkv8odznwh5jpwm.v1.p.beameio.net/gatekeeper), while Step 1 is in process

Step 3: 
Once Steps 1 and 2 are done, run the command in the sign up confirmation email you just got from us. beame-gatekeeper will obtain your very own beame hostname, and issue a valid public certificate for it.

The certificate will be ready in moments and you can start using your tunnel right away. Truly a one-stop-shop!

### Windows System Requirements <a name="Windows System Requirements"></a>

Before running `npm install -g beame-gatekeeper` please make sure you have OpenSSL installed in `C:\OpenSSL-Win64` . If you you already have OpenSSL installed at that location, skip the instructions below and just issue `npm install -g beame-gatekeeper`. If you don't have OpenSSL in `C:\OpenSSL-Win64`, one of the possible ways of installing OpenSSL is described below (Install Visual C++ Build Tools and Python 2.7, Upgrade NPM, Install Perl, Install OpenSSL). The procedure was tested on Microsoft Windows Server 2012 R2 Standard and Windows 10. We recommend using "Windows PowerShell" and running it with administrator rights for the following commands:

#### Install Visual C++ Build Tools and Python 2.7

`npm install --global --production windows-build-tools`. This typically takes 5 to 10 minutes, depending on the internet connection.

#### Upgrade NPM

`npm -g install npm@latest`

#### Install Perl

Perl is needed for building OpenSSL. If you already have Perl installed, please skip the `Install Perl` section.

Get Perl from ActiveState: [installer](https://downloads.activestate.com/ActivePerl/releases/5.24.0.2401/ActivePerl-5.24.0.2401-MSWin32-x64-401627.exe) (SHA256 is `f8fa9800fdb286b9cca98ddbab867ac95a444f4eb8b4616b50347a324305ae3c`)
or another source.

#### Install OpenSSL

Download and extract `https://www.openssl.org/source/openssl-1.0.1t.tar.gz` (other versions might work but were not tested)

Using "Visual C++ 2015 x64 Native Build Tools Command Prompt" under `C:\Program Files (x86)\Microsoft Visual C++ Build Tools\` in the OpenSSL directory issue the following commands:

    perl Configure VC-WIN64A no-asm --prefix=C:\OpenSSL-Win64
    .\ms\do_win64a.bat
	# If the following "clean" fails it's OK, just continue with following commands
    nmake -f ms\ntdll.mak clean
    nmake -f ms\ntdll.mak
    nmake -f ms\ntdll.mak install

    npm install -g beame-gatekeeper

## Managing StrongSwan VPN using Beame Gatekeeper

[Managing StrongSwan VPN using Beame Gatekeeper](doc/strongswan.md)

## What to do next?

Please read [User guide (PDF)](https://www.beame.io/pdf/Beame+Gatekeeper+Technical+Presentation.pdf). It describes what and how you can do with Beame-Gatekeeper.

### How to solve the GPIO access denied issue on Raspbian 

sudo usermod -a -G gpio beame-gatekeeper


## Environment variables

* `BEAME_GATEKEEPER_DIR` -  defines the base directory relative to which beame-gatekeeper files should be stored, default os.homedir() 
* `BEAME_SERVER_FOLDER`  - name of beame-gatekeeper config folder , default .beame_server
* `BEAME_DATA_FOLDER`  - name of beame-gatekeeper data folder , default .beame_data
* `BEAME_AUTH_SERVER_PORT` - auth server local port, default 65000
* `BEAME_DISABLE_DEMO_SERVERS` - disable demo apps on server start, default false
* `BEAME_OCSP_CACHE_PERIOD` - OCSP result cashing period , default 24 hours

