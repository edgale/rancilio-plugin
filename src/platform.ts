import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';
import Bonjour from 'bonjour';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { HomebridgeEsp8266RancilioAccessory } from './platformAccessory';

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class HomebridgeEsp8266RancilioPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.api.on('didFinishLaunching', () => {
      // run the method to discover / register your devices as accessories
      this.discoverDevices();
    });
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    // add the restored accessory to the accessories cache so we can track if it has already been registered
    this.accessories.push(accessory);
  }

  discoverDevices() {
    const bonjour = Bonjour();
    const browser = bonjour.find({ type: 'oznu-platform' });

    browser.on('up', this.foundAccessory.bind(this));

    // Check bonjour again 5 seconds after launch
    setTimeout(() => {
      browser.update();
    }, 5000);

    // Check bonjour every 60 seconds
    setInterval(() => {
      browser.update();
    }, 60000);
  }

  foundAccessory(service) {
    if (service.txt.type && service.txt.type === 'rancilio') {
      const UUID = this.api.hap.uuid.generate(service.txt.mac);
      const host = service.host;
      const accessoryConfig = { host, port: service.port, name: service.name, serial: service.txt.mac };

      // check if it already exists
      const existingAccessory = this.accessories.find(x => x.UUID === UUID);

      if (existingAccessory) {
        // Existing Accessory
        this.log.info(`Found existing Rancilio at ${service.host}:${service.port} [${service.txt.mac}]`);
        new HomebridgeEsp8266RancilioAccessory(this, existingAccessory, accessoryConfig);
      } else {
        // New Accessory
        this.log.info(`Found new Rancilio at ${service.host}:${service.port} [${service.txt.mac}]`);
        const accessory = new this.api.platformAccessory(accessoryConfig.name, UUID);
        new HomebridgeEsp8266RancilioAccessory(this, accessory, accessoryConfig);
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }
    }
  }
}
