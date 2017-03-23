(WORK IN PROGRESS)

# Core ideas behind Beame products

This tiny introduction to the way Beame thinks will help you understand our products better.

* We think that unencrypted and unauthenticated communications have no place in today's world except for very few specific cases.
* [X.509 certificates](https://en.wikipedia.org/wiki/X.509) are good and can solve the problem. It's the same type of certificates that prove you are surfing to Google or Facebook. These certificates are world-wide standard and can potentially be used in many situations where parties should be authenticated and communications encrypted.
* X.509 certificates are not used widely enough for two reasons:
	* *Pricing.* The pricing of about $10 per year. If you have 1000 employees or 5 million clients to authenticate that's a significant cost.
	* *X.509 usage convenience.* X.509 certificate are currently inconvenient to use except for few specific scenarios such as a web server with internet-routable address.
* Beame addresses both issues:
	* *Pricing.* We sell certificates for $1.5 per certificate per year (talk to us if you need high volume).
	* *X.509 usage convenience.* Since we sell certificates, it's mutually beneficial that it would be convenient for you to use them. We build products that simplify X.509 acquisition and usage.


# Beame Gatekeeper

Beame Gatekeeper provides authentication. Users and/or clients are authenticated using X.509 certificates on their mobile device.

# Beame Gatekeeper use cases

## Use case: Remote access for your employees

### Background

You have your corporate web application in your office and it's available for your employees when they are connected to the corporate network. Maybe you have a VPN for your employees so they could access your corporate website remotely.

### Problems

* Your LAN is not really secure. Google don't assume their network is secure and neither should you. "Google sees little distinction between board rooms and bars, cubicles and coffee shops; all are untrusted under its perimeter-less security model detailed in a paper published this week." -- The Register, April 2016. (The paper)[https://static.googleusercontent.com/media/research.google.com/en//pubs/archive/44860.pdf]
* VPN is not convenient for the users
* VPN has high TCO

### How Beame Gatekeeper solves remote access?

* Authenticate your employees using X.509 certificates on their mobile devices.
* Securely route traffic to your corporate web using Beame infrastructure. No firewall configuration is needed on your side.

## Use case: Crypto-ID for your clients
