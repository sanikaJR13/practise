import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';

const AUDIT_MODE_STORAGE_KEY = 'propintel.audit.mode';

function parseAuditFlag(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

export function isAuditModeEnabled(search = '') {
  if (typeof window === 'undefined') {
    return false;
  }

  const params = new URLSearchParams(search || window.location.search || '');
  if (params.has('audit')) {
    const enabled = parseAuditFlag(params.get('audit'));
    window.localStorage.setItem(AUDIT_MODE_STORAGE_KEY, enabled ? 'true' : 'false');
    return enabled;
  }

  return parseAuditFlag(window.localStorage.getItem(AUDIT_MODE_STORAGE_KEY));
}

export function useAuditMode() {
  const location = useLocation();

  return useMemo(() => isAuditModeEnabled(location.search), [location.search]);
}
