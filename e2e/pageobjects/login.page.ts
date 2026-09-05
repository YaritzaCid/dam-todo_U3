import { expect } from '@wdio/globals';

import { byTestID } from './by';

class LoginPage {
  get panel() {
    return byTestID('auth_panel');
  }

  get emailInput() {
    return byTestID('auth_email_input');
  }

  get passwordInput() {
    return byTestID('auth_password_input');
  }

  get passwordVisibilityToggle() {
    return byTestID('auth_password_visibility_toggle');
  }

  get submitButton() {
    return byTestID('auth_login_button');
  }

  get switchToRegisterButton() {
    return byTestID('auth_switch_to_register_button');
  }

  get feedbackMessage() {
    return byTestID('feedback_message');
  }

  async waitForLoaded() {
    await expect(await this.panel).toBeDisplayed();
  }

  async login(email: string, password: string) {
    await (await this.emailInput).setValue(email);
    await (await this.passwordInput).setValue(password);
    await (await this.submitButton).click();
  }
}

export default new LoginPage();
