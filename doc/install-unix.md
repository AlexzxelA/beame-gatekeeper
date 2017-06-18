<img align="right" src="../img/beame.png">

# Installing Beame Gatekeeper on Linux/Mac

## Install Beame Gatekeeper

**Please make sure you are using NodeJS 6, version 6.9.X or newer**

    sudo npm install -g beame-gatekeeper

Alternatively, depending on your configuration (if you are using [`n`](https://github.com/tj/n) or other methods for creating per-user NodejS installations) you might want to run the following command:

    npm install -g beame-gatekeeper

## Sign up

[Sign up](https://ypxf72akb6onjvrq.ohkv8odznwh5jpwm.v1.p.beameio.net/gatekeeper). You don't have to wait for the installation from previous step to complete.

## Complete installation - get credentials

Run the command in the sign up confirmation email you just got from Beame. beame-gatekeeper will obtain your very own beame hostname, and issue a valid public certificate for it.

The certificate will be ready in moments and you can start using your tunnel right away. Truly a one-stop-shop!

## Solving the GPIO access denied issue on Raspbian 

    sudo usermod -a -G gpio beame-gatekeeper
