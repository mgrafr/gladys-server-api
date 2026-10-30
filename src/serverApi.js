// -----------------------------------------------------------------------------
// Driver of the server-api container (https://github.com/mgrafr/server-api).
//
// server-api is a Fastify server: `GET /backup_bd` runs its `save.sh` script,
// which archives the Gladys data folder into
// /opt/server-api/backups/datas.tar.gz, then answers that archive as an
// attachment. The same file is served statically, so the browser can download
// the last backup again without running a new one.
//
// Two ways to reach it:
//   - the `server-api` sub-container declared in the manifest, started by this
//     integration and reachable on its private network by its DNS alias;
//   - an external server-api the user runs (docker compose, with the Gladys
//     data folder mounted), when `server_url` is set in the configuration.
//
// The image runs `/opt/server-api/src/save.sh`, which the image itself does not
// ship: the integration writes it into the `/opt/server-api` volume before
// starting the container. The main container sees that volume under
// /data/containers/server-api/opt/server-api.
// -----------------------------------------------------------------------------

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createLogger } from '@gladysassistant/integration-sdk';

const logger = createLogger({ name: 'server-api' });

// As declared in the manifest `containers` field.
export const CONTAINER_NAME = 'server-api';
export const CONTAINER_PORT = 3004;
export const PORT_NAME = 'server_api';

// DNS alias of the sub-container on the private network of the integration.
export const INTERNAL_URL = `http://${CONTAINER_NAME}:${CONTAINER_PORT}`;

// Served by the @fastify/static plugin of server-api.
export const ARCHIVE_PATH = '/opt/server-api/backups/datas.tar.gz';
export const ARCHIVE_UPLOAD_PATH = '/opt/server-api/uploads/datas.tar.gz';
// The only writable volume of the main container. Overridable for local runs.
export const DATA_DIR = process.env.DATA_DIR ?? '/data';

// save.sh runs under a 60 s timeout server-side; keep a margin under the
// 120 s acknowledgement delay of the manifest action.
const BACKUP_TIMEOUT_MS = 110_000;
const RESTORE_TIMEOUT_MS = 110_000;
const HEALTH_TIMEOUT_MS = 10_000;

const STATE_FILE = 'last-backup.json';
const BUNDLED_SCRIPT = new URL('./save.sh', import.meta.url);

// What tar writes to backup.log when the Gladys data folder is not mounted.
const MISSING_DATA_PATTERN = /gladysassistant: No such file or directory/;

/** Folder of the main container mounted as /opt/server-api in the sub-container. */
export function containerVolumeDir(dataDir = DATA_DIR) {
  return path.join(dataDir, 'containers', CONTAINER_NAME, 'opt', 'server-api');
}

/**
 * Write the files the server-api image expects under /opt/server-api.
 * @param {string} [dataDir]
 */
export async function prepareContainerFiles(dataDir = DATA_DIR) {
  const volume = containerVolumeDir(dataDir);
  await mkdir(path.join(volume, 'src'), { recursive: true });
  await mkdir(path.join(volume, 'backups'), { recursive: true });
   await mkdir(path.join(volume, 'uploads'), { recursive: true });
  // Rewritten at every start: the script follows the integration version.
  await writeFile(path.join(volume, 'src', 'save.sh'), await readFile(BUNDLED_SCRIPT), {
    mode: 0o755,
  });
  await writeFile(path.join(volume, 'src', 'restore.sh'), await readFile(BUNDLED_SCRIPT), {
    mode: 0o755,
  });
}

/**
 * Start the sub-container, or stop it when an external server is configured.
 * @param {import('@gladysassistant/integration-sdk').GladysIntegration} gladys
 * @param {{ server_url: string }} config
 */
export async function ensureServer(gladys, config, dataDir = DATA_DIR) {
  if (config.server_url) {
    const containers = await gladys.getContainers();
    const container = containers.find((c) => c.name === CONTAINER_NAME);
    if (container?.desired === 'running') {
      logger.info('External server configured -> stopping the server-api sub-container');
      await gladys.stopContainer(CONTAINER_NAME);
    }
    return;
  }
  await prepareContainerFiles(dataDir);
  await gladys.startContainer(CONTAINER_NAME);
}

