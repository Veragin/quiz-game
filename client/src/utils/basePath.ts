export const BASE_URL = import.meta.env.BASE_URL;
export const ROUTER_BASENAME = BASE_URL === '/' ? '/' : BASE_URL.replace(/\/$/, '');

export const withBase = (path: string): string => {
    if (BASE_URL === '/') return path;
    if (/^[a-z][a-z0-9+.-]*:/i.test(path) || path.startsWith('//')) return path;
    if (path === ROUTER_BASENAME || path.startsWith(BASE_URL)) return path;
    return BASE_URL + path.replace(/^\//, '');
};

export const wsUrlWithBase = (path: string): string => {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    return `${proto}://${window.location.host}${withBase(path)}`;
};
