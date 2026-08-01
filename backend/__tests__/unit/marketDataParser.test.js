const {
  getFromRaw,
  parseRatingValue,
  parseReviewCount,
  parseRatingBreakdown,
  computeRatingFromBreakdown,
  safeParseRatingBreakdown,
  hasAplusContent,
  detectAplusContent
} = require('../../utils/marketDataParser');

describe('getFromRaw', () => {
  it('matches keys case/space-insensitively', () => {
    const row = { 'Review Count': '1,234', Asin: 'B0TEST' };
    expect(getFromRaw(row, ['review_count', 'review count'], 0)).toBe('1,234');
    expect(getFromRaw(row, ['ASIN', 'Asin', 'asin'], '')).toBe('B0TEST');
  });

  it('skips null/empty values and falls through to the default', () => {
    const row = { rating: '', count: null };
    expect(getFromRaw(row, ['rating', 'count', 'other'], 'fallback')).toBe('fallback');
  });
});

describe('parseRatingValue', () => {
  it('handles "4.2 out of 5 stars"', () => {
    expect(parseRatingValue('4.2 out of 5 stars')).toBe(4.2);
  });

  it('handles comma decimal "4,2 out of 5"', () => {
    expect(parseRatingValue('4,2 out of 5')).toBe(4.2);
  });

  it('handles plain numbers and clamped values', () => {
    expect(parseRatingValue(3.5)).toBe(3.5);
    expect(parseRatingValue('5.0')).toBe(5);
    expect(parseRatingValue('9.9')).toBe(5);
    expect(parseRatingValue('-1')).toBe(0);
  });

  it('handles object-shaped ratings', () => {
    expect(parseRatingValue({ starRating: 4.8 })).toBe(4.8);
    expect(parseRatingValue({ value: '4.1' })).toBe(4.1);
    expect(parseRatingValue({})).toBe(0);
  });

  it('returns 0 for garbage', () => {
    expect(parseRatingValue('')).toBe(0);
    expect(parseRatingValue(null)).toBe(0);
    expect(parseRatingValue('no rating')).toBe(0);
  });
});

describe('parseReviewCount (R1 / R2 regression)', () => {
  it('parses "(2,441)" as 2441, not 2', () => {
    expect(parseReviewCount('(2,441)')).toBe(2441);
  });

  it('parses "1,234 global ratings"', () => {
    expect(parseReviewCount('1,234 global ratings')).toBe(1234);
  });

  it('parses "89 reviews"', () => {
    expect(parseReviewCount('89 reviews')).toBe(89);
  });

  it('parses smashed Amazon histogram instead of returning the rating', () => {
    const smashed = '4.2 out of 5 stars1,234 global ratings5 star63%4 star22%3 star9%2 star3%1 star3%';
    expect(parseReviewCount(smashed)).toBe(1234);
  });

  it('skips percentages and tiny fragments in fallback scan', () => {
    expect(parseReviewCount('5 star63%4 star22%3 star9%2 star3%1 star3%')).toBe(0);
  });

  it('returns 0 for empty/no-count input', () => {
    expect(parseReviewCount('')).toBe(0);
    expect(parseReviewCount(null)).toBe(0);
  });
});

describe('parseRatingBreakdown (R3 regression)', () => {
  it('parses bare percentages "53%23%12%5%7%"', () => {
    expect(parseRatingBreakdown('53%23%12%5%7%')).toEqual({
      fiveStar: 53, fourStar: 23, threeStar: 12, twoStar: 5, oneStar: 7
    });
  });

  it('parses star-labelled histogram "5 star63%4 star22%3 star9%2 star3%1 star3%"', () => {
    expect(parseRatingBreakdown('5 star63%4 star22%3 star9%2 star3%1 star3%')).toEqual({
      fiveStar: 63, fourStar: 22, threeStar: 9, twoStar: 3, oneStar: 3
    });
  });

  it('parses star-HTML histogram', () => {
    const html = '<span>5 star 63%</span><span>4 star 22%</span><span>3 star 9%</span><span>2 star 3%</span><span>1 star 3%</span>';
    expect(parseRatingBreakdown(html)).toEqual({
      fiveStar: 63, fourStar: 22, threeStar: 9, twoStar: 3, oneStar: 3
    });
  });

  it('returns zeroed breakdown for empty input', () => {
    expect(parseRatingBreakdown('')).toEqual({
      fiveStar: 0, fourStar: 0, threeStar: 0, twoStar: 0, oneStar: 0
    });
  });
});

