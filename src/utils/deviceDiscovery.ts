import * as vscode from 'vscode';
import { Client } from 'node-ssdp';
import axios from 'axios';
import * as parser from 'fast-xml-parser-ordered';

export class RokuDevice {
  constructor(public ip: string, public name = '', public username = '', public password = '') { }

  // Automatically discover devices:
  // https://developer.roku.com/en-ca/docs/developer-program/debugging/external-control-api.md
  public static discover(): Promise<RokuDevice[]> {
    const client = new Client();
    const devices: RokuDevice[] = vscode.workspace.getConfiguration().get('roku-development.devices') || [];

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

  public getDeviceInfo(): Promise<any> {
    return axios.get(`http://${this.ip}:8060/query/device-info`).then(response => {
      if (response.status !== 200) {
        return false;
      }

      const data = parser.parse(response.data);
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
    return axios.get(`http://${this.ip}:8060/query/active-app`).then(response => {
      if (response.status !== 200) {
        return false;
      }

      const data = parser.parse(response.data);
      const isAvailable = data.children
        .find((child: any) => child.tag === 'active-app')
        .children
        .some((child: any) => child.tag === 'app' && child['#text'] === 'Roku');

      return isAvailable;
    });
  }
}