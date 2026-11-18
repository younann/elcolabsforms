import { expect, test } from 'vitest';
import { wazeLink } from '../../src/lib/waze';

test('wazeLink navigates to the encoded address', () => {
  expect(wazeLink('הרצל 12, חיפה')).toBe('https://waze.com/ul?q=' + encodeURIComponent('הרצל 12, חיפה') + '&navigate=yes');
});
