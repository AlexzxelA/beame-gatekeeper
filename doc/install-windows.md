<img align="right" src="../img/beame.png">

# Installing Beame Gatekeeper on Windows

## Install OpenSSL

If you already have OpenSSL installed in `C:\OpenSSL-Win64`, skip the instructions in this section. If you don't have OpenSSL in `C:\OpenSSL-Win64`, one of the possible ways of installing OpenSSL is described below (Install Visual C++ Build Tools and Python 2.7, Upgrade NPM, Install Perl, Install OpenSSL). The procedure was tested on Microsoft Windows Server 2012 R2 Standard and Windows 10. We recommend using "Windows PowerShell" and running it with administrator rights for the following commands:


### Install Visual C++ Build Tools and Python 2.7

This typically takes 5 to 10 minutes, depending on the internet connection.

    npm install --global --production windows-build-tools

### Upgrade NPM

    npm -g install npm@latest

### Install Perl

Perl is needed for building OpenSSL. If you already have Perl installed, please skip the `Install Perl` section.

Get Perl from ActiveState: [installer](https://downloads.activestate.com/ActivePerl/releases/5.24.0.2401/ActivePerl-5.24.0.2401-MSWin32-x64-401627.exe) (SHA256 is `f8fa9800fdb286b9cca98ddbab867ac95a444f4eb8b4616b50347a324305ae3c`)
or another source.

### Install OpenSSL

Download and extract `https://www.openssl.org/source/openssl-1.0.1t.tar.gz` (other versions might work but were not tested)

Using "Visual C++ 2015 x64 Native Build Tools Command Prompt" under `C:\Program Files (x86)\Microsoft Visual C++ Build Tools\` in the OpenSSL directory issue the following commands:

    perl Configure VC-WIN64A no-asm --prefix=C:\OpenSSL-Win64
    .\ms\do_win64a.bat
    # If the following "clean" fails it's OK, just continue with following commands
    nmake -f ms\ntdll.mak clean
    nmake -f ms\ntdll.mak
    nmake -f ms\ntdll.mak install

    npm install -g beame-gatekeeper

## Install Beame Gatekeeper

**Please make sure you are using NodeJS 6, version 6.9.X or newer**

    npm install -g beame-gatekeeper

## Sign up

[Sign up](https://ypxf72akb6onjvrq.ohkv8odznwh5jpwm.v1.p.beameio.net/gatekeeper). You don't have to wait for the installation from previous step to complete.

## Complete installation - get credentials

Run the command in the sign up confirmation email you just got from Beame. beame-gatekeeper will obtain your very own beame hostname, and issue a valid public certificate for it.

The certificate will be ready in moments and you can start using your tunnel right away. Truly a one-stop-shop!
