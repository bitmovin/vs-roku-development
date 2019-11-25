'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as RokuApi from './utils/rokuApi';
import { RokuDevice } from './utils/deviceDiscovery';

function deployApp() {
    vscode.window.showInformationMessage(`Deploying app to ${RokuApi.getRokuDevice()}`);
    RokuApi.deploy();
}

function launchDebug() {
    const rokuDebugConsoleName = "Roku debug console";

    let rokuConsole = vscode.window.terminals.find(terminal => terminal.name === rokuDebugConsoleName);

    // Close any instances of Roku debug console before running again
    if (rokuConsole) {
        rokuConsole.dispose();
    }

    rokuConsole = vscode.window.createTerminal(rokuDebugConsoleName);
    rokuConsole.sendText(RokuApi.getDebugConsoleCommand());

    vscode.window.showInformationMessage(`Debug console started for ${RokuApi.getRokuDevice()}`);

    rokuConsole.show();
}

function deployAndDebug() {
    launchDebug();
    deployApp();
}

function discoverDevices() {
    // https://code.visualstudio.com/api/references/vscode-api#WorkspaceConfiguration
    (async function () {
        const devices = await RokuDevice.discover();
        await vscode.workspace.getConfiguration().update('roku-development.devices', devices, vscode.ConfigurationTarget.Global);
    })();
}

function runTests() {
    (async function () {
        const deviceAvailability = await Promise.all(RokuDevice.devicesFromConfig()
            .map(device => device.isAvailable().then(isAvailable => ({ device, isAvailable }))));

        const devices = deviceAvailability
            .filter(({ isAvailable }) => isAvailable)
            .map(({ device }) => ({ label: device.name, description: `IP: ${device.ip}`, device }));

        if (!devices.length) {
            vscode.window.showInformationMessage('No Roku device available');
            return;
        }

        // TODO: dsfdf
        const selection = await vscode.window.showQuickPick(devices, { placeHolder: 'Select the device to run the tests on' });

        if (!selection) {
            vscode.window.showInformationMessage('No device selected');
            return;
        }
        // const device = devices[0].device;
        const device = selection.device;

        await device.sendHomeKey();
        await device.removeFiles();
        await device.sendFile('/../../data/BitmovinTest.zip');
        await device.sendHomeKey();
    })();
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "roku-development" is now active!');

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with  registerCommand
    // The commandId parameter must match the command field in package.json
    const deployDisposable = vscode.commands.registerCommand('roku.dev.deploy', deployApp);
    context.subscriptions.push(deployDisposable);

    const debugDisposable = vscode.commands.registerCommand('roku.dev.debug', launchDebug);
    context.subscriptions.push(debugDisposable);

    const deployAndDebugDisposable = vscode.commands.registerCommand('roku.dev.deployAndDebug', deployAndDebug);
    context.subscriptions.push(deployAndDebugDisposable);

    const discoverDisposable = vscode.commands.registerCommand('roku.dev.discover', discoverDevices);
    context.subscriptions.push(discoverDisposable);

    const runTestsDisposable = vscode.commands.registerCommand('roku.dev.runTests', runTests);
    context.subscriptions.push(runTestsDisposable);
}

// this method is called when your extension is deactivated
export function deactivate() {
}
