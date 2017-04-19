<img align="right" src="img/beame.png">

# Beame Gatekeeper

## What is Beame Gatekeeper?

beame-gatekeeper allows remote authenticated access to systems using your mobile device as primary ID or secondary authentication factor.

This instantly makes on-premises software products accessible by adding HTTPS server functionality. There is no need for firewalls, nor DNS configuration.

How? We made a new breed of ID - cryptographic identity that lives on your mobile. And it's easy to put a super-secure cryptographic identity on mobile and IoT devices. We never hold any of your keys. So now the device can prove it has the right credentials without revealing them. No more sensitive databases.

[More details (PDF)](doc/beame-gatekeeper.pdf) - "The purpose of this paper is to describe the particular beame-gatekeeper use case as a tool for remote access to enterprise networks or IoT devices with mobile authentication. It provides an overview of possible product integration options". The document contains technical overview and description of provisioning and login processes.

[User guide (PDF)](https://www.beame.io/pdf/Beame+Gatekeeper+Technical+Presentation.pdf) - what you can do with Beame Gatekeeper and how.

## Get started in three quick steps!

Step 1: Sign up super-fast [here!](https://ypxf72akb6onjvrq.ohkv8odznwh5jpwm.v1.p.beameio.net/gatekeeper)

(if you use Windows, see [Windows System Requirements](#Windows System Requirements) below before Step 2)

Step 2 for Mac/Linux: Run `sudo npm install -g beame-gatekeeper` (**please make sure you are using NodeJS 6, version 6.9.X or newer**). Depending on your configuration you might want to run `npm install -g beame-gatekeeper` instead (if you are using [`n`](https://github.com/tj/n) or other methods for creating per-user NodejS installations).

Step 2 for Windows: Run `npm install -g beame-gatekeeper` (**please make sure you are using NodeJS 6, version 6.9.X or newer**).

Step 3: Run the command in the sign up confirmation email you just got from us. beame-gatekeeper will obtain your very own beame hostname, and issue a valid public certificate for it.

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

## What to do next?

Please read [User guide (PDF)](https://www.beame.io/pdf/Beame+Gatekeeper+Technical+Presentation.pdf). It describes what and how you can do with Beame-Gatekeeper.
