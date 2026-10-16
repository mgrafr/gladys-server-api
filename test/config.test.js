import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeConfig, DEFAULT_CONFIG } from '../src/config.js';

test('normalizeConfig returns the defaults when called with no argument', () => {
  assert.deepEqual(normalizeConfig(), DEFAULT_CONFIG);
});

test('normalizeConfig strips the trailing slash of the external server URL', () => {
  assert.equal(
    normalizeConfig({ server_url: ' http://192.168.1.5:3004/ ' }).server_url,
    'http://192.168.1.5:3004',
  );
});

test('normalizeConfig keeps only the host of the Gladys address', () => {
  assert.equal(normalizeConfig({ gladys_address: '192.168.1.5' }).gladys_address, '192.168.1.5');
  assert.equal(
    normalizeConfig({ gladys_address: 'http://gladys.local/dashboard' }).gladys_address,
    'gladys.local',
  );
});

test('normalizeConfig falls back to the default time zone for an unknown one', () => {
  assert.equal(normalizeConfig({ timezone: 'America/Montreal' }).timezone, 'America/Montreal');
  assert.equal(normalizeConfig({ timezone: 'Mars/Olympus' }).timezone, DEFAULT_CONFIG.timezone);
  assert.equal(normalizeConfig({ timezone: '' }).timezone, DEFAULT_CONFIG.timezone);
});
