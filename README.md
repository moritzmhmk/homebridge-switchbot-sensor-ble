# Homebridge plugin for SwitchBot Hygrometer.

This plugin provides a simple accessory-style plugin.

## Device support

- Switchbot Indoor/Outdoor Thermo-Hygrometer (Model W3400010) - also known as "WoSensorTHO" or "WoIOSensorTH"

The device specific code is rather short, so that adding support for the other switchbot Thermo-/Hygrometer models should be straight forward:
```typescript
// code to get noble to scan devices and receive advertisement data is omitted

const data = advertisement.manufacturerData;
const temperature = ((data[10] & 0x0f) * 0.1 + (data[11] & 0x7f)) * ((data[11] & 0x80) > 0 ? 1 : -1);
const humidity = data[12] & 0x7f;

const serviceData = advertisement.serviceData[0];
const batteryLevel = serviceData.data[2] & 0x7f; // this is undocumented?

console.log(`Received data: ${temperature}°C, ${humidity}% rel. Hum., ${batteryLevel}% Bat.`);
```

I would be happy to make this plugin into a generic "SwitchBot Thermo-/Hygrometer BLE" plugin with the support of someone who owns the other relevant sensors. I do not plan to support other types of SwitchBot devices.

## Setup

The MAC address of the sensor is required for setup. This can be found in the SwitchBot app or with a generic Bluetooth LE scanner app.

## Why yet another SwitchBot plugin?

When trying to get my SwitchBot sensor to work on a Raspberry Pi 4 with Docker, I kept getting the error `Adapter is not ready: unknown`, while other (non switchbot) BLE devices in the setup worked fine. Tracking down the error, I found that the `node-switchbot` library used by the other plugins was causing the error. Looking into creating a PR for `node-switchbot`, I found that it is easier to create a new plugin from scratch that only handles the device in question and does not rely on dependencies (besides noble).

So, unlike the other alternatives, this plugin is written according to the philosophy of doing only one thing but doing it well and having as few dependencies as reasonably possible.

