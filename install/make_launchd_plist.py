#!/usr/bin/env python

import sys

from plistlib import writePlist

user, group, dir_, nodejs_bin = sys.argv[1:]

svc = {
    'Label': 'io.beame.gatekeeper',
    'UserName': user,
    'GroupName': group,
    'WorkingDirectory': dir_,
    'ProgramArguments': [dir_ + '/launchd-wrapper.zsh', nodejs_bin, 'main.js', 'server', 'start'],
    'ThrottleInterval': 10,
    'KeepAlive': True,
    'EnvironmentVariables': {
        'NODE_ENV': 'production'
    }
}

writePlist(svc, sys.stdout)
