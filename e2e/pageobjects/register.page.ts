import { browser, expect } from '@wdio/globals';

import { byTestID } from './by';

class RegisterPage {
  get panel() {
    return byTestID('auth_panel');
  }

  get nameInput() {
    return byTestID('auth_name_input');
  }

  get emailInput() {
    return byTestID('auth_email_input');
  }

  get passwordInput() {
    return byTestID('auth_password_input');
  }

  get confirmPasswordInput() {
    return byTestID('auth_confirm_password_input');
  }

  get submitButton() {
    return byTestID('auth_create_account_button');
  }

  get switchToLoginButton() {
    return byTestID('auth_switch_to_login_button');
  }

  async isLoaded() {
    const hasNameInput = await (await this.nameInput).isExisting().catch(() => false);
    const hasConfirmPasswordInput = await (await this.confirmPasswordInput)
      .isExisting()
      .catch(() => false);

    return hasNameInput && hasConfirmPasswordInput;
  }

  async waitForLoaded() {
    await (await this.nameInput).waitForDisplayed({ timeout: 15000 });
    await expect(await this.confirmPasswordInput).toBeDisplayed();
  }

  async register(name: string, email: string, password: string) {
    await (await this.nameInput).setValue(name);
    await (await this.emailInput).setValue(email);
    await (await this.passwordInput).setValue(password);
    await (await this.confirmPasswordInput).setValue(password);
    await browser.hideKeyboard().catch(() => undefined);
    await (await this.submitButton).click();
  }
}

export default new RegisterPage();
