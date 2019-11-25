import * as vscode from 'vscode';
import { Client } from 'node-ssdp';
import * as rp from 'request-promise';
import * as parser from 'fast-xml-parser-ordered';
import * as fs from 'fs';

export class RokuDevice {
  constructor(public ip: string, public name = '', public username = '', public password = '') { }

  // Automatically discover devices:
  // https://developer.roku.com/en-ca/docs/developer-program/debugging/external-control-api.md
  public static discover(): Promise<RokuDevice[]> {
    const client = new Client();
    const devices: RokuDevice[] = RokuDevice.devicesFromConfig();

    client.on('response', async (headers, statusCode, rinfo) => {
      if (statusCode === 200 && headers.ST === 'roku:ecp' && !devices.some(dev => dev.ip === rinfo.address)) {

        const device = new RokuDevice(rinfo.address);
        device.name = (await device.getDeviceInfo())['default-device-name'];
        vscode.window.showInformationMessage(`Roku device discovered: ${device.name}`);
        devices.push(device);
      }
    });

    client.search('roku:ecp');

    return new Promise<RokuDevice[]>(resolve => {
      setTimeout(() => {
        client.stop();
        resolve(devices);
      }, 5000);
    });
  }

  public static devicesFromConfig(): RokuDevice[] {
    const config: any[] = vscode.workspace.getConfiguration().get('roku-development.devices') || [];
    return config.map(obj => new RokuDevice(obj.ip, obj.name, obj.username, obj.password));
  }

  public getDeviceInfo(): Promise<any> {
    return rp.get(`http://${this.ip}:8060/query/device-info`).then(body => {
      const data = parser.parse(body);
      const deviceInfo = data.children
        .find((child: any) => child.tag === 'device-info')
        .children
        .reduce((result: any, child: any) => {
          result[child.tag] = child['#text'];
          return result;
        }, {});

      return deviceInfo;
    });
  }

  public async isAvailable(): Promise<boolean> {
    return rp.get(`http://${this.ip}:8060/query/active-app`).then(body => {
      const data = parser.parse(body);
      const isAvailable = data.children
        .find((child: any) => child.tag === 'active-app')
        .children
        .some((child: any) => child.tag === 'app' && child['#text'] === 'Roku');

      return isAvailable;
    });
  }

  public async sendHomeKey(): Promise<void> {
    return rp.post(`http://${this.ip}:8060/keypress/HOME`).then(() => {
      console.log(`Send HOME key to ${this.name} successful`);
    });
  }

  public async removeFiles(): Promise<void> {
    const options = {
      url: `http://${this.ip}/plugin_install`,
      auth: {
        user: this.username,
        pass: this.password,
        sendImmediately: false
      },
      formData: {
        mysubmit: 'Delete',
        archive: '',
        passwd: '',
      }
    };

    return rp.post(options).then(() => {
      console.log(`Deleted all sideloaded apps on ${this.name}`);
    });
  }

  public async sendFile(filePath: string): Promise<void> {
    const path = __dirname + filePath;
    if (!fs.existsSync(path)) {
      return Promise.reject(`File '${path}' doesn't exist`);
    }

    const options = {
      url: `http://${this.ip}/plugin_install`,
      auth: {
        user: this.username,
        pass: this.password,
        sendImmediately: false
      },
      formData: {
        mysubmit: 'Install',
        archive: fs.createReadStream(path),
        passwd: '',
      }
    };

    return rp.post(options).then(() => {
      console.log(`Send test app to ${this.name} successful`);
    });
  }
}