import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { PinoInstrumentation } from '@opentelemetry/instrumentation-pino';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { register } from 'import-in-the-middle/register-hooks.mjs';

// Loaded before the app with `node --import ./src/telemetry.ts`. Off unless an
// OTLP endpoint is set; the SDK reads the other OTEL_* variables itself.
if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
  // ESM modules are patched through this in-thread loader hook (module.registerHooks).
  register();

  const sdk = new NodeSDK({
    serviceName: '__id__-api',
    instrumentations: [
      new HttpInstrumentation(),
      new ExpressInstrumentation(),
      new PgInstrumentation(),
      new PinoInstrumentation(),
    ],
  });

  sdk.start();
  process.once('SIGTERM', () => void sdk.shutdown());
}
