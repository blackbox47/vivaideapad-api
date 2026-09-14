import {
  buildPasswordResetUrl,
  buildSignInUrl,
  buildVerifyEmailUrl,
} from './mailer.service';

describe('buildVerifyEmailUrl', () => {
  it('builds /verify-email with an encoded token', () => {
    expect(buildVerifyEmailUrl('http://localhost:5173', 'abc123')).toBe(
      'http://localhost:5173/verify-email?token=abc123',
    );
  });

  it('strips trailing slashes from the public base URL', () => {
    expect(buildVerifyEmailUrl('https://app.example.com/', 'tok')).toBe(
      'https://app.example.com/verify-email?token=tok',
    );
  });

  it('URL-encodes special characters in the token', () => {
    expect(buildVerifyEmailUrl('http://localhost:5173', 'a+b/c')).toBe(
      'http://localhost:5173/verify-email?token=a%2Bb%2Fc',
    );
  });
});

describe('buildSignInUrl', () => {
  it('builds the contributor login URL', () => {
    expect(buildSignInUrl('https://app.example.com/')).toBe(
      'https://app.example.com/login',
    );
  });
});

describe('buildPasswordResetUrl', () => {
  it('builds /reset-password with an encoded token', () => {
    expect(buildPasswordResetUrl('http://localhost:5173', 'abc123')).toBe(
      'http://localhost:5173/reset-password?token=abc123',
    );
  });

  it('strips trailing slashes from the public base URL', () => {
    expect(buildPasswordResetUrl('https://app.example.com/', 'tok')).toBe(
      'https://app.example.com/reset-password?token=tok',
    );
  });
});
