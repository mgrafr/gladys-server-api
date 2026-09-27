import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { registerRuntime } from './src/index.js';

const gladys = new GladysIntegration();
registerRuntime(gladys);
gladys.handleShutdown();

logger.info('Starting gladys server api integration...');
gladys.connect().catch((error) => {
  logger.error('Initial connection failed', error);
  process.exit(1);
});
