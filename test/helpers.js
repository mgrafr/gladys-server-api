// Shared test helpers: a temporary /data folder and a fake server-api.

import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

export function tempDataDir() {
  return mkdtemp(path.join(tmpdir(), 'gladys-server-api-'));
}

/**
 * A `fetch` standing in for server-api, recording the requested URLs.
 * @param {{ archiveBytes?: number, status?: number, errorBody?: object }} [options]
 */
export function fakeServerApi({ archiveBytes = 2048, status = 200, errorBody } = {}) {
  const calls = [];
  const fetch = async (url) => {
    calls.push(url);
    if (url.endsWith('/backup')) {
      if (status !== 200) {
        return Response.json(errorBody ?? { error: 'Backup failed' }, { status });
      }
      return new Response(new Uint8Array(archiveBytes), {
        headers: { 'content-type': 'application/gzip' },
      });
    }
    return Response.json({ hello: 'xxx' });
  };
  return { fetch, calls };
}

// What GET /container answers once Gladys allocated the host port.
export const RUNNING_CONTAINER = {
  name: 'server-api',
  status: 'running',
  desired: 'running',
  started_at: '2026-10-16T08:00:00.000Z',
  ports: [
    {
      container_port: 3004,
      protocol: 'tcp',
      host_port: 41234,
      label: { en: 'Server API' },
      name: 'server_api',
      browsable: false,
    },
  ],
};
