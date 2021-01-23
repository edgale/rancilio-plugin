import { Service, PlatformAccessory, CharacteristicValue, CharacteristicSetCallback } from 'homebridge';
import { WebSocket } from '@oznu/ws-connect';
import { resolve4 } from 'mdns-resolver';

import { HomebridgeEsp8266RancilioPlatform } from './platform';


interface StatusPayload {
  power?: boolean;
}

export class HomebridgeEsp8266RancilioAccessory {
  private service: Service;
  private socket: WebSocket;

  constructor(
    private readonly platform: HomebridgeEsp8266RancilioPlatform,
    private readonly accessory: PlatformAccessory,
    private readonly config: { host: string; port: number; name: string; serial: string },
  ) {

    this.socket = new WebSocket('', {
      options: {
        handshakeTimeout: 10000,
      },
      beforeConnect: async () => {
        try {
          const hostIp = await resolve4(this.config.host);
          const socketAddress = `ws://${hostIp}:${this.config.port}`;
          this.socket.setAddresss(socketAddress);
        } catch (e) {
          this.platform.log.warn(e.message);
        }
      },
    });

    this.socket.on('websocket-status', (msg) => {
      this.platform.log.info(msg);
    });

    this.socket.on('json', this.parseStatus.bind(this));

    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Name, 'Rancilio')
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'oznu-platform')
      .setCharacteristic(this.platform.Characteristic.Model, 'Rancilio')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, this.config.serial);

    // create service
    this.service = this.accessory.getService(this.platform.Service.Fanv2) || this.accessory.addService(this.platform.Service.Fanv2);

    this.service.getCharacteristic(this.platform.Characteristic.Active)
      .on('set', this.setActive.bind(this))
      .on('get', this.getActive.bind(this));
  }

  // parse events from the garage door controller
  parseStatus(payload: StatusPayload) {
    this.platform.log.debug(JSON.stringify(payload));

    if (payload.power !== undefined) {
      if (payload.power) {
        this.service.updateCharacteristic(this.platform.Characteristic.Active, this.platform.Characteristic.Active.ACTIVE);
      } else {
        this.service.updateCharacteristic(this.platform.Characteristic.Active, this.platform.Characteristic.Active.INACTIVE);
      }
    }
  }

  setActive(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    if (!this.socket.isConnected()) {
      this.platform.log.error(`Rancilio Not Connected - ${this.config.host}`);
      return callback(new Error('Rancilio Not Connected'));
    }

    callback();
    this.platform.log.debug('Calling "Set Active":', value);
    this.socket.sendJson({ power: value});
  }

  getActive(callback: CharacteristicSetCallback) {
    if (!this.socket.isConnected()) {
      this.platform.log.error(`Rancilio Not Connected - ${this.config.host}`);
      return callback(new Error('Rancilio Not Connected'));
    }

    callback();
    this.platform.log.debug('Calling "Get Active":');
    this.socket.sendJson({ status: 1});
  }
}