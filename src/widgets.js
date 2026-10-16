// -----------------------------------------------------------------------------
// Dashboard widgets (SDK v0.14+, Gladys 5.1+).
//
// The `last_backup` widget shows the date of the last databases backup, its
// size and its download link, plus a button to run a new one.
//
// Widget links (`button.link`, `card-list` links) are https only, and
// server-api answers plain http on the LAN: the download URL is shown as text,
// to copy into the browser.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { formatDate, formatSize } from './serverApi.js';

// Widget key, as declared in the manifest `widgets` field.
export const LAST_BACKUP_WIDGET = 'last_backup';

// Keys of the `button` actions the last_backup content declares.
export const LAST_BACKUP_ACTIONS = { BACKUP: 'backup' };

// Status values are capped at 40 characters by the core.
function truncate(text, max = 40) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * Content of the last_backup widget.
 * @param {object} state - see loadState in src/serverApi.js
 * @param {{ language: string, timezone: string }} options
 */
export function buildLastBackupContent(state, { language, timezone }) {
  const items = [];
  if (state.last_success_at) {
    items.push(
      {
        label: { en: 'Date', fr: 'Date' },
        icon: 'calendar',
        value: formatDate(state.last_success_at, language, timezone),
        color: state.data_missing ? WIDGET_COLORS.WARNING : WIDGET_COLORS.SUCCESS,
      },
      {
        label: { en: 'Size', fr: 'Taille' },
        icon: 'hard-drive',
        value: formatSize(state.size_bytes ?? 0, language),
        color: WIDGET_COLORS.NEUTRAL,
      },
    );
  } else {
    items.push({
      label: { en: 'Date', fr: 'Date' },
      icon: 'calendar',
      value: { en: 'No backup yet', fr: 'Aucune sauvegarde' },
      color: WIDGET_COLORS.NEUTRAL,
    });
  }
  if (state.data_missing) {
    items.push({
      label: { en: 'Warning', fr: 'Attention' },
      icon: 'alert-triangle',
      value: { en: 'Gladys data not mounted', fr: 'Données Gladys non montées' },
      color: WIDGET_COLORS.WARNING,
    });
  }
  // Only an error more recent than the last success is still relevant.
  if (state.last_error && !(state.last_success_at > state.last_error_at)) {
    items.push({
      label: { en: 'Last attempt', fr: 'Dernière tentative' },
      icon: 'x-circle',
      value: truncate(state.last_error),
      color: WIDGET_COLORS.DANGER,
    });
  }

  let link;
  if (!state.last_success_at) {
    link = {
      en: 'Run a backup to get its download link.',
      fr: 'Lancez une sauvegarde pour obtenir son lien de téléchargement.',
    };
  } else if (state.url) {
    link = state.url;
  } else {
    link = {
      en: 'Fill in the Gladys IP address in the integration configuration to get the download link.',
      fr: "Renseignez l'adresse IP de Gladys dans la configuration de l'intégration pour obtenir le lien de téléchargement.",
    };
  }

  return {
    // The content only changes on a backup, which nudges the widget itself:
    // the TTL is a safety net.
    ttl_seconds: 600,
    components: [
      { type: 'status', items },
      { type: 'text', variant: 'body', text: link },
      {
        type: 'button',
        label: { en: 'Back up now', fr: 'Sauvegarder' },
        icon: 'save',
        style: 'primary',
        action: { key: LAST_BACKUP_ACTIONS.BACKUP, confirm: true },
      },
    ],
  };
}
