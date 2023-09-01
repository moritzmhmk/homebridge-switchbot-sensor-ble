import {
  AccessoryConfig,
  AccessoryPlugin,
  API,
  Characteristic,
  HAP,
  Logging,
  Service,
} from "homebridge";

import noble from "@abandonware/noble";

export = (api: API) => {
  noble.on("stateChange", async (state) => {
    if (state === "poweredOn") {
      await noble.startScanningAsync([], true);
    }
  });
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

  private readonly statusLowBattery: Characteristic;
  private readonly batteryLevel: Characteristic;
  private readonly currentTemperature: Characteristic;
  private readonly currentRelativeHumidity: Characteristic;

  private offlineTimeout?: NodeJS.Timeout;

  constructor(log: Logging, config: AccessoryConfig, { hap }: API) {
    this.hap = hap;
    this.log = log;
    this.address = config.address;
    this.timeout = config.timeout || 5 * 60;

    this.informationService = new hap.Service.AccessoryInformation()
      .setCharacteristic(hap.Characteristic.Manufacturer, "SwitchBot")
      .setCharacteristic(hap.Characteristic.Model, "W3400010");

    this.batteryService = new hap.Service.Battery("Battery");
    this.statusLowBattery = this.batteryService.getCharacteristic(
      hap.Characteristic.StatusLowBattery
    );
    this.batteryLevel = this.batteryService.getCharacteristic(
      hap.Characteristic.BatteryLevel
    );

    this.temperatureSensorService = new hap.Service.TemperatureSensor(
      "Temperature"
    );
    this.currentTemperature = this.temperatureSensorService.getCharacteristic(
      hap.Characteristic.CurrentTemperature
    );

    this.humiditySensorService = new hap.Service.HumiditySensor("Humidity");
    this.currentRelativeHumidity = this.humiditySensorService.getCharacteristic(
      hap.Characteristic.CurrentRelativeHumidity
    );

    noble.on("discover", async (peripheral) => {
      if (peripheral.address !== this.address) return;

      this.resetOfflineTimeout();

      const data = peripheral.advertisement.manufacturerData;
      // https://github.com/OpenWonderLabs/SwitchBotAPI-BLE/blob/latest/devicetypes/meter.md#outdoor-temperaturehumidity-sensor
      const temperature =
        ((data[10] & 0x0f) * 0.1 + (data[11] & 0x7f)) *
        ((data[11] & 0x80) > 0 ? 1 : -1);
      const humidity = data[12] & 0x7f;

      const serviceData = peripheral.advertisement.serviceData[0];
      const batteryLevel = serviceData.data[2] & 0x7f; // this is undocumented?

      this.log.debug(
        `Received data: ${temperature}°C, ${humidity}% rel. Hum., ${batteryLevel}% Bat.`
      );

      this.currentTemperature.updateValue(temperature);
      this.currentRelativeHumidity.updateValue(humidity);
      this.statusLowBattery.updateValue(
        batteryLevel < 15
          ? hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW
          : hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL
      );
      this.batteryLevel.updateValue(batteryLevel);
    });

    log.info("SwitchBotSensorBLE finished initializing!");
  }

  getServices(): Service[] {
    return [
      this.informationService,
      this.batteryService,
      this.temperatureSensorService,
      this.humiditySensorService,
    ];
  }

  resetOfflineTimeout(): void {
    clearTimeout(this.offlineTimeout);
    this.offlineTimeout = setTimeout(() => {
      this.log.warn(
        `Received no message for ${this.timeout} seconds - device offline.`
      );
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
