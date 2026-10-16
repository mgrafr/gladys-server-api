import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { normalizeConfig } from '../src/config.js';
import {
  INTERNAL_URL,
  archiveUrl,
  backup,
  containerVolumeDir,
  formatSize,
  gladysDataMissing,
  loadState,
  prepareContainerFiles,
  publicBaseUrl,
  runBackup,
} from '../src/serverApi.js';
import { RUNNING_CONTAINER, fakeServerApi, tempDataDir } from './helpers.js';

test('prepareContainerFiles writes save.sh and the backups folder into the volume', async () => {
  const dataDir = await tempDataDir();
  await prepareContainerFiles(dataDir);
  const volume = containerVolumeDir(dataDir);
  assert.equal(volume, path.join(dataDir, 'containers/server-api/opt/server-api'));
  const script = await readFile(path.join(volume, 'src/save.sh'), 'utf8');
  assert.match(script, /^#!\/bin\/bash/);
  assert.ok((await stat(path.join(volume, 'backups'))).isDirectory());
});

test('runBackup counts the archive answered by GET /backup', async () => {
  const server = fakeServerApi({ archiveBytes: 5000 });
  assert.deepEqual(await runBackup(INTERNAL_URL, { fetch: server.fetch }), { size_bytes: 5000 });
  assert.deepEqual(server.calls, ['http://server-api:3004/backup']);
});

test('runBackup reports the error details of server-api', async () => {
  const server = fakeServerApi({
    status: 500,
    errorBody: { error: 'Backup failed', details: 'save.sh: not found' },
  });
  await assert.rejects(
    runBackup(INTERNAL_URL, { fetch: server.fetch }),
    /HTTP 500\): save.sh: not found/,
  );
});

test('the public URL uses the Gladys address and the allocated host port', async () => {
  const gladys = createFakeGladys({ containers: [RUNNING_CONTAINER] });
  const config = normalizeConfig({ gladys_address: '192.168.1.5' });
  const base = await publicBaseUrl(gladys, config);
  assert.equal(base, 'http://192.168.1.5:41234');
  assert.equal(archiveUrl(base), 'http://192.168.1.5:41234/opt/server-api/backups/datas.tar.gz');
});

test('the public URL is unknown without a Gladys address or a host port', async () => {
  const gladys = createFakeGladys({ containers: [RUNNING_CONTAINER] });
  assert.equal(await publicBaseUrl(gladys, normalizeConfig()), null);
  const notStarted = createFakeGladys({
    containers: [
      { ...RUNNING_CONTAINER, ports: [{ ...RUNNING_CONTAINER.ports[0], host_port: null }] },
    ],
  });
  assert.equal(
    await publicBaseUrl(notStarted, normalizeConfig({ gladys_address: '10.0.0.2' })),
    null,
  );
  assert.equal(archiveUrl(null), null);
});

test('an external server is used as is, inside and outside', async () => {
  const gladys = createFakeGladys();
  const config = normalizeConfig({ server_url: 'http://192.168.1.5:3004' });
  assert.equal(await publicBaseUrl(gladys, config), 'http://192.168.1.5:3004');
  const server = fakeServerApi();
  const dataDir = await tempDataDir();
  await backup(gladys, { config, dataDir, fetch: server.fetch });
  assert.deepEqual(server.calls, ['http://192.168.1.5:3004/backup']);
});

test('backup records the date, the size and the link', async () => {
  const gladys = createFakeGladys({ containers: [RUNNING_CONTAINER] });
  const dataDir = await tempDataDir();
  const now = () => new Date('2026-10-16T17:42:00.000Z');
  const state = await backup(gladys, {
    config: normalizeConfig({ gladys_address: '192.168.1.5' }),
    dataDir,
    fetch: fakeServerApi({ archiveBytes: 1234 }).fetch,
    now,
  });
  assert.deepEqual(state, {
    last_success_at: '2026-10-16T17:42:00.000Z',
    size_bytes: 1234,
    url: 'http://192.168.1.5:41234/opt/server-api/backups/datas.tar.gz',
    data_missing: false,
  });
  assert.deepEqual(await loadState(dataDir), state);
});

test('a failed backup keeps the last success and records the error', async () => {
  const gladys = createFakeGladys({ containers: [RUNNING_CONTAINER] });
  const dataDir = await tempDataDir();
  const config = normalizeConfig();
  await backup(gladys, { config, dataDir, fetch: fakeServerApi().fetch });
  await assert.rejects(
    backup(gladys, { config, dataDir, fetch: fakeServerApi({ status: 500 }).fetch }),
    /HTTP 500/,
  );
  const state = await loadState(dataDir);
  assert.equal(state.size_bytes, 2048);
  assert.match(state.last_error, /HTTP 500/);
});

test('gladysDataMissing reads the last run of backup.log', async () => {
  const dataDir = await tempDataDir();
  assert.equal(await gladysDataMissing(dataDir), false, 'no log yet');
  await prepareContainerFiles(dataDir);
  const log = path.join(containerVolumeDir(dataDir), 'backups/backup.log');
  const missingRun = [
    '[Sun Oct  4 15:38:13 UTC 2026] Starting Docker backup',
    '[Sun Oct  4 15:38:13 UTC 2026] Exporting datas: /var/lib/gladysassistant',
    'tar: /var/lib/gladysassistant: No such file or directory',
    '',
  ].join('\n');
  await writeFile(log, missingRun);
  assert.equal(await gladysDataMissing(dataDir), true);
  const goodRun = [
    '[Sun Oct  5 15:38:13 UTC 2026] Starting Docker backup',
    "tar: Removing leading `/' from member names",
    '',
  ].join('\n');
  await writeFile(log, missingRun + goodRun);
  assert.equal(await gladysDataMissing(dataDir), false, 'only the last run counts');
});

test('formatSize speaks both languages', () => {
  assert.equal(formatSize(512, 'en'), '512 B');
  assert.equal(formatSize(7_340_032, 'en'), '7.0 MB');
  assert.equal(formatSize(7_340_032, 'fr'), '7,0 Mo');
});
