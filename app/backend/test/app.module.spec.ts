import { Test } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';

describe('AppModule', () => {
  beforeEach(() => {
    process.env.DATABASE_URL =
      'postgresql://graphite:graphite@localhost:5432/graphite_tracker';
    process.env.AUTH_ACCESS_TOKEN_SECRET = 'test-access-secret';
  });

  afterEach(() => {
    delete process.env.DATABASE_URL;
    delete process.env.AUTH_ACCESS_TOKEN_SECRET;
  });

  it('resolves the complete dependency graph', async () => {
    const application = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    expect(application.get(AppModule)).toBeInstanceOf(AppModule);
    await application.close();
  });
});
