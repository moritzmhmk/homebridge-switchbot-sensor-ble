import type { Advertisement } from "@abandonware/noble";
import {
  AccessoryConfig,
  AccessoryPlugin,
  API,
  HAP,
  Logging,
  Service,
} from "homebridge";

const { version: packageVersion } = require("../package.json");

export = (api: API) => {
  api.registerAccessory("SwitchBotSensorBLE", SwitchBotSensorBLE);
};

class SwitchBotSensorBLE implements AccessoryPlugin {
  private readonly hap: HAP;
  private readonly log: Logging;
  private readonly address: string;
  private readonly timeout: number;

  private readonly informationService: Service;
  private readonly batteryService: Service;
  private readonly temperatureSensorService: Service;
  private readonly humiditySensorService: Service;

  private offlineTimeout?: NodeJS.Timeout;
  private offline = true;

  constructor(log: Logging, config: AccessoryConfig, { hap }: API) {
    this.hap = hap;
    this.log = log;
    this.address = config.address;
    this.timeout = config.timeout || 5 * 60;

    this.informationService = new hap.Service.AccessoryInformation()
      .setCharacteristic(hap.Characteristic.Manufacturer, "SwitchBot")
      .setCharacteristic(hap.Characteristic.Model, "W3400010")
      .setCharacteristic(hap.Characteristic.Name, config.name)
      .setCharacteristic(hap.Characteristic.SerialNumber, this.address)
      .setCharacteristic(hap.Characteristic.FirmwareRevision, packageVersion);

    this.batteryService = new hap.Service.Battery("Battery");
    this.temperatureSensorService = new hap.Service.TemperatureSensor(
      "Temperature"
    );
    this.humiditySensorService = new hap.Service.HumiditySensor("Humidity");

    this.init()
      .then(() => log.info("SwitchBotSensorBLE finished initializing!"))
      .catch((err) => {
        log.error("SwitchBotSensorBLE failed to initialize!");
        log.error(err);
      });
  }

  getServices(): Service[] {
    return [
      this.informationService,
      this.batteryService,
      this.temperatureSensorService,
      this.humiditySensorService,
    ];
  }

  async init() {
    const noble = (await import("@abandonware/noble")).default;

    noble.on("discover", async (peripheral) => {
      if (peripheral.address !== this.address) return;
      this.updateFromAdvertisement(peripheral.advertisement);
    });

    noble.on("stateChange", async (state) => {
      if (state === "poweredOn") {
        await noble.startScanningAsync([], true);
      }
    });
  }

  updateFromAdvertisement(advertisement: Advertisement): void {
    const MD_MIN_LENGTH = 13;
    const SD_MIN_LENGTH = 3;
    const DEVICE_TYPES = [
      "t", // WoSensorTH
      "w", // WoIOSensorTH
    ];

    const md = advertisement.manufacturerData;
    if (!md || !Buffer.isBuffer(md) || md.length < MD_MIN_LENGTH) {
      this.log.warn(`Received invalid manufacturer data for ${this.address}.`);
      return;
    }
    const sd = advertisement.serviceData[0]?.data;
    if (!sd || !Buffer.isBuffer(sd) || sd.length < SD_MIN_LENGTH) {
      // 0x0969 = Woan Technology
      this.log.warn(`Received invalid service data for ${this.address}.`);
      return;
    }

    const companyIdentifier = md.readInt16LE();
    if (companyIdentifier !== 0x0969) {
      // 0x0969 = Woan Technology
      this.log.info(
        `Received unexpected company identifier "${companyIdentifier}" for ${this.address} - will try to decode anyway.`
      );
    }

    const deviceType = String.fromCharCode(sd[0] & 0x7f);
    if (!DEVICE_TYPES.includes(deviceType.toLowerCase())) {
      // 0x0969 = Woan Technology
      this.log.info(
        `Received unexpected device type "${deviceType}" for ${this.address} - will try to decode anyway.`
      );
    }

    const temperature =
      ((md[10] & 0x0f) * 0.1 + (md[11] & 0x7f)) *
      ((md[11] & 0x80) > 0 ? 1 : -1);
    const humidity = md[12] & 0x7f;

    const batteryLevel = sd[2] & 0x7f;

    this.log.debug(
      `Received data: ${temperature}°C, ${humidity}% rel. Hum., ${batteryLevel}% Bat.`
    );

    // when there is currently no timeout the device was offline
    if (this.offline) {
      this.log.info(`Received data, device is now online.`);
      this.offline = false;
    }
    this.resetOfflineTimeout();

    this.temperatureSensorService.updateCharacteristic(
      this.hap.Characteristic.CurrentTemperature,
      temperature
    );
    this.humiditySensorService.updateCharacteristic(
      this.hap.Characteristic.CurrentRelativeHumidity,
      humidity
    );
    this.batteryService.updateCharacteristic(
      this.hap.Characteristic.StatusLowBattery,
      batteryLevel < 15
        ? this.hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW
        : this.hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL
    );
    this.batteryService.updateCharacteristic(
      this.hap.Characteristic.BatteryLevel,
      batteryLevel
    );
  }

  resetOfflineTimeout(): void {
    clearTimeout(this.offlineTimeout);
    this.offlineTimeout = setTimeout(() => {
      this.log.warn(
        `Received no message for ${this.timeout} seconds - device offline.`
      );
      this.offline = true;
      const timeoutError = new this.hap.HapStatusError(
        this.hap.HAPStatus.OPERATION_TIMED_OUT
      );
      this.temperatureSensorService.updateCharacteristic(
        this.hap.Characteristic.CurrentTemperature,
        timeoutError
      );
      this.humiditySensorService.updateCharacteristic(
        this.hap.Characteristic.CurrentRelativeHumidity,
        timeoutError
      );
    }, this.timeout * 1000);
  }
}
