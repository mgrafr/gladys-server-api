import {
  GladysIntegration,
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
  logger,
} from "@gladysassistant/integration-sdk";

const gladys = new GladysIntegration();

// Appelé quand l'utilisateur demande à Gladys de scanner de nouveaux appareils.
// Publiez la liste complète des appareils que votre intégration peut offrir.
gladys.onScanRequest(async () => {
  const ids = gladys.externalIds("switch", "0x00158d0001a2b3c4");
  await gladys.publishDiscoveredDevices([
    {
      name: "Interrupteur virtuel",
      external_id: ids.device,
      features: [
        {
          name: "Marche/Arrêt",
          external_id: ids.feature("binary"),
          category: DEVICE_FEATURE_CATEGORIES.SWITCH,
          type: DEVICE_FEATURE_TYPES.SWITCH.BINARY,
          min: 0,
          max: 1,
          read_only: false,
          has_feedback: true,
          keep_history: true,
        },
      ],
    },
  ]);
});

// Appelé quand l'utilisateur allume ou éteint l'interrupteur depuis Gladys.
// Faites le vrai travail ici, puis confirmez le nouvel état à Gladys.
gladys.onSetValue(async (device, feature, value) => {
  // ... envoyez la commande à votre vrai appareil ici ...
  await gladys.publishState(feature.external_id, value);
});

// Réagissez aux changements de configuration faits par l'utilisateur.
gladys.onConfigUpdated(async (config) => {
  logger.info("Configuration mise à jour", config);
});

// Quittez proprement sur SIGTERM/SIGINT (arrêt, redémarrage ou mise à jour Docker).
gladys.handleShutdown();

// Authentifiez-vous, ouvrez le WebSocket, et resynchronisez.
await gladys.connect();
