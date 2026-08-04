jest.mock('../../services/nimService', () => ({
  chat: jest.fn(async () => JSON.stringify({
    summary: 'Improve title clarity and add more support for keywords.',
    priority: 'high',
    recommendations: [
      { area: 'title', score: 62, priority: 'high', remarks: ['Make the title more descriptive.'], seoFocus: ['wireless earbuds'] },
    ],
    keywords: [{ term: 'wireless earbuds', reason: 'High relevance to the provided product content' }],
  })),
  cleanJSON: jest.fn((content) => JSON.parse(content)),
}));

jest.mock('../../services/nvidiaAiService', () => ({
  analyzeProductImage: jest.fn(),
}));

const aiLqsService = require('../../services/aiLqsService');

describe('aiLqsService optimization analysis', () => {
  it('builds a dynamic optimization prompt from the fetched listing payload', () => {
    const item = {
      asin: 'B09MFMVVK5',
      marketplace: 'www.amazon.in',
      itemInfo: {
        title: { displayValue: 'BrandX Wireless Earbuds With Noise Cancellation' },
        features: { displayValues: ['Comfortable fit', 'Long battery life', 'Fast charging'] },
        byLineInfo: { brand: { displayValue: 'BrandX' } },
        contentInfo: { description: 'A premium wireless earbud designed for long listening sessions.' },
      },
      images: {
        primary: { highRes: { url: 'https://example.com/1.jpg' } },
        variants: [{ highRes: { url: 'https://example.com/2.jpg' } }],
      },
      browseNodeInfo: { browseNodes: [{ displayName: 'Electronics' }] },
    };

    const prompt = aiLqsService.buildOptimizationPrompt(item);

    expect(prompt).toContain('optimization');
    expect(prompt).toContain('BrandX Wireless Earbuds With Noise Cancellation');
    expect(prompt).toContain('Comfortable fit');
    expect(prompt).toContain('www.amazon.in');
  });

  it('returns an optimization payload from the listing data even without live AI output', async () => {
    const item = {
      asin: 'B09MFMVVK5',
      marketplace: 'www.amazon.in',
      itemInfo: {
        title: { displayValue: 'BrandX Wireless Earbuds' },
        features: { displayValues: ['Comfortable fit', 'Long battery life'] },
        byLineInfo: { brand: { displayValue: 'BrandX' } },
        contentInfo: { description: 'Wireless earbuds for daily use.' },
      },
      images: {
        primary: { highRes: { url: 'https://example.com/1.jpg' } },
      },
      browseNodeInfo: { browseNodes: [{ displayName: 'Electronics' }] },
    };

    const result = await aiLqsService.analyzeOptimization(item);

    expect(result).toMatchObject({
      summary: expect.any(String),
      priority: expect.any(String),
      recommendations: expect.any(Array),
      keywords: expect.any(Array),
    });
  });
});
