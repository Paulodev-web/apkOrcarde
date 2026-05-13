const VALID_ROUTE_PATTERNS = [
  /^\/obra\/[^/]+\/chat$/,
  /^\/obra\/[^/]+\/diario\/[^/]+$/,
  /^\/obra\/[^/]+\/diario$/,
  /^\/obra\/[^/]+\/marcos$/,
  /^\/obra\/[^/]+\/checklists\/[^/]+$/,
  /^\/obra\/[^/]+\/checklists$/,
  /^\/obra\/[^/]+\/alertas\/[^/]+$/,
  /^\/obra\/[^/]+\/alertas$/,
  /^\/obra\/[^/]+\/postes$/,
  /^\/obra\/[^/]+$/,
];

/**
 * Normalizes a link_path from the notifications table into an Expo Router path.
 *
 * The bank triggers generate paths like `/obra/{workId}/chat` but the actual
 * Expo Router file tree requires `/(main)/obra/{workId}/chat`. This function
 * handles both formats and validates against known routes.
 *
 * Returns null if the path is unrecognizable — caller should navigate to home.
 */
export function resolveDeepLink(raw: string): string | null {
  if (!raw || typeof raw !== 'string') return null;

  let path = raw.trim();

  // Strip scheme prefix if present (e.g. orcarede:///obra/...)
  const schemeIdx = path.indexOf('://');
  if (schemeIdx !== -1) {
    path = path.slice(schemeIdx + 3);
    // Remove leading host if any
    if (path.startsWith('/')) {
      // already good
    } else {
      const slashIdx = path.indexOf('/');
      path = slashIdx !== -1 ? path.slice(slashIdx) : '/';
    }
  }

  // Strip /(main) prefix if already present so we can re-add it consistently
  if (path.startsWith('/(main)')) {
    path = path.slice('/(main)'.length);
  }

  // Ensure leading slash
  if (!path.startsWith('/')) {
    path = '/' + path;
  }

  // Strip trailing slash (except root)
  if (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1);
  }

  const matched = VALID_ROUTE_PATTERNS.some((re) => re.test(path));
  if (!matched) return null;

  return `/(main)${path}`;
}
