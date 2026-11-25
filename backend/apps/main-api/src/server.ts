import { startHttpServer } from '@sombill/shared-utils';
import { createMainApiRuntime } from './config/runtime.js';

const runtime = await createMainApiRuntime();
startHttpServer(runtime.app, runtime.config.PORT, runtime.logger, [runtime.stop]);
