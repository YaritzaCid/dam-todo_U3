import { browser, expect } from '@wdio/globals';

import HomePage from '../pageobjects/home.page';
import LoginPage from '../pageobjects/login.page';
import RegisterPage from '../pageobjects/register.page';

const userName = 'Appium Tester';
const password = 'secreto1';
const androidAppPackage = process.env.ALISTO_ANDROID_APP_PACKAGE ?? 'com.alisto.app';

let emailCounter = 0;

describe('Alisto Android E2E', () => {
  beforeEach(async () => {
    await restartApp();
    await ensureLoggedOut();
  });

  afterEach(async () => {
    await restartApp();
    await ensureLoggedOut();
  });

  it('registra e inicia sesión correctamente', async () => {
    await registerAndLogin(uniqueEmail('login'));

    const welcomeTitle = await (await HomePage.welcomeTitle).getText();
    expect(welcomeTitle).toContain(userName);
  });

  it('crea una nueva tarea', async () => {
    const todoTitle = uniqueTodoTitle('crear');

    await registerAndLogin(uniqueEmail('todo'));
    await HomePage.openTodoBoard();
    await HomePage.createTodo(todoTitle);

    await expect(await HomePage.firstTodoTitleText).toHaveText(todoTitle);
    await expect(await HomePage.firstTodoStatusText).toHaveText('PENDIENTE');
  });

  it('marca una tarea como completada', async () => {
    const todoTitle = uniqueTodoTitle('completar');

    await registerAndLogin(uniqueEmail('complete'));
    await HomePage.openTodoBoard();
    await HomePage.createTodo(todoTitle);

    await expect(await HomePage.firstTodoTitleText).toHaveText(todoTitle);
    await HomePage.completeFirstTodo();
  });
});

async function registerAndLogin(email: string) {
  await openRegistration();
  await RegisterPage.register(userName, email, password);

  await LoginPage.waitForLoaded();
  const feedbackText = await (await LoginPage.feedbackMessage).getText();
  expect(feedbackText).toContain('Cuenta creada');

  await LoginPage.login(email, password);
  await HomePage.waitForWelcome();
}

async function openRegistration() {
  if (await RegisterPage.isLoaded()) {
    return;
  }

  await LoginPage.waitForLoaded();
  await (await LoginPage.switchToRegisterButton).click();
  await RegisterPage.waitForLoaded();
}

async function ensureLoggedOut() {
  await browser.waitUntil(
    async () => {
      if (await LoginPage.isLoaded()) {
        return true;
      }

      if (await RegisterPage.isLoaded()) {
        await (await RegisterPage.switchToLoginButton).click();
        return false;
      }

      if (await HomePage.isTodoBoardLoaded()) {
        await HomePage.logoutFromTodoBoard();
        return false;
      }

      if (await HomePage.isWelcomeLoaded()) {
        await HomePage.logoutFromWelcome();
        return false;
      }

      return false;
    },
    {
      timeout: 30000,
      timeoutMsg: 'Alisto no llegó a la pantalla de login para E2E',
    }
  );
}

async function restartApp() {
  await browser.terminateApp(androidAppPackage).catch(() => undefined);
  await browser.activateApp(androidAppPackage);
}

function uniqueEmail(label: string) {
  emailCounter += 1;
  return `appium-${label}-${Date.now()}-${emailCounter}@alisto.test`;
}

function uniqueTodoTitle(label: string) {
  emailCounter += 1;
  return `Preparar prueba Appium ${label} ${Date.now()} ${emailCounter}`;
}
