import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const email = 'alex.morgan@example.com';
const password = 'Test-only-password-8!';
const challenge = { success: true, requiresOtp: true, tempToken: 'test-only-challenge', destination: 'a***n@example.com', expiresIn: 300 };
const session = {
  success: true,
  data: {
    accessToken: 'test-only-access-token',
    refreshToken: 'test-only-refresh-token',
    user: { Id: 'test-user', _id: 'test-user', email, firstName: 'Alex', lastName: 'Morgan', role: { name: 'admin' }, permissions: ['dashboard_view'] },
  },
};
const json = (route, body, status = 200, headers = {}) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body), headers });
const digit = (page, index) => page.getByLabel(`Digit ${index} of 6`, { exact: true });

async function credentials(page) {
  await page.getByLabel('Work email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
}

async function openOtp(page, response = challenge) {
  await page.route('**/api/auth/login', route => json(route, response));
  await page.goto('/login');
  await credentials(page);
  await expect(page.getByRole('heading', { name: 'Verify your identity' })).toBeVisible();
  await expect(digit(page, 1)).toBeFocused();
}

async function paste(page, text, index = 1) {
  await digit(page, index).evaluate((element, clipboardText) => {
    const clipboardData = new DataTransfer();
    clipboardData.setData('text', clipboardText);
    element.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData }));
  }, text);
}

test.beforeEach(async ({ page }) => {
  // Default deny: no authentication test can reach a real service.
  await page.route('**/api/**', route => json(route, { success: false, message: 'Test endpoint not configured' }, 503));
  await page.route('**/socket.io/**', route => route.abort());
  await page.route(/^https:\/\//, route => route.abort());
});

test('login uses the existing local brand, semantic fields, and private access help', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'BrandCentral' })).toHaveAttribute('src', '/brandcentral-logo.png');
  await expect(page.getByText('Sign in to your RetailOps workspace.')).toBeVisible();
  await expect(page.getByLabel('Work email')).toHaveAttribute('autocomplete', 'username');
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('autocomplete', 'current-password');
  await expect(page.getByRole('link', { name: /sign up|register/i })).toHaveCount(0);
  await expect(page.getByText('Contact your administrator.')).toBeVisible();
  await expect(page.getByText('Secure enterprise access')).toBeVisible();
  await expect(page.getByText(/enterprise encryption|256-bit|military-grade/i)).toHaveCount(0);
  for (const field of [page.getByLabel('Work email'), page.getByLabel('Password', { exact: true }), page.getByRole('button', { name: 'Continue', exact: true })]) {
    expect((await field.boundingBox()).height).toBeGreaterThanOrEqual(48);
  }
});

test('validates fields accessibly and does not submit an incomplete form', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/auth/login', route => { requests++; return json(route, challenge); });
  await page.goto('/login');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByText('Enter your work email.')).toBeVisible();
  await expect(page.getByLabel('Work email')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByLabel('Work email')).toBeFocused();
  await page.getByLabel('Work email').fill('not-an-email');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByText('Enter a valid work email.')).toBeVisible();
  await page.getByLabel('Work email').fill(email);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByLabel('Password', { exact: true })).toBeFocused();
  expect(requests).toBe(0);
});

