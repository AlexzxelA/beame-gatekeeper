<img align="right" src="img/beame.png">

# Beame Gatekeeper

## What is Beame Gatekeeper?

Beame-Gatekeeper is a framework that provides services/tools:
* To create and manage X.509 digital certificates in public domain
* HTTPS tunnels to expose applications running on local network to global internet 
* Crypto library to create/manage keys, encrypt/decrypt sign/verify data, create/validate authentication tokens
* X.509 based identity manager for custom MFA
* SSO SAML Identity Provider (IDP)
* User management (invite/create/delete user) with trust-groups capability
* Administrating tools for full Gatekeeper managemnt (html-based console)

Here's a typical usecase for the Gatekeeper (Web-camera connected on local network is accessed from arbitrary laptop through Browser, with mobile authentication & control):

![Use-case](https://raw.githubusercontent.com/beameio/beame-gatekeeper/dev/img/IoT.png)

How is it different? We created a new breed of ID - _cryptographic identity_ that lives on a mobile ([get Beame Authenticator to your iOS device](https://itunes.apple.com/il/app/beame-authenticator/id1214704177?mt=8)). Now it's easy to put a super-secure cryptographic identity on mobile and IoT devices. So the device can prove your identity by providing proof of possession of a secret key through the Gatekeeper framework. Keys created and stored on target. The Gatekeeper does not hold databases with sensitive data.

_Click on the link below, to see Beame Gatekeeper demo on Youtube_  
[![Alt Beame Gatekeeper demo #1](https://raw.githubusercontent.com/beameio/beame-gatekeeper/dev/img/GKdemo.png)](https://www.youtube.com/watch?v=K_XNFKzJV_M)

[More details (PDF)](doc/beame-gatekeeper.pdf) - The purpose of this paper is to describe the particular beame-gatekeeper use case as a tool for remote access to enterprise networks or IoT devices with mobile authentication. It provides an overview of possible product integration options. The document contains technical overview and description of provisioning and login processes.

[User guide (PDF)](http://htmlpreview.github.io/?https://github.com/beameio/beame-gatekeeper/blob/dev/doc/GKoperationManual/BeameGatekeeperManual.html) - how to operate the Gatekeeper.

Continue with instructions below, to get your own Gatekeeper. Install it as a system service to keep your applications accessible. Or, if you want to just try it out first, install it as a standalone application. Go with the guide and in fast and easy process your Gatekeeper will be up and running.  

## Installing Beame Gatekeeper

* [Installing Beame Gatekeeper on Linux, Mac OS or Raspberry Pi](doc/install-unix.md)
* [Installing Beame Gatekeeper on Windows](doc/install-windows.md)

## Managing StrongSwan VPN using Beame Gatekeeper

[Managing StrongSwan VPN using Beame Gatekeeper](doc/strongswan.md)

## What to do next?

Please read [User guide (PDF)](https://www.beame.io/pdf/Beame+Gatekeeper+Technical+Presentation.pdf). It describes what and how you can do with Beame-Gatekeeper.


## Beame Gatekeeper environment variables

* `BEAME_GATEKEEPER_DIR` -  defines the base directory relative to which beame-gatekeeper files should be stored, default `os.homedir()`
* `BEAME_SERVER_FOLDER`  - name of beame-gatekeeper config folder , default .beame_server
* `BEAME_DATA_FOLDER`  - name of beame-gatekeeper data folder , default .beame_data
* `BEAME_AUTH_SERVER_PORT` - auth server local port, default 65000
* `BEAME_DISABLE_DEMO_SERVERS` - disable demo apps on server start, default false
* `BEAME_OCSP_CACHE_PERIOD` - OCSP result cashing period , default 24 hours

