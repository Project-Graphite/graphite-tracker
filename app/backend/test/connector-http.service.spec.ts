import {
  BadGatewayException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConnectorHttpService } from '../src/sources/connector-http.service';
import { ConnectorDescriptor } from '../src/sources/source.types';

const descriptor: ConnectorDescriptor = {
  key: 'example',
  displayName: 'Example',
  categories: ['movie'],
  languages: [],
  attribution: 'Example data',
  capabilities: ['SEARCH'],
  outboundDomains: ['example.org'],
  requestIntervalMs: 0,
  enabled: true,
};

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });

describe('ConnectorHttpService', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('retries a rate-limited request after its Retry-After delay', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 429, headers: { 'Retry-After': '0' } }))
      .mockResolvedValueOnce(json({ ok: true }));
    vi.stubGlobal('fetch', request);

    await expect(
      new ConnectorHttpService().json(descriptor, new URL('https://api.example.org/items')),
    ).resolves.toEqual({ ok: true });
    expect(request).toHaveBeenCalledTimes(2);
    expect((request.mock.calls[0] as [URL, RequestInit])[1].headers).toMatchObject({
      'User-Agent': expect.stringContaining('GraphiteTracker'),
    });
  });

  it('maps a missing title to not found without retrying', async () => {
    const request = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
    vi.stubGlobal('fetch', request);

    await expect(
      new ConnectorHttpService().json(descriptor, new URL('https://api.example.org/items/1')),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('fails fast while the circuit is open after repeated failures', async () => {
    const request = vi.fn().mockImplementation(() =>
      Promise.resolve(new Response(null, { status: 400 })),
    );
    vi.stubGlobal('fetch', request);
    const http = new ConnectorHttpService();
    const url = new URL('https://api.example.org/items');

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(http.json(descriptor, url)).rejects.toBeInstanceOf(BadGatewayException);
    }
    await expect(http.json(descriptor, url)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(request).toHaveBeenCalledTimes(5);
  });

  it('refuses hosts the connector does not declare', async () => {
    const request = vi.fn();
    vi.stubGlobal('fetch', request);

    await expect(
      new ConnectorHttpService().json(descriptor, new URL('https://example.com/items')),
    ).rejects.toThrow('example may not request example.com');
    await expect(
      new ConnectorHttpService().json(descriptor, new URL('http://api.example.org/items')),
    ).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });
});
