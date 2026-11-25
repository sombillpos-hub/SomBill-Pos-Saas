import { startHttpServer } from '@sombill/shared-utils';
import { createGatewayRuntime } from './config/runtime.js';

const runtime = await createGatewayRuntime();
startHttpServer(runtime.app, runtime.config.PORT, runtime.logger, [runtime.stop]);
