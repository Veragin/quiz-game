import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './theme.css';
import { App } from './App.tsx';
import { ROUTER_BASENAME } from './utils/basePath.ts';

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <BrowserRouter basename={ROUTER_BASENAME}>
            <App />
        </BrowserRouter>
    </StrictMode>,
);
