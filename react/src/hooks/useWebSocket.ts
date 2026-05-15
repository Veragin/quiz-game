import { useEffect, useRef, useCallback } from 'react';
import type { ServerMessage } from '../types';

interface UseWebSocketOptions {
  onMessage: (msg: ServerMessage) => void;
}

export function useWebSocket({ onMessage }: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    const ws = new WebSocket(`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
      // Auto-login from localStorage if we have a saved auth
      const authMsg = window.localStorage.getItem('authMsg');
      if (authMsg) {
        ws.send(authMsg);
      }
    };

    ws.onmessage = (event) => {
      const msg: ServerMessage = JSON.parse(event.data);
      console.log('Received message:', msg);
      onMessageRef.current(msg);
    };

    ws.onerror = () => {
      console.warn('WebSocket error, reconnecting...');
      setTimeout(() => connect(), 1000);
    };

    ws.onclose = () => {
      console.warn('WebSocket closed, reconnecting...');
      setTimeout(() => connect(), 1000);
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) {
        wsRef.current.onclose = null; // prevent reconnect on unmount
        wsRef.current.close();
      }
    };
  }, [connect]);

  const send = useCallback((data: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  const login = useCallback((name: string) => {
    const token = Math.random().toString(36).substr(2);
    const authMsg = JSON.stringify({ type: 'authorization', name, token });
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(authMsg);
    }
    window.localStorage.setItem('authMsg', authMsg);
  }, []);

  return { send, login };
}
