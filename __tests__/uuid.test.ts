import { isUuidV4, uuidV4 } from '@/utils/uuid';

describe('uuidV4', () => {
  it('returns a string matching the RFC4122 v4 format', () => {
    const id = uuidV4();
    expect(typeof id).toBe('string');
    expect(id).toHaveLength(36);
    expect(isUuidV4(id)).toBe(true);
  });

  it('sets version 4 in the third group', () => {
    const id = uuidV4();
    expect(id[14]).toBe('4');
  });

  it('sets the high bit of the fourth group to 8, 9, a, or b', () => {
    const id = uuidV4();
    expect('89ab'.includes(id[19])).toBe(true);
  });

  it('produces no collisions across 100 calls', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(uuidV4());
    }
    expect(ids.size).toBe(100);
  });

  it('isUuidV4 rejects malformed strings', () => {
    expect(isUuidV4('not-a-uuid')).toBe(false);
    expect(isUuidV4('00000000-0000-0000-0000-000000000000')).toBe(false);
    expect(isUuidV4('xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx')).toBe(false);
  });
});
