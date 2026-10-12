import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

const KEY = 'stresscare-theme';
const readMode = () => {
  try {
    const saved = localStorage.getItem(KEY);
    return saved === 'dark' || saved === 'system' ? saved : 'light';
  } catch {
    return 'light';
  }
};
const systemDark = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;

// `mode` is what the student picked (light, dark or system); `theme` is what's showing right now.
export const ThemeProvider = ({ children }) => {
  const [mode, setMode] = useState(readMode);
  const [prefersDark, setPrefersDark] = useState(systemDark);

  useEffect(() => {
    const query = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!query) return undefined;
    const onChange = (e) => setPrefersDark(e.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const theme = mode === 'system' ? (prefersDark ? 'dark' : 'light') : mode;

  useEffect(() => {
    try { localStorage.setItem(KEY, mode); } catch { /* private window */ }
    document.documentElement.classList.toggle('dark-theme', theme === 'dark');
  }, [mode, theme]);

  const setTheme = (next) => setMode(next === 'dark' || next === 'system' ? next : 'light');
  const toggleTheme = () => setMode(theme === 'light' ? 'dark' : 'light');

  return (
    <ThemeContext.Provider value={{ theme, mode, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
