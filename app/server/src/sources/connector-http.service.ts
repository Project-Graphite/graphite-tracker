import {
  BadGatewayException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConnectorDescriptor } from './source.types';

const userAgent =
  'GraphiteTracker/0.1 (+https://github.com/Project-Graphite/graphite-tracker)';
const maxAttempts = 3;
const maxRetryDelayMs = 10_000;
const maxResponseBytes = 5 * 1024 * 1024;
const circuitThreshold = 5;
const circuitOpenMs = 30_000;
const retryableStatuses = new Set([429, 500, 502, 503, 504]);

interface ConnectorState {
  queue: Promise<void>;
  lastRequestAt: number;
  failures: number;
  openUntil: number;
}

interface ConnectorRequest {
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
}

const delay = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

@Injectable()
export class ConnectorHttpService {
  private readonly states = new Map<string, ConnectorState>();

  async json<T>(
    connector: ConnectorDescriptor,
    url: URL,
    request: ConnectorRequest = {},
  ): Promise<T> {
    if (
      url.protocol !== 'https:' ||
      !connector.outboundDomains.some(
        (domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`),
      )
    ) {
      throw new Error(`${connector.key} may not request ${url.hostname}`);
    }
    const state = this.state(connector.key);
    if (state.openUntil > Date.now()) {
      throw new ServiceUnavailableException(
        `${connector.displayName} is temporarily unavailable`,
      );
    }
    for (let attempt = 1; ; attempt += 1) {
      await this.pace(connector, state);
      let response: Response;
      try {
        response = await fetch(url, {
          method: request.method ?? 'GET',
          headers: {
            Accept: 'application/json',
            'User-Agent': userAgent,
            ...request.headers,
          },
          body: request.body,
          redirect: 'error',
          signal: AbortSignal.timeout(8_000),
        });
      } catch {
        if (attempt < maxAttempts) {
          await delay(this.backoff(attempt));
          continue;
        }
        throw this.failed(
          state,
          new BadGatewayException(`${connector.displayName} request failed`),
        );
      }
      if (response.status === 404) {
        state.failures = 0;
        throw new NotFoundException(`${connector.displayName} has no matching title`);
      }
      if (!response.ok) {
        const wait = this.retryAfter(response) ?? this.backoff(attempt);
        await response.body?.cancel();
        if (
          retryableStatuses.has(response.status) &&
          attempt < maxAttempts &&
          wait <= maxRetryDelayMs
        ) {
          await delay(wait);
          continue;
        }
        const error = new BadGatewayException(
          `${connector.displayName} returned ${response.status}`,
        );
        throw retryableStatuses.has(response.status) ? this.failed(state, error) : error;
      }
      const body = await this.read(response, connector);
      state.failures = 0;
      return JSON.parse(body) as T;
    }
  }

  private state(key: string) {
    let state = this.states.get(key);
    if (!state) {
      state = { queue: Promise.resolve(), lastRequestAt: 0, failures: 0, openUntil: 0 };
      this.states.set(key, state);
    }
    return state;
  }

  private async pace(connector: ConnectorDescriptor, state: ConnectorState) {
    const turn = state.queue.then(async () => {
      const wait = state.lastRequestAt + connector.requestIntervalMs - Date.now();
      if (wait > 0) {
        await delay(wait);
      }
      state.lastRequestAt = Date.now();
    });
    state.queue = turn;
    await turn;
  }

  private failed(state: ConnectorState, error: Error) {
    state.failures += 1;
    if (state.failures >= circuitThreshold) {
      state.failures = 0;
      state.openUntil = Date.now() + circuitOpenMs;
    }
    return error;
  }

  private backoff(attempt: number) {
    return 500 * 2 ** (attempt - 1) + Math.random() * 250;
  }

  private retryAfter(response: Response) {
    const header = response.headers.get('retry-after');
    if (!header) {
      return undefined;
    }
    const seconds = Number(header);
    const milliseconds = Number.isFinite(seconds)
      ? seconds * 1000
      : Date.parse(header) - Date.now();
    return Number.isFinite(milliseconds) ? Math.max(0, milliseconds) : undefined;
  }

  private async read(response: Response, connector: ConnectorDescriptor) {
    const tooLarge = () =>
      new BadGatewayException(`${connector.displayName} response is too large`);
    if (Number(response.headers.get('content-length')) > maxResponseBytes) {
      await response.body?.cancel();
      throw tooLarge();
    }
    const reader = response.body?.getReader();
    if (!reader) {
      return '';
    }
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      size += value.byteLength;
      if (size > maxResponseBytes) {
        await reader.cancel();
        throw tooLarge();
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString('utf8');
  }
}
