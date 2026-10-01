/**
 * The NIM endpoint intermittently returns `finish_reason: 'length'` because the
 * hosted reasoning models bill their reasoning tokens against max_tokens.
 * That must be retried with a larger budget, not surfaced to the user as a
 * parse error — it was the main reason AI rule generation felt "flaky".
 */

const { NIMService } = require('../../services/nimService');

function makeService(key = 'test-key') {
  process.env.NVIDIA_NIM_API_KEY = key;
  const service = new NIMService();
  service._client = { chat: { completions: { create: async () => ({}) } } };
  return service;
}

function respond(content, finishReason = 'stop') {
  return {
    choices: [{ finish_reason: finishReason, message: { content } }],
  };
}

describe('NIMService.chat', () => {
  const originalKey = process.env.NVIDIA_NIM_API_KEY;

  afterEach(() => {
    process.env.NVIDIA_NIM_API_KEY = originalKey;
    jest.restoreAllMocks();
  });

  it('returns content on the first success', async () => {
    const service = makeService();
    const create = jest.fn().mockResolvedValue(respond('{"ok":true}'));
    service._client.chat.completions.create = create;

    await expect(service.chat([{ role: 'user', content: 'hi' }])).resolves.toBe('{"ok":true}');
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('retries with a larger max_tokens when the response is truncated', async () => {
    const service = makeService();
    const create = jest
      .fn()
      .mockResolvedValueOnce(respond('{"partial":', 'length'))
      .mockResolvedValueOnce(respond('{"complete":true}'));

    service._client.chat.completions.create = create;

    await expect(service.chat([{ role: 'user', content: 'hi' }], { max_tokens: 2048 }))
      .resolves.toBe('{"complete":true}');

    expect(create).toHaveBeenCalledTimes(2);
    const budgets = create.mock.calls.map((c) => c[0].max_tokens);
    expect(budgets[0]).toBe(2048);
    expect(budgets[1]).toBeGreaterThan(budgets[0]);
  });

  it('defaults to a budget that leaves room for reasoning tokens', async () => {
    const service = makeService();
    const create = jest.fn().mockResolvedValue(respond('{}'));
    service._client.chat.completions.create = create;

    await service.chat([{ role: 'user', content: 'hi' }]);
    expect(create.mock.calls[0][0].max_tokens).toBeGreaterThanOrEqual(4096);
  });

  it('throws TruncatedResponseError when it stays truncated', async () => {
    const service = makeService();
    service._client.chat.completions.create = jest.fn().mockResolvedValue(respond('{"a":', 'length'));

    await expect(service.chat([{ role: 'user', content: 'hi' }], { max_tokens: 1024 }))
      .rejects.toMatchObject({ name: 'TruncatedResponseError', code: 'AI_TRUNCATED' });
  });

  it('drops response_format and retries when the model rejects it', async () => {
    const service = makeService();
    const create = jest
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('unsupported'), { status: 400 }))
      .mockResolvedValueOnce(respond('{"a":1}'));

    service._client.chat.completions.create = create;

    await expect(service.chat([{ role: 'user', content: 'hi' }], { json: true }))
      .resolves.toBe('{"a":1}');

    expect(create.mock.calls[0][0].response_format).toEqual({ type: 'json_object' });
    expect(create.mock.calls[1][0].response_format).toBeUndefined();
  });

  it('does not retry other errors', async () => {
    const service = makeService();
    const create = jest.fn().mockRejectedValue(Object.assign(new Error('boom'), { status: 500 }));
    service._client.chat.completions.create = create;

    await expect(service.chat([{ role: 'user', content: 'hi' }])).rejects.toThrow(/AI inference failed/);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('rejects an empty completion', async () => {
    const service = makeService();
    service._client.chat.completions.create = jest.fn().mockResolvedValue(respond('   '));
    await expect(service.chat([{ role: 'user', content: 'hi' }])).rejects.toThrow(/empty response/i);
  });

  it('fails with an actionable message when unconfigured', async () => {
    delete process.env.NVIDIA_NIM_API_KEY;
    const service = new NIMService();
    expect(service.isConfigured()).toBe(false);
    expect(() => service.getClient()).toThrow(/NVIDIA_NIM_API_KEY/);
  });

  describe('cleanJSON', () => {
    const service = makeService();

    it.each([
      ['bare JSON', '{"a":1}'],
      ['fenced JSON', '```json\n{"a":1}\n```'],
      ['prose-wrapped JSON', 'Sure! Here it is: {"a":1} — let me know.'],
      ['leading whitespace', '\n\n  {"a":1}  \n'],
    ])('parses %s', (_label, input) => {
      expect(service.cleanJSON(input)).toEqual({ a: 1 });
    });

    it('throws a clear error on unparseable input', () => {
      expect(() => service.cleanJSON('not json at all')).toThrow(/malformed JSON/i);
    });

    it('throws on empty input', () => {
      expect(() => service.cleanJSON('')).toThrow(/empty response/i);
    });
  });
});
