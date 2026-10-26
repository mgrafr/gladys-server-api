// -----------------------------------------------------------------------------
// Handlers of the integration, registered on a Gladys client: the real one in
// index.js, the fake Gladys of the SDK in the tests.
// -----------------------------------------------------------------------------

import { logger } from '@gladysassistant/integration-sdk';
import { normalizeConfig } from './config.js';
import {
  DATA_DIR,
  backup,
  checkServer,
  ensureServer,
  formatSize,
  internalBaseUrl,
  loadState,
} from './serverApi.js';
import { LAST_BACKUP_ACTIONS, LAST_BACKUP_WIDGET, buildLastBackupContent } from './widgets.js';

/**
 * @param {import('@gladysassistant/integration-sdk').GladysIntegration} gladys
 * @param {{ dataDir?: string, fetch?: typeof fetch }} [options]
 */
export function registerHandlers(gladys, { dataDir = DATA_DIR, fetch = globalThis.fetch } = {}) {
  // Current configuration (hot-reloaded via onConfigUpdated).
  let config = normalizeConfig();

  // Every entry point runs the same backup and nudges the widget afterwards,
  // success or failure: both change what it shows.
  const runBackup = () =>
    backup(gladys, {
      config,
      dataDir,
      fetch,
      onRecorded: () => gladys.requestWidgetRefresh(LAST_BACKUP_WIDGET),
    });

  async function setup() {
    await ensureServer(gladys, config, dataDir);
    await gladys.setConnectionStatus(true);
  }

  // --- Manifest actions: buttons in the Configuration screen -----------------
  gladys.onAction('backup', async () => {
    logger.info('Action backup');
    const { size_bytes, url, data_missing } = await runBackup();
    const size = { en: formatSize(size_bytes, 'en'), fr: formatSize(size_bytes, 'fr') };
    const where = url ?? '';
    if (data_missing) {
      return {
        en: `Backup done (${size.en}), but the Gladys data folder is not mounted in the container: the archive is empty. See the documentation. ${where}`.trim(),
        fr: `Sauvegarde effectuée (${size.fr}), mais le dossier de données de Gladys n'est pas monté dans le conteneur : l'archive est vide. Voir la documentation. ${where}`.trim(),
      };
    }
    return {
      en: `Backup done (${size.en}). ${where}`.trim(),
      fr: `Sauvegarde effectuée (${size.fr}). ${where}`.trim(),
    };
  });

gladys.onAction('restore', async () => {
    logger.info('Action restore');
    const { size_bytes, url, data_missing } = await runRestore();
    const size = { en: formatSize(size_bytes, 'en'), fr: formatSize(size_bytes, 'fr') };
    const where = url ?? '';
    if (data_missing) {
      return {
        en: `Restore done (${size.en}), but the Gladys data folder is not mounted in the container: the archive is empty. See the documentation. ${where}`.trim(),
        fr: `Restore effectuée (${size.fr}), mais le dossier de données de Gladys n'est pas monté dans le conteneur : l'archive est vide. Voir la documentation. ${where}`.trim(),
      };
    }
    return {
      en: `Restore done (${size.en}). ${where}`.trim(),
      fr: `Restauration effectuée (${size.fr}). ${where}`.trim(),
    };
  });
  
  gladys.onAction('test_server', async () => {
    const baseUrl = internalBaseUrl(config);
    logger.info(`Action test_server -> ${baseUrl}`);
    await checkServer(baseUrl, { fetch });
    return {
      en: `server-api answers on ${baseUrl}.`,
      fr: `server-api répond sur ${baseUrl}.`,
    };
  });

  // --- Dashboard widget ------------------------------------------------------
  gladys.onWidgetGet(LAST_BACKUP_WIDGET, async ({ language }) =>
    buildLastBackupContent(await loadState(dataDir), { language, timezone: config.timezone }),
  );

  // After a successful action the core drops the cached content and every
  // open dashboard refetches it.
  gladys.onWidgetAction(LAST_BACKUP_WIDGET, async (actionKey) => {
    logger.info(`onWidgetAction <- ${LAST_BACKUP_WIDGET}.${actionKey}`);
    if (actionKey !== LAST_BACKUP_ACTIONS.BACKUP) {
      throw new Error(`Unknown widget action: ${actionKey}`);
    }
    await runBackup();
    return { en: 'Backup completed', fr: 'Sauvegarde effectuée' };
  });

  // --- Configuration updated by the user -------------------------------------
  gladys.onConfigUpdated(async (newConfig) => {
    logger.info('onConfigUpdated -> new configuration received');
    config = normalizeConfig(newConfig);
    // Switching to / from an external server starts or stops the container.
    await setup();
    // The date format and the link follow the config.
    gladys.requestWidgetRefresh(LAST_BACKUP_WIDGET);
  });

  // --- Connection lifecycle --------------------------------------------------
  gladys.on('connected', async () => {
    try {
      config = normalizeConfig(await gladys.getConfig());
      await setup();
      // Nudges sent while the socket was down were dropped.
      gladys.requestWidgetRefresh(LAST_BACKUP_WIDGET);
    } catch (err) {
      logger.error('Post-connection initialization failed', err);
      await gladys
        .setConnectionStatus(false, {
          en: 'Unable to start server-api, check the integration logs.',
          fr: "Impossible de démarrer server-api, consultez les logs de l'intégration.",
        })
        .catch(() => {});
    }
  });
}
