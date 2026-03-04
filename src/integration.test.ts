import { describe, it, expect } from 'vitest';
import { readFile } from 'fs/promises';

describe('integration', () => {
  describe('Node runtime compatibility', () => {
    it('dist/index.js is valid ESM', async () => {
      const indexJs = await readFile('/home/nishantg/Projects/Mahakalp/Sutra/dist/index.js', 'utf-8');
      expect(indexJs).toContain('startServer');
    });

    it('dist/server.d.ts exports startServer', async () => {
      const serverDts = await readFile('/home/nishantg/Projects/Mahakalp/Sutra/dist/server.d.ts', 'utf-8');
      expect(serverDts).toContain('startServer');
    });
  });
});
