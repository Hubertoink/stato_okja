import { getActivityCategoryMode } from './activity-category.config';

describe('activity category configuration', () => {
  const original = process.env.ACTIVITY_CATEGORY_MODE;
  afterEach(() => {
    if (original === undefined) delete process.env.ACTIVITY_CATEGORY_MODE;
    else process.env.ACTIVITY_CATEGORY_MODE = original;
  });

  it('defaults to multiple and accepts normalized single mode', () => {
    delete process.env.ACTIVITY_CATEGORY_MODE;
    expect(getActivityCategoryMode()).toBe('multiple');
    process.env.ACTIVITY_CATEGORY_MODE = ' SINGLE ';
    expect(getActivityCategoryMode()).toBe('single');
  });

  it('rejects typos instead of silently allowing multiple categories', () => {
    process.env.ACTIVITY_CATEGORY_MODE = 'singel';
    expect(() => getActivityCategoryMode()).toThrow('ACTIVITY_CATEGORY_MODE');
  });
});
