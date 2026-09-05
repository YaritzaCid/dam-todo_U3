import { resolve } from 'node:path';

const appiumPort = Number(process.env.ALISTO_APPIUM_PORT ?? 4723);
const appPackage = process.env.ALISTO_ANDROID_APP_PACKAGE ?? 'com.alisto.app';
const appActivity = process.env.ALISTO_ANDROID_APP_ACTIVITY ?? '.MainActivity';
const appPath = process.env.ALISTO_ANDROID_APP
  ? resolve(process.env.ALISTO_ANDROID_APP)
  : undefined;

export const config = {
  runner: 'local',
  hostname: '127.0.0.1',
  port: appiumPort,
  path: '/',
  tsConfigPath: './e2e/tsconfig.json',
  specs: ['./specs/**/*.spec.ts'],
  maxInstances: 1,
  logLevel: process.env.WDIO_LOG_LEVEL ?? 'info',
  outputDir: './e2e/logs',
  bail: 0,
  waitforTimeout: 10000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 1,
  services: [
    [
      'appium',
      {
        command: 'appium',
        args: {
          port: appiumPort,
          useDrivers: 'uiautomator2',
          log: './e2e/logs/appium.log',
        },
        appiumStartTimeout: 60000,
      },
    ],
  ],
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: {
    ui: 'bdd',
    timeout: 180000,
  },
  capabilities: [
    {
      platformName: 'Android',
      'appium:automationName': 'UiAutomator2',
      'appium:deviceName': process.env.ALISTO_ANDROID_DEVICE_NAME ?? 'Android Emulator',
      'appium:autoGrantPermissions': true,
      'appium:newCommandTimeout': 120,
      'appium:forceAppLaunch': true,
      'appium:settings[waitForIdleTimeout]': 100,
      ...(process.env.ALISTO_ANDROID_PLATFORM_VERSION
        ? { 'appium:platformVersion': process.env.ALISTO_ANDROID_PLATFORM_VERSION }
        : {}),
      ...(process.env.ALISTO_ANDROID_UDID ? { 'appium:udid': process.env.ALISTO_ANDROID_UDID } : {}),
      ...(appPath
        ? { 'appium:app': appPath }
        : {
            'appium:appPackage': appPackage,
            'appium:appActivity': appActivity,
            'appium:noReset': true,
          }),
    },
  ],
};
