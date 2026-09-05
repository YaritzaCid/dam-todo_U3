import { expect } from '@wdio/globals';

import HomePage from '../pageobjects/home.page';
import LoginPage from '../pageobjects/login.page';
import RegisterPage from '../pageobjects/register.page';

const userName = 'Appium Tester';
const password = 'secreto1';
const todoTitle = 'Preparar prueba Appium';

describe('Alisto login', () => {
  it('registers, logs in, and creates a todo', async () => {
    const email = `appium-${Date.now()}@alisto.test`;

    await LoginPage.waitForLoaded();
    await (await LoginPage.switchToRegisterButton).click();
    await RegisterPage.waitForLoaded();

    await RegisterPage.register(userName, email, password);

    const feedbackText = await (await LoginPage.feedbackMessage).getText();
    expect(feedbackText).toContain('Cuenta creada');

    await LoginPage.login(email, password);
    await HomePage.waitForWelcome();

    const welcomeTitle = await (await HomePage.welcomeTitle).getText();
    expect(welcomeTitle).toContain(userName);

    await HomePage.openTodoBoard();
    await HomePage.createTodo(todoTitle);

    await expect(await HomePage.firstTodoTitleText).toHaveText(todoTitle);
    await expect(await HomePage.firstTodoStatusText).toHaveText('Pendiente');
  });
});
