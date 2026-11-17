import { describe, expect, test } from 'vitest';
import { getInstallMode } from '../../src/pwa/platform';

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const IPHONE_CHROME =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/123.0.6312.52 Mobile/15E148 Safari/604.1';
const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';
const DESKTOP =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Firefox/124.0';

describe('getInstallMode', () => {
  test('iPhone Safari', () => expect(getInstallMode(IPHONE_SAFARI, false)).toBe('ios-safari'));
  test('iPhone Chrome', () => expect(getInstallMode(IPHONE_CHROME, false)).toBe('ios-other'));
  test('Android Chrome', () => expect(getInstallMode(ANDROID_CHROME, false)).toBe('android-prompt'));
  test('standalone wins', () => {
    expect(getInstallMode(IPHONE_SAFARI, true)).toBe('installed');
    expect(getInstallMode(ANDROID_CHROME, true)).toBe('installed');
  });
  test('desktop unsupported', () => expect(getInstallMode(DESKTOP, false)).toBe('unsupported'));
});