/**
 * Base URL of server-api, as seen from the integration container.
 * @param {{ server_url: string }} config
 */
export function internalBaseUrl(config) {
  return config.server_url || INTERNAL_URL;
}

/**
 * Base URL of server-api as a browser on the LAN reaches it, or null when it
 * cannot be known (no Gladys address configured, or no host port allocated).
 * @param {import('@gladysassistant/integration-sdk').GladysIntegration} gladys
 * @param {{ server_url: string, gladys_address: string }} config
 */
export async function publicBaseUrl(gladys, config) {
 if (!config.gladys_address) {
    return null;
  }
  const containers = await gladys.getContainers();
  const port = containers
    .find((c) => c.name === CONTAINER_NAME)
    ?.ports?.find((p) => p.name === PORT_NAME)?.host_port;
  return port ? `http://${config.gladys_address}:${port}` : null;
}

/** Download link of the last archive, or null (see publicBaseUrl). */
export function archiveUrl(baseUrl) {
  return baseUrl ? `${baseUrl}${ARCHIVE_PATH}` : null;
}

/**
 * Check that server-api answers on its root route.
 * @param {string} baseUrl
 * @param {{ fetch?: typeof fetch }} [options]
 */
export async function checkServer(baseUrl, { fetch = globalThis.fetch } = {}) {
  const response = await fetch(`${baseUrl}/`, { signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS) });
  if (!response.ok) {
    throw new Error(`server-api answered HTTP ${response.status}`);
  }
  return response.json();
}

/**
 * Run a backup: `GET /backup_bd`, the archive comes back as the response body.
 * The body is only counted, never kept: the archive stays on the server side.
 * @param {string} baseUrl
 * @param {{ fetch?: typeof fetch }} [options]
 * @returns {Promise<{ size_bytes: number }>}
 */
export async function runBackup(baseUrl, { fetch = globalThis.fetch } = {}) {
  logger.info(`Backup <- GET ${baseUrl}/backup_bd`);
  const response = await fetch(`${baseUrl}/backup_bd`, {
    signal: AbortSignal.timeout(BACKUP_TIMEOUT_MS),
  });
  if (!response.ok) {
    let details = '';
    try {
      const body = await response.json();
      details = body.details || body.error || '';
    } catch {
      // Not a JSON error body: the status says enough.
    }
    throw new Error(`Backup failed (HTTP ${response.status})${details ? `: ${details}` : ''}`);
  }
  let size = 0;
  for await (const chunk of response.body ?? []) {
    size += chunk.length;
  }
  logger.info(`Backup done, ${size} bytes`);
  return { size_bytes: size };
}

/**
 * Run a restore: `GET /restore-bd`, the archive comes back as the response body.
 * The body is only counted, never kept: the archive stays on the server side.
 * @param {string} baseUrl
 * @param {{ fetch?: typeof fetch }} [options]
 * @returns {Promise<{ size_bytes: number }>}
 */
export async function runRestore(baseUrl, { fetch = globalThis.fetch } = {}) {
  logger.info(`Backup <- POST ${baseUrl}/upload`);
  const response = await fetch(`${baseUrl}/upload`, {
    signal: AbortSignal.timeout(RESTORE_UPLOAD_TIMEOUT_MS),
  });
  if (!response.ok) {
    let details = '';
    try {
      const body = await response.json();
      details = body.details || body.error || '';
    } catch {
      // Not a JSON error body: the status says enough.
    }
    throw new Error(`Restore failed (HTTP ${response.status})${details ? `: ${details}` : ''}`);
  }
  let size = 0;
  for await (const chunk of response.body ?? []) {
    size += chunk.length;
  }
  logger.info(`Restore done, ${size} bytes`);
  return { size_bytes: size };
}

/**
 * The restore operation shared by the manifest action, the scene action and the
 * widget button: run it, record the outcome, nudge the widget.
 * @param {import('@gladysassistant/integration-sdk').GladysIntegration} gladys
 * @param {{ config: object, dataDir?: string, fetch?: typeof fetch, now?: () => Date,
 *   onRecorded?: () => void }} options
 */
