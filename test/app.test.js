// End to end: the handlers of src/app.js against the fake Gladys of the SDK.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../src/app.js';
import { containerVolumeDir } from '../src/serverApi.js';
import { LAST_BACKUP_WIDGET } from '../src/widgets.js';
import { RUNNING_CONTAINER, fakeServerApi, tempDataDir } from './helpers.js';

async function setup({
  config = { gladys_address: '192.168.1.5' },
  server = fakeServerApi(),
} = {}) {
  const gladys = createFakeGladys({ config, containers: [RUNNING_CONTAINER] });
  const dataDir = await tempDataDir();
  registerHandlers(gladys, { dataDir, fetch: server.fetch });
  await gladys.connect();
  return { gladys, dataDir, server };
}

const containerRequests = (gladys) =>
  gladys.fake.requests
    .filter((r) => r.path.startsWith('/container/'))
    .map((r) => `${r.method} ${r.path}`);

test('on connection the sub-container gets save.sh and is started', async () => {
  const { gladys, dataDir } = await setup();
  await access(path.join(containerVolumeDir(dataDir), 'src/save.sh'));
  assert.deepEqual(containerRequests(gladys), ['POST /container/server-api/start']);
  assert.equal(gladys.fake.connectionStatus.connected, true);
});

test('with an external server the sub-container is stopped instead', async () => {
  const { gladys } = await setup({ config: { server_url: 'http://192.168.1.5:3004' } });
  assert.deepEqual(containerRequests(gladys), ['POST /container/server-api/stop']);
});

test('the backup action answers the size and the download link, and nudges the widget', async () => {
  const { gladys } = await setup({ server: fakeServerApi({ archiveBytes: 7_340_032 }) });
  const before = gladys.fake.widgetRefreshes.length;
  const ack = await gladys.fake.action('backup', {});
  assert.equal(ack.success, true);
  assert.equal(
    ack.data.message.fr,
    'Sauvegarde effectuée (7,0 Mo). http://192.168.1.5:41234/opt/server-api/backups/datas.tar.gz',
  );
  assert.equal(gladys.fake.widgetRefreshes.length, before + 1);
});

test('a failing backup fails the action with the reason', async () => {
  const { gladys } = await setup({ server: fakeServerApi({ status: 500 }) });
  const ack = await gladys.fake.action('backup', {});
  assert.equal(ack.success, false);
  assert.match(ack.error, /HTTP 500/);
});

test('test_server checks the root route', async () => {
  const { gladys, server } = await setup();
  const ack = await gladys.fake.action('test_server', {});
  assert.equal(ack.success, true);
  assert.deepEqual(server.calls, ['http://server-api:3004/']);
});

test('the scene action returns the declared outputs', async () => {
  const { gladys } = await setup({ server: fakeServerApi({ archiveBytes: 99 }) });
  const ack = await gladys.fake.sceneAction('backup', {});
  assert.equal(ack.success, true);
  assert.deepEqual(ack.data.outputs, {
    url: 'http://192.168.1.5:41234/opt/server-api/backups/datas.tar.gz',
    size_bytes: 99,
  });
});

const getWidget = async (gladys, language = 'fr') => {
  const ack = await gladys.fake.widgetGet(LAST_BACKUP_WIDGET, {
    settings: {},
    language,
    units: 'metric',
  });
  assert.equal(ack.success, true);
  return ack.data.content;
};

test('the widget shows an empty state before the first backup', async () => {
  const { gladys } = await setup();
  const content = await getWidget(gladys);
  assert.deepEqual(validateWidgetContent(content), []);
  const text = content.components.find((c) => c.type === 'text');
  assert.match(text.text.fr, /Lancez une sauvegarde/);
});

test('the widget shows the date and the link of the last backup', async () => {
  const { gladys } = await setup();
  await gladys.fake.widgetAction(LAST_BACKUP_WIDGET, 'backup', {}, { settings: {} });
  const content = await getWidget(gladys);
  assert.deepEqual(validateWidgetContent(content), []);
  const [date, size] = content.components.find((c) => c.type === 'status').items;
  assert.equal(date.color, 'success');
  assert.match(date.value, /2\d{3}/, 'a formatted date');
  assert.equal(size.value, '2,0 Ko');
  const text = content.components.find((c) => c.type === 'text');
  assert.equal(text.text, 'http://192.168.1.5:41234/opt/server-api/backups/datas.tar.gz');
});

test('the widget asks for the Gladys address when the link cannot be built', async () => {
  const { gladys } = await setup({ config: {} });
  await gladys.fake.action('backup', {});
  const content = await getWidget(gladys, 'en');
  assert.deepEqual(validateWidgetContent(content), []);
  const text = content.components.find((c) => c.type === 'text');
  assert.match(text.text.en, /Gladys IP address/);
});

test('an unknown widget action fails', async () => {
  const { gladys } = await setup();
  const ack = await gladys.fake.widgetAction(LAST_BACKUP_WIDGET, 'unknown', {}, { settings: {} });
  assert.equal(ack.success, false);
  assert.match(ack.error, /Unknown widget action/);
});