test('password visibility is keyboard accessible and preserves the password', async ({ page }) => {
  await page.goto('/login');
  const field = page.getByLabel('Password', { exact: true });
  await field.fill(password);
  await field.press('Tab');
  await expect(page.getByRole('button', { name: 'Show password', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(field).toHaveAttribute('type', 'text');
  await expect(field).toHaveValue(password);
  await expect(page.getByRole('button', { name: 'Hide password', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Enter');
  await expect(field).toHaveAttribute('type', 'password');
});

for (const [status, expected] of [
  [401, 'Your email or password is incorrect.'],
  [403, 'Access to this workspace is unavailable. Contact your administrator.'],
  [423, 'Your account is temporarily locked. Contact your administrator.'],
  [429, 'Too many attempts. Please wait before trying again.'],
  [500, 'RetailOps is temporarily unavailable. Please try again shortly.'],
]) {
  test(`login safely handles HTTP ${status} without losing email`, async ({ page }) => {
    await page.route('**/api/auth/login', route => json(route, { success: false, message: 'Internal SQL failure in /private/server with JWT details' }, status));
    await page.goto('/login');
    await credentials(page);
    await expect(page.getByRole('alert')).toHaveText(expected);
    await expect(page.getByLabel('Work email')).toHaveValue(email);
    await expect(page.getByText(/Internal SQL|private\/server|JWT details/)).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('authToken'))).toBeNull();
  });
}

test('handles non-JSON server failures without exposing response text', async ({ page }) => {
  await page.route('**/api/auth/login', route => route.fulfill({ status: 502, contentType: 'text/html', body: '<h1>Private upstream stack trace</h1>' }));
  await page.goto('/login');
  await credentials(page);
  await expect(page.getByRole('alert')).toHaveText('RetailOps is temporarily unavailable. Please try again shortly.');
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeEnabled();
});

test('handles network failures with an actionable message', async ({ page }) => {
  await page.route('**/api/auth/login', route => route.abort('connectionfailed'));
  await page.goto('/login');
  await credentials(page);
  await expect(page.getByRole('alert')).toHaveText("We couldn't connect to RetailOps. Check your connection and try again.");
});

test('honors Retry-After and does not retry sign-in automatically', async ({ page }) => {
  await page.clock.install();
  let calls = 0;
  await page.route('**/api/auth/login', route => { calls++; return json(route, { success: false }, 429, { 'Retry-After': '90' }); });
  await page.goto('/login');
  await credentials(page);
  await expect(page.getByRole('button', { name: /Try again in/ })).toBeDisabled();
  await page.clock.fastForward(61_000);
  await expect(page.getByRole('button', { name: /Try again in/ })).toBeDisabled();
  await page.clock.fastForward(31_000);
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeEnabled();
  expect(calls).toBe(1);
});

test('credential submission is single-flight and exposes a real loading state', async ({ page }) => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let calls = 0;
  await page.route('**/api/auth/login', async route => { calls++; await gate; await json(route, challenge); });
  await page.goto('/login');
  await credentials(page);
  const button = page.getByRole('button', { name: 'Signing in…', exact: true });
  await expect(button).toBeDisabled();
  await expect(button).toHaveAttribute('aria-busy', 'true');
  await page.getByRole('form', { name: 'Sign in to RetailOps' }).dispatchEvent('submit');
  await expect.poll(() => calls).toBe(1);
  release();
  await expect(page.getByRole('heading', { name: 'Verify your identity' })).toBeVisible();
});

test('credential requests time out and allow a deliberate retry', async ({ page }) => {
  await page.clock.install();
  await page.route('**/api/auth/login', () => {});
  await page.goto('/login');
  await credentials(page);
  await expect(page.getByRole('button', { name: 'Signing in…', exact: true })).toBeDisabled();
  await page.clock.fastForward(31_000);
  await expect(page.getByRole('alert')).toHaveText('This is taking longer than expected. Please try again.');
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeEnabled();
});

test('OTP is private, initially focused, and supports keyboard editing without auto-submitting', async ({ page }) => {
  let verifications = 0;
  await page.route('**/api/auth/verify-otp', route => { verifications++; return json(route, session); });
  await openOtp(page);
  await expect(page.getByText('a•••••@example.com', { exact: true })).toBeVisible();
  await expect(page.getByText(email, { exact: true })).toHaveCount(0);
  await expect(digit(page, 1)).toHaveAttribute('autocomplete', 'one-time-code');
  await page.keyboard.type('123456');
  for (let index = 1; index <= 6; index++) {
    await expect(digit(page, index)).toHaveValue(String(index));
    await expect(digit(page, index)).toHaveAttribute('type', 'password');
    await expect(digit(page, index)).toHaveAttribute('inputmode', 'numeric');
  }
  await expect(digit(page, 6)).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(digit(page, 5)).toBeFocused();
  await page.keyboard.press('Home');
  await expect(digit(page, 1)).toBeFocused();
  await page.keyboard.press('End');
  await expect(digit(page, 6)).toBeFocused();
  await page.keyboard.press('Backspace');
  await expect(digit(page, 6)).toHaveValue('');
  await page.keyboard.press('Backspace');
  await expect(digit(page, 5)).toBeFocused();
  await expect(digit(page, 5)).toHaveValue('');
  expect(verifications).toBe(0);
  expect(await page.evaluate(() => Object.values(localStorage).some(value => value.includes('test-only-challenge')))).toBe(false);
});

test('OTP accepts a complete paste in any cell and rejects nonnumeric input', async ({ page }) => {
  await openOtp(page);
  await paste(page, '987654', 4);
  for (let index = 1; index <= 6; index++) await expect(digit(page, index)).toHaveValue('987654'[index - 1]);
  await paste(page, 'a2b3c4');
  await expect(digit(page, 1)).toHaveValue('9');
  await digit(page, 2).fill('x');
  await expect(digit(page, 2)).toHaveValue('8');
  // Simulate a browser supplying the entire one-time code to one field.
  await digit(page, 1).fill('246810');
  for (let index = 1; index <= 6; index++) await expect(digit(page, index)).toHaveValue('246810'[index - 1]);
});

test('incomplete OTP has inline feedback and does not reach the API', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/auth/verify-otp', route => { calls++; return json(route, session); });
  await openOtp(page);
  await page.keyboard.type('123');
  await page.getByRole('button', { name: 'Verify and continue', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Enter all six digits of your verification code.');
  await expect(digit(page, 4)).toBeFocused();
  await expect(digit(page, 1)).toHaveAttribute('aria-invalid', 'true');
  expect(calls).toBe(0);
});

test('incorrect OTP preserves the challenge and supports correction', async ({ page }) => {
  await page.route('**/api/auth/verify-otp', route => json(route, { success: false, message: 'Invalid OTP. 4 attempt(s) remaining.' }, 401));
  await openOtp(page);
  await paste(page, '123456');
  await page.getByRole('button', { name: 'Verify and continue', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('The verification code is incorrect. Please try again.');
  await expect(digit(page, 1)).toHaveValue('1');
  await expect(digit(page, 1)).toBeFocused();
  await expect(digit(page, 1)).toHaveAttribute('aria-invalid', 'true');
  await page.keyboard.type('9');
  await expect(digit(page, 1)).toHaveValue('9');
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('resend uses a deadline cooldown, clears only the old code, and focuses the new code', async ({ page }) => {
  await page.clock.install();
  let calls = 0;
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/api/auth/resend-otp', async route => { calls++; await gate; await json(route, { success: true, destination: challenge.destination, expiresIn: 300 }); });
  await openOtp(page);
  await paste(page, '123456');
  await page.getByLabel('Trust this device for 12 hours').check();
  await expect(page.getByRole('button', { name: /Resend code in/ })).toBeDisabled();
  await page.clock.fastForward(61_000);
  await page.getByRole('button', { name: 'Resend code', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sending a new code…', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Verify and continue', exact: true })).toBeDisabled();
  release();
  await expect(page.getByText('A new code has been sent.')).toBeVisible();
  await expect(page.getByRole('button', { name: /Resend code in/ })).toBeDisabled();
  await expect(digit(page, 1)).toHaveValue('');
  await expect(digit(page, 1)).toBeFocused();
  await expect(page.getByLabel('Trust this device for 12 hours')).toBeChecked();
  expect(calls).toBe(1);
});

test('expired OTP remains on the verification screen and can be resent', async ({ page }) => {
  await page.clock.install();
  await page.route('**/api/auth/resend-otp', route => json(route, { success: true, expiresIn: 300, destination: challenge.destination }));
  await openOtp(page, { ...challenge, expiresIn: 2 });
  await page.clock.fastForward(3_000);
  await expect(page.getByRole('alert')).toHaveText('This verification code has expired. Request a new code.');
  await expect(page.getByRole('button', { name: 'Verify and continue', exact: true })).toBeDisabled();
  await expect(page.getByRole('heading', { name: 'Verify your identity' })).toBeVisible();
  await page.clock.fastForward(60_000);
  await page.getByRole('button', { name: 'Resend code', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(digit(page, 1)).toBeEnabled();
});

for (const [message, code, expected] of [
  ['OTP expired or invalid. Please request a new one.', undefined, 'This verification code has expired. Request a new code.'],
  ['Too many incorrect attempts. Please request a new OTP.', undefined, 'Too many incorrect attempts. Request a new verification code.'],
  ['Session expired. Please login again.', 'SESSION_EXPIRED', 'Your sign-in session has expired. Please sign in again.'],
]) {
  test(`handles verification denial: ${code || message.split('.')[0]}`, async ({ page }) => {
    await page.route('**/api/auth/verify-otp', route => json(route, { success: false, message, code }, 401));
    await openOtp(page);
    await paste(page, '123456');
    await page.getByRole('button', { name: 'Verify and continue', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveText(expected);
    await expect(page.getByRole('button', { name: 'Verify and continue', exact: true })).toBeDisabled();
    await expect(page.getByRole('heading', { name: 'Verify your identity' })).toBeVisible();
    await page.getByRole('button', { name: 'Back to sign in', exact: true }).click();
    await expect(page.getByLabel('Work email')).toHaveValue(email);
    await expect(page.getByLabel('Password', { exact: true })).toHaveValue('');
  });
}

test('verification is single-flight and stores the genuine response before setup navigation', async ({ page }) => {
  let calls = 0;
  let body;
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/api/auth/verify-otp', async route => {
    calls++;
    body = route.request().postDataJSON();
    await gate;
    await json(route, { ...session, needsPasswordReset: true });
  });
  await openOtp(page);
  await page.getByLabel('Trust this device for 12 hours').check();
  await paste(page, '123456');
  await page.getByRole('button', { name: 'Verify and continue', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Verifying…', exact: true })).toHaveAttribute('aria-busy', 'true');
  await page.getByRole('form', { name: 'Verify your identity', exact: true }).dispatchEvent('submit');
  await expect.poll(() => calls).toBe(1);
  expect(body).toEqual({ tempToken: challenge.tempToken, otp: '123456', trustDevice: true });
  release();
  await expect(page).toHaveURL(/\/setup-wizard$/);
  expect(await page.evaluate(() => localStorage.getItem('refreshToken'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('authToken'))).toBeNull();
  expect(JSON.parse(await page.evaluate(() => localStorage.getItem('user'))).email).toBe(email);
});

test('Back cancels pending verification so a late success cannot sign in', async ({ page }) => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/api/auth/verify-otp', async route => { await gate; await json(route, session); });
  await openOtp(page);
  await paste(page, '123456');
  await page.getByRole('button', { name: 'Verify and continue', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Verifying…', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back to sign in', exact: true }).click();
  release();
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.getByLabel('Work email')).toHaveValue(email);
  expect(await page.evaluate(() => localStorage.getItem('authToken'))).toBeNull();
  await expect(page).toHaveURL(/\/login$/);
});

test('trusted-device login skips OTP and preserves setup routing and the session user', async ({ page }) => {
  await page.route('**/api/auth/login', route => json(route, { ...session, trustedDevice: true, requiresSetup: true }));
  await page.goto('/login');
  await credentials(page);
  await expect(page).toHaveURL(/\/setup-wizard$/);
  expect(await page.evaluate(() => localStorage.getItem('refreshToken'))).toBeNull();
  expect(JSON.parse(await page.evaluate(() => localStorage.getItem('user'))).email).toBe(email);
});

test('a malformed success response cannot authenticate the user', async ({ page }) => {
  await page.route('**/api/auth/login', route => json(route, { success: true, data: {} }));
  await page.goto('/login');
  await credentials(page);
  await expect(page.getByRole('alert')).toHaveText('RetailOps is temporarily unavailable. Please try again shortly.');
  await expect(page).toHaveURL(/\/login$/);
  expect(await page.evaluate(() => localStorage.getItem('authToken'))).toBeNull();
});

test('forgot-password navigation stays within the existing authentication system', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('link', { name: 'Forgot password?', exact: true }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
  await expect(page.getByRole('img', { name: 'BrandCentral' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send Reset Link' })).toBeVisible();
});

for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 768, height: 1024 }]) {
  test(`both screens fit ${viewport.width}px without horizontal scrolling`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.route('**/api/auth/login', route => json(route, challenge));
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await credentials(page);
    await expect(digit(page, 1)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    for (let index = 1; index <= 6; index++) {
      const box = await digit(page, index).boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(48);
      expect(box.width).toBeGreaterThanOrEqual(39);
      expect(box.x).toBeGreaterThanOrEqual(20);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width - 20);
    }
    await expect(page.getByRole('button', { name: 'Verify and continue', exact: true })).toBeVisible();
  });
}

test('login and OTP have no automated WCAG A/AA accessibility violations', async ({ page }) => {
  await page.route('**/api/auth/login', route => json(route, challenge));
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  const loginResults = await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(loginResults.violations).toEqual([]);
  await credentials(page);
  await expect(digit(page, 1)).toBeFocused();
  const otpResults = await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(otpResults.violations).toEqual([]);
});

test('respects reduced motion and keeps both screens the same width', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/auth/login', route => json(route, challenge));
  await page.goto('/login');
  const card = page.getByRole('region', { name: 'RetailOps authentication' });
  const before = await card.boundingBox();
  await credentials(page);
  await expect(digit(page, 1)).toBeFocused();
  const after = await card.boundingBox();
  expect(after.width).toBe(before.width);
  expect(await page.getByRole('heading', { name: 'Verify your identity' }).evaluate(el => getComputedStyle(el.parentElement.parentElement).animationName)).toBe('none');
});
