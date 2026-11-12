import { useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { resolvedTheme, useUi } from './stores/ui';
import { Header } from './components/Header';
import { Home } from './routes/Home';
import { DesignSystem } from './routes/DesignSystem';

export function App() {
  const theme = useUi((s) => s.theme);
  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme(theme);
  }, [theme]);

  return (
    <BrowserRouter>
      <Header />
      <main id="main" className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/design" element={<DesignSystem />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