export async function restore(
  gladys,
  { config, dataDir = DATA_DIR, fetch = globalThis.fetch, now = () => new Date(), onRecorded },
) {
  const previous = await loadState(dataDir);
  try {
    const { size_bytes } = await runRestore(internalBaseUrl(config), { fetch });
    const state = {
      last_success_at: now().toISOString(),
      size_bytes,
      url: archiveUrl(await publicBaseUrl(gladys, config)),
      // An external server reads the real Gladys folder: nothing to check.
      data_missing: config.server_url ? false : await gladysDataMissing(dataDir),
    };
    await saveState(state, dataDir);
    return state;
  } catch (err) {
    await saveState(
      { ...previous, last_error: err.message, last_error_at: now().toISOString() },
      dataDir,
    );
    throw err;
  } finally {
    onRecorded?.();
  }
}


/**
 * Whether the last run of save.sh found no Gladys data to archive. Only
 * readable for the sub-container, whose backup.log lives in our volume.
 * @param {string} [dataDir]
 */
export async function gladysDataMissing(dataDir = DATA_DIR) {
  try {
    const log = await readFile(
      path.join(containerVolumeDir(dataDir), 'backups', 'backup.log'),
      'utf8',
    );
    const lastRun = log.slice(log.lastIndexOf('Starting Docker backup'));
    return MISSING_DATA_PATTERN.test(lastRun);
  } catch {
    return false;
  }
}

/**
 * Last backup outcome, persisted under /data so the widget survives restarts.
 * @param {string} [dataDir]
 * @returns {Promise<{ last_success_at?: string, size_bytes?: number, url?: string | null,
 *   data_missing?: boolean, last_error?: string, last_error_at?: string }>}
 */
export async function loadState(dataDir = DATA_DIR) {
  try {
    return JSON.parse(await readFile(path.join(dataDir, STATE_FILE), 'utf8'));
  } catch {
    return {};
  }
}

export async function saveState(state, dataDir = DATA_DIR) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(path.join(dataDir, STATE_FILE), JSON.stringify(state, null, 2));
}

/**
 * The backup operation shared by the manifest action, the scene action and the
 * widget button: run it, record the outcome, nudge the widget.
 * @param {import('@gladysassistant/integration-sdk').GladysIntegration} gladys
 * @param {{ config: object, dataDir?: string, fetch?: typeof fetch, now?: () => Date,
 *   onRecorded?: () => void }} options
 */
export async function backup(
  gladys,
  { config, dataDir = DATA_DIR, fetch = globalThis.fetch, now = () => new Date(), onRecorded },
) {
  const previous = await loadState(dataDir);
  try {
    const { size_bytes } = await runBackup(internalBaseUrl(config), { fetch });
    const state = {
      last_success_at: now().toISOString(),
      size_bytes,
      url: archiveUrl(await publicBaseUrl(gladys, config)),
      // An external server reads the real Gladys folder: nothing to check.
      data_missing: config.server_url ? false : await gladysDataMissing(dataDir),
    };
    await saveState(state, dataDir);
    return state;
  } catch (err) {
    await saveState(
      { ...previous, last_error: err.message, last_error_at: now().toISOString() },
      dataDir,
    );
    throw err;
  } finally {
    onRecorded?.();
  }
}


/** Human-readable size, e.g. 7340032 -> "7.0 MB". */
export function formatSize(bytes, language = 'en') {
  const units = language === 'fr' ? ['o', 'Ko', 'Mo', 'Go'] : ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = unit === 0 ? 0 : 1;
  return `${value.toLocaleString(language, { minimumFractionDigits: digits, maximumFractionDigits: digits })} ${units[unit]}`;
}

/** Localized date and time, e.g. "16 oct. 2026, 19:42". */
export function formatDate(iso, language = 'en', timeZone = 'UTC') {
  return new Intl.DateTimeFormat(language, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  }).format(new Date(iso));
}
