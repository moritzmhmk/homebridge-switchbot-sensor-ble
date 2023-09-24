# Homebridge plugin for SwitchBot Hygrometer.

[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)

This plugin provides a simple accessory-style plugin.

## Device support

- Switchbot Thermometer and Hygrometer - also known as "MeterTH" or "WoSensorTH"
- Switchbot Indoor/Outdoor Thermo-Hygrometer (Model W3400010) - also known as "WoSensorTHO" or "WoIOSensorTH"

I would be happy to add support for further SwitchBot Hygrometer models with the support of someone who owns the relevant sensors. I do not plan to support other types of SwitchBot devices.

## Setup

The MAC address of the sensor is required for setup. This can be found in the SwitchBot app or with a generic Bluetooth LE scanner app.

## Why yet another SwitchBot plugin?

This plugin is written according to the philosophy of doing only one thing but doing it well and having as few dependencies as reasonably possible.

### Background

When trying to get my SwitchBot sensor to work on a Raspberry Pi 4 with Docker, I kept getting the error `Adapter is not ready: unknown`, while other (non switchbot) BLE devices in the setup worked fine. Tracking down the error, I found that the `node-switchbot` library used by the other plugins was causing the error. Looking into creating a PR for `node-switchbot`, I found that it is easier to create a new plugin from scratch that only handles the device in question and does not rely on dependencies (besides noble).

Note: After further research, I created PRs [here](https://github.com/OpenWonderLabs/node-switchbot/pull/199), [here](https://github.com/OpenWonderLabs/node-switchbot/pull/200) and [here](https://github.com/OpenWonderLabs/homebridge-switchbot/pull/814) to fix the bugs I mentioned. I am still of the opinion that a plugin that only supports sensors and only implements communication via BLE has the advantage of cleaner and easier to maintain code. Thus, this plugin remains an alternative for those who do not need the additional functions of the larger plugins.
