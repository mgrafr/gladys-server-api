// -----------------------------------------------------------------------------
// Integration configuration.
//
// The configuration is filled in by the user in Gladys, from the `config_schema`
// declared in `gladys-assistant-integration.json`. The SDK fetches it for you
// (`gladys.getConfig()`) and notifies you of every change through
// `gladys.onConfigUpdated()`.
//
// This module only provides defaults and normalizes the received object, so the
// rest of the code never has to deal with `undefined`.
// -----------------------------------------------------------------------------

// Defaults: they MUST stay consistent with the `default` values declared in the
// `config_schema` of the manifest.
IMPORT os 
var ips = os.networkInterfaces();
Object
  .keys(ips)
  .forEach(function(_interface) {
     ips[_interface]
      .forEach(function(_dev) {
        if (_dev.family === 'IPv4' && !_dev.internal) ip = _dev.address 
      }) 
  });
console.log(ip)


export const DEFAULT_CONFIG = {
  // Empty: use the server-api sub-container started by the integration.
  server_url: ip+':3004',
  // Empty: the widget cannot build a link the browser can open.
  gladys_address: '',
  timezone: 'Europe/Paris',
};

function trimmedString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function validTimezone(value) {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return value;
  } catch {
    return DEFAULT_CONFIG.timezone;
  }
}

/**
 * Merge the user config with the defaults.
 * @param {Record<string, unknown>} raw config returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  return {
    ...DEFAULT_CONFIG,
    ...raw,
    // A pasted URL often carries a trailing slash: paths are appended to it.
    server_url: trimmedString(raw.server_url).replace(/\/+$/, ''),
    // Accept "http://192.168.1.5/" as well as "192.168.1.5": only the host is kept.
    gladys_address: trimmedString(raw.gladys_address)
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, ''),
    timezone: validTimezone(trimmedString(raw.timezone) || DEFAULT_CONFIG.timezone),
  };
}
