import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

export interface SignupData {
  name: string;
  email: string;
  password: string;
  title?: 'Mr' | 'Mrs';
  birthDay?: string;
  birthMonth?: string;
  birthYear?: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  address?: string;
  address2?: string;
  country?: string;
  state?: string;
  city?: string;
  zipcode?: string;
  mobileNumber?: string;
  newsletter?: boolean;
  specialOffers?: boolean;
}

export class AuthPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  // Signup section
  get newUserSignupHeader(): Locator {
    return this.page.locator('h2:has-text("New User Signup!")');
  }

  get signupNameInput(): Locator {
    return this.page.locator('[data-qa="signup-name"]');
  }

  get signupEmailInput(): Locator {
    return this.page.locator('[data-qa="signup-email"]');
  }

  get signupButton(): Locator {
    return this.page.locator('[data-qa="signup-button"]');
  }

  // Login section
  get loginHeader(): Locator {
    return this.page.locator('h2:has-text("Login to your account")');
  }

  get loginEmailInput(): Locator {
    return this.page.locator('[data-qa="login-email"]');
  }

  get loginPasswordInput(): Locator {
    return this.page.locator('[data-qa="login-password"]');
  }

  get loginButton(): Locator {
    return this.page.locator('[data-qa="login-button"]');
  }

  get loginErrorMessage(): Locator {
    return this.page.locator('p:has-text("Your email or password is incorrect!")');
  }

  get signupErrorMessage(): Locator {
    return this.page.locator('p:has-text("Email Address already exist!")');
  }

  // Account information form (after signup)
  get accountInfoHeader(): Locator {
    return this.page.locator('h2:has-text("Enter Account Information")');
  }

  get titleMr(): Locator {
    return this.page.locator('#id_gender1');
  }

  get titleMrs(): Locator {
    return this.page.locator('#id_gender2');
  }

  get passwordInput(): Locator {
    return this.page.locator('[data-qa="password"]');
  }

  get daysDropdown(): Locator {
    return this.page.locator('[data-qa="days"]');
  }

  get monthsDropdown(): Locator {
    return this.page.locator('[data-qa="months"]');
  }

  get yearsDropdown(): Locator {
    return this.page.locator('[data-qa="years"]');
  }

  get newsletterCheckbox(): Locator {
    return this.page.locator('#newsletter');
  }

  get specialOffersCheckbox(): Locator {
    return this.page.locator('#optin');
  }

  get firstNameInput(): Locator {
    return this.page.locator('[data-qa="first_name"]');
  }

  get lastNameInput(): Locator {
    return this.page.locator('[data-qa="last_name"]');
  }

  get companyInput(): Locator {
    return this.page.locator('[data-qa="company"]');
  }

  get addressInput(): Locator {
    return this.page.locator('[data-qa="address"]');
  }

  get address2Input(): Locator {
    return this.page.locator('[data-qa="address2"]');
  }

  get countryDropdown(): Locator {
    return this.page.locator('[data-qa="country"]');
  }

  get stateInput(): Locator {
    return this.page.locator('[data-qa="state"]');
  }

  get cityInput(): Locator {
    return this.page.locator('[data-qa="city"]');
  }

  get zipcodeInput(): Locator {
    return this.page.locator('[data-qa="zipcode"]');
  }

  get mobileNumberInput(): Locator {
    return this.page.locator('[data-qa="mobile_number"]');
  }

  get createAccountButton(): Locator {
    return this.page.locator('[data-qa="create-account"]');
  }

  // Account created page
  get accountCreatedHeader(): Locator {
    return this.page.locator('h2:has-text("Account Created!")');
  }

  get continueButton(): Locator {
    return this.page.locator('[data-qa="continue-button"]');
  }

  // Account deleted page
  get accountDeletedHeader(): Locator {
    return this.page.locator('h2:has-text("Account Deleted!")');
  }

  // Actions
  async open(): Promise<void> {
    await this.navigate('/login');
  }

  async verifySignupFormVisible(): Promise<void> {
    await expect(this.newUserSignupHeader).toBeVisible();
  }

  async verifyLoginFormVisible(): Promise<void> {
    await expect(this.loginHeader).toBeVisible();
  }

  async initiateSignup(name: string, email: string): Promise<void> {
    await this.signupNameInput.fill(name);
    await this.signupEmailInput.fill(email);
    await this.signupButton.click();
  }

  async fillAccountInformation(data: SignupData): Promise<void> {
    // Title
    if (data.title === 'Mrs') {
      await this.titleMrs.check();
    } else {
      await this.titleMr.check();
    }

    // Password
    await this.passwordInput.fill(data.password);

    // Date of birth
    if (data.birthDay) await this.daysDropdown.selectOption(data.birthDay);
    if (data.birthMonth) await this.monthsDropdown.selectOption(data.birthMonth);
    if (data.birthYear) await this.yearsDropdown.selectOption(data.birthYear);

    // Checkboxes
    if (data.newsletter) await this.newsletterCheckbox.check();
    if (data.specialOffers) await this.specialOffersCheckbox.check();

    // Address info
    if (data.firstName) await this.firstNameInput.fill(data.firstName);
    if (data.lastName) await this.lastNameInput.fill(data.lastName);
    if (data.company) await this.companyInput.fill(data.company);
    if (data.address) await this.addressInput.fill(data.address);
    if (data.address2) await this.address2Input.fill(data.address2);
    if (data.country) await this.countryDropdown.selectOption(data.country);
    if (data.state) await this.stateInput.fill(data.state);
    if (data.city) await this.cityInput.fill(data.city);
    if (data.zipcode) await this.zipcodeInput.fill(data.zipcode);
    if (data.mobileNumber) await this.mobileNumberInput.fill(data.mobileNumber);
  }

  async submitAccountCreation(): Promise<void> {
    await this.createAccountButton.click();
  }

  async login(email: string, password: string): Promise<void> {
    await this.loginEmailInput.fill(email);
    await this.loginPasswordInput.fill(password);
    await this.loginButton.click();
  }

  async verifyAccountCreated(): Promise<void> {
    await expect(this.accountCreatedHeader).toBeVisible();
  }

  async verifyAccountDeleted(): Promise<void> {
    await expect(this.accountDeletedHeader).toBeVisible();
  }
}
