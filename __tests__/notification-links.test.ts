import { resolveDeepLink } from '@/lib/notifications/links';

describe('resolveDeepLink', () => {
  it('normalizes /obra/{id}/chat to /(main)/obra/{id}/chat', () => {
    expect(resolveDeepLink('/obra/abc-123/chat')).toBe('/(main)/obra/abc-123/chat');
  });

  it('passes through /(main)/obra/{id}/chat unchanged', () => {
    expect(resolveDeepLink('/(main)/obra/abc-123/chat')).toBe(
      '/(main)/obra/abc-123/chat',
    );
  });

  it('normalizes diario detail path', () => {
    expect(resolveDeepLink('/obra/w1/diario/d1')).toBe('/(main)/obra/w1/diario/d1');
  });

  it('normalizes marcos path', () => {
    expect(resolveDeepLink('/obra/w1/marcos')).toBe('/(main)/obra/w1/marcos');
  });

  it('normalizes checklists detail path', () => {
    expect(resolveDeepLink('/obra/w1/checklists/c1')).toBe(
      '/(main)/obra/w1/checklists/c1',
    );
  });

  it('normalizes alertas detail path', () => {
    expect(resolveDeepLink('/obra/w1/alertas/a1')).toBe('/(main)/obra/w1/alertas/a1');
  });

  it('strips scheme prefix', () => {
    expect(resolveDeepLink('orcarede:///obra/w1/chat')).toBe('/(main)/obra/w1/chat');
  });

  it('strips trailing slash', () => {
    expect(resolveDeepLink('/obra/w1/marcos/')).toBe('/(main)/obra/w1/marcos');
  });

  it('returns null for empty string', () => {
    expect(resolveDeepLink('')).toBeNull();
  });

  it('returns null for unknown route', () => {
    expect(resolveDeepLink('/admin/settings')).toBeNull();
  });

  it('returns null for root path', () => {
    expect(resolveDeepLink('/')).toBeNull();
  });

  it('handles obra detail without sub-feature', () => {
    expect(resolveDeepLink('/obra/w1')).toBe('/(main)/obra/w1');
  });
});
