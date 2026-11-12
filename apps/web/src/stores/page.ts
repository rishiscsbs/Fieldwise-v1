import { useEffect } from 'react';
import { create } from 'zustand';

/** What the "Read aloud" button speaks for the current page. Pages set it with useSay(). */
export const usePage = create<{ say: string; setSay: (s: string) => void }>()((set) => ({
  say: '',
  setSay: (say) => set({ say }),
}));

export function useSay(text: string | undefined) {
  const setSay = usePage((s) => s.setSay);
  useEffect(() => {
    setSay(text ?? '');
    return () => setSay('');
  }, [text, setSay]);
}