describe('computeRatingFromBreakdown', () => {
  it('computes weighted average from percentages', () => {
    const b = { fiveStar: 63, fourStar: 22, threeStar: 9, twoStar: 3, oneStar: 3 };
    expect(computeRatingFromBreakdown(b)).toBe(4.4);
  });

  it('returns 0 when breakdown is empty', () => {
    expect(computeRatingFromBreakdown({ fiveStar: 0, fourStar: 0, threeStar: 0, twoStar: 0, oneStar: 0 })).toBe(0);
  });
});

describe('safeParseRatingBreakdown', () => {
  it('parses stored JSON and normalizes keys', () => {
    expect(safeParseRatingBreakdown('{"fiveStar":63,"fourStar":22,"threeStar":9,"twoStar":3,"oneStar":3}')).toEqual({
      fiveStar: 63, fourStar: 22, threeStar: 9, twoStar: 3, oneStar: 3
    });
  });

  it('returns null for invalid/empty JSON', () => {
    expect(safeParseRatingBreakdown('')).toBe(null);
    expect(safeParseRatingBreakdown('not json')).toBe(null);
    expect(safeParseRatingBreakdown(null)).toBe(null);
  });
});

describe('hasAplusContent (A1 / A6 regression)', () => {
  it('does NOT treat product description HTML as A+ content (A1)', () => {
    const productDescription = '<div id="productDescription_feature_div"><p>Product description text that is long enough to pass any naive length check.</p><p>More descriptive marketing copy.</p></div>';
    expect(hasAplusContent(productDescription)).toBe(false);
  });

  it('detects genuine A+ HTML via markers', () => {
    const aplusHtml = '<div id="aplus_feature_div"><div class="aplus-v2"><section class="aplus-module"><img src="x.jpg"></section></div></div>';
    expect(hasAplusContent(aplusHtml)).toBe(true);
  });

  it('detects A+ from parsed arrays/objects', () => {
    expect(hasAplusContent(['module1', 'module2'])).toBe(true);
    expect(hasAplusContent({ banner: 'x' })).toBe(true);
    expect(hasAplusContent([])).toBe(false);
    expect(hasAplusContent({})).toBe(false);
  });

  it('detects stringified JSON A+ content', () => {
    expect(hasAplusContent('[{"type":"banner"}]')).toBe(true);
    expect(hasAplusContent('{"modules":2}')).toBe(true);
  });

  it('returns false for "No A+ content found" and other negative text (A6)', () => {
    expect(hasAplusContent('No A+ content found')).toBe(false);
    expect(hasAplusContent('false')).toBe(false);
    expect(hasAplusContent('null')).toBe(false);
    expect(hasAplusContent('n/a')).toBe(false);
  });

  it('returns true for explicit positive flags', () => {
    expect(hasAplusContent('true')).toBe(true);
    expect(hasAplusContent('1')).toBe(true);
  });
});

describe('detectAplusContent (A2 regression)', () => {
  it('detects A+ from the "A+" / "A Plus" column labels', () => {
    expect(detectAplusContent({ 'A+': 'true' })).toBe(true);
    expect(detectAplusContent({ 'A Plus': '1' })).toBe(true);
    expect(detectAplusContent({ 'A+ Content': 'false' })).toBe(false);
  });

  it('detects A+ from HTML in the content field', () => {
    const row = {
      AplusContent: '<div id="aplus_feature_div"><div class="aplus-v2"><section class="aplus-module"><img src="x.jpg"></section></div></div>'
    };
    expect(detectAplusContent(row)).toBe(true);
  });

  it('does not flag rows whose only content field is product description (A1)', () => {
    const row = { product_description: '<div>Long product description copy that is definitely not A+ content.</div>' };
    expect(detectAplusContent(row)).toBe(false);
  });

  it('returns false for empty rows', () => {
    expect(detectAplusContent({})).toBe(false);
    expect(detectAplusContent(null)).toBe(false);
  });
});
