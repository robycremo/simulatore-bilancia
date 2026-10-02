import { useCallback, useEffect, useRef, useState } from 'react';

const TOKEN_KEY = 'simulatore.token';
const CLOSE_AUTH = 4401;
const LOAD_MIN_INTERVAL_MS = 50; // max 20 invii/s del carico: resta sotto il limite di 50 comandi/s

export const storedToken = () => {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};
const storeToken = (t) => {
  try {
    if (t) sessionStorage.setItem(TOKEN_KEY, t);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {}
};

// Connessione WebSocket al motore Node: riceve stato (10 Hz), liste e configurazione; invia comandi.
export function useEngine() {
  const [state, setState] = useState(null);
  const [config, setConfig] = useState(null);
  const [lists, setLists] = useState({ printerOut: [], txLog: [], rxLog: [], mppArchive: [], receivers: [] });
  const [connected, setConnected] = useState(false);
  const [auth, setAuth] = useState({ required: false, error: null });
  const [errors, setErrors] = useState([]);
  const wsRef = useRef(null);
  const loadThrottle = useRef({ last: 0, timer: null, value: null });

  const pushError = useCallback((message) => {
    const id = Date.now() + Math.random();
    setErrors((e) => [...e.slice(-3), { id, message }]);
    setTimeout(() => setErrors((e) => e.filter((x) => x.id !== id)), 4000);
  }, []);

  useEffect(() => {
    let stop = false;
    let retry;
    const connect = () => {
      const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
      wsRef.current = ws;
      ws.onopen = () => setConnected(true);
      ws.onclose = (ev) => {
        setConnected(false);
        if (ev.code === CLOSE_AUTH) {
          storeToken(null);
          setAuth({ required: true, error: 'Token non valido' });
        }
        if (!stop) retry = setTimeout(connect, 1000);
      };
      ws.onmessage = (ev) => {
        const m = JSON.parse(ev.data);
        if (m.type === 'state') setState(m.state);
        else if (m.type === 'config') setConfig(m.config);
        else if (m.type === 'lists') setLists(m.lists);
        else if (m.type === 'error') pushError(m.message);
        else if (m.type === 'authOk') setAuth({ required: false, error: null });
        else if (m.type === 'authRequired') {
          const t = storedToken();
          if (t) ws.send(JSON.stringify({ type: 'auth', token: t }));
          else setAuth((a) => ({ required: true, error: a.error }));
        }
      };
    };
    connect();
    return () => {
      stop = true;
      clearTimeout(retry);
      clearTimeout(loadThrottle.current.timer);
      wsRef.current?.close();
    };
  }, [pushError]);

  const sendNow = useCallback((name, args) => {
    const ws = wsRef.current;
    if (ws?.readyState === 1) ws.send(JSON.stringify({ type: 'cmd', cmd: name, args }));
  }, []);

  const cmd = useCallback(
    (name, args) => {
      if (name !== 'setLoad') return sendNow(name, args);
      // Trascinando il cursore arrivano molti eventi: si invia al massimo ogni 50 ms, sempre con l'ultimo valore.
      const t = loadThrottle.current;
      t.value = args;
      if (t.timer) return; // invio già programmato: userà l'ultimo valore
      const wait = t.last + LOAD_MIN_INTERVAL_MS - Date.now();
      if (wait <= 0) {
        t.last = Date.now();
        sendNow('setLoad', args);
      } else {
        t.timer = setTimeout(() => {
          t.timer = null;
          t.last = Date.now();
          sendNow('setLoad', t.value);
        }, wait);
      }
    },
    [sendNow]
  );

  const submitToken = useCallback((token) => {
    storeToken(token);
    setAuth({ required: false, error: null });
    const ws = wsRef.current;
    if (ws?.readyState === 1) ws.send(JSON.stringify({ type: 'auth', token }));
  }, []);

  return { state, config, lists, connected, cmd, auth, submitToken, errors };
}

export function fmtW(v, config) {
  if (!config) return String(v);
  const s = String(config.division);
  const dec = s.includes('.') ? s.split('.')[1].length : 0;
  return Number(v).toFixed(dec).replace('.', config.decimalSep);
}
