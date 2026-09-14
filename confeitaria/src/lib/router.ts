import { useCallback, useEffect, useState } from 'react';

/** Roteador mínimo baseado em hash — mantém as telas linkáveis e o histórico funcionando. */
export function useRoute(): [string, (path: string) => void] {
  const [path, setPath] = useState(() => window.location.hash.replace(/^#/, '') || '/');

  useEffect(() => {
    const onHashChange = () => setPath(window.location.hash.replace(/^#/, '') || '/');
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback((next: string) => {
    if (window.location.hash.replace(/^#/, '') === next) {
      setPath(next);
      return;
    }
    window.location.hash = next;
  }, []);

  return [path, navigate];
}

export function scrollTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
