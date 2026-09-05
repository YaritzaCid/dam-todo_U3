import { expect } from '@wdio/globals';

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

  get todoBoardPanel() {
    return byTestID('todo_board_panel');
  }

  get newTodoTitleInput() {
    return byTestID('todo_new_title_input');
  }

  get addTodoButton() {
    return byTestID('todo_add_button');
  }

  get firstTodoTitleText() {
    return byTodoTestIDPart('title_text');
  }

  get firstTodoStatusText() {
    return byTodoTestIDPart('status_text');
  }

  async waitForWelcome() {
    await expect(await this.welcomePanel).toBeDisplayed();
  }

  async openTodoBoard() {
    await (await this.welcomeOpenTodosButton).click();
    await expect(await this.todoBoardPanel).toBeDisplayed();
  }

  async createTodo(title: string) {
    await (await this.newTodoTitleInput).setValue(title);
    await (await this.addTodoButton).click();
  }
}

export default new HomePage();
