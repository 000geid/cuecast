import React from 'react';
import { createRoot } from 'react-dom/client';
import './i18n';
import App from './App';
import { applyTheme, resolveStoredTheme } from './lib/theme';
import './styles.css';

applyTheme(resolveStoredTheme(window.localStorage));

const container = document.getElementById('root')!;
const root = createRoot(container);
root.render(<React.StrictMode><App /></React.StrictMode>);

