import { browser, expect } from '@wdio/globals';

import { byTestID, byTodoTestIDPart } from './by';

class HomePage {
  get welcomePanel() {
    return byTestID('welcome_panel');
  }

  get welcomeTitle() {
    return byTestID('welcome_title');
  }

  get welcomeOpenTodosButton() {
    return byTestID('welcome_open_todos_button');
  }

  get welcomeLogoutButton() {
    return byTestID('welcome_logout_button');
  }

  get todoBoardPanel() {
    return byTestID('todo_board_panel');
  }

  get newTodoTitleInput() {
    return byTestID('todo_new_title_input');
  }

  get addTodoButton() {
    return byTestID('todo_add_button');
  }

  get todoBoardLogoutButton() {
    return byTestID('todo_board_logout_button');
  }

  get firstTodoTitleText() {
    return byTodoTestIDPart('title_text');
  }

  get firstTodoStatusText() {
    return byTodoTestIDPart('status_text');
  }

  get firstTodoToggleCheckbox() {
    return byTodoTestIDPart('toggle_checkbox');
  }

  async isWelcomeLoaded() {
    return (await this.welcomePanel).isDisplayed().catch(() => false);
  }

  async isTodoBoardLoaded() {
    return (await this.todoBoardPanel).isDisplayed().catch(() => false);
  }

  async waitForWelcome() {
    await (await this.welcomeTitle).waitForDisplayed({ timeout: 15000 });
    await expect(await this.welcomePanel).toBeDisplayed();
  }

  async openTodoBoard() {
    await (await this.welcomeOpenTodosButton).click();
    await (await this.newTodoTitleInput).waitForDisplayed({ timeout: 15000 });
    await expect(await this.todoBoardPanel).toBeDisplayed();
  }

  async createTodo(title: string) {
    await (await this.newTodoTitleInput).setValue(title);
    await browser.hideKeyboard().catch(() => undefined);
    await (await this.addTodoButton).click();
  }

  async completeFirstTodo() {
    await (await this.firstTodoToggleCheckbox).click();
    await expect(await this.firstTodoStatusText).toHaveText('COMPLETADA');
  }

  async logoutFromWelcome() {
    await (await this.welcomeLogoutButton).click();
  }

  async logoutFromTodoBoard() {
    await (await this.todoBoardLogoutButton).click();
  }
}

export default new HomePage();
