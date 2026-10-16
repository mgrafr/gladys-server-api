// -----------------------------------------------------------------------------
// Consistency checks between `gladys-assistant-integration.json` and the code.
// The manifest is validated by the store indexer, but nothing there can know
// which handlers the code actually registers — these tests keep both in sync.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../src/app.js';
import { DEFAULT_CONFIG } from '../src/config.js';
import { CONTAINER_NAME, CONTAINER_PORT, PORT_NAME } from '../src/serverApi.js';
import { LAST_BACKUP_WIDGET } from '../src/widgets.js';
import { tempDataDir } from './helpers.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

const allFields = [
  ...(manifest.config_schema ?? []),
  ...[...(manifest.actions ?? []), ...(manifest.scene_actions ?? [])].flatMap(
    (item) => item.fields ?? [],
  ),
  ...(manifest.widgets ?? []).flatMap((widget) => widget.settings ?? []),
];

const keysOf = (list) => (list ?? []).map((entry) => entry.key);

// Every handler registered by src/app.js, per kind.
const gladys = createFakeGladys();
const registered = { action: [], sceneAction: [], widgetGet: [], widgetAction: [] };
for (const kind of Object.keys(registered)) {
  const method = `on${kind[0].toUpperCase()}${kind.slice(1)}`;
  const original = gladys[method].bind(gladys);
  gladys[method] = (key, cb) => {
    registered[kind].push(key);
    return original(key, cb);
  };
}
registerHandlers(gladys, { dataDir: await tempDataDir() });

function minGladysVersion() {
  const match = manifest.gladys_version.match(/>=\s*(\d+)\.(\d+)\.(\d+)/);
  assert.ok(match, 'gladys_version must declare a minimum version');
  return match.slice(1).map(Number);
}

test('provider type, widgets and scene actions require Gladys >= 5.1.0', () => {
  const [major, minor] = minGladysVersion();
  assert.ok(major > 5 || (major === 5 && minor >= 1), manifest.gladys_version);
});

test('every manifest action has a handler, and vice versa', () => {
  assert.deepEqual(keysOf(manifest.actions).sort(), [...registered.action].sort());
});

test('every scene_actions key has a handler, and vice versa', () => {
  assert.deepEqual(keysOf(manifest.scene_actions).sort(), [...registered.sceneAction].sort());
});

test('every widget has a content and an action handler', () => {
  assert.deepEqual(keysOf(manifest.widgets), [LAST_BACKUP_WIDGET]);
  assert.deepEqual(registered.widgetGet, [LAST_BACKUP_WIDGET]);
  assert.deepEqual(registered.widgetAction, [LAST_BACKUP_WIDGET]);
});

test('the sub-container declaration matches what the code drives', () => {
  const container = manifest.containers.find((c) => c.name === CONTAINER_NAME);
  assert.ok(container, `container "${CONTAINER_NAME}" must be declared`);
  // Started by the integration once save.sh is in its volume.
  assert.equal(container.start, 'manual');
  assert.ok(container.volumes.includes('/opt/server-api'));
  const port = container.ports.find((p) => p.name === PORT_NAME);
  assert.equal(port?.container_port, CONTAINER_PORT);
});

test('the server-api image is pinned to an explicit tag', () => {
  const container = manifest.containers.find((c) => c.name === CONTAINER_NAME);
  assert.match(container.docker_image, /:[^/]+$/);
  assert.notEqual(container.docker_image.split(':').pop(), 'latest');
});

test('config_schema defaults stay consistent with DEFAULT_CONFIG', () => {
  for (const field of manifest.config_schema) {
    if (field.default !== undefined) {
      assert.equal(DEFAULT_CONFIG[field.key], field.default, `DEFAULT_CONFIG.${field.key}`);
    }
  }
  for (const field of manifest.config_schema.filter((f) => f.type !== 'section')) {
    assert.ok(field.key in DEFAULT_CONFIG, `config key "${field.key}" needs a default`);
  }
});

test('section fields are purely presentational', () => {
  for (const section of manifest.config_schema.filter((f) => f.type === 'section')) {
    assert.equal(section.required, undefined);
    assert.equal(section.default, undefined);
    assert.equal(section.placeholder, undefined);
    assert.ok(!(section.key in DEFAULT_CONFIG));
    for (const link of section.links ?? []) {
      assert.match(link.url, /^https:\/\//, 'section links must be https');
    }
  }
});

test('every {{port:<name>}} placeholder references a declared port', () => {
  const names = manifest.containers.flatMap((c) => (c.ports ?? []).map((p) => p.name));
  const text = JSON.stringify(manifest.config_schema);
  for (const [, name] of text.matchAll(/\{\{port:([a-z0-9_]+)\}\}/g)) {
    assert.ok(names.includes(name), `unknown port name "${name}"`);
  }
});

test('the manifest version is the package version, and the image is tagged with it', () => {
  assert.equal(manifest.version, pkg.version, 'manifest version must match package.json');
  assert.ok(
    manifest.docker_image.endsWith(`:${manifest.version}`),
    `docker_image must be tagged :${manifest.version}, got "${manifest.docker_image}"`,
  );
});

test('the catalog description holds 10 to 100 characters per language', () => {
  assert.ok(manifest.description.en);
  for (const [lang, text] of Object.entries(manifest.description)) {
    assert.ok(text.length >= 10 && text.length <= 100, `description.${lang}: ${text.length}`);
  }
});

test('every user-facing text is bilingual', () => {
  const texts = [];
  const walk = (node) => {
    if (Array.isArray(node)) {
      node.forEach(walk);
    } else if (node && typeof node === 'object') {
      for (const [key, value] of Object.entries(node)) {
        if (['label', 'description', 'placeholder'].includes(key)) {
          texts.push(value);
        } else {
          walk(value);
        }
      }
    }
  };
  walk(manifest);
  for (const text of texts) {
    assert.equal(typeof text, 'object', JSON.stringify(text));
    assert.ok(text.en && text.fr, JSON.stringify(text));
  }
});

test('field placeholders are multi-language objects', () => {
  for (const field of allFields.filter((f) => f.placeholder !== undefined)) {
    assert.equal(typeof field.placeholder, 'object', `field "${field.key}": placeholder`);
  }
});
