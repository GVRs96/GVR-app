import { useState, useCallback, useEffect, useRef, createContext, useContext } from "react";

// ─── SVG ICON SYSTEM ─────────────────────────────────────────────────────────
const iconBaseStyle = {
  display: "inline-block",
  flexShrink: 0,
  vectorEffect: "non-scaling-stroke",
};

function IconSvg({ size = 18, strokeWidth = 1.75, children }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={iconBaseStyle}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function LogoSvg({ size = 22 }) {
  return (
    <IconSvg size={size} strokeWidth={1.8}>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M8 9h8M8 12h8M8 15h5" />
    </IconSvg>
  );
}

function SvcIco({ id, size = 16 }) {
  const icons = {
    trash:   (<><path d="M3 14L10 6h8l3 4v8H3z"/><path d="M10 6v8"/></>),
    sawdust: (<><path d="M3 16h18"/><path d="M5 16c2-4 12-4 14 0"/><circle cx="8" cy="13" r="0.5" fill="currentColor"/><circle cx="12" cy="12" r="0.5" fill="currentColor"/><circle cx="16" cy="13" r="0.5" fill="currentColor"/></>),
    offcuts: (<><rect x="4" y="12" width="10" height="4" rx="1"/><rect x="8" y="8" width="12" height="4" rx="1"/></>),
    other:   (<><circle cx="12" cy="12" r="8"/><path d="M9.7 9.6a2.4 2.4 0 0 1 4.6.9c0 1.7-2.3 2.2-2.3 3.6"/><path d="M12 17h.01"/></>),
  };
  // support both "trash" and "trash_svc" formats
  const key = id ? id.replace('_svc','') : 'other';
  return <IconSvg size={size} strokeWidth={1.8}>{icons[key] || icons.other}</IconSvg>;
}

function IcNav({ name, size = 16 }) {
  const icons = {
    home: <><path d="M3 11.5L12 4l9 7.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><path d="M9 21V12h6v9"/></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    package: <><path d="M4 8.5 12 4l8 4.5v7L12 20l-8-4.5z" /><path d="m4 8.5 8 4.5 8-4.5M12 13v7" /></>,
    wallet: <><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 10h18" /></>,
    chart: <><path d="M6 19v-6M12 19V5M18 19v-9" /></>,
    trending: <><path d="m4 16 5-5 4 4 7-8" /><path d="M15 7h5v5" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M12 3v2M12 19v2M4.2 7.5l1.7 1M18.1 15.5l1.7 1M4.2 16.5l1.7-1M18.1 8.5l1.7-1M3 12h2M19 12h2" /></>,
  };
  return <IconSvg size={size} strokeWidth={1.75}>{icons[name] || null}</IconSvg>;
}

function IcTab({ name, size = 22 }) {
  const icons = {
    home:      <><path d="M3 11.5L12 4l9 7.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><path d="M9 21V12h6v9"/></>,
    plus:      <><path d="M12 5v14M5 12h14" /></>,
    dispatch:  <><path d="M7 4h7l4 4v12H7z" /><path d="M14 4v4h4" /><path d="M10 13h5M10 16h3" /></>,
    leads:     <><circle cx="9" cy="8" r="3" /><path d="M4 20c.5-3.2 2.4-5 5-5s4.5 1.8 5 5" /><path d="M16 11a2.5 2.5 0 1 0 0-5" /><path d="M17 15c1.8.6 3 2.2 3.4 5" /></>,
    reminders: <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></>,
  };
  return <IconSvg size={size} strokeWidth={1.75}>{icons[name] || null}</IconSvg>;
}


// ─── GOOGLE AUTH & DRIVE SYNC ─────────────────────────────────────────────────
const GOOGLE_CLIENT_ID = "1044925949580-mif0vk3a69b7hqps7ecesu2hrk6vfk04.apps.googleusercontent.com";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/calendar.events profile email";
const AuthCtx = createContext(null);
const ServicesCtx = createContext([]);

// ─── ЕДИНАЯ СИНХРОНИЗАЦИЯ ───────────────────────────────────────────────────
// Один файл в Drive для всего: заказы + долги + лиды + настройки + удаления
const DRIVE_FILE = "gvr_dispatch_v1.json";
const SyncCtx = createContext(null);

// События для связи разделов с движком синхронизации
const SYNC_LOCAL_CHANGED = "gvr-local-changed"; // данные изменены локально → выгрузить
const SYNC_MERGED        = "gvr-sync-merged";   // данные слиты из облака → перечитать
function notifyLocalChanged() {
  try { window.dispatchEvent(new Event(SYNC_LOCAL_CHANGED)); } catch {}
}

// «Надгробия» — отметки об удалённых записях, чтобы merge не воскрешал их
function getTombstones() {
  try { return JSON.parse(localStorage.getItem("gvr_tombstones") || "{}"); } catch { return {}; }
}
function addTombstone(id) {
  if (!id) return;
  const t = getTombstones();
  t[id] = new Date().toISOString();
  localStorage.setItem("gvr_tombstones", JSON.stringify(pruneTombstones(t)));
}
function pruneTombstones(t) {
  const cutoff = Date.now() - 90 * 86400000; // храним отметки 90 дней
  Object.keys(t).forEach(k => {
    const ts = new Date(t[k]).getTime();
    if (!ts || ts < cutoff) delete t[k];
  });
  return t;
}
function mergeTombstones(localT, cloudT) {
  return pruneTombstones({ ...(cloudT || {}), ...(localT || {}) });
}

// Слияние массивов записей по id: новое побеждает, удалённое не воскресает
function mergeById(localArr, cloudArr, tomb) {
  const map = {};
  (localArr || []).forEach(x => { if (x && x.id != null && !tomb[x.id]) map[x.id] = x; });
  (cloudArr || []).forEach(x => {
    if (!x || x.id == null || tomb[x.id]) return;
    if (!map[x.id]) map[x.id] = x;
    else {
      const lt = new Date(map[x.id].updatedAt || map[x.id].createdAt || 0).getTime();
      const ct = new Date(x.updatedAt || x.createdAt || 0).getTime();
      if (ct > lt) map[x.id] = x;
    }
  });
  const merged  = Object.values(map);
  const changed = JSON.stringify(merged) !== JSON.stringify(localArr || []);
  return { merged, changed };
}

// Слияние долгов: оплаты/начисления/расходы объединяем по id
function mergeDebts(localD, cloudD, tomb) {
  const L = localD || {}, C = cloudD || {};
  const m = (a, b) => {
    const map = {};
    (a || []).forEach(x => { if (x && x.id && !tomb["debt_" + x.id]) map[x.id] = x; });
    (b || []).forEach(x => {
      if (!x || !x.id || tomb["debt_" + x.id]) return;
      if (!map[x.id]) { map[x.id] = x; return; }
      const lt = new Date(map[x.id].updatedAt || 0).getTime();
      const ct = new Date(x.updatedAt || 0).getTime();
      if (ct > lt) map[x.id] = x; // более свежая правота побеждает
    });
    return Object.values(map);
  };
  return {
    ...L,
    payments:    m(L.payments,    C.payments),
    manualDebts: m(L.manualDebts, C.manualDebts),
    expenses:    m(L.expenses,    C.expenses),
  };
}

// Настройки, которые синхронизируем между устройствами
function buildSettingsPayload() {
  return {
    dispatch_sheets_url:   localStorage.getItem("dispatch_sheets_url")  || "",
    leads_sheets_url:      localStorage.getItem("leads_sheets_url_v2")  || "",
    calendar_auto_sync:    localStorage.getItem("calendar_auto_sync")   || "1",
    calendar_id_default:   localStorage.getItem("cal_id_default")       || "",
    calendar_id_trash:     localStorage.getItem("cal_id_trash")         || "",
    calendar_id_sawdust:   localStorage.getItem("cal_id_sawdust")       || "",
    calendar_id_offcuts:   localStorage.getItem("cal_id_offcuts")       || "",
    calendar_id_reminders: localStorage.getItem("cal_id_reminders")     || "",
    reminders_done:        localStorage.getItem("reminders_done")       || "{}",
  };
}
function applySettingsPayload(s) {
  if (!s) return;
  if (s.dispatch_sheets_url)   localStorage.setItem("dispatch_sheets_url", s.dispatch_sheets_url);
  if (s.leads_sheets_url)      localStorage.setItem("leads_sheets_url_v2", s.leads_sheets_url);
  if (s.calendar_auto_sync)    localStorage.setItem("calendar_auto_sync",  s.calendar_auto_sync);
  if (s.calendar_id_default)   localStorage.setItem("cal_id_default",      s.calendar_id_default);
  if (s.calendar_id_trash)     localStorage.setItem("cal_id_trash",        s.calendar_id_trash);
  if (s.calendar_id_sawdust)   localStorage.setItem("cal_id_sawdust",      s.calendar_id_sawdust);
  if (s.calendar_id_offcuts)   localStorage.setItem("cal_id_offcuts",      s.calendar_id_offcuts);
  if (s.calendar_id_reminders) localStorage.setItem("cal_id_reminders",    s.calendar_id_reminders);
  // отметки «выполнено» в напоминаниях — объединяем, локальные новее
  try {
    const local = JSON.parse(localStorage.getItem("reminders_done") || "{}");
    const cloud = JSON.parse(s.reminders_done || "{}");
    localStorage.setItem("reminders_done", JSON.stringify({ ...cloud, ...local }));
  } catch {}
}

function loadGSI() {
  return new Promise((res) => {
    if (window.google?.accounts) { res(); return; }
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.onload = res; s.onerror = res;
    document.head.appendChild(s);
  });
}

async function driveListFiles(token, filename) {
  const name = filename || DRIVE_FILE;
  const r = await fetch(
    `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name="${name}"&fields=files(id,name,modifiedTime)`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (r.status === 401 || r.status === 403) {
    const e = new Error("Google auth expired"); e.authError = true; throw e;
  }
  return r.json();
}
async function driveReadFile(token, fileId) {
  const r = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (r.status === 401 || r.status === 403) {
    const e = new Error("Google auth expired"); e.authError = true; throw e;
  }
  return r.json();
}
async function driveCreateFile(token, data, filename) {
  const name = filename || DRIVE_FILE;
  const meta = JSON.stringify({ name, parents: ["appDataFolder"] });
  const body = new FormData();
  body.append("metadata", new Blob([meta], { type: "application/json" }));
  body.append("file", new Blob([JSON.stringify(data)], { type: "application/json" }));
  const r = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
    { method: "POST", headers: { Authorization: `Bearer ${token}` }, body }
  );
  if (r.status === 401 || r.status === 403) {
    const e = new Error("Google auth expired"); e.authError = true; throw e;
  }
  return r.json();
}
async function driveUpdateFile(token, fileId, data) {
  const r = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
    { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(data) }
  );
  if (r.status === 401 || r.status === 403) {
    const e = new Error("Google auth expired"); e.authError = true; throw e;
  }
  return r.json();
}

// ─── GOOGLE CALENDAR DIRECT API ──────────────────────────────────────────────
const SVC_COLORS_CAL = { trash:"5", sawdust:"6", offcuts:"11" }; // Google Calendar color ids

// ── Extract real Calendar ID from any format user might paste ─────────────────
// Handles: raw ID, embed URL (?src=...), ical URL (/ical/.../)
function parseCalendarId(raw) {
  if (!raw || !raw.trim()) return "primary";
  const s = raw.trim();

  // Already a plain ID (contains @ but not http)
  if (!s.startsWith("http") && s.includes("@")) return s;

  try {
    // embed URL: .../embed?src=ENCODED_ID or .../r?...&src=ENCODED_ID
    const srcMatch = s.match(/[?&]src=([^&]+)/);
    if (srcMatch) return decodeURIComponent(srcMatch[1]);

    // ical URL: .../ical/ENCODED_ID/...
    const icalMatch = s.match(/\/ical\/([^/]+)\//);
    if (icalMatch) return decodeURIComponent(icalMatch[1]);

    // htmlLink / events URL: /calendars/ENCODED_ID/
    const calMatch = s.match(/\/calendars\/([^/]+)/);
    if (calMatch) return decodeURIComponent(calMatch[1]);
  } catch {}

  // Fallback: return as-is
  return s;
}

async function calendarCreateEvent(token, order) {
  if (!token || !order.date) return null;

  const svcNames = { trash:"Вывоз мусора", sawdust:"Опилки россыпью", offcuts:"Обрезки доски" };
  const svcName  = svcNames[order.service] || order.service || "Заказ";
  const title    = `${svcName}${order.clientName ? " · " + order.clientName : ""}${order.address ? " — " + order.address : ""}`;

  const hourMap = {
    morning:   ["08:00","12:00"],
    afternoon: ["12:00","17:00"],
    evening:   ["17:00","21:00"],
    day:       ["08:00","18:00"],
  };
  const times = hourMap[order.hour] || hourMap.day;
  const start = { dateTime:`${order.date}T${times[0]}:00`, timeZone:"Europe/Moscow" };
  const end   = { dateTime:`${order.date}T${times[1]}:00`, timeZone:"Europe/Moscow" };

  const description = [
    order.message || order.summary || "",
    order.phone  ? `Тел: ${order.phone}`        : "",
    order.executor ? `Исполнитель: ${order.executor}` : "",
    order.amount ? `Б/н: ${order.amount} тонн`  : "",
    order.margin ? `Маржа: ${order.margin} тонн`: "",
  ].filter(Boolean).join("\n").trim();

  const event = {
    summary: title,
    description,
    start, end,
    colorId: SVC_COLORS_CAL[order.service] || "1",
    reminders: { useDefault:false, overrides:[{ method:"popup", minutes:60 }] },
  };

  // Pick calendar ID for this service/type
  const svcCalKey = order.isReminder ? "cal_id_reminders" : ("cal_id_" + (order.service || ""));
  const rawId = localStorage.getItem(svcCalKey) || localStorage.getItem("cal_id_default") || "primary";
  const calendarId = encodeURIComponent(parseCalendarId(rawId));
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`,
    {
      method: "POST",
      headers: { Authorization:`Bearer ${token}`, "Content-Type":"application/json" },
      body: JSON.stringify(event),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(()=>({}));
    throw new Error(err?.error?.message || `Calendar API error ${res.status}`);
  }
  return res.json();
}

async function calendarDeleteEvent(token, eventId) {
  if (!token || !eventId) return;
  await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
    { method:"DELETE", headers:{ Authorization:`Bearer ${token}` } }
  );
}

function useGoogleAuth() {
  const [user, setUser]       = useState(() => { try { return JSON.parse(localStorage.getItem("gauth_user")||"null"); } catch { return null; } });
  const [token, setToken]     = useState(() => {
    // Истёкший токен бесполезен — все запросы упадут с 401
    const t   = localStorage.getItem("gauth_token") || null;
    const exp = parseInt(localStorage.getItem("gauth_token_exp") || "0", 10);
    return (t && exp > Date.now()) ? t : null;
  });
  const [clientId, setClientId] = useState(() => localStorage.getItem("google_client_id") || GOOGLE_CLIENT_ID);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const tokenClientRef        = useRef(null);

  const saveClientId = (id) => { setClientId(id); localStorage.setItem("google_client_id",id); };

  const initTokenClient = useCallback((cid) => {
    if (!window.google?.accounts || !cid) return;
    tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
      client_id: cid,
      scope: DRIVE_SCOPE,
      callback: async (resp) => {
        if (resp.error) { setError("Ошибка входа: " + resp.error); setLoading(false); return; }
        const tk = resp.access_token;
        setToken(tk);
        localStorage.setItem("gauth_token", tk);
        // Токен живёт ~1 час — запоминаем срок с запасом в минуту
        const expSec = resp.expires_in ? parseInt(resp.expires_in, 10) : 3600;
        localStorage.setItem("gauth_token_exp", String(Date.now() + (expSec - 60) * 1000));
        try {
          const info = await fetch("https://www.googleapis.com/oauth2/v3/userinfo",
            { headers: { Authorization: `Bearer ${tk}` } }).then(r=>r.json());
          const u = { name: info.name, email: info.email, picture: info.picture };
          setUser(u);
          localStorage.setItem("gauth_user", JSON.stringify(u));
        } catch(e) {}
        setLoading(false);
        setError("");
      },
      error_callback: () => {
        // Попап заблокирован или закрыт — токен недействителен
        setToken(null);
        localStorage.removeItem("gauth_token");
        localStorage.removeItem("gauth_token_exp");
        setLoading(false);
      },
    });
  }, []);

  const signIn = useCallback(async () => {
    if (!clientId) { setError("Введи Google Client ID"); return; }
    setLoading(true); setError("");
    await loadGSI();
    initTokenClient(clientId);
    if (!tokenClientRef.current) { setError("Не удалось загрузить Google SDK"); setLoading(false); return; }
    tokenClientRef.current.requestAccessToken({ prompt: "" });
  }, [clientId, initTokenClient]);

  const signOut = useCallback(() => {
    if (token && window.google?.accounts?.oauth2) {
      window.google.accounts.oauth2.revoke(token, ()=>{});
    }
    setUser(null); setToken(null);
    localStorage.removeItem("gauth_user");
    localStorage.removeItem("gauth_token");
    localStorage.removeItem("gauth_token_exp");
    localStorage.removeItem("auth_skipped");
    window.location.reload();
  }, [token]);

  // Тихое продление токена (или восстановление одним тапом из баннера)
  const refresh = useCallback(async () => {
    await loadGSI();
    if (!tokenClientRef.current && clientId) initTokenClient(clientId);
    if (tokenClientRef.current) {
      try { tokenClientRef.current.requestAccessToken({ prompt: "" }); } catch {}
    }
  }, [clientId, initTokenClient]);

  // Пометить токен недействительным (по 401 от Google API)
  const invalidate = useCallback(() => {
    setToken(null);
    localStorage.removeItem("gauth_token");
    localStorage.removeItem("gauth_token_exp");
  }, []);

  // Автопродление за 2 минуты до истечения срока
  useEffect(() => {
    if (!token) return;
    const exp = parseInt(localStorage.getItem("gauth_token_exp") || "0", 10);
    if (!exp) return;
    const ms = Math.max(5000, exp - Date.now() - 120000);
    const t = setTimeout(() => refresh(), ms);
    return () => clearTimeout(t);
  }, [token, refresh]);

  useEffect(() => {
    loadGSI().then(() => {
      if (clientId) initTokenClient(clientId);
      // Пользователь уже входил, но токен истёк — пробуем продлить тихо
      const exp = parseInt(localStorage.getItem("gauth_token_exp") || "0", 10);
      if (user && localStorage.getItem("gauth_token") && exp <= Date.now() && tokenClientRef.current) {
        try { tokenClientRef.current.requestAccessToken({ prompt: "" }); } catch {}
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, initTokenClient]);

  return { user, token, clientId, saveClientId, signIn, signOut, refresh, invalidate, loading, error };
}

// ─── ДВИЖОК СИНХРОНИЗАЦИИ ────────────────────────────────────────────────────
// Живёт в корне приложения и работает на ЛЮБОЙ вкладке (Заказы/Напоминания/Лиды):
//  • любое локальное изменение → выгрузка в Drive через 1.5 сек
//  • опрос облака каждые 20 сек + при возврате в приложение
//  • слияние по id с отметками удаления (удалённое не воскресает)
function SyncEngine({ children }) {
  const auth = useContext(AuthCtx);
  const [syncing, setSyncing]   = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const fileIdRef      = useRef(null);
  const tokenRef       = useRef(null);
  const authRef        = useRef(auth);
  const lastSavedAtRef = useRef(null);
  const saveTimerRef   = useRef(null);
  const busyRef        = useRef(false);

  useEffect(() => { tokenRef.current = auth?.token || null; }, [auth?.token]);
  useEffect(() => { authRef.current  = auth; }, [auth]);

  const readLocal = () => ({
    orders: (() => { try { return JSON.parse(localStorage.getItem("dispatch_orders")   || "[]"); } catch { return []; } })(),
    debts:  (() => { try { return JSON.parse(localStorage.getItem("dispatch_debts_v2") || "{}"); } catch { return {}; } })(),
    leads:  (() => { try { return JSON.parse(localStorage.getItem("leads_data_v2")     || "[]"); } catch { return []; } })(),
  });

  // Выгрузка всех локальных данных в Drive (debounce, чтобы не спамить API)
  const schedulePush = useCallback((delay = 1500) => {
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const token = tokenRef.current;
      if (!token) return;
      setSyncing(true);
      try {
        if (!fileIdRef.current) {
          const list  = await driveListFiles(token, DRIVE_FILE);
          const files = list.files || [];
          if (files.length > 0) fileIdRef.current = files[0].id;
        }
        const savedAt = new Date().toISOString();
        lastSavedAtRef.current = savedAt;
        const payload = { ...readLocal(), settings: buildSettingsPayload(), tombstones: getTombstones(), savedAt };
        if (fileIdRef.current) {
          await driveUpdateFile(token, fileIdRef.current, payload);
        } else {
          const res = await driveCreateFile(token, payload, DRIVE_FILE);
          if (res?.id) fileIdRef.current = res.id;
        }
        setLastSync(new Date());
      } catch (e) {
        if (e?.authError) authRef.current?.invalidate?.();
      }
      setSyncing(false);
    }, delay);
  }, []);

  // Чтение облака и слияние с локальными данными
  const pullAndMerge = useCallback(async (isInitial = false) => {
    const token = tokenRef.current;
    if (!token || busyRef.current) return;
    busyRef.current = true;
    setSyncing(true);
    try {
      if (!fileIdRef.current) {
        const list  = await driveListFiles(token, DRIVE_FILE);
        const files = list.files || [];
        if (files.length > 0) fileIdRef.current = files[0].id;
      }
      const local     = readLocal();
      const tombLocal = getTombstones();

      if (!fileIdRef.current) {
        // В облаке пусто — выгружаем то, что есть локально
        const savedAt = new Date().toISOString();
        lastSavedAtRef.current = savedAt;
        const payload = { ...local, settings: buildSettingsPayload(), tombstones: tombLocal, savedAt };
        const res = await driveCreateFile(token, payload, DRIVE_FILE);
        if (res?.id) { fileIdRef.current = res.id; setLastSync(new Date()); }
        return;
      }

      const cloud = await driveReadFile(token, fileIdRef.current);
      if (!cloud || typeof cloud !== "object") return;
      // Эхо собственного сохранения — пропускаем
      if (!isInitial && cloud.savedAt && cloud.savedAt === lastSavedAtRef.current) {
        setLastSync(new Date());
        return;
      }

      // Объединяем отметки об удалениях с обоих устройств
      const tomb = mergeTombstones(tombLocal, cloud.tombstones);
      localStorage.setItem("gvr_tombstones", JSON.stringify(tomb));

      const mo = mergeById(local.orders, cloud.orders, tomb);
      const ml = mergeById(local.leads,  cloud.leads,  tomb);
      const md = mergeDebts(local.debts, cloud.debts,  tomb);
      const debtsChanged = JSON.stringify(md) !== JSON.stringify(local.debts);

      if (mo.changed || ml.changed || debtsChanged) {
        localStorage.setItem("dispatch_orders",   JSON.stringify(mo.merged));
        localStorage.setItem("leads_data_v2",     JSON.stringify(ml.merged));
        localStorage.setItem("dispatch_debts_v2", JSON.stringify(md));
      }
      if (isInitial) applySettingsPayload(cloud.settings);
      if (mo.changed || ml.changed || debtsChanged || isInitial) {
        window.dispatchEvent(new Event(SYNC_MERGED));
      }

      // Если у нас есть данные, которых нет в облаке — дольём их обратно
      const cloudOrderIds = new Set((cloud.orders || []).map(o => o?.id));
      const cloudLeadIds  = new Set((cloud.leads  || []).map(l => l?.id));
      const weHaveExtra =
        mo.merged.some(o => !cloudOrderIds.has(o.id)) ||
        ml.merged.some(l => !cloudLeadIds.has(l.id)) ||
        JSON.stringify(md)   !== JSON.stringify(cloud.debts || {}) ||
        JSON.stringify(tomb) !== JSON.stringify(cloud.tombstones || {});
      if (weHaveExtra || isInitial) schedulePush(500);

      setLastSync(new Date());
    } catch (e) {
      if (e?.authError) authRef.current?.invalidate?.();
    } finally {
      busyRef.current = false;
      setSyncing(false);
    }
  }, [schedulePush]);

  // Первичная загрузка и слияние при появлении токена
  useEffect(() => { if (auth?.token) pullAndMerge(true); }, [auth?.token, pullAndMerge]);

  // Локальные изменения из любого раздела → выгрузка
  useEffect(() => {
    const h = () => schedulePush(1500);
    window.addEventListener(SYNC_LOCAL_CHANGED, h);
    return () => window.removeEventListener(SYNC_LOCAL_CHANGED, h);
  }, [schedulePush]);

  // Опрос облака каждые 20 секунд + при возврате в приложение
  useEffect(() => {
    const iv    = setInterval(() => pullAndMerge(false), 20000);
    const onVis = () => { if (!document.hidden) pullAndMerge(false); };
    window.addEventListener("focus", onVis);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(iv);
      window.removeEventListener("focus", onVis);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [pullAndMerge]);

  // Сессия истекла, а тихое продление не сработало — баннер на один тап
  const needsReauth = !!auth?.user && !auth?.token;
  const resume = () => authRef.current?.refresh?.();

  return (
    <SyncCtx.Provider value={{ syncing, lastSync, needsReauth, resume }}>
      {needsReauth && (
        <div onClick={resume} style={{
          position:"fixed", top:0, left:0, right:0, zIndex:5000,
          background:"#241a05", borderBottom:"1px solid rgba(210,168,106,0.4)",
          color:"#D2A86A", fontSize:12, fontWeight:700, textAlign:"center",
          padding:"max(10px, env(safe-area-inset-top)) 14px 9px",
          cursor:"pointer",
        }}>
          Сессия Google истекла — нажми, чтобы возобновить синхронизацию
        </div>
      )}
      {children}
    </SyncCtx.Provider>
  );
}

function LoginScreen({ auth, onSkip }) {
  const [showSetup, setShowSetup] = useState(!auth.clientId);
  const [cid, setCid] = useState(auth.clientId);
  const isSdkError = auth.error?.includes("SDK") || auth.error?.includes("загрузить");

  return (
    <div style={{
      minHeight:"100dvh", background:"var(--bg)",
      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      fontFamily:"'Outfit',-apple-system,sans-serif", padding:24,
    }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap');*{box-sizing:border-box}`}</style>

      <div style={{ maxWidth:420, width:"100%" }}>
        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:36 }}>
          <div style={{
            width:64, height:64, borderRadius:14,
            background:"linear-gradient(135deg,var(--card-2),var(--card-2))",
            border:"1.5px solid var(--w30)",
            display:"inline-flex", alignItems:"center", justifyContent:"center",
          }}><LogoSvg/></div>
          <div style={{ fontSize:24, fontWeight:800, color:"var(--text)", letterSpacing:"-0.03em" }}>GVR</div>
          <div style={{ fontSize:13, color:"var(--w55)", marginTop:4 }}>Growth · Value · Revenue</div>
        </div>

        {/* Main card */}
        <div style={{
          background:"var(--card)",boxShadow:"var(--elev)", border:"1px solid var(--w07)",
          borderRadius:14, padding:28,
        }}>
          {!showSetup ? (
            <>
              {/* CSP warning banner */}
              <div style={{
                marginBottom:16, padding:"12px 14px",
                background:"var(--card-2)", border:"1px solid #f59e0b44",
                borderRadius:12, fontSize:12, color:"#D2A86A", lineHeight:1.6,
              }}>
                <strong>Google вход недоступен внутри Claude</strong><br/>
                <span style={{color:"#8a6a20"}}>Браузер блокирует внешние скрипты в предпросмотре. Войди через Google когда приложение будет открыто как отдельный сайт. Пока — используй локальный режим.</span>
              </div>

              {/* Skip button — primary */}
              <button onClick={onSkip} style={{
                width:"100%", padding:"14px",
                background:"linear-gradient(135deg,#1a4a9e,#0e2d6e)",
                border:"1.5px solid #2a5aad",
                color:"#7E9AD6", borderRadius:12,
                fontSize:15, fontWeight:800, cursor:"pointer",
                fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:10,
                marginBottom:10,
              }}>
                Продолжить без входа
              </button>

              <div style={{
                textAlign:"center", fontSize:11, color:"var(--w55)", marginBottom:14,
              }}>Данные сохранятся на этом устройстве</div>

              {/* Divider */}
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
                <div style={{ flex:1, height:1, background:"var(--w10)" }}/>
                <span style={{ fontSize:11, color:"var(--w35)" }}>или при деплое сайта</span>
                <div style={{ flex:1, height:1, background:"var(--w10)" }}/>
              </div>

              {/* Google button — secondary */}
              <button onClick={auth.signIn} disabled={auth.loading} style={{
                width:"100%", padding:"12px",
                background:"transparent",
                border:"1.5px solid var(--w10)",
                color:"var(--w30)", borderRadius:12,
                fontSize:14, fontWeight:600, cursor:"not-allowed",
                fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:10,
                marginBottom:10, opacity:0.5,
              }}>
                <svg width="18" height="18" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                Войти через Google (недоступно здесь)
              </button>

              <button onClick={()=>setShowSetup(true)} style={{
                width:"100%", padding:"10px",
                background:"transparent", border:"1px solid var(--w07)",
                color:"var(--w35)", borderRadius:10, fontSize:12,
                cursor:"pointer", fontFamily:"inherit",
              }}>Настроить для деплоя</button>
            </>
          ) : (
            <>
              <div style={{ fontSize:15, fontWeight:800, color:"var(--text)", marginBottom:4 }}>Настройка Google Client ID</div>
              <div style={{ fontSize:12, color:"var(--w55)", marginBottom:20, lineHeight:1.6 }}>
                Нужно для работы синхронизации когда приложение будет опубликовано как отдельный сайт
              </div>

              {[
                { n:1, t:"Откройте Google Cloud Console", d:<>Перейдите на <span style={{color:"#4285F4"}}>console.cloud.google.com</span> → создайте проект</> },
                { n:2, t:"Включите Drive API", d:'APIs & Services → Library → Google Drive API → Enable' },
                { n:3, t:"Создайте Client ID", d:'APIs & Services → Credentials → Create → OAuth Client ID → Web Application' },
                { n:4, t:"Добавьте домен сайта", d:'В «Authorized JavaScript origins» добавьте URL вашего сайта' },
                { n:5, t:"Вставьте Client ID", d:"Скопируйте Client ID и вставьте ниже" },
              ].map(s=>(
                <div key={s.n} style={{display:"flex",gap:12,marginBottom:14}}>
                  <div style={{
                    minWidth:24,height:24,borderRadius:"50%",
                    background:"var(--card-2)",color:"#7E9AD6",
                    display:"flex",alignItems:"center",justifyContent:"center",
                    fontSize:11,fontWeight:800,border:"1px solid #2a5aad",flexShrink:0,
                  }}>{s.n}</div>
                  <div>
                    <div style={{fontWeight:700,fontSize:12,color:"var(--text)",marginBottom:2}}>{s.t}</div>
                    <div style={{fontSize:11,color:"var(--w55)",lineHeight:1.5}}>{s.d}</div>
                  </div>
                </div>
              ))}

              <input
                placeholder="1234567890-abc...apps.googleusercontent.com"
                value={cid} onChange={e=>setCid(e.target.value)}
                style={{
                  width:"100%", background:"var(--card-2)", border:"1.5px solid var(--w10)",
                  borderRadius:10, color:"var(--text)", fontSize:12, padding:"10px 12px",
                  outline:"none", fontFamily:"monospace", marginBottom:10,
                }}
                onFocus={e=>e.target.style.borderColor="var(--w30)"}
                onBlur={e=>e.target.style.borderColor="var(--w10)"}
              />
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={()=>{ auth.saveClientId(cid); setShowSetup(false); }} style={{
                  flex:1, padding:"10px", background:"var(--card-2)", border:"1.5px solid #2a5aad",
                  color:"#7E9AD6", borderRadius:10, fontSize:13, fontWeight:700,
                  cursor:"pointer", fontFamily:"inherit",
                }}>Сохранить</button>
                <button onClick={()=>setShowSetup(false)} style={{
                  padding:"10px 16px", background:"transparent", border:"1px solid var(--w07)",
                  color:"var(--w55)", borderRadius:10, fontSize:13, cursor:"pointer", fontFamily:"inherit",
                }}>Назад</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── SYNC STATUS BADGE ────────────────────────────────────────────────────────
function SyncBadge({ syncing, lastSync, user, onSignOut }) {
  const [showMenu, setShowMenu] = useState(false);
  return (
    <div style={{ position:"relative" }}>
      <button onClick={()=>setShowMenu(!showMenu)} style={{
        display:"flex", alignItems:"center", gap:7,
        background:"transparent", border:"1px solid var(--w07)",
        borderRadius:20, padding:"4px 10px 4px 5px",
        cursor:"pointer", fontFamily:"inherit",
      }}>
        {user?.picture
          ? <img src={user.picture} style={{width:22,height:22,borderRadius:"50%"}} alt=""/>
          : <div style={{width:22,height:22,borderRadius:"50%",background:"var(--card-2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11}}>👤</div>
        }
        <span style={{ fontSize:11, color: syncing?"#D2A86A":"#79B391", fontWeight:700 }}>
          {syncing ? "Синхр..." : lastSync ? "Синхр" : "●"}
        </span>
      </button>
      {showMenu && (
        <div style={{
          position:"absolute", right:0, top:"calc(100% + 6px)",
          background:"var(--card)",boxShadow:"var(--elev)", border:"1px solid var(--w07)", borderRadius:12,
          padding:"10px", minWidth:200, zIndex:100,
        }}>
          <div style={{ fontSize:12, color:"var(--text)", fontWeight:700, marginBottom:2 }}>{user?.name}</div>
          <div style={{ fontSize:11, color:"var(--w55)", marginBottom:10 }}>{user?.email}</div>
          {lastSync && <div style={{ fontSize:10, color:"var(--w35)", marginBottom:10 }}>
            Синхр: {lastSync.toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"})}
          </div>}
          <button onClick={()=>{setShowMenu(false);onSignOut();}} style={{
            width:"100%", padding:"7px", background:"rgba(205,133,133,0.12)",
            border:"1px solid #CD858533", color:"#CD8585",
            borderRadius:8, fontSize:12, fontWeight:700,
            cursor:"pointer", fontFamily:"inherit",
          }}>Выйти из аккаунта</button>
        </div>
      )}
    </div>
  );
}

// ─── HELPERS ────────────────────────────────────────────────────────────────
const RU_DAYS = ["вс","пн","вт","ср","чт","пт","сб"];
const RU_MONTHS = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  const day = RU_DAYS[d.getDay()];
  return `${day} ${String(d.getDate()).padStart(2,"0")}.${String(d.getMonth()+1).padStart(2,"0")}.${d.getFullYear()}`;
}
function formatTimeSlot(hour) {
  if (!hour || hour === "day") return "в течении дня";
  const h = parseInt(hour);
  return `${h}:00–${h+2}:00`;
}
function isoDateTime(dateStr, hour) {
  if (!dateStr) return null;
  const h = (hour && hour !== "day") ? parseInt(hour) : 9;
  return `${dateStr}T${String(h).padStart(2,"0")}:00:00`;
}
function isoDateTimeEnd(dateStr, hour) {
  if (!dateStr) return null;
  const h = (hour && hour !== "day") ? parseInt(hour)+2 : 18;
  return `${dateStr}T${String(h).padStart(2,"0")}:00:00`;
}

// Локальная дата YYYY-MM-DD (toISOString даёт UTC и ночью сдвигает день назад)
function localISODate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ─── ИСПОЛНИТЕЛИ (вывоз мусора) ─────────────────────────────────────────────
const EXECUTORS = [
  "Сергей (Раменское)",
  "Юрий (Жуковский)",
  "Алексей (Бронницы)",
  "Виталий (Домодедово)",
];
// ☝️ ДОБАВИТЬ НОВОГО ИСПОЛНИТЕЛЯ: просто допиши строку в список выше.
// Он автоматически появится в форме заказа и во всех фильтрах
// («По услугам», «Платежи», «Аналитика»). Фильтры также подхватывают
// исполнителей, найденных в существующих заказах.

function getExecutors(orders) {
  const set = new Set(EXECUTORS);
  (orders || []).forEach(o => {
    const e = o?.executor || o?.data?.executor;
    if (e && String(e).trim()) set.add(String(e).trim());
  });
  return [...set];
}
function orderExecutor(o) { return o?.executor || o?.data?.executor || ""; }

// Универсальный фильтр по исполнителю: «Все» + список (пилюли)
function ExecutorFilter({ value, onChange, executors }) {
  return (
    <div style={{ display:"flex", gap:6, marginBottom:14, flexWrap:"wrap", alignItems:"center" }}>
      <span style={{ fontSize:10, fontWeight:700, color:"var(--w22)", letterSpacing:"0.07em", textTransform:"uppercase", marginRight:2 }}>Исполнитель</span>
      {[["all","Все"], ...executors.map(e=>[e,e])].map(([id,label])=>(
        <button key={id} onClick={()=>onChange(id)} style={{
          padding:"5px 13px", borderRadius:20, flexShrink:0,
          border:`1.5px solid ${value===id?"#79B391":"var(--w10)"}`,
          background: value===id?"rgba(121,179,145,0.12)":"transparent",
          color: value===id?"#79B391":"var(--w45)",
          fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
        }}>{label}</button>
      ))}
    </div>
  );
}

// ─── SERVICES CONFIG ────────────────────────────────────────────────────────
const SERVICES = [
  { id: "trash",   icon: "trash_svc", label: "Вывоз мусора",  color: "#79B391" },
  { id: "sawdust", icon: "sawdust_svc", label: "Опилки россыпью", color: "#D2A86A" },
  { id: "offcuts", icon: "offcuts_svc", label: "Обрезки доски", color: "#C98E73" },
  { id: "_add",    icon: "+",  label: "Добавить услугу",     color: "#4b5263", add: true },
];

// ─── MESSAGE GENERATORS ─────────────────────────────────────────────────────
function genTrash(f) {
  if (!f.action) return "";
  const lines = [];
  const vol = f.volume ? `${f.volume}м³` : "";
  const rental = f.rental ? ` (${f.rental})` : "";
  lines.push(`${f.action}: ${vol}${rental}`);
  lines.push("");
  if (f.address) lines.push(f.address);
  lines.push("");
  if (f.date) lines.push(`📅 Дата: ${formatDate(f.date)}`);
  lines.push(`🕐 Время: ${formatTimeSlot(f.hour)}`);
  if (f.note) lines.push(`⚠️ ${f.note}`);
  lines.push("");
  if (f.phone) lines.push(f.phone);
  if (f.clientName) lines.push(f.clientName);
  if (f.manager) lines.push(`Отв: ${f.manager}`);
  if (f.executor) lines.push(`Исполнитель: ${f.executor}`);
  lines.push("");
  if (f.amount) lines.push(`Б/н: ${f.amount} тонн`);
  if (f.margin) lines.push(`Маржа: ${f.margin} тонн`);
  if (f.company) lines.push(f.company);
  if (f.geoLink) { lines.push(""); lines.push(`📍 ${f.geoLink}`); }
  return lines.join("\n");
}

function genSawdust(f) {
  const vol = f.volume ? `${f.volume}м³ ` : "";
  const lines = [];
  lines.push(`${vol}опилок`);
  lines.push("");
  if (f.address) lines.push(f.address);
  lines.push("");
  if (f.date) lines.push(`📅 Дата: ${formatDate(f.date)}`);
  if (f.hour) lines.push(`🕐 Время: ${formatTimeSlot(f.hour)}`);
  if (f.note) lines.push(`⚠️ ${f.note}`);
  lines.push("");
  if (f.phone) lines.push(f.phone);
  if (f.clientName) lines.push(f.clientName);
  if (f.managerPhone) lines.push(`Отв: ${f.managerPhone}`);
  lines.push("");
  if (f.amount) lines.push(`Б/н: ${f.amount} тонн`);
  if (f.margin) lines.push(`Маржа: ${f.margin} тонн`);
  if (f.company) lines.push(f.company);
  if (f.geoLink) { lines.push(""); lines.push(`📍 ${f.geoLink}`); }
  return lines.join("\n");
}

function genOffcuts(f) {
  const lines = [];
  const type = f.offcutType && f.offcutType !== "любые" ? `${f.offcutType} ` : "";
  const vol = f.volume ? `${f.volume}м³` : "";
  lines.push(`Обрезки ${type}${vol}`);
  lines.push("");
  if (f.address) lines.push(f.address);
  lines.push("");
  if (f.date) lines.push(`📅 ${formatDate(f.date)}`);
  if (f.hour) lines.push(`🕐 ${formatTimeSlot(f.hour)}`);
  if (f.note) lines.push(`⚠️ ${f.note}`);
  lines.push("");
  if (f.phone) lines.push(f.phone);
  if (f.clientName) lines.push(f.clientName);
  if (f.managerPhone) lines.push(`Отв: ${f.managerPhone}`);
  lines.push("");
  if (f.amount) lines.push(`Б/н: ${f.amount} тонн`);
  if (f.margin) lines.push(`Маржа: ${f.margin} тонн`);
  if (f.company) lines.push(f.company);
  if (f.geoLink) { lines.push(""); lines.push(`📍 ${f.geoLink}`); }
  return lines.join("\n");
}

const GENERATORS = { trash: genTrash, sawdust: genSawdust, offcuts: genOffcuts };

// ─── FORM FIELDS CONFIG ─────────────────────────────────────────────────────
function formatPhone(raw) {
  const digits = raw.replace(/\D/g, "");
  let d = digits;
  if (d.startsWith("8")) d = "7" + d.slice(1);
  if (!d.startsWith("7")) d = "7" + d;
  d = d.slice(0, 11);
  const p = d.slice(1);
  let out = "+7";
  if (p.length > 0) out += " (" + p.slice(0, 3);
  if (p.length >= 3) out += ") " + p.slice(3, 6);
  if (p.length >= 6) out += "-" + p.slice(6, 8);
  if (p.length >= 8) out += "-" + p.slice(8, 10);
  return out;
}

function TrashForm({ f, set }) {
  const fieldStyle = { marginBottom: 12 };
  return (
    <>
      {/* Действие | Объём */}
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12}}>
        <Field label="Действие">
          <SelectPick
            options={[["— выбрать —",""],["Поставить","Поставить"],["Откатать","Откатать"],["Заменить","Заменить"]]}
            value={f.action||""} onChange={v => set("action", v)}
          />
        </Field>
        <Field label="Объём">
          <SelectPick
            options={[["— м³ —",""],["8 м³","8"],["10 м³","10"],["20 м³","20"],["30 м³","30"]]}
            value={f.volume||""} onChange={v => set("volume", v)}
          />
        </Field>
      </div>

      {/* Контейнер нужен | Исполнитель */}
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12}}>
        <Field label="Контейнер нужен">
          <SelectPick
            options={[
              ["— срок —",""],
              ["Под погрузку","под погрузку"],
              ["На сутки","на сутки"],
              ["Неполный день","на неполный день"],
              ["2–3 дня","на 2-3 дня"],
              ["3–4 дня","на 3-4 дня"],
              ["На неделю","на неделю"],
              ["На месяц","на месяц"],
            ]}
            value={f.rental||""} onChange={v => set("rental", v)}
          />
        </Field>
        <Field label="Исполнитель">
          <SelectPick
            options={[["— выбрать —",""], ...EXECUTORS.map(x => [x, x])]}
            value={f.executor||""} onChange={v => set("executor", v)}
          />
        </Field>
      </div>

      {/* Адрес заказа */}
      <div style={{marginBottom:12}}>
        <Field label="Адрес заказа">
          <Input multiline rows={3} placeholder="Адрес объекта" value={f.address||""} onChange={v => set("address",v)} />
        </Field>
      </div>

      {/* Дата */}
      <div style={{marginBottom:12}}>
        <Field label="Дата">
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            <input
              type="date"
              value={f.date||""}
              onChange={e => set("date", e.target.value)}
              style={{
                flex:1, background:"var(--card-2)",
                border:"1px solid var(--w10)", borderRadius:11,
                color: f.date ? "var(--w85)" : "var(--w45)",
                fontSize:13, padding:"9px 12px",
                outline:"none", fontFamily:"inherit",
                boxSizing:"border-box",
                WebkitAppearance:"none", appearance:"none",
                lineHeight:"1.4",
              }}
            />
            {f.date && (
              <button onClick={() => set("date","")} style={{
                flexShrink:0,width:32,height:36,background:"transparent",
                border:"1px solid var(--w10)",borderRadius:8,
                color:"var(--w40)",fontSize:14,cursor:"pointer",
                display:"flex",alignItems:"center",justifyContent:"center",
                fontFamily:"inherit",
              }}>✕</button>
            )}
          </div>
        </Field>
      </div>

      {/* Время */}
      <div style={{marginBottom:12}}>
        <Field label="Время">
          <select
            value={f.hour || "day"}
            onChange={e => set("hour", e.target.value)}
            style={{
              width:"100%", background:"var(--card-2)",
              border:"1px solid var(--w10)", borderRadius:11,
              color:"var(--w85)", fontSize:13, padding:"9px 12px",
              outline:"none", fontFamily:"inherit",
              boxSizing:"border-box", display:"block",
              cursor:"pointer", lineHeight:"1.4",
            }}
          >
            {["day",7,8,9,10,11,12,13,14,15,16,17,18,19,20].map(h => (
              <option key={h} value={h}>
                {h === "day" ? "Весь день" : `${h}:00–${h+2}:00`}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {/* Имя | Телефон */}
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12}}>
        <Field label="Имя клиента">
          <Input placeholder="Имя клиента" value={f.clientName||""} onChange={v => set("clientName",v)} />
        </Field>
        <Field label="Телефон">
          <Input
            placeholder="+7 (___) ___-__-__"
            value={f.phone||""}
            onChange={v => set("phone", formatPhone(v))}
          />
        </Field>
      </div>

      {/* Сумма | Моржа */}
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12}}>
        <Field label="Сумма (тонн)">
          <Input placeholder="Сумма" type="number" step="0.1" value={f.amount||""} onChange={v => set("amount",v)} />
        </Field>
        <Field label="Маржа (тонн)">
          <Input placeholder="Маржа" type="number" step="0.1" value={f.margin||""} onChange={v => set("margin",v)} />
        </Field>
      </div>

      {/* Организация | Ответственный */}
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12}}>
        <Field label="Организация">
          <Input placeholder='Организация' value={f.company||""} onChange={v => set("company",v)} />
        </Field>
        <Field label="Ответственный">
          <Input
            placeholder="+7 (___) ___-__-__"
            value={f.manager||""}
            onChange={v => set("manager", formatPhone(v))}
          />
        </Field>
      </div>
      {/* Примечание | Следующий заказ */}
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12}}>
        <Field label="Примечание">
          <Input placeholder="Доп. информация, пожелания клиента..." value={f.note||""} onChange={v => set("note",v)} />
        </Field>
        <Field label="Следующий заказ">
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            <div style={{flex:1}}><Input key={f.nextDate?"nd1":"nd0"} type="date" value={f.nextDate||""} onChange={v => set("nextDate",v)} /></div>
            {f.nextDate && (
              <button onClick={() => set("nextDate","")} style={{
                flexShrink:0,height:36,padding:"0 12px",background:"rgba(205,133,133,0.12)",
                border:"1px solid rgba(205,133,133,0.3)",borderRadius:8,
                color:"#CD8585",fontSize:12,fontWeight:700,cursor:"pointer",
                display:"flex",alignItems:"center",justifyContent:"center",
                fontFamily:"inherit",whiteSpace:"nowrap",
              }}>Сброс</button>
            )}
          </div>
        </Field>
      </div>
    </>
  );
}

function SawdustForm({ f, set }) {
  // Автоподстановка значений по умолчанию
  useEffect(() => {
    if (f.volume === undefined || f.volume === "") set("volume", "32");
    if (f.hour === undefined || f.hour === "") set("hour", "day");
  }, []);

  return (
    <>
      {/* Объём */}
      <div style={{marginBottom:12}}>
        <Field label="Объём (м³)">
          <Input placeholder="32" type="number" value={f.volume||""} onChange={v => set("volume",v)} suffix="м³" />
        </Field>
      </div>

      {/* Адрес заказа */}
      <div style={{marginBottom:12}}>
        <Field label="Адрес заказа">
          <Input multiline rows={3} placeholder="Адрес доставки" value={f.address||""} onChange={v => set("address",v)} />
        </Field>
      </div>

      {/* Дата */}
      <div style={{marginBottom:12}}>
        <Field label="Дата">
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            <input
              type="date"
              value={f.date||""}
              onChange={e => set("date", e.target.value)}
              style={{
                flex:1, background:"var(--card-2)",
                border:"1px solid var(--w10)", borderRadius:11,
                color: f.date ? "var(--w85)" : "var(--w45)",
                fontSize:13, padding:"9px 12px",
                outline:"none", fontFamily:"inherit",
                boxSizing:"border-box",
                WebkitAppearance:"none", appearance:"none",
                lineHeight:"1.4",
              }}
            />
            {f.date && (
              <button onClick={() => set("date","")} style={{
                flexShrink:0,width:32,height:36,background:"transparent",
                border:"1px solid var(--w10)",borderRadius:8,
                color:"var(--w40)",fontSize:14,cursor:"pointer",
                display:"flex",alignItems:"center",justifyContent:"center",
                fontFamily:"inherit",
              }}>✕</button>
            )}
          </div>
        </Field>
      </div>

      {/* Время */}
      <div style={{marginBottom:12}}>
        <Field label="Время">
          <select
            value={f.hour || "day"}
            onChange={e => set("hour", e.target.value)}
            style={{
              width:"100%", background:"var(--card-2)",
              border:"1px solid var(--w10)", borderRadius:11,
              color:"var(--w85)", fontSize:13, padding:"9px 12px",
              outline:"none", fontFamily:"inherit",
              boxSizing:"border-box", display:"block",
              cursor:"pointer", lineHeight:"1.4",
            }}
          >
            {["day",7,8,9,10,11,12,13,14,15,16,17,18,19,20].map(h => (
              <option key={h} value={h}>
                {h === "day" ? "Весь день" : `${h}:00–${h+2}:00`}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {/* Имя | Телефон */}
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12}}>
        <Field label="Имя клиента">
          <Input placeholder="Олег" value={f.clientName||""} onChange={v => set("clientName",v)} />
        </Field>
        <Field label="Телефон">
          <Input
            placeholder="+7 (___) ___-__-__"
            value={f.phone||""}
            onChange={v => set("phone", formatPhone(v))}
          />
        </Field>
      </div>

      {/* Сумма | Маржа */}
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12}}>
        <Field label="Сумма (тонн)">
          <Input placeholder="23" type="number" step="0.1" value={f.amount||""} onChange={v => set("amount",v)} />
        </Field>
        <Field label="Маржа (тонн)">
          <Input placeholder="Маржа" type="number" step="0.1" value={f.margin||""} onChange={v => set("margin",v)} />
        </Field>
      </div>

      {/* Организация | Ответственный */}
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12}}>
        <Field label="Организация">
          <Input placeholder='Организация' value={f.company||""} onChange={v => set("company",v)} />
        </Field>
        <Field label="Ответственный">
          <Input
            placeholder="+7 (___) ___-__-__"
            value={f.managerPhone||""}
            onChange={v => set("managerPhone", formatPhone(v))}
          />
        </Field>
      </div>
      {/* Примечание | Следующая доставка */}
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12}}>
        <Field label="Примечание">
          <Input placeholder="Доп. информация, пожелания клиента..." value={f.note||""} onChange={v => set("note",v)} />
        </Field>
        <Field label="Следующая доставка">
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            <div style={{flex:1}}><Input key={f.nextDate?"nd1":"nd0"} type="date" value={f.nextDate||""} onChange={v => set("nextDate",v)} /></div>
            {f.nextDate && (
              <button onClick={() => set("nextDate","")} style={{
                flexShrink:0,height:36,padding:"0 12px",background:"rgba(205,133,133,0.12)",
                border:"1px solid rgba(205,133,133,0.3)",borderRadius:8,
                color:"#CD8585",fontSize:12,fontWeight:700,cursor:"pointer",
                display:"flex",alignItems:"center",justifyContent:"center",
                fontFamily:"inherit",whiteSpace:"nowrap",
              }}>Сброс</button>
            )}
          </div>
        </Field>
      </div>
    </>
  );
}

function OffcutsForm({ f, set }) {
  // Автоподстановка значений по умолчанию
  useEffect(() => {
    if (!f.offcutType) set("offcutType", "любые");
    if (!f.volume) set("volume", "8");
    if (!f.hour) set("hour", "day");
  }, []);

  return (
    <>
      {/* Тип обрезков */}
      <div style={{marginBottom:12}}>
        <Field label="Тип обрезков">
          <SelectPick
            options={[
              ["— выбрать —",""],
              ["Короткие","короткие"],
              ["Длинные","длинные"],
              ["Любые","любые"],
            ]}
            value={f.offcutType||""} onChange={v => set("offcutType", v)}
          />
        </Field>
      </div>

      {/* Объём */}
      <div style={{marginBottom:12}}>
        <Field label="Объём (м³)">
          <Input placeholder="8" type="number" value={f.volume || "8"} onChange={v => set("volume", v)} suffix="м³" />
        </Field>
      </div>

      {/* Адрес заказа */}
      <div style={{marginBottom:12}}>
        <Field label="Адрес заказа">
          <Input multiline rows={3} placeholder="Адрес доставки" value={f.address||""} onChange={v => set("address",v)} />
        </Field>
      </div>

      {/* Дата */}
      <div style={{marginBottom:12}}>
        <Field label="Дата">
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            <input
              type="date"
              value={f.date||""}
              onChange={e => set("date", e.target.value)}
              style={{
                flex:1, background:"var(--card-2)",
                border:"1px solid var(--w10)", borderRadius:11,
                color: f.date ? "var(--w85)" : "var(--w45)",
                fontSize:13, padding:"9px 12px",
                outline:"none", fontFamily:"inherit",
                boxSizing:"border-box",
                WebkitAppearance:"none", appearance:"none",
                lineHeight:"1.4",
              }}
            />
            {f.date && (
              <button onClick={() => set("date","")} style={{
                flexShrink:0,width:32,height:36,background:"transparent",
                border:"1px solid var(--w10)",borderRadius:8,
                color:"var(--w40)",fontSize:14,cursor:"pointer",
                display:"flex",alignItems:"center",justifyContent:"center",
                fontFamily:"inherit",
              }}>✕</button>
            )}
          </div>
        </Field>
      </div>

      {/* Время */}
      <div style={{marginBottom:12}}>
        <Field label="Время">
          <select
            value={f.hour || "day"}
            onChange={e => set("hour", e.target.value)}
            style={{
              width:"100%", background:"var(--card-2)",
              border:"1px solid var(--w10)", borderRadius:11,
              color:"var(--w85)", fontSize:13, padding:"9px 12px",
              outline:"none", fontFamily:"inherit",
              boxSizing:"border-box", display:"block",
              cursor:"pointer", lineHeight:"1.4",
            }}
          >
            {["day",7,8,9,10,11,12,13,14,15,16,17,18,19,20].map(h => (
              <option key={h} value={h}>
                {h === "day" ? "Весь день" : `${h}:00–${h+2}:00`}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {/* Имя | Телефон */}
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12}}>
        <Field label="Имя клиента">
          <Input placeholder="Михаил" value={f.clientName||""} onChange={v => set("clientName",v)} />
        </Field>
        <Field label="Телефон">
          <Input
            placeholder="+7 (___) ___-__-__"
            value={f.phone||""}
            onChange={v => set("phone", formatPhone(v))}
          />
        </Field>
      </div>

      {/* Сумма | Маржа */}
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12}}>
        <Field label="Сумма (тонн)">
          <Input placeholder="7.8" type="number" step="0.1" value={f.amount||""} onChange={v => set("amount",v)} />
        </Field>
        <Field label="Маржа (тонн)">
          <Input placeholder="1.0" type="number" step="0.1" value={f.margin||""} onChange={v => set("margin",v)} />
        </Field>
      </div>

      {/* Организация | Ответственный */}
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12}}>
        <Field label="Организация">
          <Input placeholder='Организация' value={f.company||""} onChange={v => set("company",v)} />
        </Field>
        <Field label="Ответственный">
          <Input
            placeholder="+7 (___) ___-__-__"
            value={f.managerPhone||""}
            onChange={v => set("managerPhone", formatPhone(v))}
          />
        </Field>
      </div>
      {/* Примечание | Следующая доставка */}
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12}}>
        <Field label="Примечание">
          <Input placeholder="Доп. информация, пожелания клиента..." value={f.note||""} onChange={v => set("note",v)} />
        </Field>
        <Field label="Следующая доставка">
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            <div style={{flex:1}}><Input key={f.nextDate?"nd1":"nd0"} type="date" value={f.nextDate||""} onChange={v => set("nextDate",v)} /></div>
            {f.nextDate && (
              <button onClick={() => set("nextDate","")} style={{
                flexShrink:0,height:36,padding:"0 12px",background:"rgba(205,133,133,0.12)",
                border:"1px solid rgba(205,133,133,0.3)",borderRadius:8,
                color:"#CD8585",fontSize:12,fontWeight:700,cursor:"pointer",
                display:"flex",alignItems:"center",justifyContent:"center",
                fontFamily:"inherit",whiteSpace:"nowrap",
              }}>Сброс</button>
            )}
          </div>
        </Field>
      </div>
    </>
  );
}

const FORMS = { trash: TrashForm, sawdust: SawdustForm, offcuts: OffcutsForm };

// ─── UI PRIMITIVES ──────────────────────────────────────────────────────────
function Row({ children }) {
  return <div style={{ marginBottom: 14 }}>{children}</div>;
}
function Row2({ children }) {
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>{children}</div>;
}
function Field({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--w38)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}
function Input({ placeholder, value, onChange, type = "text", step, prefix, suffix, multiline, rows = 3 }) {
  const baseStyle = {
    width: "100%",
    background: "var(--card-2)",
    border: "1px solid var(--w10)",
    borderRadius: 9,
    color: "var(--w85)",
    fontSize: 13,
    padding: "9px 12px",
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "inherit",
    transition: "border-color 0.15s",
    resize: "none",
  };
  if (multiline) return (
    <textarea rows={rows} placeholder={placeholder} value={value}
      onChange={e => onChange(e.target.value)} style={baseStyle}
      onFocus={e => e.target.style.borderColor="var(--w30)"}
      onBlur={e => e.target.style.borderColor="var(--w10)"}
    />
  );
  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
      {prefix && <span style={{ position:"absolute", left:10, color:"var(--w45)", fontSize:12, pointerEvents:"none", userSelect:"none" }}>{prefix}</span>}
      <input
        type={type}
        step={step}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          ...baseStyle,
          padding: `9px ${suffix ? "52px" : "12px"} 9px ${prefix ? "60px" : "12px"}`,
        }}
        onFocus={e => e.target.style.borderColor = "var(--w30)"}
        onBlur={e => e.target.style.borderColor = "var(--w10)"}
      />
      {suffix && <span style={{ position:"absolute", right:10, color:"var(--w45)", fontSize:12, pointerEvents:"none" }}>{suffix}</span>}
    </div>
  );
}
function SelectPick({ options, value, onChange }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        width:"100%", background:"var(--card-2)",
        border:"1px solid var(--w10)", borderRadius:12,
        color: value ? "var(--w85)" : "var(--w45)",
        fontSize:13, padding:"9px 12px",
        outline:"none", fontFamily:"inherit", cursor:"pointer",
      }}
    >
      {options.map(([label, val]) => (
        <option key={val} value={val}>{label}</option>
      ))}
    </select>
  );
}

function ToggleGroup({ options, value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {options.map(([label, val]) => (
        <button
          key={val}
          onClick={() => onChange(value === val ? "" : val)}
          style={{
            padding: "7px 14px",
            borderRadius: 8,
            border: value === val ? "1.5px solid #2a5aad" : "1px solid var(--w10)",
            background: value === val ? "rgba(126,154,214,0.12)" : "var(--card-2)",
            color: value === val ? "#7E9AD6" : "#5a6a88",
            fontSize: 13,
            fontWeight: value === val ? 700 : 500,
            cursor: "pointer",
            fontFamily: "inherit",
            transition: "all 0.12s",
          }}
        >{label}</button>
      ))}
    </div>
  );
}
function HourPicker({ value, onChange }) {
  const hours = ["day", 7,8,9,10,11,12,13,14,15,16,17,18,19,20];
  const label = h => h === "day" ? "Весь день" : `${h}:00–${h+2}:00`;
  return (
    <select
      value={value || "day"}
      onChange={e => onChange(e.target.value)}
      style={{
        width: "100%",
        background: "var(--card-2)",
        border: "1px solid var(--w10)",
        borderRadius: 9,
        color: "var(--w85)",
        fontSize: 13,
        padding: "9px 12px",
        outline: "none",
        fontFamily: "inherit",
        cursor: "pointer",
        boxSizing: "border-box",
        appearance: "auto",
      }}
    >
      {hours.map(h => <option key={h} value={h}>{label(h)}</option>)}
    </select>
  );
}

// ─── CALENDAR INTEGRATION ───────────────────────────────────────────────────
async function createCalendarEvent(serviceId, f, message) {
  const titles = { trash: "Вывоз мусора", sawdust: "Опилки россыпью", offcuts: "Обрезки доски" };
  const title = `${titles[serviceId]}: ${f.clientName || f.address || "заявка"}`;
  const start = isoDateTime(f.date, f.hour);
  const end = isoDateTimeEnd(f.date, f.hour);
  if (!start) throw new Error("Нет даты");

  const prompt = `Создай событие в Google Calendar:
- Название: ${title}
- Начало: ${start}
- Конец: ${end}
- Описание: ${message}
- Место: ${f.address || ""}
Создай событие.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      mcp_servers: [{ type: "url", url: "https://calendarmcp.googleapis.com/mcp/v1", name: "google-calendar" }],
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error?.message || "Calendar error");
  return true;
}

// ─── ORDERS ─────────────────────────────────────────────────────────────────
const ORDER_STATUSES = [
  { id:"new",      label:"Новый",     color:"#7E9AD6" },
  { id:"queue",    label:"В очереди", color:"#D2A86A" },
  { id:"working",  label:"В работе",  color:"#A98FD0" },
  { id:"done",     label:"Выполнен",  color:"#79B391" },
  { id:"cancelled",label:"Отменён",   color:"#CD8585" },
];
const getOrderStatus = id => ORDER_STATUSES.find(s => s.id === id) || ORDER_STATUSES[0];

function normalizePhone(raw) {
  if (!raw) return "";
  return raw.replace(/\D/g, "").replace(/^8/, "7");
}

// Нормализуем любой ввод телефона для сравнения:
// "89991234567", "+7 (999) 123-45-67", "9991234567", "999 123 45 67" → одинаково
function normalizeQuery(raw) {
  if (!raw) return "";
  return raw.replace(/\D/g, "").replace(/^8/, "7");
}

// Проверяем, содержит ли строка телефона запрос в любом формате
function phoneMatches(phone, query) {
  if (!phone || !query) return false;
  const digPhone = normalizePhone(phone);  // нормализованный телефон
  const digQuery = normalizeQuery(query);  // нормализованный запрос

  if (!digQuery) return false;

  // Прямое совпадение по цифрам
  if (digPhone.includes(digQuery)) return true;

  // Если запрос начинается с 9 (без кода) — добавляем 7 и проверяем
  if (digQuery.length >= 7 && !digQuery.startsWith("7")) {
    if (digPhone.includes("7" + digQuery)) return true;
  }

  // Если ввод с 8 (до нормализации) — ищем и с 7
  if (digQuery.startsWith("7") && digPhone.includes(digQuery.replace(/^7/, "9"))) return true;

  return false;
}

// Главная функция поиска — проверяет клиента и все его заказы
function clientMatchesSearch(client, rawQuery) {
  if (!rawQuery) return true;
  const q = rawQuery.toLowerCase().trim();
  if (!q) return true;

  // Имя клиента
  if ((client.name || "").toLowerCase().includes(q)) return true;

  // Телефон в любом формате
  if (phoneMatches(client.phone, q)) return true;

  // Проверяем все заказы клиента
  for (const o of client.orders) {
    // Адрес заказа
    if ((o.address || "").toLowerCase().includes(q)) return true;
    // Имя в заказе (могло быть обновлено)
    if ((o.clientName || "").toLowerCase().includes(q)) return true;
    // Телефон заказа
    if (phoneMatches(o.phone, q)) return true;
    // Название услуги
    const svc = SERVICES.find(s => s.id === o.service);
    if (svc && svc.label.toLowerCase().includes(q)) return true;
    // Примечание
    if ((o.note || "").toLowerCase().includes(q)) return true;
    // Организация
    if ((o.company || "").toLowerCase().includes(q)) return true;
    // Исполнитель
    if (((o.executor || o.data?.executor) || "").toLowerCase().includes(q)) return true;
    // ID заказа
    if ((o.id || "").toLowerCase().includes(q)) return true;
  }

  return false;
}

function OrderCard({ order, onUpdate, onDelete, onRepeat }) {
  const [open, setOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState({});
  const [copiedOrder, setCopiedOrder] = useState(false);
  const [showReminderPicker, setShowReminderPicker] = useState(false);
  const st = getOrderStatus(order.status);
  const svc = SERVICES.find(s => s.id === order.service);

  // Генерируем текст заказа из полей если message пустой
  const getOrderText = () => {
    if (order.message) return order.message;
    const lines = [];
    if (order.summary) lines.push(order.summary);
    if (order.address) { lines.push(""); lines.push(order.address); }
    if (order.date) {
      lines.push("");
      const d = new Date(order.date);
      const days = ["вс","пн","вт","ср","чт","пт","сб"];
      lines.push(`📅 Дата: ${days[d.getDay()]} ${String(d.getDate()).padStart(2,"0")}.${String(d.getMonth()+1).padStart(2,"0")}.${d.getFullYear()}`);
    }
    if (order.phone || order.clientName) {
      lines.push("");
      if (order.phone) lines.push(order.phone);
      if (order.clientName) lines.push(order.clientName);
    }
    if (order.amount) { lines.push(""); lines.push(`Б/н: ${order.amount} тонн`); }
    return lines.join("\n");
  };

  const handleCopyOrder = () => {
    const text = getOrderText();
    copyToClipboard(text);
    setCopiedOrder(true);
    setTimeout(() => setCopiedOrder(false), 2000);
  };

  const startEdit = () => { setDraft({ ...order }); setEditMode(true); };
  const cancelEdit = () => { setEditMode(false); setDraft({}); };
  const saveEdit = () => {
    const merged = { ...order, ...draft, summary: (draft.summary || draft.message?.split("\n")[0] || order.summary) };
    if (draft.executor !== undefined) merged.data = { ...(order.data || {}), executor: draft.executor };
    onUpdate(merged, order);
    setEditMode(false); setDraft({});
  };
  const setD = (k, v) => setDraft(p => ({ ...p, [k]: v }));

  // Заголовок карточки: если есть организация — она основная; иначе адрес (жирным), ниже имя+телефон
  const _company = (order.data?.company || order.company || "").trim();
  const _titleText = _company || order.address || order.summary || "Заказ";
  const _whoParts = [];
  if (_company && order.address) _whoParts.push(order.address);
  if (order.clientName) _whoParts.push(order.clientName);
  if (order.phone)      _whoParts.push(order.phone);

  const fieldStyle = {
    width: "100%", background: "var(--card)",boxShadow:"var(--elev)", border: "1px solid var(--w10)",
    borderRadius: 7, color: "var(--w85)", fontSize: 12,
    padding: "6px 10px", outline: "none", fontFamily: "inherit",
    boxSizing: "border-box",
  };

  return (
    <div style={{
      background:"var(--card)",boxShadow:"var(--elev)", border:`1px solid ${editMode ? "rgba(126,154,214,0.6)" : "var(--w08)"}`,
      borderRadius:11, marginBottom:6, overflow:"hidden",
      transition: "border-color 0.15s",
    }}>
      <div onClick={()=>{ if (!editMode) setOpen(!open); }} style={{
        display:"flex", alignItems:"center", gap:10,
        padding:"9px 12px", cursor: editMode ? "default" : "pointer", userSelect:"none",
      }}>
        <div style={{width:7,height:7,borderRadius:"50%",background:st.color,flexShrink:0,}}/>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:12,color:"var(--w85)",fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
            {_titleText}
          </div>
          {_whoParts.length > 0 && (
            <div style={{fontSize:11,color:"var(--w60)",marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
              {_whoParts.join("  ·  ")}
            </div>
          )}
          <div style={{fontSize:10,color:"var(--w45)",marginTop:2}}>
            {order.date ? new Date(order.date).toLocaleDateString("ru-RU") : "—"}
            {order.amount ? ` · ${order.amount} т` : ""}
            {(order.executor || order.data?.executor) ? ` · 🚛 ${order.executor || order.data?.executor}` : ""}
            {order.nextDate ? <span style={{color:"#D2A86A",marginLeft:4}}>↻ {new Date(order.nextDate).toLocaleDateString("ru-RU")}</span> : ""}
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:5,flexShrink:0}}>
          {order.isRepeat && (
            <div style={{fontSize:9,fontWeight:700,padding:"2px 6px",borderRadius:5,background:"rgba(169,143,208,0.15)",color:"#A98FD0",border:"1px solid rgba(169,143,208,0.25)"}}>
              ↻
            </div>
          )}
          <div style={{fontSize:10,padding:"2px 7px",borderRadius:5,background:st.color+"22",color:st.color,fontWeight:700,whiteSpace:"nowrap"}}>
            {st.label}
          </div>
        </div>
      </div>
      {open && !editMode && (
        <div style={{borderTop:"1px solid var(--w07)",padding:"10px 12px"}}>
          <div style={{fontSize:10,fontWeight:700,color:"var(--w45)",letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:6}}>Стадия</div>
          <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:10}}>
            {ORDER_STATUSES.map(s=>{
              const active = order.status === s.id;
              return (
                <button key={s.id} onClick={()=>onUpdate({...order,status:s.id}, order)} style={{
                  padding:"4px 10px", borderRadius:6,
                  border:`1.5px solid ${active?s.color+"88":"var(--w10)"}`,
                  background: active ? s.color+"22" : "transparent",
                  color: active ? s.color : "var(--w45)",
                  fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
                }}>{s.label}</button>
              );
            })}
          </div>
          {order.message && (
            <pre style={{
              background:"var(--card)",boxShadow:"var(--elev)", border:"1px solid var(--w07)", borderRadius:9,
              padding:"8px 10px", fontSize:11, color:"var(--w45)",
              fontFamily:"'Outfit',-apple-system,sans-serif", whiteSpace:"pre-wrap", margin:0, maxHeight:160, overflowY:"auto",
            }}>{order.message}</pre>
          )}
          {order.nextDate && (
            <div style={{
              marginTop:8, display:"inline-flex", alignItems:"center", gap:6,
              background:"rgba(210,168,106,0.1)", border:"1px solid rgba(210,168,106,0.35)",
              borderRadius:8, padding:"5px 12px",
            }}>
              <span style={{fontSize:11}}>↻</span>
              <span style={{fontSize:11, fontWeight:700, color:"#D2A86A"}}>Следующий заказ:</span>
              <span style={{fontSize:11, color:"var(--w70)"}}>
                {new Date(order.nextDate).toLocaleDateString("ru-RU",{weekday:"long",day:"numeric",month:"long"})}
              </span>
            </div>
          )}
          <div style={{display:"flex",gap:7,marginTop:10,alignItems:"center",flexWrap:"wrap"}}>
            <button onClick={handleCopyOrder} style={{
              background: copiedOrder ? "rgba(121,179,145,0.12)" : "rgba(126,154,214,0.12)",
              border: `1.5px solid ${copiedOrder ? "#79B39188" : "rgba(126,154,214,0.6)"}`,
              color: copiedOrder ? "#79B391" : "#7E9AD6",
              borderRadius:9, padding:"5px 12px", fontSize:11, fontWeight:700,
              cursor:"pointer", fontFamily:"inherit", transition:"all 0.2s",
              minWidth:110,
            }}>{copiedOrder ? "✓ Скопировано" : "Копировать"}</button>
            <button onClick={startEdit} style={{
              background:"var(--card-2)", border:"1.5px solid #4E7A52", color:"#79B391",
              borderRadius:9, padding:"5px 12px", fontSize:11, fontWeight:700,
              cursor:"pointer", fontFamily:"inherit",
            }}>✏️ Изменить</button>
            {onRepeat && (
              <button onClick={()=>onRepeat(order)} style={{
                background:"var(--card-2)", border:"1.5px solid #7E73B0", color:"#C3B0DD",
                borderRadius:9, padding:"5px 12px", fontSize:11, fontWeight:700,
                cursor:"pointer", fontFamily:"inherit",
              }}>🔄 Повторить</button>
            )}
            <div style={{fontSize:9,color:"var(--w18)"}}>{order.id}</div>
            <button
              onClick={()=>{
                if (confirmDel) { onDelete(order.id); }
                else { setConfirmDel(true); setTimeout(()=>setConfirmDel(false), 3000); }
              }}
              style={{
                marginLeft:"auto",
                background: confirmDel ? "#CD858522" : "transparent",
                border: `1px solid ${confirmDel ? "#CD858588" : "#2a1a1a"}`,
                color: confirmDel ? "#CD8585" : "#4a2a2a",
                borderRadius:6, padding:"4px 10px",
                fontSize:11, fontWeight: confirmDel ? 800 : 500,
                cursor:"pointer", fontFamily:"inherit",
                transition: "all 0.15s",
              }}
            >{confirmDel ? "Удалить?" : "✕"}</button>
          </div>

          {/* ── Напоминание ── */}
          <div style={{marginTop:10, paddingTop:9, borderTop:"1px solid var(--w05)"}}>
            {order.reminderDate ? (
              <div style={{
                display:"flex", alignItems:"center", gap:8,
                padding:"6px 10px",
                background:"rgba(169,143,208,0.1)", border:"1px solid rgba(169,143,208,0.25)",
                borderRadius:8,
              }}>
                <div style={{width:5,height:5,borderRadius:"50%",background:"#A98FD0",flexShrink:0}}/>
                <span style={{fontSize:11,color:"var(--w40)"}}>Напоминание:</span>
                <span style={{fontSize:11,fontWeight:700,color:"#A98FD0",flex:1}}>
                  {new Date(order.reminderDate+"T00:00:00").toLocaleDateString("ru-RU",{day:"numeric",month:"long"})}
                </span>
                <button onClick={()=>onUpdate({...order,reminderDate:""},order)} style={{
                  background:"transparent",border:"none",color:"var(--w30)",
                  fontSize:14,cursor:"pointer",fontFamily:"inherit",lineHeight:1,padding:"0 2px",
                }}>✕</button>
              </div>
            ) : showReminderPicker ? (
              <div style={{display:"flex",gap:6,alignItems:"center"}}>
                <input
                  type="date"
                  autoFocus
                  onChange={e=>{
                    if (e.target.value) {
                      onUpdate({...order,reminderDate:e.target.value}, order);
                      setShowReminderPicker(false);
                    }
                  }}
                  style={{
                    flex:1,background:"var(--card-2)",
                    border:"1.5px solid rgba(169,143,208,0.5)",
                    borderRadius:8,color:"var(--w85)",fontSize:12,
                    padding:"6px 10px",outline:"none",fontFamily:"inherit",
                    WebkitAppearance:"none",appearance:"none",
                  }}
                />
                <button onClick={()=>setShowReminderPicker(false)} style={{
                  background:"transparent",border:"none",color:"var(--w30)",
                  fontSize:14,cursor:"pointer",fontFamily:"inherit",
                }}>✕</button>
              </div>
            ) : (
              <button onClick={()=>setShowReminderPicker(true)} style={{
                background:"transparent",border:"none",padding:0,
                color:"rgba(169,143,208,0.65)",fontSize:11,fontWeight:600,
                cursor:"pointer",fontFamily:"inherit",
                display:"flex",alignItems:"center",gap:5,
              }}>
                <span style={{fontSize:15,lineHeight:1,marginTop:-1}}>+</span>
                Добавить напоминание
              </button>
            )}
          </div>
        </div>
      )}
      {editMode && (
        <div style={{borderTop:"1px solid var(--w25)",padding:"12px"}}>
          <div style={{fontSize:10,fontWeight:700,color:"#7E9AD6",letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:10}}>
            Редактирование заказа
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
            <div>
              <div style={{fontSize:10,color:"var(--w45)",fontWeight:700,marginBottom:4}}>Клиент</div>
              <input value={draft.clientName||""} onChange={e=>setD("clientName",e.target.value)} placeholder="Имя" style={fieldStyle}/>
            </div>
            <div>
              <div style={{fontSize:10,color:"var(--w45)",fontWeight:700,marginBottom:4}}>Телефон</div>
              <input value={draft.phone||""} onChange={e=>setD("phone",e.target.value)} placeholder="+7..." style={fieldStyle}/>
            </div>
          </div>
          <div style={{marginBottom:8}}>
            <div style={{fontSize:10,color:"var(--w45)",fontWeight:700,marginBottom:4}}>Адрес</div>
            <input value={draft.address||""} onChange={e=>setD("address",e.target.value)} placeholder="Адрес" style={{...fieldStyle}}/>
          </div>
          {order.service === "trash" && (
            <div style={{marginBottom:8}}>
              <div style={{fontSize:10,color:"var(--w45)",fontWeight:700,marginBottom:4}}>Исполнитель</div>
              <select
                value={draft.executor ?? order.executor ?? order.data?.executor ?? ""}
                onChange={e=>setD("executor",e.target.value)}
                style={{...fieldStyle, cursor:"pointer"}}
              >
                <option value="">— не назначен —</option>
                {EXECUTORS.map(x => <option key={x} value={x}>{x}</option>)}
              </select>
            </div>
          )}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:8}}>
            <div>
              <div style={{fontSize:10,color:"var(--w45)",fontWeight:700,marginBottom:4}}>Дата</div>
              <div style={{display:"flex",gap:5}}>
                <input type="date" value={draft.date||""} onChange={e=>setD("date",e.target.value)} style={{...fieldStyle,WebkitAppearance:"none",flex:1}}/>
                {(draft.date||order.date) && (
                  <button onClick={()=>setD("date","")} style={{
                    flexShrink:0,width:30,background:"transparent",
                    border:"1px solid var(--w10)",borderRadius:7,
                    color:"var(--w40)",fontSize:13,cursor:"pointer",
                    display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit",
                  }}>✕</button>
                )}
              </div>
            </div>
            <div>
              <div style={{fontSize:10,color:"var(--w45)",fontWeight:700,marginBottom:4}}>Сумма (т)</div>
              <input type="number" step="0.1" value={draft.amount||""} onChange={e=>setD("amount",e.target.value)} placeholder="0.0" style={fieldStyle}/>
            </div>
            <div>
              <div style={{fontSize:10,color:"var(--w45)",fontWeight:700,marginBottom:4}}>Маржа (т)</div>
              <input type="number" step="0.1" value={draft.margin||""} onChange={e=>setD("margin",e.target.value)} placeholder="0.0" style={fieldStyle}/>
            </div>
          </div>
          <div style={{marginBottom:10}}>
            <div style={{fontSize:10,color:"var(--w45)",fontWeight:700,marginBottom:4}}>Стадия</div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
              {ORDER_STATUSES.map(s=>{
                const active = (draft.status||order.status) === s.id;
                return (
                  <button key={s.id} onClick={()=>setD("status",s.id)} style={{
                    padding:"4px 10px", borderRadius:6,
                    border:`1.5px solid ${active?s.color+"88":"var(--w10)"}`,
                    background: active ? s.color+"22" : "transparent",
                    color: active ? s.color : "var(--w45)",
                    fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
                  }}>{s.label}</button>
                );
              })}
            </div>
          </div>
          <div style={{marginBottom:10}}>
            <div style={{fontSize:10,color:"var(--w45)",fontWeight:700,marginBottom:4}}>Следующий заказ</div>
            <div style={{display:"flex",gap:5}}>
              <input key={(draft.nextDate||order.nextDate)?"nd1":"nd0"} type="date" value={draft.nextDate||""} onChange={e=>setD("nextDate",e.target.value)}
                style={{...fieldStyle, WebkitAppearance:"none", appearance:"none", flex:1}}/>
              {(draft.nextDate||order.nextDate) && (
                <button onClick={()=>setD("nextDate","")} style={{
                  flexShrink:0,padding:"0 12px",background:"rgba(205,133,133,0.12)",
                  border:"1px solid rgba(205,133,133,0.3)",borderRadius:7,
                  color:"#CD8585",fontSize:12,fontWeight:700,cursor:"pointer",
                  display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit",whiteSpace:"nowrap",
                }}>Сброс</button>
              )}
            </div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={saveEdit} style={{
              background:"rgba(121,179,145,0.12)", border:"1.5px solid #79B39188",
              color:"#79B391", borderRadius:10, padding:"7px 18px",
              fontSize:12, fontWeight:800, cursor:"pointer", fontFamily:"inherit",
            }}>✓ Сохранить</button>
            <button onClick={cancelEdit} style={{
              background:"transparent", border:"1px solid var(--w10)",
              color:"var(--w45)", borderRadius:10, padding:"7px 14px",
              fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit",
            }}>Отмена</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ClientCard({ client, orders, onUpdateOrder, onDeleteOrder, onRepeat }) {
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState("orders"); // "orders" | "stats"

  const totalAmount  = orders.reduce((s,o) => s+(parseFloat(o.amount)||0), 0);
  const totalMargin  = orders.reduce((s,o) => s+(parseFloat(o.margin)||0), 0);
  const activeCount  = orders.filter(o => o.status!=="done" && o.status!=="cancelled").length;
  const doneCount    = orders.filter(o => o.status==="done").length;
  const cancelCount  = orders.filter(o => o.status==="cancelled").length;

  const initials = (client.name||"?").trim().split(/\s+/).map(w=>w[0]).slice(0,2).join("").toUpperCase();

  const dates = orders.map(o=>getOrderDate(o).toISOString()).sort();
  const firstDate = dates[0] ? new Date(dates[0]) : null;
  const lastDate  = dates[dates.length-1] ? new Date(dates[dates.length-1]) : null;

  const fmt = n => n % 1 === 0 ? n.toString() : n.toFixed(1);

  // Orders by service
  const bySvc = {};
  orders.forEach(o => {
    const svc = SERVICES.find(s => s.id === o.service);
    if (!svc || svc.add) return;
    if (!bySvc[o.service]) bySvc[o.service] = { label: svc.label, color: svc.color, count: 0, amount: 0, margin: 0 };
    bySvc[o.service].count++;
    bySvc[o.service].amount += parseFloat(o.amount)||0;
    bySvc[o.service].margin += parseFloat(o.margin)||0;
  });

  // Last 8 orders for mini chart
  const recentAmounts = orders
    .filter(o => o.amount)
    .sort((a,b) => getOrderDate(b).getTime() - getOrderDate(a).getTime())
    .slice(-8)
    .map(o => parseFloat(o.amount)||0);

  // Period string
  const periodStr = firstDate && lastDate
    ? (firstDate.getTime() === lastDate.getTime()
      ? firstDate.toLocaleDateString("ru-RU")
      : `${firstDate.toLocaleDateString("ru-RU",{day:"2-digit",month:"2-digit"})} — ${lastDate.toLocaleDateString("ru-RU",{day:"2-digit",month:"2-digit",year:"2-digit"})}`)
    : "—";

  return (
    <div style={{
      background:"var(--card)",boxShadow:"var(--elev)", border:"1px solid var(--w08)",
      borderRadius:14, marginBottom:10, overflow:"hidden",
      transition:"border-color 0.15s",
    }}>
      {/* Header row */}
      <div onClick={()=>setExpanded(!expanded)} style={{
        display:"flex", alignItems:"center", gap:12,
        padding:"14px 16px", cursor:"pointer", userSelect:"none",
      }}>
        <div style={{
          width:40, height:40, borderRadius:"50%",
          background:"var(--card-2)", border:"1px solid var(--w12)",
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:14, fontWeight:800, color:"var(--text)", flexShrink:0,
        }}>{initials}</div>

        <div style={{flex:1, minWidth:0}}>
          <div style={{fontSize:14,fontWeight:700,color:"var(--text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
            {client.name || "Без имени"}
          </div>
          <div style={{fontSize:11,color:"var(--w40)",marginTop:2,display:"flex",gap:8,alignItems:"center"}}>
            {client.phone && <span>{client.phone}</span>}
            {client.phone && client.address && <span style={{color:"var(--w20)"}}>·</span>}
            {client.address && <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:160}}>{client.address}</span>}
          </div>
        </div>

        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4,flexShrink:0}}>
          <div style={{fontSize:13,fontWeight:800,color:"var(--text)"}}>{orders.length} зак.</div>
          <div style={{fontSize:10,color:"var(--w35)"}}>{periodStr}</div>
        </div>
      </div>

      {/* Quick stats strip */}
      {orders.length > 0 && (
        <div style={{
          display:"flex", borderTop:"1px solid var(--w06)",
          padding:"8px 16px", gap:16, background:"rgba(0,0,0,0.2)",
        }}>
          {[
            { label:"Активных", value: activeCount, color:"#7E9AD6" },
            { label:"Выполнено", value: doneCount, color:"#79B391" },
            { label:"Сумма", value: `${fmt(totalAmount)} т`, color:"var(--text)" },
            { label:"Маржа", value: `${fmt(totalMargin)} т`, color:"#D2A86A" },
          ].map(s => (
            <div key={s.label} style={{display:"flex",flexDirection:"column",gap:1}}>
              <div style={{fontSize:9,color:"var(--w35)",letterSpacing:"0.06em",textTransform:"uppercase",fontWeight:600}}>{s.label}</div>
              <div style={{fontSize:13,fontWeight:700,color:s.color}}>{s.value}</div>
            </div>
          ))}
          {recentAmounts.length >= 3 && (
            <div style={{marginLeft:"auto"}}>
              <Sparkline values={recentAmounts} color="#7E9AD6" w={60} h={22}/>
            </div>
          )}
        </div>
      )}

      {/* Expanded content */}
      {expanded && (
        <div style={{borderTop:"1px solid var(--w07)"}}>
          {/* Tab switcher */}
          <div style={{display:"flex",borderBottom:"1px solid var(--w07)"}}>
            {[["orders","Заказы"],["stats","Статистика"]].map(([id,lbl]) => (
              <button key={id} onClick={e=>{e.stopPropagation();setTab(id);}} style={{
                flex:1, padding:"10px", background:"transparent", border:"none",
                borderBottom:`2px solid ${tab===id?"#7E9AD6":"transparent"}`,
                color: tab===id ? "#7E9AD6" : "var(--w40)",
                fontSize:12, fontWeight: tab===id ? 700 : 500,
                cursor:"pointer", fontFamily:"inherit",
              }}>{lbl}</button>
            ))}
          </div>

          {tab === "orders" && (
            <div style={{padding:"8px 12px", background:"var(--bg)"}}>
              {orders.length === 0 ? (
                <div style={{textAlign:"center",padding:"20px 0",color:"var(--w30)",fontSize:12}}>Нет заказов</div>
              ) : (
                orders.sort((a,b)=>getOrderDate(b).getTime()-getOrderDate(a).getTime()).map(o => (
                  <OrderCard key={o.id} order={o} onUpdate={onUpdateOrder} onDelete={onDeleteOrder} onRepeat={onRepeat}/>
                ))
              )}
            </div>
          )}

          {tab === "stats" && (
            <div style={{padding:"14px 16px", background:"var(--bg)"}}>
              {/* Period */}
              <div style={{marginBottom:16}}>
                <div style={{fontSize:10,fontWeight:700,color:"var(--w40)",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:6}}>Период сотрудничества</div>
                <div style={{fontSize:13,color:"var(--text)",fontWeight:600}}>{periodStr}</div>
                {firstDate && lastDate && firstDate.getTime() !== lastDate.getTime() && (
                  <div style={{fontSize:11,color:"var(--w40)",marginTop:3}}>
                    {Math.ceil((lastDate - firstDate) / 86400000)} дней
                  </div>
                )}
              </div>

              {/* Status breakdown */}
              <div style={{marginBottom:16}}>
                <div style={{fontSize:10,fontWeight:700,color:"var(--w40)",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:8}}>Статусы</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {ORDER_STATUSES.map(s => {
                    const cnt = orders.filter(o=>o.status===s.id).length;
                    if (cnt === 0) return null;
                    return (
                      <div key={s.id} style={{
                        background:s.color+"18", border:`1px solid ${s.color}33`,
                        borderRadius:8, padding:"4px 10px",
                        display:"flex", gap:6, alignItems:"center",
                      }}>
                        <div style={{width:6,height:6,borderRadius:"50%",background:s.color}}/>
                        <span style={{fontSize:11,color:s.color,fontWeight:700}}>{s.label}</span>
                        <span style={{fontSize:11,color:"var(--w40)",fontWeight:600}}>{cnt}</span>
                      </div>
                    );
                  })}
                </div>
                {/* Status bar */}
                <div style={{display:"flex",height:4,borderRadius:4,overflow:"hidden",marginTop:8,gap:1}}>
                  {ORDER_STATUSES.map(s => {
                    const cnt = orders.filter(o=>o.status===s.id).length;
                    if (cnt === 0) return null;
                    return (
                      <div key={s.id} style={{
                        flex:cnt, background:s.color, minWidth:3,
                        transition:"flex 0.3s ease",
                      }}/>
                    );
                  })}
                </div>
              </div>

              {/* By service */}
              {Object.keys(bySvc).length > 0 && (
                <div style={{marginBottom:16}}>
                  <div style={{fontSize:10,fontWeight:700,color:"var(--w40)",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:8}}>По услугам</div>
                  {Object.entries(bySvc).map(([id, s]) => (
                    <div key={id} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                      <div style={{width:8,height:8,borderRadius:"50%",background:s.color,flexShrink:0}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                          <span style={{fontSize:12,color:"var(--w85)",fontWeight:600}}>{s.label}</span>
                          <span style={{fontSize:12,color:s.color,fontWeight:700}}>{s.count} зак.</span>
                        </div>
                        <div style={{background:"var(--w06)",borderRadius:3,height:3}}>
                          <div style={{
                            height:"100%",background:s.color,borderRadius:3,
                            width:`${Math.round((s.count/orders.length)*100)}%`,
                          }}/>
                        </div>
                        <div style={{fontSize:10,color:"var(--w40)",marginTop:3}}>
                          {fmt(s.amount)} т · маржа {fmt(s.margin)} т
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Total summary */}
              <div style={{background:"var(--card-2)",border:"1px solid var(--w07)",borderRadius:10,padding:"12px 14px"}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                  {[
                    ["Всего заказов",orders.length,""],
                    ["Выполнено",`${doneCount} (${orders.length>0?Math.round((doneCount/orders.length)*100):0}%)`,orders.length>0&&doneCount/orders.length>0.7?"#79B391":"var(--w70)"],
                    ["Общая сумма",`${fmt(totalAmount)} т`,"#79B391"],
                    ["Общая маржа",`${fmt(totalMargin)} т`,"#D2A86A"],
                  ].map(([lbl,val,clr]) => (
                    <div key={lbl}>
                      <div style={{fontSize:9,fontWeight:700,color:"var(--w38)",letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:3}}>{lbl}</div>
                      <div style={{fontSize:16,fontWeight:800,color:clr||"var(--text)"}}>{val}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════
// SERVICE STATS VIEW — заказы по услугам за период
// ═══════════════════════════════════════════════════════════
function ServiceStatsView({ orders: allOrders, onOpenOrder }) {
  const allServices = SERVICES.filter(s => !s.add);
  const [period, setPeriod] = useState(() => localStorage.getItem("svcstats_period") || "week"); // day | week | month | custom
  const [execFilter, setExecFilter] = useState(() => localStorage.getItem("svcstats_exec") || "all");
  const executors = getExecutors(allOrders);
  const orders = execFilter === "all" ? allOrders : allOrders.filter(o => orderExecutor(o) === execFilter);
  const [customFrom, setCustomFrom] = useState(() => localStorage.getItem("svcstats_from") || "");
  const [customTo,   setCustomTo]   = useState(() => localStorage.getItem("svcstats_to") || "");
  // Запоминаем выбор между переходами по разделам
  useEffect(() => { localStorage.setItem("svcstats_period", period); }, [period]);
  useEffect(() => { localStorage.setItem("svcstats_exec", execFilter); }, [execFilter]);
  useEffect(() => { localStorage.setItem("svcstats_from", customFrom); }, [customFrom]);
  useEffect(() => { localStorage.setItem("svcstats_to", customTo); }, [customTo]);

  const today = new Date();
  today.setHours(23,59,59,999);

  const getRangeStart = () => {
    const d = new Date();
    d.setHours(0,0,0,0);
    if (period === "day")   return d;
    if (period === "week")  { d.setDate(d.getDate() - d.getDay() + (d.getDay()===0?-6:1)); return d; }
    if (period === "month") { d.setDate(1); return d; }
    if (period === "custom" && customFrom) return new Date(customFrom + "T00:00:00");
    return new Date(0);
  };
  const getRangeEnd = () => {
    if (period === "custom" && customTo) return new Date(customTo + "T23:59:59");
    return today;
  };

  const start = getRangeStart();
  const end   = getRangeEnd();

  const inRange = o => {
    const d = getOrderDate(o);
    return d >= start && d <= end;
  };

  const rangeOrders = orders.filter(inRange);
  const fmt = n => n%1===0 ? String(n) : n.toFixed(1);

  // Totals
  const totalCount  = rangeOrders.length;
  const totalAmount = rangeOrders.reduce((s,o)=>s+(parseFloat(o.amount)||0),0);
  const totalMargin = rangeOrders.reduce((s,o)=>s+(parseFloat(o.margin)||0),0);
  const totalDone   = rangeOrders.filter(o=>o.status==="done").length;

  const PERIOD_LABELS = { day:"Сегодня", week:"Эта неделя", month:"Этот месяц", custom:"Период" };

  const SVC_RU_MONTHS = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];
  const fmtD = d => `${d.getDate()} ${SVC_RU_MONTHS[d.getMonth()]}`;
  const periodLabel = period === "custom" && customFrom
    ? `${fmtD(start)}${customTo ? " — " + fmtD(end) : ""}`
    : PERIOD_LABELS[period];

  return (
    <div style={{ flex:1, overflowY:"auto", WebkitOverflowScrolling:"touch", minHeight:0,
      padding:"16px 18px", paddingBottom:"calc(120px + env(safe-area-inset-bottom))" }}>

      {/* Header */}
      <div style={{ marginBottom:16 }}>
        <div style={{ fontSize:20, fontWeight:800, color:"var(--text)", letterSpacing:"-0.02em" }}>По услугам</div>
        <div style={{ fontSize:12, color:"var(--w35)", marginTop:2 }}>{periodLabel}</div>
      </div>

      {/* Period selector */}
      <div style={{ display:"flex", gap:6, marginBottom:14, flexWrap:"wrap" }}>
        {[["day","День"],["week","Неделя"],["month","Месяц"],["custom","Период"]].map(([id,label])=>(
          <button key={id} onClick={()=>setPeriod(id)} style={{
            padding:"5px 13px", borderRadius:20, flexShrink:0,
            border:`1.5px solid ${period===id?"#7E9AD6":"var(--w10)"}`,
            background: period===id?"rgba(126,154,214,0.14)":"transparent",
            color: period===id?"#7E9AD6":"var(--w45)",
            fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
          }}>{label}</button>
        ))}
      </div>

      {/* Фильтр по исполнителю */}
      <ExecutorFilter value={execFilter} onChange={setExecFilter} executors={executors} />

      {/* Custom date range */}
      {period === "custom" && (
        <div style={{ display:"flex", gap:8, marginBottom:14, alignItems:"center" }}>
          <input type="date" value={customFrom} onChange={e=>setCustomFrom(e.target.value)}
            style={{ flex:1, background:"var(--card-2)", border:"1px solid var(--w12)",
              borderRadius:9, color:"var(--w80)", fontSize:12, padding:"7px 10px",
              outline:"none", fontFamily:"inherit", WebkitAppearance:"none" }}/>
          <span style={{ color:"var(--w30)", fontSize:12 }}>—</span>
          <input type="date" value={customTo} onChange={e=>setCustomTo(e.target.value)}
            style={{ flex:1, background:"var(--card-2)", border:"1px solid var(--w12)",
              borderRadius:9, color:"var(--w80)", fontSize:12, padding:"7px 10px",
              outline:"none", fontFamily:"inherit", WebkitAppearance:"none" }}/>
        </div>
      )}

      {/* Total summary row */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:20 }}>
        {[
          { label:"Всего заказов", value:totalCount, unit:"",  color:"#7E9AD6" },
          { label:"Выручка",       value:fmt(totalAmount), unit:"т", color:"#79B391" },
          { label:"Маржа",         value:fmt(totalMargin), unit:"т", color:"#D2A86A" },
        ].map(c=>(
          <div key={c.label} style={{ background:"var(--card)",boxShadow:"var(--elev)", border:"1px solid var(--w06)",
            borderRadius:12, padding:"10px 12px" }}>
            <div style={{ fontSize:9, fontWeight:700, color:"var(--w35)",
              letterSpacing:"0.07em", textTransform:"uppercase", marginBottom:4 }}>{c.label}</div>
            <div style={{ fontSize:18, fontWeight:800, color:c.color }}>
              {c.value}<span style={{ fontSize:11, fontWeight:500, color:"var(--w40)" }}>{c.unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Per-service breakdown */}
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {allServices.map(svc => {
          const svcOrders = rangeOrders.filter(o => o.service === svc.id);
          const count   = svcOrders.length;
          const amount  = svcOrders.reduce((s,o)=>s+(parseFloat(o.amount)||0),0);
          const margin  = svcOrders.reduce((s,o)=>s+(parseFloat(o.margin)||0),0);
          const done    = svcOrders.filter(o=>o.status==="done").length;
          const active  = svcOrders.filter(o=>o.status!=="done"&&o.status!=="cancelled").length;
          const pct     = totalCount > 0 ? Math.round(count/totalCount*100) : 0;

          return (
            <div key={svc.id} style={{ background:"var(--card)",boxShadow:"var(--elev)",
              border:`1px solid ${count>0?svc.color+"30":"var(--w05)"}`,
              borderLeft:`3px solid ${count>0?svc.color:"var(--w07)"}`,
              borderRadius:12, padding:"13px 14px",
              opacity: count===0 ? 0.45 : 1 }}>

              {/* Service header */}
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom: count>0?10:0 }}>
                <span style={{ fontSize:13, fontWeight:800, color: count>0?svc.color:"var(--w40)", flex:1 }}>
                  {svc.label}
                </span>
                <span style={{ fontSize:20, fontWeight:800, color: count>0?"var(--text)":"var(--w20)" }}>
                  {count}
                </span>
                <span style={{ fontSize:11, color:"var(--w30)" }}>
                  {count>0?`${pct}%`:""}
                </span>
              </div>

              {/* Progress bar */}
              {count > 0 && (
                <div style={{ height:3, background:"var(--w07)", borderRadius:2, marginBottom:10, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${pct}%`, background:svc.color, borderRadius:2, transition:"width 0.3s" }}/>
                </div>
              )}

              {/* Stats row */}
              {count > 0 && (
                <div style={{ display:"flex", gap:16, flexWrap:"wrap" }}>
                  {amount>0 && (
                    <div>
                      <div style={{ fontSize:9, fontWeight:700, color:"var(--w30)", letterSpacing:"0.06em", textTransform:"uppercase" }}>Выручка</div>
                      <div style={{ fontSize:15, fontWeight:800, color:"#79B391" }}>{fmt(amount)}<span style={{ fontSize:10, color:"var(--w30)" }}> т</span></div>
                    </div>
                  )}
                  {margin>0 && (
                    <div>
                      <div style={{ fontSize:9, fontWeight:700, color:"var(--w30)", letterSpacing:"0.06em", textTransform:"uppercase" }}>Маржа</div>
                      <div style={{ fontSize:15, fontWeight:800, color:"#D2A86A" }}>{fmt(margin)}<span style={{ fontSize:10, color:"var(--w30)" }}> т</span></div>
                    </div>
                  )}
                  <div>
                    <div style={{ fontSize:9, fontWeight:700, color:"var(--w30)", letterSpacing:"0.06em", textTransform:"uppercase" }}>Статусы</div>
                    <div style={{ display:"flex", gap:6, marginTop:2, flexWrap:"wrap" }}>
                      {active>0 && <span style={{ fontSize:11, fontWeight:700, color:"#7E9AD6" }}>{active} акт.</span>}
                      {done>0  && <span style={{ fontSize:11, fontWeight:700, color:"#79B391" }}>{done} вып.</span>}
                      {count-done-active>0 && <span style={{ fontSize:11, fontWeight:700, color:"var(--w40)" }}>{count-done-active} ост.</span>}
                    </div>
                  </div>
                </div>
              )}

              {/* Order list */}
              {count > 0 && (
                <div style={{ marginTop:10, borderTop:"1px solid var(--w05)", paddingTop:8,
                  display:"flex", flexDirection:"column", gap:4 }}>
                  {svcOrders
                    .sort((a,b)=>getOrderDate(b)-getOrderDate(a))
                    .map(o => {
                      const st = getOrderStatus(o.status);
                      const d  = getOrderDate(o);
                      return (
                        <div key={o.id} onClick={()=>onOpenOrder && onOpenOrder(o)} style={{ display:"flex", alignItems:"center", gap:8,
                          padding:"6px 2px", borderBottom:"1px solid var(--w04)", cursor:"pointer" }}>
                          <div style={{ width:6, height:6, borderRadius:"50%", background:st.color, flexShrink:0 }}/>
                          <div style={{ flex:1, minWidth:0 }}>
                            <span style={{ fontSize:12, fontWeight:600, color:"var(--w80)" }}>
                              {o.clientName || "Клиент"}
                            </span>
                            {o.address && <span style={{ fontSize:11, color:"var(--w30)", marginLeft:5 }}>· {o.address}</span>}
                          </div>
                          <div style={{ textAlign:"right", flexShrink:0 }}>
                            {o.amount && <div style={{ fontSize:11, fontWeight:700, color:"var(--w60)" }}>{o.amount} т</div>}
                            {o.margin && <div style={{ fontSize:11, fontWeight:700, color:"#D2A86A" }}>↑{o.margin} т</div>}
                            <div style={{ fontSize:10, color:"var(--w25)" }}>
                              {d.getDate()} {SVC_RU_MONTHS[d.getMonth()]}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OrdersView({ orders, setOrders, onRepeat, onAutoSync }) {
  const [filter, setFilter] = useState("all");
  const [filterService, setFilterService] = useState("all");
  const [search, setSearch] = useState("");

  const updateOrder = u => {
    setOrders(p => p.map(o => o.id===u.id?u:o));
    if (onAutoSync) onAutoSync(u);
  };
  const deleteOrder = id => { addTombstone(id); setOrders(p => p.filter(o => o.id !== id)); };

  // Группируем заказы по клиенту (ключ — нормализованный телефон или имя)
  const clientsMap = {};
  orders.forEach(o => {
    const key = normalizePhone(o.phone) || (o.clientName||"").toLowerCase().trim() || o.id;
    if (!clientsMap[key]) {
      clientsMap[key] = {
        key, name: o.clientName || "", phone: o.phone || "",
        address: o.address || "", orders: [],
      };
    }
    clientsMap[key].orders.push(o);
    if (o.clientName) clientsMap[key].name = o.clientName;
    if (o.address) clientsMap[key].address = o.address;
  });

  let clients = Object.values(clientsMap);

  // Фильтр по статусу
  if (filter !== "all") {
    clients = clients.filter(c => c.orders.some(o => o.status === filter));
  }
  // Фильтр по услуге
  if (filterService !== "all") {
    clients = clients.filter(c => c.orders.some(o => o.service === filterService));
    // Показываем только заказы нужной услуги внутри карточки
    clients = clients.map(c => ({
      ...c,
      orders: c.orders.filter(o => o.service === filterService),
    }));
  }
  // Поиск — по имени, телефону (любой формат), адресу, услуге, заметке
  if (search) {
    clients = clients.filter(c => clientMatchesSearch(c, search));
  }

  // Сортировка — клиенты с активными заказами наверху
  clients.sort((a,b) => {
    const aActive = a.orders.some(o => o.status!=="done"&&o.status!=="cancelled")?1:0;
    const bActive = b.orders.some(o => o.status!=="done"&&o.status!=="cancelled")?1:0;
    if (aActive !== bActive) return bActive - aActive;
    const aDate = a.orders.map(o=>o.createdAt).sort().pop()||"";
    const bDate = b.orders.map(o=>o.createdAt).sort().pop()||"";
    return bDate.localeCompare(aDate);
  });

  const counts = ORDER_STATUSES.reduce((acc,s)=>{
    acc[s.id] = orders.filter(o => o.status === s.id).length;
    return acc;
  }, {});

  const svcCounts = SERVICES.reduce((acc,s)=>{
    if (!s.add) acc[s.id] = orders.filter(o => o.service === s.id).length;
    return acc;
  }, {});

  return (
    <div style={{flex:1,overflowY:"auto",WebkitOverflowScrolling:"touch",padding:"16px 20px 80px",paddingBottom:"calc(120px + env(safe-area-inset-bottom))"}}>
      {/* Header */}
      <div style={{marginBottom:14}}>
        <div style={{fontSize:20,fontWeight:800,color:"var(--text)",letterSpacing:"-0.02em"}}>Заказы клиентов</div>
        <div style={{fontSize:12,color:"var(--w35)",marginTop:2}}>
          {clients.length} клиент{clients.length===1?"":clients.length<5&&clients.length>1?"а":"ов"} · {orders.length} заказ{orders.length===1?"":orders.length<5&&orders.length>1?"а":"ов"} всего
        </div>
      </div>

      {/* Фильтр по статусу */}
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8,alignItems:"center"}}>
        <span style={{fontSize:10,fontWeight:700,color:"var(--w22)",letterSpacing:"0.07em",textTransform:"uppercase",marginRight:2}}>Статус</span>
        <button onClick={()=>setFilter("all")} style={{
          padding:"4px 11px", borderRadius:9,
          border:`1.5px solid ${filter==="all"?"rgba(126,154,214,0.6)":"var(--w10)"}`,
          background: filter==="all"?"rgba(126,154,214,0.12)":"transparent",
          color: filter==="all"?"#7E9AD6":"var(--w45)",
          fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
        }}>Все ({orders.length})</button>
        {ORDER_STATUSES.map(s=>counts[s.id]>0&&(
          <button key={s.id} onClick={()=>setFilter(filter===s.id?"all":s.id)} style={{
            padding:"4px 11px", borderRadius:9,
            border:`1.5px solid ${filter===s.id?s.color+"88":"var(--w10)"}`,
            background: filter===s.id?s.color+"22":"transparent",
            color: filter===s.id?s.color:"var(--w45)",
            fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
          }}>{s.label} ({counts[s.id]})</button>
        ))}
        <input
          placeholder="Имя, телефон, адрес..."
          value={search}
          onChange={e=>setSearch(e.target.value)}
          style={{
            marginLeft:"auto", background:"var(--card-2)",
            border:"1px solid var(--w08)", borderRadius:10,
            color:"var(--w85)", fontSize:12, padding:"5px 12px",
            outline:"none", fontFamily:"inherit", width:180,
          }}
        />
      </div>

      {/* Фильтр по услуге */}
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14,alignItems:"center"}}>
        <span style={{fontSize:10,fontWeight:700,color:"var(--w22)",letterSpacing:"0.07em",textTransform:"uppercase",marginRight:2}}>Услуга</span>
        <button onClick={()=>setFilterService("all")} style={{
          padding:"4px 11px", borderRadius:9,
          border:`1.5px solid ${filterService==="all"?"rgba(126,154,214,0.6)":"var(--w10)"}`,
          background: filterService==="all"?"rgba(126,154,214,0.12)":"transparent",
          color: filterService==="all"?"#7E9AD6":"var(--w45)",
          fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
        }}>Все</button>
        {SERVICES.filter(s=>!s.add).map(s=>(
          <button key={s.id} onClick={()=>setFilterService(filterService===s.id?"all":s.id)} style={{
            padding:"4px 11px", borderRadius:9,
            border:`1.5px solid ${filterService===s.id?s.color+"88":"var(--w10)"}`,
            background: filterService===s.id?s.color+"22":"transparent",
            color: filterService===s.id?s.color:"var(--w45)",
            fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
          }}>{s.label} {svcCounts[s.id]>0?`(${svcCounts[s.id]})`:""}</button>
        ))}
      </div>

      {/* Clients list */}
      {clients.length === 0 ? (
        <div style={{textAlign:"center",padding:"60px 0",color:"var(--w18)",fontSize:14}}>
          {orders.length === 0
            ? "Заказов пока нет — заполни форму и нажми «Сохранить заказ»"
            : "Ничего не найдено"}
        </div>
      ) : (
        clients.map(c => (
          <ClientCard
            key={c.key}
            client={c}
            orders={c.orders}
            onUpdateOrder={updateOrder}
            onDeleteOrder={deleteOrder}
            onRepeat={onRepeat}
          />
        ))
      )}
    </div>
  );
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────
// ─── REPORT & ANALYTICS HELPERS ─────────────────────────────────────────────

// Учётный принцип: неделя пн-вс. Если неделя началась в месяце X — она принадлежит X,
// даже если заканчивается в месяце X+1.

const RU_MONTHS_FULL = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];

// Начало недели (пн) для произвольной даты
function weekStart(d) {
  const r = new Date(d);
  const day = r.getDay(); // 0=вс,1=пн...
  const diff = day === 0 ? -6 : 1 - day; // сдвиг до пн
  r.setDate(r.getDate() + diff);
  r.setHours(0, 0, 0, 0);
  return r;
}

// Конец недели (вс 23:59:59) для начала недели
function weekEnd(monDate) {
  const r = new Date(monDate);
  r.setDate(r.getDate() + 6);
  r.setHours(23, 59, 59, 999);
  return r;
}

// Учётный месяц: все недели (пн-вс), чей ПОНЕДЕЛЬНИК попадает в calendar-месяц y/m (0-based)
function accountingMonth(year, month) {
  // Первый понедельник в этом месяце (или первый пн >= 1-го числа)
  const firstDay = new Date(year, month, 1);
  const firstMon = weekStart(firstDay);
  // Если первый пн до начала месяца — берём следующий
  const start = firstMon.getMonth() === month && firstMon.getFullYear() === year
    ? firstMon
    : new Date(firstMon.getTime() + 7 * 86400000);

  // Последний понедельник, чей пн ещё в этом месяце
  const lastDay = new Date(year, month + 1, 0); // последнее число месяца
  let cur = new Date(start);
  let lastMon = new Date(start);
  while (cur <= lastDay) {
    if (cur.getMonth() === month && cur.getFullYear() === year) lastMon = new Date(cur);
    cur = new Date(cur.getTime() + 7 * 86400000);
  }
  const end = weekEnd(lastMon);

  return { start, end };
}

// Текущий учётный месяц и предыдущий
function currentAccountingMonth() {
  const now = new Date();
  return accountingMonth(now.getFullYear(), now.getMonth());
}
function prevAccountingMonth() {
  const now = new Date();
  const m = now.getMonth() - 1;
  const y = m < 0 ? now.getFullYear() - 1 : now.getFullYear();
  return accountingMonth(y, (m + 12) % 12);
}

// Учётный год: все недели, чей пн попадает в Calendar-год
function accountingYear(year) {
  const jan1 = new Date(year, 0, 1);
  const firstMon = weekStart(jan1);
  const start = firstMon.getFullYear() === year ? firstMon : new Date(firstMon.getTime() + 7 * 86400000);
  const dec31 = new Date(year, 11, 31);
  let cur = new Date(start), lastMon = new Date(start);
  while (cur <= dec31) {
    if (cur.getFullYear() === year) lastMon = new Date(cur);
    cur = new Date(cur.getTime() + 7 * 86400000);
  }
  return { start, end: weekEnd(lastMon) };
}

// Текущая учётная неделя
function currentWeek() {
  const now = new Date();
  return { start: weekStart(now), end: weekEnd(weekStart(now)) };
}
function prevWeek() {
  const s = weekStart(new Date());
  const ps = new Date(s.getTime() - 7 * 86400000);
  return { start: ps, end: weekEnd(ps) };
}

const PERIOD_PRESETS = [
  { id: "today",  label: "Сегодня" },
  { id: "week",   label: "Неделя" },
  { id: "month",  label: "Учётный месяц" },
  { id: "year",   label: "Год" },
  { id: "custom", label: "Свой" },
];

function getPeriodRange(preset, customFrom, customTo) {
  const now = new Date();
  if (preset === "today") {
    const s = new Date(now); s.setHours(0,0,0,0);
    const e = new Date(now); e.setHours(23,59,59,999);
    return { start: s, end: e };
  }
  if (preset === "week") return currentWeek();
  if (preset === "month") return currentAccountingMonth();
  if (preset === "year")  return accountingYear(now.getFullYear());
  if (preset === "custom" && customFrom && customTo) {
    return { start: new Date(customFrom + "T00:00:00"), end: new Date(customTo + "T23:59:59") };
  }
  return { start: new Date(0), end: new Date() };
}

function getOrderDate(o) {
  // Use the scheduled order date as the canonical date.
  // Fall back to createdAt for orders that predate this change.
  if (o.date) return new Date(o.date + "T12:00:00");
  if (o.createdAt) return new Date(o.createdAt);
  return new Date();
}

function filterOrdersByPeriod(orders, range) {
  return orders.filter(o => {
    const d = getOrderDate(o);
    return d >= range.start && d <= range.end;
  });
}

function aggregateByService(orders) {
  const result = {};
  SERVICES.forEach(s => {
    if (s.add) return;
    const svcOrders = orders.filter(o => o.service === s.id);
    result[s.id] = {
      label: s.label, icon: s.icon, color: s.color,
      count: svcOrders.length,
      amount: svcOrders.reduce((sum, o) => sum + (parseFloat(o.amount) || 0), 0),
      margin: svcOrders.reduce((sum, o) => sum + (parseFloat(o.margin) || 0), 0),
    };
  });
  return result;
}

// Метка диапазона для отображения
function rangeLabel(range) {
  const fmt = d => d.toLocaleDateString("ru-RU", { day:"2-digit", month:"2-digit" });
  return `${fmt(range.start)} — ${fmt(range.end)}`;
}

// ─── REPORT VIEW ────────────────────────────────────────────────────────────

// ─── SVG MINI SPARKLINE ──────────────────────────────────────────────────────
function Sparkline({ values, color="#7E9AD6", w=80, h=28 }) {
  if (!values || values.length < 2) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg width={w} height={h} style={{display:"block",overflow:"visible"}}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ─── SVG BAR CHART ────────────────────────────────────────────────────────────
function SvgBarChart({ data, color="#7E9AD6", height=90 }) {
  if (!data || data.length === 0) return (
    <div style={{height,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <span style={{color:"var(--w18)",fontSize:11}}>Нет данных</span>
    </div>
  );
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{display:"flex",alignItems:"flex-end",gap:2,height,paddingBottom:16,position:"relative"}}>
      {data.map((d, i) => {
        const pct = Math.max(2, (d.value / max) * 100);
        return (
          <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",gap:2}}>
            <div style={{
              width:"100%",
              background: d.value > 0 ? color : "var(--w06)",
              borderRadius:"3px 3px 0 0",
              opacity: d.value > 0 ? 0.85 : 1,
              height:`${pct}%`,
              minHeight: d.value > 0 ? 3 : 2,
              transition:"height 0.3s ease",
            }}/>
            <div style={{fontSize:8,color:"var(--w25)",textAlign:"center",lineHeight:1}}>{d.label}</div>
          </div>
        );
      })}
    </div>
  );
}

// ─── REPORT VIEW ─────────────────────────────────────────────────────────────
function ReportView({ orders }) {
  const [preset, setPreset]         = useState("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo]     = useState("");
  const [activeMetric, setActiveMetric] = useState("count");

  const range    = getPeriodRange(preset, customFrom, customTo);
  const filtered = filterOrdersByPeriod(orders, range);
  const agg      = aggregateByService(filtered);
  const fmt      = n => n % 1 === 0 ? String(n) : n.toFixed(1);

  const totals = {
    count:  filtered.length,
    amount: filtered.reduce((s,o) => s + (parseFloat(o.amount)||0), 0),
    margin: filtered.reduce((s,o) => s + (parseFloat(o.margin)||0), 0),
  };

  // Prev period for delta
  const dur        = range.end - range.start;
  const prevRange  = { start: new Date(range.start - dur - 1), end: new Date(range.start - 1) };
  const prevFilt   = filterOrdersByPeriod(orders, prevRange);
  const prevTotals = {
    count:  prevFilt.length,
    amount: prevFilt.reduce((s,o) => s + (parseFloat(o.amount)||0), 0),
    margin: prevFilt.reduce((s,o) => s + (parseFloat(o.margin)||0), 0),
  };
  const delta = (a,b) => b === 0 ? (a > 0 ? "+100%" : "—") : `${a>=b?"+":""}${Math.round(((a-b)/b)*100)}%`;
  const deltaColor = (a,b) => b === 0 ? "var(--w40)" : a >= b ? "#79B391" : "#CD8585";

  // Chart data
  const buildChart = (metric) => {
    if (!filtered.length) return [];
    const days = Math.ceil((range.end - range.start) / 86400000);
    if (days <= 31) {
      const buckets = {};
      filtered.forEach(o => {
        const d  = getOrderDate(o);
        const k  = String(d.getDate());
        if (!buckets[k]) buckets[k] = 0;
        buckets[k] += metric === "count" ? 1 : (parseFloat(o[metric])||0);
      });
      const result = [];
      for (let i = 0; i < Math.min(days, 31); i++) {
        const d = new Date(range.start.getTime() + i * 86400000);
        result.push({ label: String(d.getDate()), value: buckets[String(d.getDate())] || 0 });
      }
      return result;
    }
    // Weekly
    const out = [];
    let cur = new Date(range.start);
    while (cur < range.end) {
      const wEnd = new Date(Math.min(cur.getTime() + 6*86400000, range.end.getTime()));
      const wOrd = filtered.filter(o => { const d=getOrderDate(o); return d>=cur&&d<=wEnd; });
      const val  = metric === "count" ? wOrd.length : wOrd.reduce((s,o)=>s+(parseFloat(o[metric])||0),0);
      out.push({ label: `${String(cur.getDate()).padStart(2,"0")}.${String(cur.getMonth()+1).padStart(2,"0")}`, value: val });
      cur = new Date(cur.getTime() + 7*86400000);
    }
    return out;
  };

  const chartData = buildChart(activeMetric);
  const C = { count:"#7E9AD6", amount:"#79B391", margin:"#D2A86A" };
  const periodLabel = (() => {
    const f = d => d.toLocaleDateString("ru-RU",{day:"2-digit",month:"2-digit"});
    return `${f(range.start)} — ${f(range.end)}`;
  })();

  const METRICS = [
    { id:"count",  label:"Заказы",    suffix:"",   unit:"" },
    { id:"amount", label:"Выручка",   suffix:" т", unit:"тонн" },
    { id:"margin", label:"Маржа",     suffix:" т", unit:"тонн" },
  ];
  const active = METRICS.find(m=>m.id===activeMetric);

  return (
    <div style={{flex:1,overflowY:"auto",WebkitOverflowScrolling:"touch",background:"var(--bg)",paddingBottom:"calc(120px + env(safe-area-inset-bottom))"}}>
      {/* ── Header ── */}
      <div style={{padding:"20px 18px 0"}}>
        <div style={{fontSize:28,fontWeight:800,color:"var(--text)",letterSpacing:"-0.04em",lineHeight:1}}>Отчёт</div>
        <div style={{fontSize:13,color:"var(--w35)",marginTop:4}}>{periodLabel}</div>
      </div>

      {/* ── Period pills ── */}
      <div style={{display:"flex",gap:6,padding:"16px 18px 0",overflowX:"auto",scrollbarWidth:"none"}}>
        {PERIOD_PRESETS.map(p => {
          const on = preset === p.id;
          return (
            <button key={p.id} onClick={() => setPreset(p.id)} style={{
              padding:"8px 18px", borderRadius:22, flexShrink:0,
              background: on ? "var(--text)" : "var(--card-2)",
              color: on ? "var(--ink)" : "var(--w50)",
              border: "none", fontSize:13, fontWeight: on ? 700 : 500,
              cursor:"pointer", fontFamily:"inherit", transition:"all 0.15s",
            }}>{p.label}</button>
          );
        })}
      </div>

      {preset === "custom" && (
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,padding:"12px 18px 0"}}>
          {[["От",customFrom,setCustomFrom],["До",customTo,setCustomTo]].map(([lbl,val,setter]) => (
            <div key={lbl}>
              <div style={{fontSize:10,fontWeight:600,color:"var(--w38)",letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:5}}>{lbl}</div>
              <input type="date" value={val} onChange={e=>setter(e.target.value)}
                style={{width:"100%",background:"var(--card-2)",border:"1px solid var(--w10)",borderRadius:10,color:"var(--w85)",fontSize:13,padding:"10px 12px",outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>
            </div>
          ))}
        </div>
      )}

      {/* ── PRIMARY METRIC CARD (full-width, large) ── */}
      <div style={{padding:"16px 18px 0"}}>
        <div style={{
          background:"var(--card)",boxShadow:"var(--elev)", borderRadius:18, padding:"20px 22px",
          border:"1px solid var(--w08)",
        }}>
          {/* Metric switcher row */}
          <div style={{display:"flex",gap:4,marginBottom:18}}>
            {METRICS.map(m => (
              <button key={m.id} onClick={() => setActiveMetric(m.id)} style={{
                padding:"5px 14px", borderRadius:20,
                background: activeMetric===m.id ? "var(--w12)" : "transparent",
                color: activeMetric===m.id ? "var(--text)" : "var(--w38)",
                border:"none", fontSize:12, fontWeight: activeMetric===m.id ? 700 : 500,
                cursor:"pointer", fontFamily:"inherit", transition:"all 0.12s",
              }}>{m.label}</button>
            ))}
          </div>

          {/* Big number */}
          <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",marginBottom:6}}>
            <div>
              <div style={{fontSize:52,fontWeight:800,color:"var(--text)",letterSpacing:"-0.05em",lineHeight:1}}>
                {fmt(totals[activeMetric])}
                {active.suffix && (
                  <span style={{fontSize:20,fontWeight:500,color:"var(--w40)",marginLeft:4}}>{active.suffix.trim()}</span>
                )}
              </div>
              <div style={{fontSize:12,color:"var(--w35)",marginTop:6}}>
                {delta(totals[activeMetric], prevTotals[activeMetric]) !== "—" && (
                  <span style={{color:deltaColor(totals[activeMetric],prevTotals[activeMetric]),fontWeight:600,marginRight:6}}>
                    {delta(totals[activeMetric], prevTotals[activeMetric])}
                  </span>
                )}
                к прошлому периоду
              </div>
            </div>
            {/* Prev period mini */}
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:11,color:"var(--w30)"}}>Предыдущий</div>
              <div style={{fontSize:22,fontWeight:700,color:"var(--w35)",letterSpacing:"-0.02em"}}>
                {fmt(prevTotals[activeMetric])}{active.suffix}
              </div>
            </div>
          </div>

          {/* Chart */}
          <div style={{marginTop:16}}>
            <SvgBarChart data={chartData} color={C[activeMetric]} height={80}/>
          </div>
        </div>
      </div>

      {/* ── SECONDARY KPI ROW (2+1 layout like reference) ── */}
      <div style={{padding:"12px 18px 0"}}>
        {/* Top row: 2 cards side by side */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
          {METRICS.filter(m=>m.id!==activeMetric).map(m => (
            <div key={m.id} onClick={() => setActiveMetric(m.id)} style={{
              background:"var(--card)",boxShadow:"var(--elev)", borderRadius:18, padding:"18px 18px 16px",
              border:"1px solid var(--w07)", cursor:"pointer",
              transition:"border-color 0.15s",
            }}>
              <div style={{fontSize:32,fontWeight:800,color:"var(--text)",letterSpacing:"-0.04em",lineHeight:1,marginBottom:12}}>
                {fmt(totals[m.id])}
                {m.suffix && <span style={{fontSize:14,fontWeight:500,color:"var(--w40)",marginLeft:3}}>{m.suffix.trim()}</span>}
              </div>
              <div style={{fontSize:13,fontWeight:600,color:"var(--w75)"}}>{m.label}</div>
              <div style={{fontSize:11,color:deltaColor(totals[m.id],prevTotals[m.id]),marginTop:3,fontWeight:600}}>
                {delta(totals[m.id],prevTotals[m.id])}
              </div>
            </div>
          ))}
        </div>

        {/* Total orders count — full width strip if more detail needed */}
        <div style={{
          background:"var(--card)",boxShadow:"var(--elev)", borderRadius:18, padding:"14px 20px",
          border:"1px solid var(--w07)",
          display:"flex", alignItems:"center", justifyContent:"space-between",
        }}>
          <div>
            <div style={{fontSize:13,fontWeight:600,color:"var(--w60)"}}>Всего заказов</div>
            <div style={{fontSize:11,color:"var(--w30)",marginTop:2}}>за выбранный период</div>
          </div>
          <div style={{fontSize:34,fontWeight:800,color:"var(--text)",letterSpacing:"-0.04em"}}>{totals.count}</div>
        </div>
      </div>

      {/* ── BY SERVICE — cards like reference ── */}
      <div style={{padding:"20px 18px 0"}}>
        <div style={{fontSize:13,fontWeight:700,color:"var(--w40)",letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:12}}>
          По услугам
        </div>

        {Object.entries(agg).length === 0 ? (
          <div style={{textAlign:"center",padding:"30px 0",color:"var(--w20)",fontSize:13}}>
            Нет заказов за выбранный период
          </div>
        ) : (
          <>
            {/* Full-width card for top service */}
            {Object.entries(agg).slice(0,1).map(([id,s]) => (
              <div key={id} style={{
                background:"var(--card)",boxShadow:"var(--elev)", borderRadius:18, padding:"20px 22px",
                border:"1px solid var(--w08)", marginBottom:10,
              }}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <div>
                      <div style={{fontSize:15,fontWeight:700,color:"var(--text)"}}>{s.label}</div>
                      <div style={{fontSize:11,color:"var(--w35)"}}>{s.count} заказ{s.count===1?"":s.count<5?"а":"ов"}</div>
                    </div>
                  </div>
                  <div style={{fontSize:36,fontWeight:800,color:s.color,letterSpacing:"-0.04em"}}>
                    {fmt(s[activeMetric])}<span style={{fontSize:14,fontWeight:500,color:s.color+"AA",marginLeft:2}}>{active.suffix.trim()}</span>
                  </div>
                </div>
                {/* Progress bar */}
                <div style={{height:3,background:"var(--w07)",borderRadius:3,overflow:"hidden",marginBottom:16}}>
                  <div style={{height:"100%",background:s.color,width:"100%",borderRadius:3}}/>
                </div>
                {/* Sub metrics */}
                <div style={{display:"flex",gap:0}}>
                  {[["Заказов",String(s.count),"#7E9AD6"],["Выручка",`${fmt(s.amount)} т`,"#79B391"],["Маржа",`${fmt(s.margin)} т`,"#D2A86A"]].map(([lbl,val,clr],i,arr) => (
                    <div key={lbl} style={{flex:1,borderRight: i<arr.length-1 ? "1px solid var(--w07)" : "none",paddingRight:i<arr.length-1?12:0,paddingLeft:i>0?12:0}}>
                      <div style={{fontSize:9,fontWeight:600,color:"var(--w35)",letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:3}}>{lbl}</div>
                      <div style={{fontSize:15,fontWeight:700,color:clr}}>{val}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Remaining services in 2-col grid */}
            {Object.entries(agg).length > 1 && (
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                {Object.entries(agg).slice(1).map(([id,s]) => {
                  const maxV = Math.max(...Object.values(agg).map(x=>x[activeMetric]),1);
                  const pct  = Math.round((s[activeMetric]/maxV)*100);
                  return (
                    <div key={id} style={{
                      background:"var(--card)",boxShadow:"var(--elev)", borderRadius:18, padding:"18px 18px 16px",
                      border:"1px solid var(--w07)",
                    }}>

                      <div style={{fontSize:28,fontWeight:800,color:"var(--text)",letterSpacing:"-0.04em",lineHeight:1,marginBottom:8}}>
                        {fmt(s[activeMetric])}{active.suffix && <span style={{fontSize:12,fontWeight:500,color:"var(--w40)",marginLeft:2}}>{active.suffix.trim()}</span>}
                      </div>
                      <div style={{fontSize:13,fontWeight:600,color:"var(--w70)",marginBottom:2}}>{s.label}</div>
                      <div style={{fontSize:11,color:"var(--w30)"}}>{s.count} заказ{s.count===1?"":s.count<5?"а":"ов"}</div>
                      {/* Mini bar */}
                      <div style={{height:3,background:"var(--w07)",borderRadius:3,overflow:"hidden",marginTop:10}}>
                        <div style={{height:"100%",background:s.color,width:`${pct}%`,borderRadius:3,transition:"width 0.4s ease"}}/>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      <div style={{height:24}}/>
    </div>
  );
}





// ─── ANALYTICS VIEW ─────────────────────────────────────────────────────────
function AnalyticsView({ orders: allOrders }) {
  // ── Tabs ──────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState("compare"); // compare | funnel | weekday | season

  // ── Фильтр по исполнителю — действует на все вкладки аналитики ────────────
  const [execFilter, setExecFilter] = useState("all");
  const executors = getExecutors(allOrders);
  const orders = execFilter === "all" ? allOrders : allOrders.filter(o => orderExecutor(o) === execFilter);

  // ── Leads from localStorage ───────────────────────────────────────────────
  const leads = (() => { try { return JSON.parse(localStorage.getItem("leads_data_v2")||"[]"); } catch { return []; }})();

  const fmt = n => typeof n === "number" ? (n % 1 === 0 ? String(n) : n.toFixed(1)) : "0";
  const pctOf = (a,b) => b === 0 ? 0 : Math.round((a/b)*100);

  // ─────────────────────────────────────────────────────────────────────────
  // TAB: СРАВНЕНИЕ ПЕРИОДОВ (existing logic)
  // ─────────────────────────────────────────────────────────────────────────
  const [mode, setMode]         = useState("auto");
  const [autoPreset, setAutoPreset] = useState("month");
  const [aFrom, setAFrom]       = useState("");
  const [aTo, setATo]           = useState("");
  const [bFrom, setBFrom]       = useState("");
  const [bTo, setBTo]           = useState("");
  const [metric, setMetric]     = useState("count");

  const metricLabel = { count:"Заказы", amount:"Сумма, т", margin:"Маржа, т" };
  const metricColor = { count:"#7E9AD6", amount:"#79B391", margin:"#D2A86A" };
  const colorA = "#7E9AD6", colorB = "#D2A86A";

  const getRanges = () => {
    if (mode === "auto") {
      if (autoPreset === "week")  { const a=currentWeek(),b=prevWeek(); return [{...a,label:"Эта неделя"},{...b,label:"Прошлая неделя"}]; }
      if (autoPreset === "month") { const a=currentAccountingMonth(),b=prevAccountingMonth(),now=new Date(); return [{...a,label:RU_MONTHS_FULL[now.getMonth()]},{...b,label:RU_MONTHS_FULL[(now.getMonth()-1+12)%12]}]; }
      if (autoPreset === "year")  { const y=new Date().getFullYear(); return [{...accountingYear(y),label:String(y)},{...accountingYear(y-1),label:String(y-1)}]; }
    }
    const parseR=(from,to)=>({start:from?new Date(from+"T00:00:00"):new Date(0),end:to?new Date(to+"T23:59:59"):new Date()});
    return [
      {...parseR(aFrom,aTo), label:(aFrom&&aTo)?`${aFrom} — ${aTo}`:"Период А"},
      {...parseR(bFrom,bTo), label:(bFrom&&bTo)?`${bFrom} — ${bTo}`:"Период Б"},
    ];
  };
  const [rangeA,rangeB] = getRanges();
  const ordA=filterOrdersByPeriod(orders,rangeA), ordB=filterOrdersByPeriod(orders,rangeB);
  const aggA=aggregateByService(ordA), aggB=aggregateByService(ordB);
  const totA={count:ordA.length,amount:ordA.reduce((s,o)=>s+(parseFloat(o.amount)||0),0),margin:ordA.reduce((s,o)=>s+(parseFloat(o.margin)||0),0)};
  const totB={count:ordB.length,amount:ordB.reduce((s,o)=>s+(parseFloat(o.amount)||0),0),margin:ordB.reduce((s,o)=>s+(parseFloat(o.margin)||0),0)};
  const inputSt={background:"var(--card-2)",border:"1px solid var(--w10)",borderRadius:10,color:"var(--w85)",fontSize:13,padding:"9px 12px",outline:"none",fontFamily:"inherit",boxSizing:"border-box",width:"100%"};

  // ─────────────────────────────────────────────────────────────────────────
  // TAB: ВОРОНКА — Лиды → Заказы
  // ─────────────────────────────────────────────────────────────────────────
  const totalLeads     = leads.length;
  const contacted      = leads.filter(l=>l.status!=="new").length;
  const inProgress     = leads.filter(l=>l.status==="working"||l.status==="done").length;
  const converted      = leads.filter(l=>l.status==="done").length;
  const lost           = leads.filter(l=>l.status==="lost").length;

  const funnelSteps = [
    { label:"Все лиды",       value: totalLeads,  color:"#7E9AD6",  pct: 100 },
    { label:"Связались",      value: contacted,   color:"#A98FD0",  pct: pctOf(contacted, totalLeads) },
    { label:"В работе",       value: inProgress,  color:"#D2A86A",  pct: pctOf(inProgress, totalLeads) },
    { label:"Оформлен заказ", value: converted,   color:"#79B391",  pct: pctOf(converted, totalLeads) },
  ];

  // По источникам
  const sourceConv = SOURCES.map(s => {
    const sLeads     = leads.filter(l=>l.source===s.id);
    const sDone      = sLeads.filter(l=>l.status==="done").length;
    const sLost      = sLeads.filter(l=>l.status==="lost").length;
    const convRate   = pctOf(sDone, sLeads.length);
    return { ...s, total: sLeads.length, done: sDone, lost: sLost, rate: convRate };
  }).filter(s=>s.total>0).sort((a,b)=>b.rate-a.rate);

  // По услугам в лидах
  const svcConv = LEAD_SERVICES.map(s => {
    const sl   = leads.filter(l=>l.service===s.id);
    const done = sl.filter(l=>l.status==="done").length;
    return { ...s, total: sl.length, done, rate: pctOf(done, sl.length) };
  }).filter(s=>s.total>0).sort((a,b)=>b.total-a.total);

  // Причины отказа
  const lostLeads = leads.filter(l=>l.status==="lost"&&l.lostReason);
  const lostMap   = {};
  lostLeads.forEach(l=>{ lostMap[l.lostReason]=(lostMap[l.lostReason]||0)+1; });
  const lostReasons = Object.entries(lostMap).sort((a,b)=>b[1]-a[1]);

  // ─────────────────────────────────────────────────────────────────────────
  // TAB: ДНИ НЕДЕЛИ И ЧАСЫ
  // ─────────────────────────────────────────────────────────────────────────
  const DAY_NAMES = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];
  const HOUR_LABELS = ["0","2","4","6","8","10","12","14","16","18","20","22"];

  // Count orders by day of week (0=Mon..6=Sun) and hour block
  const byDow = Array(7).fill(0);
  const byHour = Array(12).fill(0); // 2-hour blocks
  orders.forEach(o => {
    const d = getOrderDate(o);
    const dow = (d.getDay()+6)%7; // JS: 0=Sun → shift to 0=Mon
    byDow[dow]++;
    const hBlock = Math.floor(d.getHours()/2);
    byHour[hBlock]++;
  });
  const maxDow  = Math.max(...byDow, 1);
  const maxHour = Math.max(...byHour, 1);

  // ─────────────────────────────────────────────────────────────────────────
  // TAB: СЕЗОННОСТЬ — 12 месяцев
  // ─────────────────────────────────────────────────────────────────────────
  const [seasonMetric, setSeasonMetric] = useState("count");
  const now12 = new Date();
  const months12 = [];
  for (let i=11; i>=0; i--) {
    const d = new Date(now12.getFullYear(), now12.getMonth()-i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    const label = `${["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"][d.getMonth()]}`;
    const mOrders = orders.filter(o => {
      const od = getOrderDate(o);
      return od.getFullYear()===d.getFullYear() && od.getMonth()===d.getMonth();
    });
    const value = seasonMetric==="count"
      ? mOrders.length
      : mOrders.reduce((s,o)=>s+(parseFloat(o[seasonMetric])||0),0);
    months12.push({ key, label, value, month: d.getMonth(), year: d.getFullYear() });
  }
  const maxSeason = Math.max(...months12.map(m=>m.value), 1);

  // ─────────────────────────────────────────────────────────────────────────
  // SHARED STYLE HELPERS
  // ─────────────────────────────────────────────────────────────────────────
  const Card = ({children, style={}}) => (
    <div style={{background:"var(--card)",boxShadow:"var(--elev)",border:"1px solid var(--w08)",borderRadius:16,padding:"16px",marginBottom:12,...style}}>
      {children}
    </div>
  );
  const SecLabel = ({children}) => (
    <div style={{fontSize:11,fontWeight:700,color:"var(--w40)",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:12}}>
      {children}
    </div>
  );
  const Pill = ({active,onClick,children,color}) => (
    <button onClick={onClick} style={{
      padding:"7px 16px",borderRadius:20,flexShrink:0,
      background: active?"var(--text)":"var(--w07)",
      color: active?"var(--ink)":"var(--w55)",
      border:"none",fontSize:13,fontWeight:active?700:500,
      cursor:"pointer",fontFamily:"inherit",transition:"all 0.15s",
    }}>{children}</button>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  const TABS = [
    { id:"compare", label:"Сравнение" },
    { id:"funnel",  label:"Воронка"   },
    { id:"weekday", label:"По дням"   },
    { id:"season",  label:"Сезонность"},
  ];

  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",minHeight:0,overflow:"hidden"}}>

      {/* ── TAB SWITCHER ── */}
      <div style={{
        display:"flex",borderBottom:"1px solid var(--w08)",
        background:"var(--bg)",flexShrink:0,overflowX:"auto",
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            flex:1,padding:"12px 8px",background:"transparent",border:"none",
            borderBottom:`2px solid ${tab===t.id?"var(--text)":"transparent"}`,
            color:tab===t.id?"var(--text)":"var(--w40)",
            fontSize:12,fontWeight:tab===t.id?700:500,
            cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap",
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── CONTENT ── */}
      <div style={{flex:1,overflowY:"auto",WebkitOverflowScrolling:"touch",padding:"20px 16px 80px",paddingBottom:"calc(120px + env(safe-area-inset-bottom))",background:"var(--bg)"}}>

        {/* Фильтр по исполнителю */}
        <ExecutorFilter value={execFilter} onChange={setExecFilter} executors={executors} />

        {/* ════════ СРАВНЕНИЕ ПЕРИОДОВ ════════ */}
        {tab==="compare" && <>
          <div style={{marginBottom:16}}>
            <div style={{fontSize:22,fontWeight:800,color:"var(--text)",letterSpacing:"-0.03em"}}>Сравнение</div>
            <div style={{fontSize:12,color:"var(--w35)",marginTop:2}}>Два периода бок о бок</div>
          </div>

          <div style={{display:"flex",gap:6,marginBottom:16}}>
            <Pill active={mode==="auto"} onClick={()=>setMode("auto")}>Быстрое</Pill>
            <Pill active={mode==="custom"} onClick={()=>setMode("custom")}>Свои даты</Pill>
          </div>

          {mode==="auto" && (
            <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>
              {[["week","Неделя"],["month","Месяц"],["year","Год"]].map(([p,lbl])=>(
                <button key={p} onClick={()=>setAutoPreset(p)} style={{
                  padding:"6px 14px",borderRadius:10,
                  border:`1px solid ${autoPreset===p?"var(--w20)":"var(--w09)"}`,
                  background:autoPreset===p?"var(--w10)":"transparent",
                  color:autoPreset===p?"var(--text)":"var(--w40)",
                  fontSize:12,fontWeight:autoPreset===p?600:400,cursor:"pointer",fontFamily:"inherit",
                }}>{lbl}</button>
              ))}
            </div>
          )}

          {mode==="custom" && (
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
              {[["A",colorA,aFrom,setAFrom,aTo,setATo],["Б",colorB,bFrom,setBFrom,bTo,setBTo]].map(([lbl,clr,vf,sf,vt,st])=>(
                <div key={lbl} style={{background:"var(--card)",boxShadow:"var(--elev)",border:`1px solid ${clr}22`,borderRadius:12,padding:"12px"}}>
                  <div style={{fontSize:11,fontWeight:700,color:clr,marginBottom:8}}>Период {lbl}</div>
                  <div style={{display:"flex",flexDirection:"column",gap:6}}>
                    <input type="date" value={vf} onChange={e=>sf(e.target.value)} style={inputSt}/>
                    <input type="date" value={vt} onChange={e=>st(e.target.value)} style={inputSt}/>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{display:"flex",gap:6,marginBottom:20}}>
            {["count","amount","margin"].map(m=>(
              <button key={m} onClick={()=>setMetric(m)} style={{
                flex:1,padding:"8px",borderRadius:10,
                background:metric===m?"var(--w08)":"transparent",
                border:`1px solid ${metric===m?metricColor[m]+"55":"var(--w08)"}`,
                color:metric===m?metricColor[m]:"var(--w40)",
                fontSize:12,fontWeight:metric===m?700:500,cursor:"pointer",fontFamily:"inherit",
              }}>{metricLabel[m]}</button>
            ))}
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
            {[[rangeA,colorA,totA],[rangeB,colorB,totB]].map(([range,clr,tot])=>(
              <div key={clr} style={{background:"var(--card)",boxShadow:"var(--elev)",border:`1px solid ${clr}33`,borderRadius:14,padding:"14px"}}>
                <div style={{fontSize:10,fontWeight:700,color:clr,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:6}}>{range.label}</div>
                <div style={{fontSize:26,fontWeight:800,color:"var(--text)",letterSpacing:"-0.03em"}}>{fmt(tot[metric])}</div>
                <div style={{fontSize:10,color:"var(--w35)",marginTop:3}}>{tot.count} заказ{tot.count===1?"":tot.count<5&&tot.count>1?"а":"ов"}</div>
              </div>
            ))}
          </div>

          {(totA[metric]>0||totB[metric]>0) && (()=>{
            const d=totB[metric]===0?(totA[metric]>0?100:0):Math.round(((totA[metric]-totB[metric])/totB[metric])*100);
            const up=d>=0;
            return (
              <Card style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
                <div>
                  <div style={{fontSize:11,color:"var(--w40)",marginBottom:4}}>Изменение</div>
                  <div style={{fontSize:28,fontWeight:800,color:up?"#79B391":"#CD8585",letterSpacing:"-0.03em"}}>{up?"+":""}{d}%</div>
                  <div style={{fontSize:11,color:"var(--w35)",marginTop:2}}>{up?"▲":"▼"} {fmt(Math.abs(totA[metric]-totB[metric]))}{metric!=="count"?" т":""}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:11,color:colorA,fontWeight:700,marginBottom:4}}>{rangeA.label}: {fmt(totA[metric])}{metric!=="count"?" т":""}</div>
                  <div style={{fontSize:11,color:colorB,fontWeight:700}}>{rangeB.label}: {fmt(totB[metric])}{metric!=="count"?" т":""}</div>
                </div>
              </Card>
            );
          })()}

          <SecLabel>По услугам — {metricLabel[metric]}</SecLabel>
          <Card>
            {SERVICES.filter(s=>!s.add).map(s=>{
              const va=aggA[s.id]?.[metric]||0,vb=aggB[s.id]?.[metric]||0,maxV=Math.max(1,va,vb);
              return (
                <div key={s.id} style={{marginBottom:18}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:7}}>
                    <span style={{fontSize:12,color:"var(--w85)",fontWeight:600}}>{s.label}</span>
                    <div style={{display:"flex",gap:14,fontSize:12}}>
                      <span style={{color:colorA,fontWeight:700}}>{fmt(va)}{metric!=="count"?" т":""}</span>
                      <span style={{color:colorB,fontWeight:700}}>{fmt(vb)}{metric!=="count"?" т":""}</span>
                    </div>
                  </div>
                  <div style={{height:5,background:"var(--w06)",borderRadius:3,overflow:"hidden",marginBottom:3}}>
                    <div style={{width:`${(va/maxV)*100}%`,height:"100%",background:colorA,borderRadius:3,opacity:0.85}}/>
                  </div>
                  <div style={{height:5,background:"var(--w06)",borderRadius:3,overflow:"hidden"}}>
                    <div style={{width:`${(vb/maxV)*100}%`,height:"100%",background:colorB,borderRadius:3,opacity:0.8}}/>
                  </div>
                </div>
              );
            })}
            <div style={{display:"flex",gap:16,paddingTop:10,borderTop:"1px solid var(--w06)"}}>
              {[[colorA,rangeA.label],[colorB,rangeB.label]].map(([clr,lbl])=>(
                <div key={lbl} style={{display:"flex",alignItems:"center",gap:6}}>
                  <div style={{width:16,height:4,background:clr,borderRadius:2}}/>
                  <span style={{fontSize:11,color:clr}}>{lbl}</span>
                </div>
              ))}
            </div>
          </Card>
        </>}

        {/* ════════ ВОРОНКА ════════ */}
        {tab==="funnel" && <>
          <div style={{marginBottom:20}}>
            <div style={{fontSize:22,fontWeight:800,color:"var(--text)",letterSpacing:"-0.03em"}}>Воронка продаж</div>
            <div style={{fontSize:12,color:"var(--w35)",marginTop:2}}>Лиды → Заказы · {totalLeads} лидов всего</div>
          </div>

          {totalLeads === 0 ? (
            <div style={{textAlign:"center",padding:"40px 0",color:"var(--w22)",fontSize:13}}>Нет лидов для анализа</div>
          ) : <>

            {/* Воронка */}
            <SecLabel>Этапы воронки</SecLabel>
            <Card style={{paddingBottom:8}}>
              {funnelSteps.map((step,i) => (
                <div key={step.label} style={{marginBottom:i<funnelSteps.length-1?16:0}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:7}}>
                    <span style={{fontSize:13,fontWeight:600,color:"var(--w85)"}}>{step.label}</span>
                    <div style={{display:"flex",alignItems:"baseline",gap:8}}>
                      <span style={{fontSize:22,fontWeight:800,color:step.color,letterSpacing:"-0.03em"}}>{step.value}</span>
                      <span style={{fontSize:11,color:"var(--w40)",fontWeight:600}}>{step.pct}%</span>
                    </div>
                  </div>
                  <div style={{height:6,background:"var(--w07)",borderRadius:4,overflow:"hidden"}}>
                    <div style={{
                      width:`${step.pct}%`,height:"100%",
                      background:step.color,borderRadius:4,
                      transition:"width 0.5s ease",opacity:0.9,
                    }}/>
                  </div>
                </div>
              ))}
            </Card>

            {/* KPI строка */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
              <Card style={{padding:"14px 16px",margin:0}}>
                <div style={{fontSize:9,fontWeight:700,color:"#79B391",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:6}}>Конверсия</div>
                <div style={{fontSize:28,fontWeight:800,color:"var(--text)",letterSpacing:"-0.03em"}}>{pctOf(converted,totalLeads)}<span style={{fontSize:14,fontWeight:500,color:"var(--w40)"}}>%</span></div>
                <div style={{fontSize:11,color:"var(--w35)",marginTop:3}}>лидов → заказов</div>
              </Card>
              <Card style={{padding:"14px 16px",margin:0}}>
                <div style={{fontSize:9,fontWeight:700,color:"#CD8585",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:6}}>Отказы</div>
                <div style={{fontSize:28,fontWeight:800,color:"var(--text)",letterSpacing:"-0.03em"}}>{lost}<span style={{fontSize:14,fontWeight:500,color:"var(--w40)",marginLeft:4}}>шт.</span></div>
                <div style={{fontSize:11,color:"var(--w35)",marginTop:3}}>{pctOf(lost,totalLeads)}% от всех лидов</div>
              </Card>
            </div>

            {/* По источникам */}
            {sourceConv.length > 0 && <>
              <SecLabel>Конверсия по источникам</SecLabel>
              <Card>
                {sourceConv.map((s,i) => (
                  <div key={s.id} style={{marginBottom:i<sourceConv.length-1?16:0}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:7}}>
                      <div>
                        <div style={{fontSize:13,fontWeight:600,color:"var(--w90)"}}>{s.label}</div>
                        <div style={{fontSize:10,color:"var(--w38)",marginTop:1}}>
                          {s.total} лидов · {s.done} оформлено · {s.lost} отказ
                        </div>
                      </div>
                      <div style={{
                        fontSize:18,fontWeight:800,letterSpacing:"-0.02em",
                        color:s.rate>=50?"#79B391":s.rate>=25?"#D2A86A":"#CD8585",
                      }}>{s.rate}<span style={{fontSize:11,fontWeight:500,color:"var(--w40)"}}>%</span></div>
                    </div>
                    {/* Stacked bar: done | in-progress | lost */}
                    <div style={{height:5,display:"flex",borderRadius:4,overflow:"hidden",gap:1}}>
                      <div style={{flex:s.done,background:"#79B391",opacity:0.9,minWidth:s.done?2:0}}/>
                      <div style={{flex:s.total-s.done-s.lost,background:"#D2A86A",opacity:0.7,minWidth:(s.total-s.done-s.lost)?2:0}}/>
                      <div style={{flex:s.lost,background:"#CD8585",opacity:0.7,minWidth:s.lost?2:0}}/>
                      {s.total===0&&<div style={{flex:1,background:"var(--w07)"}}/>}
                    </div>
                  </div>
                ))}
                <div style={{display:"flex",gap:14,marginTop:12,paddingTop:10,borderTop:"1px solid var(--w06)"}}>
                  {[["#79B391","Заказ"],["#D2A86A","В работе"],["#CD8585","Отказ"]].map(([clr,lbl])=>(
                    <div key={lbl} style={{display:"flex",alignItems:"center",gap:5}}>
                      <div style={{width:10,height:4,background:clr,borderRadius:2,opacity:0.9}}/>
                      <span style={{fontSize:10,color:"var(--w45)"}}>{lbl}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </>}

            {/* По услугам */}
            {svcConv.length > 0 && <>
              <SecLabel>По услугам</SecLabel>
              <Card>
                {svcConv.map((s,i)=>(
                  <div key={s.id} style={{display:"flex",alignItems:"center",gap:12,marginBottom:i<svcConv.length-1?14:0}}>
                    <div style={{width:8,height:8,borderRadius:"50%",background:s.color,flexShrink:0}}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                        <span style={{fontSize:12,fontWeight:600,color:"var(--w90)"}}>{s.label}</span>
                        <span style={{fontSize:12,fontWeight:700,color:s.rate>=50?"#79B391":s.rate>=25?"#D2A86A":"var(--w60)"}}>{s.rate}%</span>
                      </div>
                      <div style={{height:4,background:"var(--w07)",borderRadius:3,overflow:"hidden"}}>
                        <div style={{width:`${s.rate}%`,height:"100%",background:s.color,borderRadius:3,transition:"width 0.4s ease"}}/>
                      </div>
                      <div style={{fontSize:10,color:"var(--w35)",marginTop:3}}>{s.total} лидов · {s.done} в заказы</div>
                    </div>
                  </div>
                ))}
              </Card>
            </>}

            {/* Причины отказа */}
            {lostReasons.length > 0 && <>
              <SecLabel>Причины отказа</SecLabel>
              <Card>
                {lostReasons.map(([reason,cnt],i)=>(
                  <div key={reason} style={{display:"flex",alignItems:"center",gap:12,marginBottom:i<lostReasons.length-1?12:0}}>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                        <span style={{fontSize:12,fontWeight:600,color:"var(--w80)"}}>{reason}</span>
                        <span style={{fontSize:12,fontWeight:700,color:"var(--w50)"}}>{cnt}</span>
                      </div>
                      <div style={{height:4,background:"var(--w07)",borderRadius:3,overflow:"hidden"}}>
                        <div style={{width:`${pctOf(cnt,lostLeads.length)}%`,height:"100%",background:"#CD8585",borderRadius:3,opacity:0.7}}/>
                      </div>
                    </div>
                  </div>
                ))}
              </Card>
            </>}
          </>}
        </>}

        {/* ════════ ДНИ НЕДЕЛИ И ЧАСЫ ════════ */}
        {tab==="weekday" && <>
          <div style={{marginBottom:20}}>
            <div style={{fontSize:22,fontWeight:800,color:"var(--text)",letterSpacing:"-0.03em"}}>По дням и часам</div>
            <div style={{fontSize:12,color:"var(--w35)",marginTop:2}}>Когда приходит больше заказов</div>
          </div>

          {orders.length === 0 ? (
            <div style={{textAlign:"center",padding:"40px 0",color:"var(--w22)",fontSize:13}}>Нет заказов для анализа</div>
          ) : <>

            {/* По дням недели */}
            <SecLabel>По дням недели</SecLabel>
            <Card>
              <div style={{display:"flex",alignItems:"flex-end",gap:6,height:100,marginBottom:10}}>
                {DAY_NAMES.map((d,i)=>{
                  const val = byDow[i];
                  const pct = Math.max(4,(val/maxDow)*100);
                  const isMax = val===maxDow && val>0;
                  return (
                    <div key={d} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",gap:4}}>
                      {val>0&&<div style={{fontSize:10,fontWeight:700,color:isMax?"#7E9AD6":"var(--w50)"}}>{val}</div>}
                      <div style={{
                        width:"100%",borderRadius:"4px 4px 0 0",
                        background:isMax?"#7E9AD6":val>0?"rgba(126,154,214,0.5)":"var(--w06)",
                        height:`${pct}%`,transition:"height 0.4s ease",
                      }}/>
                      <div style={{fontSize:11,fontWeight:isMax?700:400,color:isMax?"var(--text)":"var(--w40)"}}>{d}</div>
                    </div>
                  );
                })}
              </div>
              {/* Peak day insight */}
              {maxDow > 0 && (
                <div style={{background:"rgba(126,154,214,0.08)",border:"1px solid rgba(126,154,214,0.2)",borderRadius:10,padding:"10px 14px",marginTop:4}}>
                  <span style={{fontSize:12,color:"var(--w70)"}}>
                    Пиковый день — <span style={{fontWeight:700,color:"#7E9AD6"}}>{DAY_NAMES[byDow.indexOf(maxDow)]}</span>
                    {" "}({maxDow} заказ{maxDow===1?"":maxDow<5?"а":"ов"})
                  </span>
                </div>
              )}
            </Card>

            {/* По времени суток */}
            <SecLabel>По времени суток</SecLabel>
            <Card>
              <div style={{display:"flex",alignItems:"flex-end",gap:4,height:90,marginBottom:10}}>
                {byHour.map((val,i)=>{
                  const pct = Math.max(4,(val/maxHour)*100);
                  const isMax = val===maxHour && val>0;
                  const timeLabel = HOUR_LABELS[i];
                  // Color: night=dark, morning=blue, day=green, evening=orange
                  const hue = i<3?"rgba(126,154,214,0.4)":i<6?"#7E9AD6":i<9?"#79B391":"#D2A86A";
                  const hueActive = i<3?"rgba(126,154,214,0.8)":i<6?"#7E9AD6":i<9?"#79B391":"#D2A86A";
                  return (
                    <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",gap:3}}>
                      {val>0&&<div style={{fontSize:9,fontWeight:700,color:isMax?hueActive:"var(--w45)"}}>{val}</div>}
                      <div style={{
                        width:"100%",borderRadius:"3px 3px 0 0",
                        background:val>0?(isMax?hueActive:hue):"var(--w05)",
                        height:`${pct}%`,transition:"height 0.4s ease",
                      }}/>
                      <div style={{fontSize:9,color:"var(--w35)",lineHeight:1}}>{timeLabel}</div>
                    </div>
                  );
                })}
              </div>
              {/* Time zone labels */}
              <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:8,paddingTop:10,borderTop:"1px solid var(--w06)"}}>
                {[
                  ["rgba(126,154,214,0.6)","0–6 Ночь"],
                  ["#7E9AD6","6–12 Утро"],
                  ["#79B391","12–18 День"],
                  ["#D2A86A","18–24 Вечер"],
                ].map(([clr,lbl])=>(
                  <div key={lbl} style={{display:"flex",alignItems:"center",gap:5}}>
                    <div style={{width:10,height:4,background:clr,borderRadius:2}}/>
                    <span style={{fontSize:10,color:"var(--w45)"}}>{lbl}</span>
                  </div>
                ))}
              </div>
              {/* Peak hour insight */}
              {maxHour > 0 && (
                <div style={{background:"var(--w04)",borderRadius:10,padding:"10px 14px",marginTop:10}}>
                  <span style={{fontSize:12,color:"var(--w70)"}}>
                    Пиковое время — <span style={{fontWeight:700,color:"var(--text)"}}>{HOUR_LABELS[byHour.indexOf(maxHour)]}:00–{HOUR_LABELS[byHour.indexOf(maxHour)]+2}:00</span>
                    {" "}({maxHour} заказ{maxHour===1?"":maxHour<5?"а":"ов"})
                  </span>
                </div>
              )}
            </Card>

            {/* Сводка */}
            <SecLabel>Распределение</SecLabel>
            <Card>
              {[
                ["Будни (Пн–Пт)", byDow.slice(0,5).reduce((a,b)=>a+b,0), orders.length],
                ["Выходные (Сб–Вс)", byDow.slice(5).reduce((a,b)=>a+b,0), orders.length],
                ["Рабочие часы (9–18)", byHour.slice(4,9).reduce((a,b)=>a+b,0), orders.length],
                ["Вечер + ночь (18–8)", [...byHour.slice(9),...byHour.slice(0,4)].reduce((a,b)=>a+b,0), orders.length],
              ].map(([lbl,val,total])=>(
                <div key={lbl} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                  <span style={{fontSize:12,color:"var(--w70)"}}>{lbl}</span>
                  <div style={{display:"flex",alignItems:"baseline",gap:6}}>
                    <span style={{fontSize:15,fontWeight:700,color:"var(--text)"}}>{val}</span>
                    <span style={{fontSize:11,color:"var(--w38)"}}>{pctOf(val,total)}%</span>
                  </div>
                </div>
              ))}
            </Card>
          </>}
        </>}

        {/* ════════ СЕЗОННОСТЬ ════════ */}
        {tab==="season" && <>
          <div style={{marginBottom:16}}>
            <div style={{fontSize:22,fontWeight:800,color:"var(--text)",letterSpacing:"-0.03em"}}>Сезонность</div>
            <div style={{fontSize:12,color:"var(--w35)",marginTop:2}}>12 месяцев · тренды и мёртвые сезоны</div>
          </div>

          <div style={{display:"flex",gap:6,marginBottom:20}}>
            {[["count","Заказы"],["amount","Сумма"],["margin","Маржа"]].map(([m,lbl])=>(
              <button key={m} onClick={()=>setSeasonMetric(m)} style={{
                flex:1,padding:"8px",borderRadius:10,
                background:seasonMetric===m?"var(--w08)":"transparent",
                border:`1px solid ${seasonMetric===m?metricColor[m]+"55":"var(--w08)"}`,
                color:seasonMetric===m?metricColor[m]:"var(--w40)",
                fontSize:12,fontWeight:seasonMetric===m?700:500,cursor:"pointer",fontFamily:"inherit",
              }}>{lbl}</button>
            ))}
          </div>

          {orders.length === 0 ? (
            <div style={{textAlign:"center",padding:"40px 0",color:"var(--w22)",fontSize:13}}>Нет заказов для анализа</div>
          ) : <>

            {/* 12-month bar chart */}
            <Card>
              <div style={{display:"flex",alignItems:"flex-end",gap:3,height:120,marginBottom:10}}>
                {months12.map((m,i) => {
                  const pct = Math.max(3,(m.value/maxSeason)*100);
                  const isMax = m.value===maxSeason && m.value>0;
                  const isMin = m.value===Math.min(...months12.map(x=>x.value)) && m.value<maxSeason;
                  const isCurrent = i===11;
                  const bg = isMax?"#79B391":isMin&&m.value===0?"var(--w05)":isCurrent?"#7E9AD6":metricColor[seasonMetric]+"66";
                  return (
                    <div key={m.key} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",gap:3}}>
                      {m.value>0&&<div style={{fontSize:8,fontWeight:isMax?700:400,color:isMax?"#79B391":isCurrent?"#7E9AD6":"var(--w40)",textAlign:"center",lineHeight:1}}>{seasonMetric==="count"?m.value:fmt(m.value)}</div>}
                      <div style={{
                        width:"100%",borderRadius:"3px 3px 0 0",
                        background:m.value>0?bg:"var(--w05)",
                        height:`${pct}%`,transition:"height 0.4s ease",
                      }}/>
                      <div style={{fontSize:8,color:isCurrent?"var(--text)":"var(--w35)",fontWeight:isCurrent?700:400,textAlign:"center",lineHeight:1}}>{m.label}</div>
                    </div>
                  );
                })}
              </div>
              {/* Legend */}
              <div style={{display:"flex",gap:14,paddingTop:10,borderTop:"1px solid var(--w06)"}}>
                {[["#79B391","Пик"],["var(--w10)","Минимум"],["#7E9AD6","Текущий"]].map(([clr,lbl])=>(
                  <div key={lbl} style={{display:"flex",alignItems:"center",gap:5}}>
                    <div style={{width:10,height:4,background:clr,borderRadius:2}}/>
                    <span style={{fontSize:10,color:"var(--w45)"}}>{lbl}</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Insights */}
            {(() => {
              const maxM = months12.reduce((a,b)=>a.value>b.value?a:b,months12[0]);
              const minM = months12.filter(m=>m.value>0).reduce((a,b)=>a.value<b.value?a:b,months12[0]);
              const total12 = months12.reduce((s,m)=>s+m.value,0);
              const avg12 = total12/12;
              return (
                <>
                  <SecLabel>Итого за 12 месяцев</SecLabel>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
                    {[
                      ["Всего",seasonMetric==="count"?String(total12):fmt(total12)+" т","var(--w60)"],
                      ["В среднем / мес.",seasonMetric==="count"?fmt(avg12):fmt(avg12)+" т","var(--w60)"],
                      ["Лучший месяц",maxM.label+" "+maxM.year,"#79B391"],
                      ["Слабый месяц",minM?minM.label+" "+minM.year:"—","#D2A86A"],
                    ].map(([lbl,val,clr])=>(
                      <Card key={lbl} style={{padding:"12px 14px",margin:0}}>
                        <div style={{fontSize:9,fontWeight:700,color:"var(--w38)",letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:5}}>{lbl}</div>
                        <div style={{fontSize:15,fontWeight:800,color:clr}}>{val}</div>
                      </Card>
                    ))}
                  </div>

                  {/* Month-by-month table */}
                  <SecLabel>По месяцам</SecLabel>
                  <Card style={{padding:0,overflow:"hidden"}}>
                    {[...months12].reverse().filter(m=>m.value>0).map((m,i,arr)=>{
                      const prevM = arr[i+1];
                      const d = prevM&&prevM.value>0?Math.round(((m.value-prevM.value)/prevM.value)*100):null;
                      return (
                        <div key={m.key} style={{
                          display:"flex",alignItems:"center",justifyContent:"space-between",
                          padding:"11px 16px",
                          borderBottom:i<arr.filter(x=>x.value>0).length-1?"1px solid var(--w06)":"none",
                        }}>
                          <span style={{fontSize:13,color:i===0?"var(--text)":"var(--w70)",fontWeight:i===0?700:400}}>
                            {m.label} {m.year}
                          </span>
                          <div style={{display:"flex",alignItems:"center",gap:10}}>
                            {d!==null&&<span style={{fontSize:11,fontWeight:600,color:d>=0?"#79B391":"#CD8585"}}>{d>=0?"+":""}{d}%</span>}
                            <span style={{fontSize:14,fontWeight:700,color:i===0?"var(--text)":"var(--w60)"}}>
                              {seasonMetric==="count"?m.value:fmt(m.value)}{seasonMetric!=="count"?" т":""}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </Card>
                </>
              );
            })()}
          </>}
        </>}
      </div>
    </div>
  );
}




// ─── DEBTS (personal finance: marginal earnings) ────────────────────────────
function fmtT(n) {
  const v = parseFloat(n) || 0;
  return (v % 1 === 0) ? v.toString() : v.toFixed(1);
}
function fmtDateShort(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

const RU_MONTH_NAMES = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
function monthKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}
function monthLabel(mKey) {
  const [y, m] = mKey.split("-");
  return `${RU_MONTH_NAMES[parseInt(m)-1]} ${y}`;
}

function DebtsView({ orders, debts, setDebts }) {
  // debts = { payments: [...], manualDebts: [...], expenses: [{id, amount, date, note}] }
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [confirmDelId, setConfirmDelId] = useState(null);
  const [editPayId, setEditPayId]       = useState(null);
  const [editPayDraft, setEditPayDraft] = useState({});
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(localISODate());
  const [payNote, setPayNote] = useState("");
  const [manualAmount, setManualAmount] = useState("");
  const [manualMonth, setManualMonth] = useState(monthKey(new Date()));
  const [manualNote, setManualNote] = useState("");
  const [showManual, setShowManual] = useState(false);

  // Expenses state
  const [activeTab, setActiveTab] = useState("payments"); // "payments" | "expenses"
  const [expAmount, setExpAmount] = useState("");
  const [expDate, setExpDate] = useState(localISODate());
  const [expNote, setExpNote] = useState("");
  const [confirmDelExpId, setConfirmDelExpId] = useState(null);

  // Исполнители: фильтр раздела и выбор при добавлении записей
  const [execFilter, setExecFilter] = useState("all");
  const [payExecutor, setPayExecutor] = useState("");
  const [manualExecutor, setManualExecutor] = useState("");
  const executors = getExecutors(orders);

  const allPayments    = debts.payments    || [];
  const allManualDebts = debts.manualDebts || [];
  const expenses       = debts.expenses    || [];
  // Фильтр по исполнителю: «Все» показывает всё (включая записи без исполнителя)
  const payments    = execFilter === "all" ? allPayments    : allPayments.filter(p => (p.executor || "") === execFilter);
  const manualDebts = execFilter === "all" ? allManualDebts : allManualDebts.filter(d => (d.executor || "") === execFilter);

  // Только ручные начисления — автоматического долга из заказов нет
  const marginByMonth = {};
  manualDebts.forEach(d => {
    if (!marginByMonth[d.month]) marginByMonth[d.month] = { total: 0, byService: {}, manual: 0 };
    marginByMonth[d.month].manual  = (marginByMonth[d.month].manual  || 0) + d.amount;
    marginByMonth[d.month].total  += d.amount;
  });

  // Общий долг
  const totalEarned = Object.values(marginByMonth).reduce((s, m) => s + m.total, 0);
  const totalPaid = payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  const totalDebt = totalEarned - totalPaid;

  // Месяцы в порядке убывания
  const allMonths = Object.keys(marginByMonth).sort().reverse();

  // Распределение оплат по месяцам — FIFO от старых к новым
  const allocatePayments = () => {
    const allocation = {};
    let remainingPayment = totalPaid;
    // от самых старых к новым
    const monthsAsc = [...allMonths].sort();
    monthsAsc.forEach(m => {
      const earned = marginByMonth[m].total;
      const paidToMonth = Math.min(remainingPayment, earned);
      allocation[m] = paidToMonth;
      remainingPayment -= paidToMonth;
    });
    return allocation;
  };
  const monthPaidMap = allocatePayments();

  // Для выбранного месяца
  const currentMonthData = selectedMonth !== "all" && marginByMonth[selectedMonth]
    ? marginByMonth[selectedMonth]
    : null;
  const currentMonthEarned = currentMonthData?.total || 0;
  const currentMonthPaid = monthPaidMap[selectedMonth] || 0;
  const currentMonthDebt = currentMonthEarned - currentMonthPaid;

  // Handlers
  const handleAddPayment = () => {
    const a = parseFloat(payAmount);
    if (!a || a <= 0) return;
    setDebts(prev => ({
      ...prev,
      payments: [...(prev.payments || []), {
        id: Date.now().toString(36),
        amount: a, date: payDate, note: payNote, executor: payExecutor,
        updatedAt: new Date().toISOString(),
      }]
    }));
    setPayAmount(""); setPayNote("");
    setPayDate(localISODate());
  };

  const handleDeletePayment = (id) => {
    addTombstone("debt_" + id);
    setDebts(prev => ({
      ...prev,
      payments: (prev.payments || []).filter(p => p.id !== id),
    }));
  };

  const handleUpdatePayment = (id, patch) => {
    setDebts(prev => ({
      ...prev,
      payments: (prev.payments || []).map(p =>
        p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p
      ),
    }));
  };

  const handleAddManual = () => {
    const a = parseFloat(manualAmount);
    if (!a || a <= 0) return;
    setDebts(prev => ({
      ...prev,
      manualDebts: [...(prev.manualDebts || []), {
        id: Date.now().toString(36),
        amount: a, month: manualMonth, note: manualNote, executor: manualExecutor,
      }]
    }));
    setManualAmount(""); setManualNote("");
    setShowManual(false);
  };

  const handleDeleteManual = (id) => {
    addTombstone("debt_" + id);
    setDebts(prev => ({
      ...prev,
      manualDebts: (prev.manualDebts || []).filter(d => d.id !== id),
    }));
  };

  const handleAddExpense = () => {
    const a = parseFloat(expAmount);
    if (!a || a <= 0) return;
    setDebts(prev => ({
      ...prev,
      expenses: [...(prev.expenses || []), {
        id: Date.now().toString(36),
        amount: a, date: expDate, note: expNote,
      }],
    }));
    setExpAmount(""); setExpNote("");
    setExpDate(localISODate());
  };

  const handleDeleteExpense = (id) => {
    addTombstone("debt_" + id);
    setDebts(prev => ({
      ...prev,
      expenses: (prev.expenses || []).filter(e => e.id !== id),
    }));
  };

  // Сводка "показать"
  const displayEarned = selectedMonth === "all" ? totalEarned : currentMonthEarned;
  const displayPaid   = selectedMonth === "all" ? totalPaid   : currentMonthPaid;
  const displayDebt   = selectedMonth === "all" ? totalDebt   : currentMonthDebt;

  return (
    <div style={{flex:1,overflowY:"auto",WebkitOverflowScrolling:"touch",minHeight:0,padding:"18px 20px",paddingBottom:"calc(120px + env(safe-area-inset-bottom))"}}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.02em" }}>Платежи</div>
        <div style={{ fontSize: 12, color: "var(--w35)", marginTop: 2 }}>
          Учёт начислений, оплат и расходов бизнеса
        </div>
      </div>

      {/* Tab switcher: Долги / Расходы */}
      <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
        {[["payments","Долги и платежи"],["expenses","Расходы"]].map(([tab, label]) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: "8px 18px", borderRadius: 20,
            border: `1.5px solid ${activeTab === tab ? "rgba(126,154,214,0.6)" : "var(--w10)"}`,
            background: activeTab === tab ? "rgba(126,154,214,0.14)" : "transparent",
            color: activeTab === tab ? "#7E9AD6" : "var(--w45)",
            fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
          }}>{label}</button>
        ))}
      </div>

      {/* ── PAYMENTS TAB ──────────────────────────────── */}
      {activeTab === "payments" && (<>

      {/* Фильтр по исполнителю */}
      <ExecutorFilter value={execFilter} onChange={setExecFilter} executors={executors} />

      {/* Period selector */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14, alignItems: "center" }}>
        <button onClick={() => setSelectedMonth("all")} style={{
          padding: "6px 14px", borderRadius: 8,
          border: `1.5px solid ${selectedMonth === "all" ? "rgba(126,154,214,0.6)" : "var(--w10)"}`,
          background: selectedMonth === "all" ? "rgba(126,154,214,0.12)" : "transparent",
          color: selectedMonth === "all" ? "#7E9AD6" : "var(--w45)",
          fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
        }}>Всё время</button>
        {allMonths.map(m => (
          <button key={m} onClick={() => setSelectedMonth(m)} style={{
            padding: "6px 14px", borderRadius: 8,
            border: `1.5px solid ${selectedMonth === m ? "rgba(126,154,214,0.6)" : "var(--w10)"}`,
            background: selectedMonth === m ? "rgba(126,154,214,0.12)" : "transparent",
            color: selectedMonth === m ? "#7E9AD6" : "var(--w45)",
            fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
          }}>{monthLabel(m)}</button>
        ))}
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 18 }}>
        <div style={{ background: "var(--card-2)", border: "1px solid var(--w08)", borderRadius: 12, padding: "14px 16px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#A98FD0", letterSpacing: "0.08em", textTransform: "uppercase" }}>Начислено</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "var(--text)", marginTop: 4, letterSpacing: "-0.02em" }}>
            {fmtT(displayEarned)} <span style={{ fontSize: 16, color: "var(--w45)" }}>т</span>
          </div>
        </div>
        <div style={{ background: "var(--card-2)", border: "1px solid rgba(121,179,145,0.2)", borderRadius: 12, padding: "14px 16px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#79B391", letterSpacing: "0.08em", textTransform: "uppercase" }}>Получено</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "var(--text)", marginTop: 4, letterSpacing: "-0.02em" }}>
            {fmtT(displayPaid)} <span style={{ fontSize: 16, color: "var(--w45)" }}>т</span>
          </div>
        </div>
        <div style={{ background: "var(--card-2)", border: displayDebt > 0.01 ? "1px solid rgba(205,133,133,0.3)" : "1px solid rgba(121,179,145,0.2)", borderRadius: 12, padding: "14px 16px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: displayDebt > 0.01 ? "#CD8585" : "#79B391", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            {displayDebt > 0.01 ? "Должны мне" : "Рассчитались"}
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: displayDebt > 0.01 ? "#CD8585" : "#79B391", marginTop: 4, letterSpacing: "-0.02em" }}>
            {displayDebt > 0.01 ? fmtT(displayDebt) : "✓"}
            {displayDebt > 0.01 && <span style={{ fontSize: 16, color: "var(--w45)" }}> т</span>}
          </div>
        </div>
      </div>

      {/* Add Payment */}
      <div style={{ background: "rgba(121,179,145,0.08)", border: "1px solid rgba(121,179,145,0.2)", borderRadius: 12, padding: "14px 16px", marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#79B391", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
          Записать оплату
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
          <input type="number" step="0.1" placeholder="Сумма в тоннах"
            value={payAmount} onChange={e => setPayAmount(e.target.value)}
            style={{
              background: "var(--card-2)", border: "1px solid var(--w10)",
              borderRadius: 8, color: "var(--w85)", fontSize: 13,
              padding: "9px 12px", outline: "none", fontFamily: "inherit",
              boxSizing: "border-box", width: "100%",
            }}
          />
          <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)}
            style={{
              background: "var(--card-2)", border: "1px solid var(--w10)",
              borderRadius: 8, color: "var(--w85)", fontSize: 13,
              padding: "9px 12px", outline: "none", fontFamily: "inherit",
              boxSizing: "border-box", width: "100%",
              WebkitAppearance: "none", appearance: "none",
            }}
          />
        </div>
        <select value={payExecutor} onChange={e => setPayExecutor(e.target.value)}
          style={{ width:"100%", background:"var(--card-2)", border:"1px solid var(--w10)",
            borderRadius:8, fontSize:13, padding:"9px 12px", outline:"none", fontFamily:"inherit",
            boxSizing:"border-box", marginBottom:8, WebkitAppearance:"none", appearance:"none",
            color: payExecutor ? "var(--w85)" : "var(--w35)" }}>
          <option value="">Исполнитель (необязательно)</option>
          {executors.map(ex => <option key={ex} value={ex}>{ex}</option>)}
        </select>
        <div style={{ display: "flex", gap: 8 }}>
          <input type="text" placeholder="Комментарий (необязательно)"
            value={payNote} onChange={e => setPayNote(e.target.value)}
            style={{
              flex: 1, background: "var(--card-2)", border: "1px solid var(--w10)",
              borderRadius: 8, color: "var(--w85)", fontSize: 13,
              padding: "9px 12px", outline: "none", fontFamily: "inherit",
              boxSizing: "border-box",
            }}
          />
          <button onClick={handleAddPayment} disabled={!payAmount} style={{
            background: payAmount ? "rgba(121,179,145,0.12)" : "var(--card)",
            border: `1.5px solid ${payAmount ? "#79B39188" : "var(--w08)"}`,
            color: payAmount ? "#79B391" : "var(--w35)",
            borderRadius: 8, padding: "9px 20px",
            fontSize: 13, fontWeight: 800,
            cursor: payAmount ? "pointer" : "not-allowed",
            fontFamily: "inherit", whiteSpace: "nowrap",
          }}>+ Оплата</button>
        </div>
      </div>

      {/* Toggle manual debt */}
      <div style={{ marginBottom: 12 }}>
        <button onClick={() => setShowManual(!showManual)} style={{
          background: showManual ? "rgba(205,133,133,0.08)" : "transparent",
          border: `1.5px solid ${showManual ? "#CD858588" : "var(--w10)"}`,
          color: showManual ? "#CD8585" : "var(--w45)",
          borderRadius: 8, padding: "6px 14px",
          fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
        }}>{showManual ? "Скрыть" : "+ Начислить долг вручную"}</button>
      </div>

      {/* Manual debt */}
      {showManual && (
        <div style={{ background: "rgba(205,133,133,0.08)", border: "1px solid #CD858533", borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#CD8585", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
            📝 Ручное начисление
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
            <input type="number" step="0.1" placeholder="Сумма в тоннах"
              value={manualAmount} onChange={e => setManualAmount(e.target.value)}
              style={{
                background: "var(--card-2)", border: "1px solid var(--w10)",
                borderRadius: 8, color: "var(--w85)", fontSize: 13,
                padding: "9px 12px", outline: "none", fontFamily: "inherit",
                boxSizing: "border-box", width: "100%",
              }}
            />
            <input type="month" value={manualMonth} onChange={e => setManualMonth(e.target.value)}
              style={{
                background: "var(--card-2)", border: "1px solid var(--w10)",
                borderRadius: 8, color: "var(--w85)", fontSize: 13,
                padding: "9px 12px", outline: "none", fontFamily: "inherit",
                boxSizing: "border-box", width: "100%",
                WebkitAppearance: "none", appearance: "none",
              }}
            />
          </div>
          <select value={manualExecutor} onChange={e => setManualExecutor(e.target.value)}
            style={{ width:"100%", background:"var(--card-2)", border:"1px solid var(--w10)",
            borderRadius:8, fontSize:13, padding:"9px 12px", outline:"none", fontFamily:"inherit",
            boxSizing:"border-box", marginBottom:8, WebkitAppearance:"none", appearance:"none",
              color: manualExecutor ? "var(--w85)" : "var(--w35)" }}>
            <option value="">Исполнитель (необязательно)</option>
            {executors.map(ex => <option key={ex} value={ex}>{ex}</option>)}
          </select>
          <div style={{ display: "flex", gap: 8 }}>
            <input type="text" placeholder="За что (необязательно)"
              value={manualNote} onChange={e => setManualNote(e.target.value)}
              style={{
                flex: 1, background: "var(--card-2)", border: "1px solid var(--w10)",
                borderRadius: 8, color: "var(--w85)", fontSize: 13,
                padding: "9px 12px", outline: "none", fontFamily: "inherit",
                boxSizing: "border-box",
              }}
            />
            <button onClick={handleAddManual} disabled={!manualAmount} style={{
              background: manualAmount ? "rgba(205,133,133,0.12)" : "var(--card)",
              border: `1.5px solid ${manualAmount ? "#CD858588" : "var(--w08)"}`,
              color: manualAmount ? "#CD8585" : "var(--w35)",
              borderRadius: 8, padding: "9px 20px",
              fontSize: 13, fontWeight: 800,
              cursor: manualAmount ? "pointer" : "not-allowed",
              fontFamily: "inherit", whiteSpace: "nowrap",
            }}>Начислить</button>
          </div>
        </div>
      )}

      {/* Monthly breakdown */}
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--w45)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
        По месяцам
      </div>

      {allMonths.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 0", color: "var(--w18)", fontSize: 13 }}>
          Нет данных — создайте заказы с маржой или начислите долг вручную
        </div>
      )}

      {allMonths.map(m => {
        const data = marginByMonth[m];
        const earned = data.total;
        const paidToMonth = monthPaidMap[m] || 0;
        const debt = earned - paidToMonth;
        const pct = earned > 0 ? (paidToMonth / earned) * 100 : 0;

        return (
          <div key={m} style={{
            background: "var(--card-2)", border: "1px solid var(--w08)",
            borderRadius: 12, padding: "14px 16px", marginBottom: 8,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{monthLabel(m)}</div>
              <div style={{ fontSize: 11, color: "var(--w45)" }}>
                {fmtT(paidToMonth)} / {fmtT(earned)} т
              </div>
            </div>

            {/* Progress bar */}
            <div style={{ height: 6, background: "var(--card)", boxShadow:"var(--elev)", borderRadius: 3, overflow: "hidden", marginBottom: 10 }}>
              <div style={{
                width: `${Math.min(100, pct)}%`, height: "100%",
                background: debt > 0.01 ? "linear-gradient(90deg, #79B391, #79B391AA)" : "#79B391",
                transition: "width 0.4s ease",
              }}/>
            </div>

            {/* Manual debt entries */}
            {data.manual > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                <span style={{
                  fontSize: 11, padding: "3px 10px", borderRadius: 6,
                  background: "rgba(205,133,133,0.1)", color: "#CD8585", fontWeight: 700,
                }}>
                  Начислено вручную: {fmtT(data.manual)} т
                </span>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
              <span style={{ color: debt > 0.01 ? "#CD8585" : "#79B391", fontWeight: 700 }}>
                {debt > 0.01 ? `Долг: ${fmtT(debt)} т` : "✓ Полностью оплачено"}
              </span>
              {earned > 0 && (
                <span style={{ color: "var(--w45)" }}>
                  {Math.round(pct)}% оплачено
                </span>
              )}
            </div>
          </div>
        );
      })}

      {/* Payments history */}
      {payments.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--w45)", letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 20, marginBottom: 10 }}>
            История оплат ({payments.length})
          </div>
          <div style={{ background: "var(--card-2)", border: "1px solid var(--w08)", borderRadius: 12, padding: "6px" }}>
            {[...payments].sort((a,b) => (b.date||"").localeCompare(a.date||"")).map(p => (
              editPayId === p.id ? (
                <div key={p.id} style={{ padding:"10px 12px", borderRadius:8, background:"var(--card)", border:"1px solid var(--w10)", margin:"2px 0", display:"flex", flexDirection:"column", gap:8 }}>
                  <div style={{ display:"flex", gap:8 }}>
                    <input type="number" inputMode="decimal" value={editPayDraft.amount} placeholder="Сумма, т"
                      onChange={e=>setEditPayDraft(d=>({...d, amount:e.target.value}))}
                      style={{ flex:1, background:"var(--card-2)", border:"1px solid var(--w12)", borderRadius:8, color:"var(--text)", fontSize:13, padding:"7px 10px", outline:"none", fontFamily:"inherit" }}/>
                    <input type="date" value={editPayDraft.date}
                      onChange={e=>setEditPayDraft(d=>({...d, date:e.target.value}))}
                      style={{ flex:1, background:"var(--card-2)", border:"1px solid var(--w12)", borderRadius:8, color:"var(--text)", fontSize:13, padding:"7px 10px", outline:"none", fontFamily:"inherit" }}/>
                  </div>
                  <select value={editPayDraft.executor || ""}
                    onChange={e=>setEditPayDraft(d=>({...d, executor:e.target.value}))}
                    style={{ background:"var(--card-2)", border:"1px solid var(--w12)", borderRadius:8, color:"var(--text)", fontSize:13, padding:"7px 10px", outline:"none", fontFamily:"inherit" }}>
                    <option value="">Без исполнителя</option>
                    {executors.map(ex => <option key={ex} value={ex}>{ex}</option>)}
                  </select>
                  <input value={editPayDraft.note || ""} placeholder="Заметка"
                    onChange={e=>setEditPayDraft(d=>({...d, note:e.target.value}))}
                    style={{ background:"var(--card-2)", border:"1px solid var(--w12)", borderRadius:8, color:"var(--text)", fontSize:13, padding:"7px 10px", outline:"none", fontFamily:"inherit" }}/>
                  <div style={{ display:"flex", gap:8 }}>
                    <button onClick={()=>{ const amt=parseFloat(editPayDraft.amount); if(!amt||amt<=0) return; handleUpdatePayment(p.id, { amount:amt, date:editPayDraft.date, note:editPayDraft.note, executor:editPayDraft.executor }); setEditPayId(null); }}
                      style={{ flex:1, background:"rgba(121,179,145,0.14)", border:"1.5px solid #79B39155", color:"#79B391", borderRadius:8, padding:"8px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>Сохранить</button>
                    <button onClick={()=>setEditPayId(null)}
                      style={{ padding:"8px 16px", background:"transparent", border:"1px solid var(--w10)", color:"var(--w45)", borderRadius:8, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>Отмена</button>
                  </div>
                </div>
              ) : (
              <div key={p.id} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "8px 12px", borderRadius: 8,
              }}>
                <div style={{ fontSize: 12 }}>
                  <span style={{ color: "var(--w45)" }}>{fmtDateShort(p.date)}</span>
                  {p.executor && <span style={{ color: "#79B391", marginLeft: 8, fontWeight: 600 }}>· {p.executor}</span>}
                  {p.note && <span style={{ color: "var(--w35)", marginLeft: 8 }}>· {p.note}</span>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#79B391" }}>+{fmtT(p.amount)} т</span>
                  <button
                    onClick={()=>{ setEditPayId(p.id); setEditPayDraft({ amount:String(p.amount ?? ""), date:p.date||localISODate(), note:p.note||"", executor:p.executor||"" }); setConfirmDelId(null); }}
                    style={{ background:"transparent", border:"1px solid var(--w10)", color:"var(--w45)", borderRadius:6, padding:"3px 9px", fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}
                  >Изм.</button>
                  <button
                    onClick={() => {
                      if (confirmDelId === p.id) { handleDeletePayment(p.id); setConfirmDelId(null); }
                      else { setConfirmDelId(p.id); setTimeout(()=>setConfirmDelId(x => x===p.id ? null : x), 3000); }
                    }}
                    style={{
                      background: confirmDelId === p.id ? "#CD858522" : "transparent",
                      border: `1px solid ${confirmDelId === p.id ? "#CD858588" : "transparent"}`,
                      color: confirmDelId === p.id ? "#CD8585" : "#3a1a1a",
                      borderRadius: 6, padding: "3px 9px",
                      fontSize: 11, fontWeight: confirmDelId === p.id ? 800 : 500,
                      cursor: "pointer", fontFamily: "inherit",
                      transition: "all 0.15s",
                    }}
                  >{confirmDelId === p.id ? "Удалить?" : "✕"}</button>
                </div>
              </div>
              )
            ))}
          </div>
        </>
      )}

      {/* Manual debts history */}
      {manualDebts.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--w45)", letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 20, marginBottom: 10 }}>
            Ручные начисления ({manualDebts.length})
          </div>
          <div style={{ background: "var(--card-2)", border: "1px solid var(--w08)", borderRadius: 12, padding: "6px" }}>
            {[...manualDebts].sort((a,b) => (b.month||"").localeCompare(a.month||"")).map(d => (
              <div key={d.id} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "8px 12px", borderRadius: 8,
              }}>
                <div style={{ fontSize: 12 }}>
                  <span style={{ color: "var(--w45)" }}>{monthLabel(d.month)}</span>
                  {d.executor && <span style={{ color: "#79B391", marginLeft: 8, fontWeight: 600 }}>· {d.executor}</span>}
                  {d.note && <span style={{ color: "var(--w35)", marginLeft: 8 }}>· {d.note}</span>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#CD8585" }}>+{fmtT(d.amount)} т</span>
                  <button
                    onClick={() => {
                      if (confirmDelId === d.id) { handleDeleteManual(d.id); setConfirmDelId(null); }
                      else { setConfirmDelId(d.id); setTimeout(()=>setConfirmDelId(x => x===d.id ? null : x), 3000); }
                    }}
                    style={{
                      background: confirmDelId === d.id ? "#CD858522" : "transparent",
                      border: `1px solid ${confirmDelId === d.id ? "#CD858588" : "transparent"}`,
                      color: confirmDelId === d.id ? "#CD8585" : "#3a1a1a",
                      borderRadius: 6, padding: "3px 9px",
                      fontSize: 11, fontWeight: confirmDelId === d.id ? 800 : 500,
                      cursor: "pointer", fontFamily: "inherit",
                      transition: "all 0.15s",
                    }}
                  >{confirmDelId === d.id ? "Удалить?" : "✕"}</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      </>)}

      {/* ── EXPENSES TAB ──────────────────────────────── */}
      {activeTab === "expenses" && (
        <div>
          {/* Add expense form */}
          <div style={{ background: "rgba(210,168,106,0.08)", border: "1px solid rgba(210,168,106,0.25)", borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#D2A86A", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
              Добавить расход
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
              <input type="number" step="1" placeholder="Сумма, ₽"
                value={expAmount} onChange={e => setExpAmount(e.target.value)}
                style={{
                  background: "var(--card-2)", border: "1px solid var(--w10)",
                  borderRadius: 8, color: "var(--w85)", fontSize: 13,
                  padding: "9px 12px", outline: "none", fontFamily: "inherit", boxSizing: "border-box",
                }}
              />
              <input type="date" value={expDate} onChange={e => setExpDate(e.target.value)}
                style={{
                  background: "var(--card-2)", border: "1px solid var(--w10)",
                  borderRadius: 8, color: "var(--w85)", fontSize: 13,
                  padding: "9px 12px", outline: "none", fontFamily: "inherit", boxSizing: "border-box",
                  WebkitAppearance: "none", appearance: "none",
                }}
              />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input type="text" placeholder="Назначение (например: реклама, топливо, зарплата...)"
                value={expNote} onChange={e => setExpNote(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && expAmount) handleAddExpense(); }}
                style={{
                  flex: 1, background: "var(--card-2)", border: "1px solid var(--w10)",
                  borderRadius: 8, color: "var(--w85)", fontSize: 13,
                  padding: "9px 12px", outline: "none", fontFamily: "inherit", boxSizing: "border-box",
                }}
              />
              <button onClick={handleAddExpense} disabled={!expAmount} style={{
                background: expAmount ? "rgba(210,168,106,0.12)" : "var(--card)",
                border: `1.5px solid ${expAmount ? "rgba(210,168,106,0.5)" : "var(--w08)"}`,
                color: expAmount ? "#D2A86A" : "var(--w35)",
                borderRadius: 8, padding: "9px 20px",
                fontSize: 13, fontWeight: 800,
                cursor: expAmount ? "pointer" : "not-allowed",
                fontFamily: "inherit", whiteSpace: "nowrap",
              }}>Записать</button>
            </div>
          </div>

          {/* Total */}
          {expenses.length > 0 && (
            <div style={{ background: "var(--card-2)", border: "1px solid rgba(210,168,106,0.2)", borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#D2A86A", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>Итого расходов</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#D2A86A", letterSpacing: "-0.02em" }}>
                {expenses.reduce((s,e) => s + (parseFloat(e.amount)||0), 0).toLocaleString("ru-RU")}
                <span style={{ fontSize: 16, color: "var(--w45)", marginLeft: 6 }}>₽</span>
              </div>
            </div>
          )}

          {/* List */}
          {expenses.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "var(--w18)", fontSize: 13 }}>
              Расходов пока нет — добавьте первый
            </div>
          ) : (
            <div style={{ background: "var(--card-2)", border: "1px solid var(--w08)", borderRadius: 12, padding: "6px" }}>
              {[...expenses].sort((a,b) => (b.date||"").localeCompare(a.date||"")).map(exp => (
                <div key={exp.id} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "10px 12px", borderRadius: 8,
                  borderBottom: "1px solid var(--w04)",
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--w85)" }}>
                      {exp.note || <span style={{ color: "var(--w35)", fontStyle: "italic" }}>Без назначения</span>}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--w35)", marginTop: 2 }}>{fmtDateShort(exp.date)}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: "#D2A86A" }}>
                      −{parseFloat(exp.amount).toLocaleString("ru-RU")} ₽
                    </span>
                    <button
                      onClick={() => {
                        if (confirmDelExpId === exp.id) { handleDeleteExpense(exp.id); setConfirmDelExpId(null); }
                        else { setConfirmDelExpId(exp.id); setTimeout(()=>setConfirmDelExpId(x => x===exp.id ? null : x), 3000); }
                      }}
                      style={{
                        background: confirmDelExpId === exp.id ? "#CD858522" : "transparent",
                        border: `1px solid ${confirmDelExpId === exp.id ? "#CD858588" : "transparent"}`,
                        color: confirmDelExpId === exp.id ? "#CD8585" : "#3a1a1a",
                        borderRadius: 6, padding: "3px 9px",
                        fontSize: 11, fontWeight: confirmDelExpId === exp.id ? 800 : 500,
                        cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
                      }}
                    >{confirmDelExpId === exp.id ? "Удалить?" : "✕"}</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── CLIPBOARD HELPER (works in iframe/artifact) ─────────────────────────────
function copyToClipboard(text) {
  // 1. Modern API
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  }
  // 2. Fallback via textarea + execCommand
  fallbackCopy(text);
  return Promise.resolve();
}
function fallbackCopy(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0";
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try { document.execCommand("copy"); } catch(e) {}
  document.body.removeChild(ta);
}

// ─── HOME VIEW ───────────────────────────────────────────────────────────────
function HomeView({ orders, debts, onNavigate }) {
  const today = new Date();
  today.setHours(0,0,0,0);
  const todayStr = localISODate(today);
  const fmt = n => n % 1 === 0 ? String(n) : n.toFixed(1);

  // ── Today's orders ──────────────────────────────────────────────────────────
  const todayOrders = orders.filter(o => {
    const d = getOrderDate(o);
    return localISODate(d) === todayStr;
  });

  // ── Week KPI ────────────────────────────────────────────────────────────────
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay() + (today.getDay()===0?-6:1));
  const weekOrders = orders.filter(o => {
    const d = getOrderDate(o); d.setHours(0,0,0,0);
    return d >= weekStart && d <= today;
  });
  const weekAmount = weekOrders.reduce((s,o)=>s+(parseFloat(o.amount)||0),0);
  const weekMargin = weekOrders.reduce((s,o)=>s+(parseFloat(o.margin)||0),0);
  const weekDone   = weekOrders.filter(o=>o.status==="done").length;

  // prev week
  const prevWeekStart = new Date(weekStart); prevWeekStart.setDate(prevWeekStart.getDate()-7);
  const prevWeekEnd   = new Date(weekStart); prevWeekEnd.setDate(prevWeekEnd.getDate()-1);
  const prevWeekOrders = orders.filter(o => {
    const d = getOrderDate(o); d.setHours(0,0,0,0);
    return d >= prevWeekStart && d <= prevWeekEnd;
  });
  const prevAmount = prevWeekOrders.reduce((s,o)=>s+(parseFloat(o.amount)||0),0);
  const deltaAmt = prevAmount===0 ? null : Math.round(((weekAmount-prevAmount)/prevAmount)*100);

  // ── Debts ────────────────────────────────────────────────────────────────────
  // Считаем так же, как раздел «Платежи»: начислено вручную − получено
  const totalDebt = (() => {
    const earned = (debts.manualDebts||[]).reduce((s,d)=>s+(parseFloat(d.amount)||0),0);
    const paid   = (debts.payments||[]).reduce((s,p)=>s+(parseFloat(p.amount)||0),0);
    return Math.max(0, earned - paid);
  })();
  const openDebts = (debts.manualDebts||[]);

  // ── Active / new orders ──────────────────────────────────────────────────────
  const activeOrders = orders.filter(o=>o.status==="working"||o.status==="queue");
  const newOrders    = orders.filter(o=>o.status==="new");

  // ── Leads from localStorage ──────────────────────────────────────────────────
  const leads = (() => { try { return JSON.parse(localStorage.getItem("leads_data_v2")||"[]"); } catch { return []; }})();
  const newLeads  = leads.filter(l=>l.status==="new");
  const hotLeads  = leads.filter(l=>l.status==="callback");

  // ── Recent orders (last 5) ───────────────────────────────────────────────────
  const recentOrders = [...orders]
    .sort((a,b)=>getOrderDate(b).getTime()-getOrderDate(a).getTime())
    .slice(0,5);

  const greetHour = new Date().getHours();

  const greetings = {
    night:   ["Доброй ночи", "Тихой ночи", "Ночь — тоже рабочее время"],
    morning: ["Доброе утро", "С добрым утром", "Утро — лучшее время для новых заказов", "Хорошего утра"],
    day:     ["Добрый день", "Продуктивного дня", "В самом разгаре дня", "Хорошего дня"],
    evening: ["Добрый вечер", "Хорошего вечера", "Вечер — время подводить итоги"],
  };

  const motives = [
    "Каждый заказ — это шаг к цели 💪",
    "Сегодня хороший день для рекорда",
    "Работай умнее, а не больше",
    "Команда делает разницу",
    "Клиент доволен — бизнес растёт",
    "Маленькие шаги, большие результаты",
    "Держи темп — ты в правильном направлении",
    "Лучший момент начать — прямо сейчас",
    "Фокус на главном, остальное приложится",
    "Каждый выполненный заказ — это репутация",
  ];

  const timeKey = greetHour >= 0 && greetHour < 6 ? "night"
    : greetHour < 12 ? "morning"
    : greetHour < 18 ? "day"
    : "evening";

  // Stable per-session random (changes on each app open, not on re-render)
  const sessionSeed = Math.floor(Date.now() / 60000); // changes every minute max
  const greetList = greetings[timeKey];
  const greet  = greetList[sessionSeed % greetList.length];
  const motive = motives[sessionSeed % motives.length];

  const weekDayNames = ["Воскресенье","Понедельник","Вторник","Среда","Четверг","Пятница","Суббота"];
  const monthNames = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];

  const statusColors = { new:"#7E9AD6",queue:"#D2A86A",working:"#A98FD0",done:"#79B391",cancelled:"#CD8585" };
  const statusLabels = { new:"Новый",queue:"Очередь",working:"В работе",done:"Выполнен",cancelled:"Отменён" };

  return (
    <div style={{flex:1,overflowY:"auto",WebkitOverflowScrolling:"touch",background:"var(--bg)",paddingBottom:"calc(120px + env(safe-area-inset-bottom))"}}>

      {/* ── HEADER ── */}
      <div style={{padding:"22px 18px 8px",display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12}}>
        <div style={{minWidth:0}}>
          <div style={{fontSize:13,color:"var(--w38)",fontWeight:500,marginBottom:6}}>
            {weekDayNames[new Date().getDay()]}, {new Date().getDate()} {monthNames[new Date().getMonth()]}
          </div>
          <div style={{fontSize:28,fontWeight:800,color:"var(--text)",letterSpacing:"-0.04em",lineHeight:1.1,marginBottom:8}}>
            {greet} 👋
          </div>
          <div style={{
            fontSize:13, color:"var(--w45)", fontWeight:400,
            lineHeight:1.4, fontStyle:"italic",
          }}>
            {motive}
          </div>
        </div>
        <ThemeToggle style={{marginTop:2}}/>
      </div>

      {/* ── WEEK KPI STRIP ── */}
      <div style={{padding:"20px 18px 0"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div style={{fontSize:11,fontWeight:700,color:"var(--w40)",letterSpacing:"0.08em",textTransform:"uppercase"}}>
            Эта неделя
          </div>
          {deltaAmt !== null && (
            <div style={{fontSize:12,fontWeight:600,color:deltaAmt>=0?"#79B391":"#CD8585"}}>
              {deltaAmt>=0?"+":""}{deltaAmt}% к прошлой
            </div>
          )}
        </div>

        {/* KPI row — 4 cards */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {/* Большая карточка — выручка */}
          <div onClick={()=>onNavigate("report")} style={{
            background:"var(--card)",boxShadow:"var(--elev)",borderRadius:18,padding:"18px 20px",
            border:"1px solid var(--w08)",cursor:"pointer",gridRow:"span 2",
            display:"flex",flexDirection:"column",justifyContent:"space-between",minHeight:140,
          }}>
            <div style={{fontSize:11,fontWeight:700,color:"#79B391",letterSpacing:"0.08em",textTransform:"uppercase"}}>Выручка</div>
            <div>
              <div style={{fontSize:42,fontWeight:800,color:"var(--text)",letterSpacing:"-0.05em",lineHeight:1}}>
                {fmt(weekAmount)}
              </div>
              <div style={{fontSize:13,color:"var(--w40)",marginTop:4}}>тонн за неделю</div>
            </div>
          </div>

          {/* Заказов */}
          <div onClick={()=>onNavigate("orders")} style={{
            background:"var(--card)",boxShadow:"var(--elev)",borderRadius:18,padding:"14px 16px",
            border:"1px solid var(--w08)",cursor:"pointer",
          }}>
            <div style={{fontSize:9,fontWeight:700,color:"#A98FD0",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:6}}>Заказов</div>
            <div style={{display:"flex",alignItems:"baseline",gap:6}}>
              <div style={{fontSize:28,fontWeight:800,color:"var(--text)",letterSpacing:"-0.04em"}}>{weekOrders.length}</div>
              {weekDone>0&&<div style={{fontSize:12,color:"#79B391",fontWeight:600}}>✓{weekDone}</div>}
            </div>
          </div>

          {/* Маржа */}
          <div onClick={()=>onNavigate("report")} style={{
            background:"var(--card)",boxShadow:"var(--elev)",borderRadius:18,padding:"14px 16px",
            border:"1px solid var(--w08)",cursor:"pointer",
          }}>
            <div style={{fontSize:9,fontWeight:700,color:"#D2A86A",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:6}}>Маржа</div>
            <div style={{fontSize:28,fontWeight:800,color:"var(--text)",letterSpacing:"-0.04em"}}>{fmt(weekMargin)}<span style={{fontSize:12,fontWeight:500,color:"var(--w40)",marginLeft:2}}>т</span></div>
          </div>
        </div>
      </div>

      {/* ── ALERT STRIP — долги и активные ── */}
      {(totalDebt > 0.01 || activeOrders.length > 0 || newOrders.length > 0) && (
        <div style={{padding:"16px 18px 0",display:"flex",flexDirection:"column",gap:8}}>
          {totalDebt > 0.01 && (
            <div onClick={()=>onNavigate("debts")} style={{
              background:"rgba(205,133,133,0.08)",border:"1px solid rgba(205,133,133,0.25)",
              borderRadius:14,padding:"12px 16px",cursor:"pointer",
              display:"flex",alignItems:"center",justifyContent:"space-between",
            }}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:"#CD8585",flexShrink:0}}/>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:"#CD8585"}}>Незакрытые долги</div>
                  <div style={{fontSize:11,color:"var(--w40)",marginTop:1}}>
                    {openDebts.length} позиц{openDebts.length===1?"ия":openDebts.length<5?"ии":"ий"} · открыть раздел
                  </div>
                </div>
              </div>
              <div style={{fontSize:20,fontWeight:800,color:"#CD8585",letterSpacing:"-0.03em"}}>{fmt(totalDebt)}<span style={{fontSize:11,marginLeft:2,fontWeight:500}}>т</span></div>
            </div>
          )}

          {(activeOrders.length > 0 || newOrders.length > 0) && (
            <div onClick={()=>onNavigate("orders")} style={{
              background:"rgba(126,154,214,0.07)",border:"1px solid rgba(126,154,214,0.2)",
              borderRadius:14,padding:"12px 16px",cursor:"pointer",
              display:"flex",alignItems:"center",justifyContent:"space-between",
            }}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:"#7E9AD6",flexShrink:0}}/>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:"#7E9AD6"}}>
                    {activeOrders.length} в работе{newOrders.length>0?` · ${newOrders.length} новых`:""}
                  </div>
                  <div style={{fontSize:11,color:"var(--w40)",marginTop:1}}>незавершённые заказы</div>
                </div>
              </div>
              <div style={{fontSize:20,fontWeight:800,color:"#7E9AD6",letterSpacing:"-0.03em"}}>{activeOrders.length+newOrders.length}</div>
            </div>
          )}
        </div>
      )}

      {/* ── LEADS BLOCK ── */}
      {(newLeads.length > 0 || hotLeads.length > 0) && (
        <div style={{padding:"16px 18px 0"}}>
          <div style={{fontSize:11,fontWeight:700,color:"var(--w40)",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:10}}>
            Лиды
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {newLeads.length > 0 && (
              <div style={{background:"var(--card)",boxShadow:"var(--elev)",border:"1px solid var(--w08)",borderRadius:18,padding:"16px 18px"}}>
                <div style={{fontSize:9,fontWeight:700,color:"#7E9AD6",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:8}}>Новых</div>
                <div style={{fontSize:36,fontWeight:800,color:"var(--text)",letterSpacing:"-0.04em",lineHeight:1}}>{newLeads.length}</div>
                <div style={{fontSize:11,color:"var(--w40)",marginTop:6}}>ждут обработки</div>
              </div>
            )}
            {hotLeads.length > 0 && (
              <div style={{background:"var(--card)",boxShadow:"var(--elev)",border:"1px solid rgba(210,168,106,0.2)",borderRadius:18,padding:"16px 18px"}}>
                <div style={{fontSize:9,fontWeight:700,color:"#D2A86A",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:8}}>Перезвонить</div>
                <div style={{fontSize:36,fontWeight:800,color:"var(--text)",letterSpacing:"-0.04em",lineHeight:1}}>{hotLeads.length}</div>
                <div style={{fontSize:11,color:"var(--w40)",marginTop:6}}>ждут звонка</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TODAY'S ORDERS ── */}
      <div style={{padding:"20px 18px 0"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div style={{fontSize:11,fontWeight:700,color:"var(--w40)",letterSpacing:"0.08em",textTransform:"uppercase"}}>
            Сегодня
          </div>
          <div style={{fontSize:12,color:"var(--w30)"}}>
            {new Date().getDate()} {monthNames[new Date().getMonth()]}
          </div>
        </div>

        {todayOrders.length === 0 ? (
          <div style={{
            background:"var(--card)",boxShadow:"var(--elev)",border:"1px solid var(--w07)",
            borderRadius:18,padding:"28px 20px",textAlign:"center",
          }}>
            <div style={{fontSize:13,color:"var(--w30)"}}>Заказов на сегодня нет</div>
            <button onClick={()=>onNavigate("form")} style={{
              marginTop:12,background:"var(--text)",color:"var(--ink)",
              border:"none",borderRadius:10,padding:"8px 20px",
              fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
            }}>+ Создать заказ</button>
          </div>
        ) : (
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {todayOrders.map(o => {
              const svc = SERVICES.find(s=>s.id===o.service);
              const st  = getOrderStatus(o.status);
              return (
                <div key={o.id} onClick={()=>onNavigate("orders")} style={{
                  background:"var(--card)",boxShadow:"var(--elev)",border:"1px solid var(--w08)",
                  borderRadius:16,padding:"14px 16px",cursor:"pointer",
                  display:"flex",alignItems:"center",gap:12,
                }}>
                  <div style={{width:4,alignSelf:"stretch",borderRadius:2,background:svc?.color||"#7E9AD6",flexShrink:0}}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:14,fontWeight:700,color:"var(--text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      {o.clientName || "Клиент"}
                    </div>
                    <div style={{fontSize:11,color:"var(--w40)",marginTop:2,display:"flex",gap:8}}>
                      <span>{svc?.label}</span>
                      {o.address && <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:160}}>· {o.address}</span>}
                    </div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4,flexShrink:0}}>
                    <div style={{
                      fontSize:10,fontWeight:700,color:st.color,
                      background:st.color+"18",borderRadius:6,padding:"2px 8px",
                    }}>{st.label}</div>
                    {o.amount && <div style={{fontSize:13,fontWeight:700,color:"var(--w70)"}}>{fmt(parseFloat(o.amount))} т</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── RECENT ORDERS ── */}
      {recentOrders.length > 0 && (
        <div style={{padding:"20px 18px 0"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div style={{fontSize:11,fontWeight:700,color:"var(--w40)",letterSpacing:"0.08em",textTransform:"uppercase"}}>
              Последние заказы
            </div>
            <button onClick={()=>onNavigate("orders")} style={{
              background:"transparent",border:"none",color:"#7E9AD6",
              fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",
            }}>Все →</button>
          </div>

          <div style={{background:"var(--card)",boxShadow:"var(--elev)",border:"1px solid var(--w07)",borderRadius:18,overflow:"hidden"}}>
            {recentOrders.map((o,i) => {
              const svc = SERVICES.find(s=>s.id===o.service);
              const st  = getOrderStatus(o.status);
              const d   = getOrderDate(o);
              return (
                <div key={o.id} onClick={()=>onNavigate("orders")} style={{
                  display:"flex",alignItems:"center",gap:12,
                  padding:"12px 16px",cursor:"pointer",
                  borderBottom: i<recentOrders.length-1 ? "1px solid var(--w06)" : "none",
                }}>
                  <div style={{width:6,height:6,borderRadius:"50%",background:st.color,flexShrink:0}}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:600,color:"var(--w90)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      {o.clientName || "Клиент"} <span style={{color:"var(--w35)",fontWeight:400}}>· {svc?.label}</span>
                    </div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:2,flexShrink:0}}>
                    {o.amount && <div style={{fontSize:12,fontWeight:700,color:"var(--w60)"}}>{fmt(parseFloat(o.amount))} т</div>}
                    {d && <div style={{fontSize:10,color:"var(--w28)"}}>{d.getDate()} {monthNames[d.getMonth()]}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── EMPTY STATE ── */}
      {orders.length === 0 && leads.length === 0 && (
        <div style={{padding:"40px 18px",textAlign:"center"}}>
          <div style={{fontSize:32,marginBottom:12}}>📋</div>
          <div style={{fontSize:15,fontWeight:700,color:"var(--w60)",marginBottom:8}}>Добро пожаловать!</div>
          <div style={{fontSize:13,color:"var(--w35)",marginBottom:20}}>Создайте первый заказ чтобы начать работу</div>
          <button onClick={()=>onNavigate("form")} style={{
            background:"var(--text)",color:"var(--ink)",border:"none",borderRadius:12,
            padding:"12px 28px",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
          }}>+ Новый заказ</button>
        </div>
      )}

      <div style={{height:24}}/>
    </div>
  );
}


// ─── CALENDAR SYNC SETTINGS COMPONENT ───────────────────────────────────────
function CalendarSyncSettings({ auth }) {
  const [enabled, setEnabled] = useState(() => localStorage.getItem("calendar_auto_sync") !== "0");

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    localStorage.setItem("calendar_auto_sync", next ? "1" : "0");
    notifyLocalChanged();
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      <div style={{ fontSize:11, fontWeight:700, color:"var(--w35)", letterSpacing:"0.07em", textTransform:"uppercase" }}>
        Google Calendar — автовыгрузка
      </div>

      {/* Auth status */}
      {auth?.token ? (
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:7, height:7, borderRadius:"50%", background:"#79B391", flexShrink:0 }}/>
          <span style={{ fontSize:12, color:"var(--w45)" }}>
            {auth.user?.email || "Google аккаунт"}
          </span>
        </div>
      ) : (
        <div style={{ fontSize:12, color:"#D2A86A", lineHeight:1.5 }}>
          Войди через Google (кнопка в правом верхнем углу) чтобы активировать выгрузку.
        </div>
      )}

      {/* Toggle — always shown */}
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <div onClick={toggle} style={{
          width:38, height:22, borderRadius:11, cursor:"pointer",
          background: enabled ? "#79B391" : "var(--w12)",
          position:"relative", transition:"background 0.2s", flexShrink:0,
        }}>
          <div style={{
            position:"absolute", top:3,
            left: enabled ? 19 : 3,
            width:16, height:16, borderRadius:"50%",
            background:"var(--text)", transition:"left 0.2s",
            boxShadow:"0 1px 3px rgba(0,0,0,0.35)",
          }}/>
        </div>
        <span style={{ fontSize:12, color: enabled ? "var(--w75)" : "var(--w35)" }}>
          {enabled ? "Включено" : "Выключено"}
        </span>
      </div>

      {/* Calendar ID fields — always visible so user can fill before login */}
      <CalendarIdsField />

      {/* Test button */}
      {auth?.token && <TestCalendarButton auth={auth} />}

      {/* Bulk sync button */}
      {auth?.token && <BulkCalendarSync auth={auth} />}
    </div>
  );
}

// ── Test Calendar Button ──────────────────────────────────────────────────────
function TestCalendarButton({ auth }) {
  const [status, setStatus] = useState(null); // null | "loading" | {ok, msg}

  const run = async () => {
    setStatus("loading");
    const token = auth?.token;
    if (!token) { setStatus({ ok:false, msg:"Нет токена — войди через Google" }); return; }

    // 1. Check token scopes
    try {
      const info = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${token}`);
      const d = await info.json();
      if (!d.scope || !d.scope.includes("calendar")) {
        setStatus({ ok:false, msg:`❌ Нет scope calendar.events.\nТекущие scope: ${d.scope||"—"}\n\nРешение: выйди из Google и войди заново.` });
        return;
      }
    } catch(e) {
      setStatus({ ok:false, msg:"Не удалось проверить токен: " + e.message }); return;
    }

    // 2. Try creating a test event in primary calendar
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate()+1);
    const ds = localISODate(tomorrow);
    try {
      const r = await fetch(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events",
        {
          method:"POST",
          headers:{ Authorization:`Bearer ${token}`, "Content-Type":"application/json" },
          body: JSON.stringify({
            summary: "✅ Тест GVR App",
            start:{ dateTime:`${ds}T10:00:00`, timeZone:"Europe/Moscow" },
            end:{   dateTime:`${ds}T10:30:00`, timeZone:"Europe/Moscow" },
          }),
        }
      );
      const data = await r.json();
      if (r.ok) {
        // Delete the test event immediately
        await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events/${data.id}`,
          { method:"DELETE", headers:{ Authorization:`Bearer ${token}` } }
        );
        setStatus({ ok:true, msg:`✓ Работает! Событие создалось в основном календаре.\n\nЕсли заказы не появляются — убедись что включён тумблер и в заказе указана дата.` });
      } else {
        setStatus({ ok:false, msg:`❌ Ошибка API: ${data?.error?.message || JSON.stringify(data)}` });
      }
    } catch(e) {
      setStatus({ ok:false, msg:"Сетевая ошибка: " + e.message });
    }
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      <button onClick={run} disabled={status==="loading"} style={{
        padding:"9px 14px", background:"rgba(126,154,214,0.12)",
        border:"1.5px solid rgba(126,154,214,0.4)", borderRadius:9,
        color:"#7E9AD6", fontSize:12, fontWeight:700,
        cursor: status==="loading" ? "wait" : "pointer",
        fontFamily:"inherit", textAlign:"left",
      }}>
        {status === "loading" ? "Проверяю..." : "🔍 Тест подключения к Calendar"}
      </button>
      {status && status !== "loading" && (
        <div style={{
          padding:"10px 12px", borderRadius:9,
          background: status.ok ? "rgba(121,179,145,0.08)" : "rgba(205,133,133,0.08)",
          border: `1px solid ${status.ok ? "rgba(121,179,145,0.25)" : "rgba(205,133,133,0.25)"}`,
          fontSize:11, color: status.ok ? "#79B391" : "#CD8585",
          lineHeight:1.6, whiteSpace:"pre-wrap", wordBreak:"break-word",
        }}>{status.msg}</div>
      )}
    </div>
  );
}

// ── Bulk Calendar Sync ───────────────────────────────────────────────────────
function BulkCalendarSync({ auth }) {
  const [status, setStatus] = useState(null); // null | "loading" | {done, failed, total}

  const run = async () => {
    const token = auth?.token;
    if (!token) return;
    setStatus("loading");

    const orders   = JSON.parse(localStorage.getItem("dispatch_orders")  || "[]");
    const leads    = JSON.parse(localStorage.getItem("leads_data_v2")    || "[]");
    const remDone  = JSON.parse(localStorage.getItem("reminders_done")   || "{}");
    const today    = localISODate();

    // Orders with a date (all statuses except cancelled)
    const orderItems = orders.filter(o => o.date && o.status !== "cancelled");
    // Reminders from leads (callDate)
    const leadItems = leads
      .filter(l => l.callDate && l.status !== "done" && l.status !== "lost" && !remDone["lead_"+l.id])
      .map(l => ({ ...l, date: l.callDate, isReminder: true,
        summary: `Перезвонить: ${l.clientName||"Лид"}`,
        clientName: l.clientName, phone: l.phone, service: l.service || "other" }));
    // nextDate items
    const nextItems = orders
      .filter(o => o.nextDate && !remDone["order_"+o.id])
      .map(o => ({ ...o, date: o.nextDate, isReminder: false,
        summary: (o.summary||"Повтор") + " (повтор)" }));
    // reminderDate items
    const remItems = orders
      .filter(o => o.reminderDate && !remDone["reminder_"+o.id])
      .map(o => ({ ...o, date: o.reminderDate, isReminder: true,
        summary: (o.summary||"Заказ") + " (напоминание)" }));

    const allItems = [...orderItems, ...leadItems, ...nextItems, ...remItems];
    let done = 0, failed = 0;

    for (const item of allItems) {
      try {
        await calendarCreateEvent(token, item);
        done++;
        setStatus(`loading_${done}_${allItems.length}`);
        await new Promise(r => setTimeout(r, 200)); // rate limit
      } catch { failed++; }
    }
    setStatus({ done, failed, total: allItems.length });
  };

  const isLoading = typeof status === "string" && status.startsWith("loading");
  const progress  = isLoading && status !== "loading"
    ? status.replace("loading_","").split("_") : null;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      <button onClick={run} disabled={isLoading} style={{
        padding:"10px 14px", borderRadius:9, cursor: isLoading ? "wait" : "pointer",
        background:"rgba(169,143,208,0.1)", border:"1.5px solid rgba(169,143,208,0.35)",
        color:"#A98FD0", fontSize:12, fontWeight:700, fontFamily:"inherit", textAlign:"left",
      }}>
        {isLoading
          ? `Загружаю... ${progress ? `${progress[0]} / ${progress[1]}` : ""}`
          : "📅 Выгрузить все заказы и напоминания в Calendar"}
      </button>
      {status && typeof status === "object" && (
        <div style={{
          padding:"10px 12px", borderRadius:9, fontSize:11, lineHeight:1.6,
          background: status.failed > 0 ? "rgba(210,168,106,0.08)" : "rgba(121,179,145,0.08)",
          border:`1px solid ${status.failed > 0 ? "rgba(210,168,106,0.25)" : "rgba(121,179,145,0.2)"}`,
          color: status.failed > 0 ? "#D2A86A" : "#79B391",
        }}>
          ✓ Готово: {status.done} из {status.total} событий создано
          {status.failed > 0 && ` · ${status.failed} ошибок (возможно уже есть в календаре)`}
          {"\n"}Заказы, повторы и напоминания теперь в Google Calendar.
        </div>
      )}
      <div style={{ fontSize:10, color:"var(--w25)", lineHeight:1.5 }}>
        Выгружает все заказы с датой, даты перезвонов из лидов и напоминания.
        Уже существующие события не дублируются (Google Calendar игнорирует повторы).
      </div>
    </div>
  );
}

// ── Per-service Calendar ID fields ────────────────────────────────────────────
const SVC_CALENDAR_KEYS = [
  { id:"trash",     label:"Вывоз мусора",             color:"#79B391", key:"cal_id_trash" },
  { id:"sawdust",   label:"Опилки россыпью",           color:"#D2A86A", key:"cal_id_sawdust" },
  { id:"offcuts",   label:"Обрезки доски",             color:"#C98E73", key:"cal_id_offcuts" },
  { id:"reminders", label:"Напоминания",               color:"#A98FD0", key:"cal_id_reminders" },
  { id:"default",   label:"Остальные / по умолчанию",  color:"var(--w40)", key:"cal_id_default" },
];

function CalendarIdsField() {
  const [vals, setVals] = useState(() => {
    const out = {};
    SVC_CALENDAR_KEYS.forEach(s => { out[s.key] = localStorage.getItem(s.key) || ""; });
    return out;
  });

  const save = (key, v) => {
    setVals(prev => ({ ...prev, [key]: v }));
    if (v.trim()) localStorage.setItem(key, v.trim());
    else localStorage.removeItem(key);
    notifyLocalChanged();
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
      <div style={{ fontSize:11, color:"var(--w30)", lineHeight:1.5 }}>
        Укажи Calendar ID для каждой услуги. Оставь пустым — используется основной календарь.
        <br/>Найти ID: Google Calendar → календарь → ⋮ → Настройки → «Идентификатор календаря».
      </div>
      {SVC_CALENDAR_KEYS.map(s => {
        const parsed = parseCalendarId(vals[s.key]);
        const isUrl  = vals[s.key] && vals[s.key].startsWith("http");
        return (
        <div key={s.key}>
          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
            <div style={{ width:7, height:7, borderRadius:"50%", background:s.color, flexShrink:0 }}/>
            <span style={{ fontSize:11, fontWeight:600, color:s.color }}>{s.label}</span>
            {vals[s.key] ? <span style={{ fontSize:10, color:"#79B391", marginLeft:"auto" }}>✓</span> : null}
          </div>
          <input
            value={vals[s.key]}
            onChange={e => save(s.key, e.target.value)}
            placeholder="primary  или  abc123@group.calendar.google.com"
            style={{
              width:"100%", background:"var(--card-2)",
              border:`1px solid ${vals[s.key] ? s.color+"55" : "var(--w08)"}`,
              borderRadius:8, color:"var(--w75)", fontSize:11,
              padding:"7px 10px", outline:"none", fontFamily:"inherit", boxSizing:"border-box",
            }}
          />
          {isUrl && parsed !== "primary" && (
            <div style={{ fontSize:10, color:"#79B391", marginTop:3, paddingLeft:2, wordBreak:"break-all" }}>
              → {parsed}
            </div>
          )}
        </div>
        );
      })}
    </div>
  );
}

function DispatchApp({ navIntent, onViewChange }) {
  const [activeService, setActiveService] = useState("trash");
  const [activeView, setActiveView] = useState("home"); // "home" | "form" | "orders" | ...
  // Нижнее меню App может переключить раздел «Заказы» (Главная / Новый заказ)
  useEffect(() => { if (navIntent && navIntent.view) setActiveView(navIntent.view); }, [navIntent]);
  // Сообщаем App текущий экран — для подсветки активной кнопки меню
  useEffect(() => { if (onViewChange) onViewChange(activeView); }, [activeView, onViewChange]);
  const [forms, setForms] = useState({ trash:{}, sawdust:{}, offcuts:{} });
  const [svcSelectedOrder, setSvcSelectedOrder] = useState(null); // заказ, открытый из «По услугам»
  const [prefillBanner, setPrefillBanner] = useState(null);
  const [orders, setOrders] = useState(() => {
    try { return JSON.parse(localStorage.getItem("dispatch_orders") || "[]"); }
    catch { return []; }
  });
  const [debts, setDebts] = useState(() => {
    try {
      const raw = localStorage.getItem("dispatch_debts_v2");
      if (raw) return JSON.parse(raw);
      return { payments: [], manualDebts: [] };
    } catch { return { payments: [], manualDebts: [] }; }
  });
  const [orderSaved, setOrderSaved] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [showParser, setShowParser] = useState(false);
  const [importStatus, setImportStatus] = useState(null);
  const [parseText, setParseText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState("");

  // Сохраняем заказы в localStorage и сообщаем движку синхронизации
  useEffect(() => {
    localStorage.setItem("dispatch_orders", JSON.stringify(orders));
    notifyLocalChanged();
  }, [orders]);

  // Сохраняем долги в localStorage и сообщаем движку синхронизации
  useEffect(() => {
    localStorage.setItem("dispatch_debts_v2", JSON.stringify(debts));
    notifyLocalChanged();
  }, [debts]);

  // ── Подхватываем данные из Лидов при открытии
  useEffect(() => {
    try {
      const raw = localStorage.getItem("dispatch_prefill");
      if (!raw) return;
      const p = JSON.parse(raw);
      localStorage.removeItem("dispatch_prefill");

      // Определяем сервис
      const svcId = p.service && ["trash","sawdust","offcuts"].includes(p.service) ? p.service : "trash";
      setActiveService(svcId);
      setActiveView("form"); // переключиться на форму при переходе из лида
      setForms(prev => ({
        ...prev,
        [svcId]: {
          ...prev[svcId],
          clientName: p.clientName || "",
          phone:      p.phone      || "",
          address:    p.address    || "",
          amount:     p.amount     || "",
          notes:      p.note       || "",
        }
      }));
      setPrefillBanner(p.clientName || p.phone || "лид");
      setTimeout(() => setPrefillBanner(null), 5000);
    } catch(e) {}
  }, []);
  const [copied, setCopied] = useState(false);
  const [calStatus, setCalStatus] = useState(null); // null | loading | ok | err
  const [calMsg, setCalMsg] = useState("");
  const [sheetsUrl, setSheetsUrl] = useState(
    () => localStorage.getItem("dispatch_sheets_url") || ""
  );
  const [sheetsStatus, setSheetsStatus] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  // Автосинхронизация
  const [syncStatus, setSyncStatus] = useState(null); // null | "syncing" | "ok" | "err"
  const syncTimer = useRef(null);

  const auth = useContext(AuthCtx);

  // ── Синхронизация: единый движок SyncEngine в корне приложения ────────────
  const syncCtx = useContext(SyncCtx) || {};
  const driveSyncing  = !!syncCtx.syncing;
  const driveLastSync = syncCtx.lastSync || null;

  // Перечитываем данные после слияния с облаком (изменения с других устройств)
  useEffect(() => {
    const h = () => {
      try { setOrders(JSON.parse(localStorage.getItem("dispatch_orders")   || "[]")); } catch {}
      try { setDebts(JSON.parse(localStorage.getItem("dispatch_debts_v2") || "{}")); } catch {}
      setSheetsUrl(localStorage.getItem("dispatch_sheets_url") || "");
    };
    window.addEventListener(SYNC_MERGED, h);
    return () => window.removeEventListener(SYNC_MERGED, h);
  }, []);

  const f        = forms[activeService] || {};
  const activeSvc = SERVICES.find(s => s.id === activeService) || { label: activeService, color: "#7E9AD6" };
  const setField = useCallback((key, val) => {
    setForms(prev => ({ ...prev, [activeService]: { ...prev[activeService], [key]: val } }));
  }, [activeService]);
  const clearForm = () => setForms(prev => ({ ...prev, [activeService]: {} }));

  const gen = GENERATORS[activeService];
  const message = gen ? gen(f) : "";

  // ── АВТОСИНХРОНИЗАЦИЯ ────────────────────────────────────────────────────
  const showSyncIndicator = (status) => {
    setSyncStatus(status);
    if (syncTimer.current) clearTimeout(syncTimer.current);
    if (status === "ok" || status === "err") {
      syncTimer.current = setTimeout(() => setSyncStatus(null), 3000);
    }
  };

  const autoSyncToSheets = async (order) => {
    const url = localStorage.getItem("dispatch_sheets_url") || sheetsUrl;
    if (!url || url.includes("YOUR_ID")) return; // не настроено — пропускаем тихо
    showSyncIndicator("syncing");
    try {
      const svcData = order.data || {};
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          _type:       order.service,
          _orderId:    order.id,
          status:      order.status,          // used by script for row column
          date:        order.date        || "",
          action:      svcData.action    || "",
          volume:      svcData.volume    || "",
          offcutType:  svcData.offcutType|| "",
          address:     order.address     || "",
          timeSlot:    formatTimeSlot(svcData.hour || ""),
          clientName:  order.clientName  || "",
          phone:       order.phone       || "",
          amount:      order.amount      || "",
          margin:      order.margin      || "",
          company:     svcData.company   || "",
          executor:    order.executor    || svcData.executor || "",
          responsible: svcData.manager   || svcData.managerPhone || "",
          geoLink:     svcData.geoLink   || "",
          note:        svcData.note      || "",
          createdAt:   order.createdAt   || "",
          syncedAt:    new Date().toISOString(),
        }),
        mode: "no-cors",
      });
      showSyncIndicator("ok");
    } catch(e) {
      // Sheets недоступен — не показываем ошибку пользователю
      showSyncIndicator(null);
    }
  };

  const autoSyncToCalendar = async (order) => {
    if (!order.date) return; // нет даты — пропускаем
    const token = auth?.token;
    if (!token) return; // не авторизован — пропускаем тихо
    const calEnabled = localStorage.getItem("calendar_auto_sync") !== "0";
    if (!calEnabled) return;
    try {
      const created = await calendarCreateEvent(token, {
        ...order,
        isReminder: false, // regular order → service calendar
      });
      if (created?.id) {
        // сохраняем calEventId в заказ для возможного удаления
        setOrders(prev => prev.map(o =>
          o.id === order.id ? { ...o, calEventId: created.id, calEventLink: created.htmlLink } : o
        ));
      }
    } catch(e) {
      // тихо — Calendar не критичен
      console.warn("Calendar sync error:", e.message);
    }
  };

  // Обёртка для обновления заказа с автосинхронизацией
  const updateOrderWithSync = async (updatedOrder, prevOrder) => {
    const stamped = { ...updatedOrder, updatedAt: new Date().toISOString() };
    setOrders(prev => prev.map(o => o.id === stamped.id ? stamped : o));
    await autoSyncToSheets(stamped);

    // ── Если появилась (или изменилась) дата повторного заказа —
    //    создаём новый заказ на эту дату и синхронизируем
    const prevNext = prevOrder?.nextDate || "";
    const newNext  = stamped.nextDate || "";
    if (newNext && newNext !== prevNext) {
      const alreadyExists = orders.some(
        o => o.parentId === stamped.id && o.date === newNext
      );
      if (!alreadyExists) {
        const repeatOrder = {
          id:         "ORD-" + Date.now().toString(36).toUpperCase() + "R",
          parentId:   stamped.id,
          createdAt:  newNext + "T12:00:00.000Z",
          updatedAt:  new Date().toISOString(),
          service:    stamped.service,
          status:     "queue",
          clientName: stamped.clientName || "",
          phone:      stamped.phone      || "",
          address:    stamped.address    || "",
          amount:     stamped.amount     || "",
          margin:     stamped.margin     || "",
          date:       newNext,
          hour:       stamped.hour       || "",
          message:    stamped.message    || "",
          summary:    (stamped.summary   || "Заказ") + " (повтор)",
          data:       { ...(stamped.data || {}) },
          isRepeat:   true,
        };
        setOrders(prev => [repeatOrder, ...prev]);
        await autoSyncToSheets(repeatOrder);
        await autoSyncToCalendar(repeatOrder);
      }
    }

    const prevReminder = prevOrder?.reminderDate || "";
    const newReminder  = stamped.reminderDate || "";
    if (newReminder && newReminder !== prevReminder) {
      const token = auth?.token;
      if (token) {
        calendarCreateEvent(token, {
          ...stamped,
          date: newReminder,
          isReminder: true,
          summary: (stamped.summary || "Напоминание"),
        }).catch(() => {});
      }
    }
  };

  // ── ЭКСПОРТ / ИМПОРТ ────────────────────────────────────────────────────
  const handleExport = () => {
    const data = {
      version: 2,
      exportedAt: new Date().toISOString(),
      orders:  JSON.parse(localStorage.getItem("dispatch_orders")  || "[]"),
      debts:   JSON.parse(localStorage.getItem("dispatch_debts_v2")|| "{}"),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    const d    = new Date();
    a.download = `dispatcher_backup_${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        const newOrders = data.orders || [];
        const newDebts  = data.debts  || {};
        if (newOrders.length > 0) {
          localStorage.setItem("dispatch_orders",   JSON.stringify(newOrders));
          setOrders(newOrders);
        }
        if (data.debts) {
          localStorage.setItem("dispatch_debts_v2", JSON.stringify(newDebts));
          setDebts(newDebts);
        }
        // Движок синхронизации выгрузит импортированные данные
        notifyLocalChanged();
        setImportStatus("ok");
        setTimeout(() => setImportStatus(null), 3000);
      } catch(err) {
        setImportStatus("err");
        setTimeout(() => setImportStatus(null), 3000);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleRepeatOrder = (order) => {
    // Copy all fields except date — user picks new date
    const svc = order.service && ["trash","sawdust","offcuts"].includes(order.service) ? order.service : "trash";
    setActiveService(svc);
    setForms(prev => ({
      ...prev,
      [svc]: {
        ...(order.data || {}),
        // Fields from order summary
        clientName:  order.clientName  || "",
        phone:       order.phone       || "",
        address:     order.address     || "",
        amount:      order.amount      || "",
        margin:      order.margin      || "",
        executor:    order.executor    || order.data?.executor || "",
        // Keep service-specific fields from saved data
        action:      order.data?.action     || "",
        volume:      order.data?.volume     || "",
        rental:      order.data?.rental     || "",
        offcutType:  order.data?.offcutType || "",
        company:     order.data?.company    || "",
        manager:     order.data?.manager    || "",
        managerPhone:order.data?.managerPhone || "",
        note:        order.data?.note       || "",
        // Clear date so user picks new one
        date: "",
        hour: order.data?.hour || "day",
      }
    }));
    setActiveView("form");
  };

  const saveOrder = () => {
    if (!message) return;
    // Use the scheduled date from the form as the canonical date for reports/analytics.
    // Fall back to today only when no date is specified.
    const orderDate = f.date || localISODate();
    const order = {
      id: "ORD-" + Date.now().toString(36).toUpperCase(),
      createdAt: orderDate + "T12:00:00.000Z",
      updatedAt: new Date().toISOString(),
      service: activeService,
      status: f.status || "new",
      clientName: f.clientName || "",
      phone: f.phone || "",
      address: f.address || "",
      amount: f.amount || "",
      margin: f.margin || "",
      executor: f.executor || "",
      date: f.date || "",
      hour: f.hour || "",
      message,
      summary: message.split("\n")[0] || "Заказ",
      data: { ...f },
    };
    setOrders(prev => [order, ...prev]);
    clearForm(); // обнуляем поля формы после создания заказа
    setOrderSaved(true);
    // Автосинхронизация при создании заказа
    autoSyncToSheets(order);
    autoSyncToCalendar(order);
    setTimeout(() => {
      setOrderSaved(false);
      setActiveView("orders");
    }, 1500);
  };

  const parseFromChat = () => {
    if (!parseText.trim()) return;
    setParsing(true);
    setParseError("");

    try {
      const text = parseText.trim();
      const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

      // ── Detect service ──────────────────────────────────────────────
      let svc = activeService;
      const t = text.toLowerCase();
      if (/опилк/i.test(t)) svc = "sawdust";
      else if (/обрезк|доск|длинн|коротк/i.test(t)) svc = "offcuts";
      else if (/контейнер|вывоз|мусор|поставить|откатать|заменить/i.test(t)) svc = "trash";

      // ── Action (trash only) ─────────────────────────────────────────
      let action = "";
      const actionM = text.match(/^(Поставить|Откатать|Заменить)/im);
      if (actionM) action = actionM[1];

      // ── Volume ──────────────────────────────────────────────────────
      let volume = "";
      const volM = text.match(/(\d+)\s*м[³3]/i);
      if (volM) volume = volM[1];

      // ── Rental period (trash) ───────────────────────────────────────
      let rental = "";
      if (/под\s*погрузку/i.test(t)) rental = "под погрузку";
      else if (/на\s*сутки/i.test(t)) rental = "на сутки";
      else if (/неполный|не\s*полный/i.test(t)) rental = "на неполный день";
      else if (/2.?3\s*дня|два.?три/i.test(t)) rental = "на 2-3 дня";
      else if (/3.?4\s*дня|три.?четыре/i.test(t)) rental = "на 3-4 дня";
      else if (/на\s*неделю|~\s*на\s*неделю/i.test(t)) rental = "на неделю";
      else if (/на\s*месяц/i.test(t)) rental = "на месяц";

      // ── Offcut type ─────────────────────────────────────────────────
      let offcutType = "";
      if (/длинн/i.test(t)) offcutType = "длинные";
      else if (/коротк/i.test(t)) offcutType = "короткие";

      // ── Date ────────────────────────────────────────────────────────
      let date = "";
      const dateM = text.match(/(?:📆|📅|🗓️?)\s*(?:Дата:\s*)?(?:пн|вт|ср|чт|пт|сб|вс)?\s*(\d{1,2})\.(\d{1,2})\.(\d{4})/i);
      if (dateM) {
        const [, d, m, y] = dateM;
        date = `${y}-${m.padStart(2,"0")}-${d.padStart(2,"0")}`;
      }

      // ── Time/hour ───────────────────────────────────────────────────
      let hour = "";
      if (/в\s*течени[еи]/i.test(t)) {
        hour = "day";
      } else {
        const timeM = text.match(/(?:🕐|⏰|Время[:\s]+)?(?:в\s+)?(\d{1,2})[:\s]?00/i);
        if (timeM) hour = timeM[1];
      }

      // ── Phone ────────────────────────────────────────────────────────
      let phone = "";
      const phoneM = text.match(/\+?[78][\s\-]?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}/);
      if (phoneM) {
        // format it
        const digits = phoneM[0].replace(/\D/g,"");
        let d2 = digits.startsWith("8") ? "7"+digits.slice(1) : digits;
        if (!d2.startsWith("7")) d2 = "7"+d2;
        d2 = d2.slice(0,11);
        const p = d2.slice(1);
        let out = "+7";
        if (p.length>0) out += " ("+p.slice(0,3);
        if (p.length>=3) out += ") "+p.slice(3,6);
        if (p.length>=6) out += "-"+p.slice(6,8);
        if (p.length>=8) out += "-"+p.slice(8,10);
        phone = out;
      }

      // ── Client name — line after phone ──────────────────────────────
      let clientName = "";
      if (phoneM) {
        const phoneIdx = lines.findIndex(l => l.replace(/\D/g,"").length >= 10 && /\d{10,}/.test(l.replace(/\D/g,"")));
        if (phoneIdx >= 0 && phoneIdx + 1 < lines.length) {
          const nextLine = lines[phoneIdx + 1];
          if (!/[\d📆📅🕐📍Бб\/н]/i.test(nextLine) && nextLine.length < 40) {
            clientName = nextLine;
          }
        }
      }

      // ── Amount (Б/н) ─────────────────────────────────────────────────
      let amount = "";
      const amountM = text.match(/[Бб][\.\/]н[:\s]+([\d.,]+)/i) || text.match(/([\d.,]+)\s*тонн/i);
      if (amountM) amount = amountM[1].replace(",",".");

      // ── Company ──────────────────────────────────────────────────────
      let company = "";
      const compM = text.match(/(?:ООО|ИП|ЗАО|ОАО)[^\n]+/i);
      if (compM) company = compM[0].trim();

      // ── Geo link ─────────────────────────────────────────────────────
      let geoLink = "";
      const geoM = text.match(/https?:\/\/[^\s]+/);
      if (geoM) geoLink = geoM[0];

      // ── Executor ─────────────────────────────────────────────────────
      let executor = "";
      const exM = text.match(/Исполнитель[:\s]+([^\n]+)/i);
      if (exM) executor = exM[1].trim();

      // ── Address — find non-service, non-phone, non-date lines ────────
      let address = "";
      const skipPatterns = /^(\+7|8\s*\(|📆|📅|🕐|📍|Б[\.\/]н|ООО|ИП|https?:|\d{2}\.\d{2}\.|Дата:|Время:|Поставить|Откатать|Заменить|Исполнитель|Отв[:\s]|\d+м)/i;
      const serviceWords = /опилок|опилки|обрезки|контейнер|вывоз/i;
      const addrLines = lines.filter(l =>
        l.length > 3 &&
        !skipPatterns.test(l) &&
        !serviceWords.test(l) &&
        !/^[\d.,]+\s*(тонн|т)?$/i.test(l) &&
        !/[\d]{10,}/.test(l.replace(/\D/g,"")) &&
        !l.includes("http") &&
        !/^(пн|вт|ср|чт|пт|сб|вс)[\s,]/i.test(l) &&
        !/в течени/i.test(l)
      );
      if (addrLines.length > 0) {
        // Take lines that look like an address (not the name)
        const addrCandidate = addrLines.filter(l => 
          /[,0-9]|ул\.?|пос\.?|д\.?|кск|г\.|пр\.?|кварт/i.test(l) ||
          addrLines.indexOf(l) === 0
        );
        address = addrCandidate.slice(0,2).join(", ");
        // If no address found but we have addrLines, take first
        if (!address && addrLines.length > 0) address = addrLines[0];
        // Remove client name from address
        if (clientName && address.includes(clientName)) {
          address = address.replace(clientName, "").replace(/^[,\s]+|[,\s]+$/g,"");
        }
      }

      // ── Apply to form ────────────────────────────────────────────────
      setActiveService(svc);
      const updates = {};
      if (action) updates.action = action;
      if (volume) updates.volume = volume;
      if (rental) updates.rental = rental;
      if (offcutType) updates.offcutType = offcutType;
      if (address) updates.address = address;
      if (geoLink) updates.geoLink = geoLink;
      if (date) updates.date = date;
      if (hour !== "") updates.hour = hour;
      if (phone) updates.phone = phone;
      if (clientName) updates.clientName = clientName;
      if (amount) updates.amount = amount;
      if (company) updates.company = company;
      if (executor) updates.executor = executor;

      setForms(prev => ({
        ...prev,
        [svc]: { ...(prev[svc] || {}), ...updates },
      }));

      setShowParser(false);
      setParseText("");
    } catch(e) {
      setParseError("Ошибка парсинга: " + e.message);
    }
    setParsing(false);
  };

    const handleCopy = () => {
    if (!message) return;
    copyToClipboard(message);
    setCopied(true);
    // Автоматически сохраняем как заказ при копировании
    saveOrder();
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCalendar = async () => {
    if (!f.date) { setCalMsg("Укажите дату"); setCalStatus("err"); return; }
    const token = auth?.token;
    if (!token) { setCalMsg("Войдите через Google в Настройках"); setCalStatus("err"); return; }
    setCalStatus("loading"); setCalMsg("Создаю событие...");
    try {
      const orderForCal = { ...f, service: activeService, message };
      const created = await calendarCreateEvent(token, orderForCal);
      setCalStatus("ok");
      setCalMsg(created?.htmlLink ? "Событие создано ✓" : "Создано ✓");
    } catch(e) {
      setCalStatus("err"); setCalMsg(e.message);
    }
    setTimeout(() => setCalStatus(null), 4000);
  };

  const handleSheets = async () => {
    if (!sheetsUrl) { setSheetsStatus("err"); setTimeout(() => setSheetsStatus(null), 3000); return; }
    setSheetsStatus("loading");
    try {
      await fetch(sheetsUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          _type:      activeService,          // "trash" | "sawdust" | "offcuts"
          date:       f.date       || "",     // YYYY-MM-DD
          status:     "Выполнен",             // dispatch forms = confirmed orders
          action:     f.action     || "",     // trash only
          volume:     f.volume     || "",
          offcutType: f.offcutType || "",     // offcuts only
          address:    f.address    || "",
          timeSlot:   formatTimeSlot(f.hour), // "9:00–11:00" or "в течении дня"
          clientName: f.clientName || "",
          phone:      f.phone      || "",
          amount:     f.amount     || "",
          margin:     f.margin     || "",
          company:    f.company    || "",
          executor:   f.executor   || "",
          responsible: f.manager  || f.managerPhone || "",
          geoLink:    f.geoLink    || "",
          note:       f.note       || "",
        }),
        mode: "no-cors",
      });
      setSheetsStatus("ok");
    } catch(e) {
      setSheetsStatus("err");
    }
    setTimeout(() => setSheetsStatus(null), 3000);
  };

  const FormComponent = FORMS[activeService] || null;

  return (
    <div style={{
      height: "100%",
      minHeight: 0,
      overflow: "hidden",
      background: "var(--bg)",
      color: "var(--w85)",
      fontFamily: "'Outfit',-apple-system,sans-serif",
      display: "flex",
      flexDirection: "column",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&display=swap');
        *{box-sizing:border-box;-webkit-font-smoothing:antialiased}
        ::-webkit-scrollbar{display:none}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
        select option{background:var(--card-2)}
        input[type=date]{-webkit-appearance:none;appearance:none;line-height:normal}
        input[type=date]::-webkit-calendar-picker-indicator{filter:invert(0.6);cursor:pointer}
        input[type=number]::-webkit-inner-spin-button{opacity:0.3}
        textarea{resize:none}
      `}</style>

      {/* TOP BAR */}
      <div style={{
        background: "var(--bg)",
        borderBottom: "1px solid var(--w08)",
        padding: "0 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: 50,
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: "var(--card-2)",
            border: "1px solid var(--w15)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}><LogoSvg size={16}/></div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--text)" }}>Заказы</div>
            <div style={{ fontSize: 10, color: "var(--w35)", letterSpacing: "0.06em", fontWeight: 600 }}>ЗАЯВКИ · CALENDAR · SHEETS</div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {auth?.token && (
            <div style={{
              display:"flex", alignItems:"center", gap:4, padding:"3px 8px",
              borderRadius:20, fontSize:10, fontWeight:600,
              background: driveSyncing ? "rgba(126,154,214,0.1)" : driveLastSync ? "rgba(121,179,145,0.1)" : "transparent",
              border: `1px solid ${driveSyncing ? "rgba(126,154,214,0.3)" : driveLastSync ? "rgba(121,179,145,0.25)" : "var(--w08)"}`,
              color: driveSyncing ? "#7E9AD6" : driveLastSync ? "#79B391" : "var(--w30)",
            }}>
              <div style={{ width:5, height:5, borderRadius:"50%", flexShrink:0,
                background: driveSyncing ? "#7E9AD6" : driveLastSync ? "#79B391" : "var(--w20)" }}/>
              {driveSyncing ? "Синхр..." : driveLastSync
                ? `↻ ${driveLastSync.toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"})}`
                : auth.user?.email?.split("@")[0] || "Drive"}
            </div>
          )}
          {syncStatus && (
            <div style={{
              display:"flex",alignItems:"center",gap:5,padding:"4px 10px",borderRadius:20,
              background: syncStatus==="syncing" ? "var(--w06)" : syncStatus==="ok" ? "rgba(121,179,145,0.12)" : "rgba(205,133,133,0.12)",
              border: "1px solid " + (syncStatus==="syncing" ? "var(--w12)" : syncStatus==="ok" ? "rgba(121,179,145,0.3)" : "rgba(205,133,133,0.3)"),
            }}>
              <div style={{
                width:6,height:6,borderRadius:"50%",flexShrink:0,
                background: syncStatus==="syncing" ? "var(--w50)" : syncStatus==="ok" ? "#79B391" : "#CD8585",
                animation: syncStatus==="syncing" ? "pulse 1s infinite" : "none",
              }}/>
              <span style={{
                fontSize:10, fontWeight:600,
                color: syncStatus==="syncing" ? "var(--w50)" : syncStatus==="ok" ? "#79B391" : "#CD8585",
              }}>
                {syncStatus==="syncing" ? "Синхр..." : syncStatus==="ok" ? "Сохранено" : "Ошибка"}
              </span>
            </div>
          )}
          <button
            onClick={() => setShowSettings(!showSettings)}
            style={{
              background: showSettings ? "rgba(126,154,214,0.12)" : "transparent",
              border: "1px solid " + (showSettings ? "rgba(126,154,214,0.6)" : "var(--w10)"),
              color: showSettings ? "#7E9AD6" : "var(--w45)",
              borderRadius: 8, padding: "5px 12px", cursor: "pointer",
              fontSize: 12, fontWeight: 600, fontFamily: "inherit",
            }}
          >Настройки</button>
        </div>
      </div>

      {/* SETTINGS PANEL */}
      {showSettings && (
        <div style={{
          background: "var(--card)", borderBottom: "1px solid var(--w07)",
          padding: "14px 20px 24px", display: "flex", flexDirection: "column", gap: 14,
          maxHeight: "60dvh", overflowY: "auto", WebkitOverflowScrolling: "touch",
          overscrollBehavior: "contain", flexShrink: 0,
        }}>

          {/* Google Calendar auto-sync */}
          <CalendarSyncSettings auth={auth} />

          {/* Google Sheets URL */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--w35)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 8 }}>
              Google Sheets — URL Apps Script
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <input
                type="url"
                placeholder="https://script.google.com/macros/s/YOUR_ID/exec"
                value={sheetsUrl}
                onChange={e => { setSheetsUrl(e.target.value); localStorage.setItem("dispatch_sheets_url", e.target.value); notifyLocalChanged(); }}
                style={{
                  flex: 1, background: "var(--card-2)", border: "1px solid var(--w10)",
                  borderRadius: 9, color: "var(--w85)", fontSize: 12,
                  padding: "8px 12px", outline: "none", fontFamily: "inherit",
                }}
              />
              {sheetsUrl && <span style={{ color: "#79B391", fontSize: 12, alignSelf: "center" }}>✓ Сохранён</span>}
            </div>
          </div>

          {/* Export / Import */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--w35)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 8 }}>
              Резервная копия данных
            </div>
            <div style={{ fontSize: 11, color: "var(--w35)", marginBottom: 10 }}>
              Экспорт сохраняет все заказы и долги в JSON-файл на устройство. Импорт восстанавливает данные из файла.
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>

              {/* Export button */}
              <button onClick={handleExport} style={{
                background: "rgba(121,179,145,0.12)", border: "1.5px solid #79B39155",
                color: "#79B391", borderRadius: 9, padding: "8px 18px",
                fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", gap: 6,
              }}>
                Экспорт данных
              </button>

              {/* Import button */}
              <label style={{
                background: "rgba(126,154,214,0.12)", border: "1.5px solid #2a5aad",
                color: "#7E9AD6", borderRadius: 9, padding: "8px 18px",
                fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", gap: 6,
              }}>
                Импорт данных
                <input type="file" accept=".json" onChange={handleImport} style={{ display: "none" }}/>
              </label>

              {/* Status */}
              {importStatus === "ok" && (
                <span style={{ fontSize: 12, color: "#79B391", fontWeight: 700 }}>✓ Данные восстановлены!</span>
              )}
              {importStatus === "err" && (
                <span style={{ fontSize: 12, color: "#CD8585", fontWeight: 700 }}>✗ Неверный файл</span>
              )}
            </div>
            <div style={{ fontSize: 10, color: "var(--w18)", marginTop: 8 }}>
              Файл сохраняется как <code style={{color:"var(--w45)"}}>dispatcher_backup_ДАТА.json</code> — храни в iCloud или Google Drive.
            </div>
          </div>
        </div>
      )}

      {/* PREFILL BANNER */}
      {prefillBanner && (
        <div style={{
          background:"rgba(121,179,145,0.12)", borderBottom:"1px solid #79B39133",
          padding:"10px 20px", display:"flex", alignItems:"center", gap:10,
          flexShrink:0,
        }}>
          
          <div>
            <span style={{fontSize:13,fontWeight:700,color:"#79B391"}}>Данные из лида подгружены: </span>
            <span style={{fontSize:13,color:"#3F6E52"}}>{prefillBanner}</span>
          </div>
          <button onClick={()=>setPrefillBanner(null)} style={{marginLeft:"auto",background:"transparent",border:"none",color:"#34543F",fontSize:16,cursor:"pointer"}}>✕</button>
        </div>
      )}

      {/* TOP NAV — Новый заказ / Заказы / Отчёт / Аналитика */}
      <div style={{
        display: "flex",
        background: "var(--bg)",
        borderBottom: "1px solid var(--w08)",
        flexShrink: 0,
        overflowX: "auto",
      }}>
        {[
          { id: "home",      icon: "home",    label: "Главная",    color: "var(--text)" },
          { id: "form",      icon: "plus",    label: "Новый заказ",color: "#7E9AD6" },
          { id: "orders",    icon: "package", label: "Заказы",     color: "#A98FD0", badge: orders.length },
          { id: "svcstats",  icon: "chart",   label: "По услугам", color: "#7E9AD6" },
          { id: "debts",     icon: "wallet",  label: "Платежи",    color: "#CD8585" },
          { id: "report",    icon: "chart",   label: "Отчёт",      color: "#79B391" },
          { id: "analytics", icon: "trending",label: "Аналитика",  color: "#D2A86A" },
        ].map(t => {
          const active = activeView === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveView(t.id)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "0 20px", height: 50, cursor: "pointer",
                background: active ? "var(--card-2)" : "transparent",
                border: "none",
                borderBottom: `3px solid ${active ? t.color : "transparent"}`,
                color: active ? t.color : "var(--w45)",
                fontSize: 13, fontWeight: active ? 800 : 600,
                transition: "all 0.15s", fontFamily: "inherit",
                flexShrink: 0, whiteSpace: "nowrap",
              }}
            >
              <IcNav name={t.icon} size={15}/>
              {t.label}
              {t.badge > 0 && (
                <span style={{
                  background: active ? t.color + "33" : "var(--w08)",
                  color: active ? t.color : "var(--w45)",
                  borderRadius: 10, padding: "2px 9px",
                  fontSize: 11, fontWeight: 800,
                }}>{t.badge}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* SERVICE SELECTOR — только в режиме "Новый заказ" */}
      {activeView === "form" && (
        <div style={{
          display: "flex",
          background: "var(--card)",
          borderBottom: "1px solid var(--w07)",
          overflowX: "auto",
          flexShrink: 0,
          padding: "0 6px",
        }}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: "var(--w35)",
            letterSpacing: "0.08em", textTransform: "uppercase",
            display: "flex", alignItems: "center", padding: "0 10px",
            flexShrink: 0,
          }}>Услуга:</div>

          {SERVICES.map(svc => {
            if (svc.add) return (
              <button key="add" style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "0 16px", height: 40, cursor: "pointer",
                background: "transparent", border: "none",
                borderBottom: "2px solid transparent",
                color: "var(--w35)", fontSize: 16, fontWeight: 700,
                flexShrink: 0,
              }} title="Добавить услугу (скоро)">+</button>
            );
            const active = activeService === svc.id;
            return (
              <button
                key={svc.id}
                onClick={() => setActiveService(svc.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 7,
                  padding: "0 16px", height: 40, cursor: "pointer",
                  background: active ? "var(--card-2)" : "transparent",
                  border: "none",
                  borderBottom: `2px solid ${active ? svc.color : "transparent"}`,
                  color: active ? svc.color : "var(--w45)",
                  fontSize: 13, fontWeight: active ? 700 : 500,
                  flexShrink: 0, transition: "all 0.15s",
                  fontFamily: "inherit",
                }}
              >
                {svc.label}
              </button>
            );
          })}
        </div>
      )}

      {/* MAIN CONTENT */}
      {activeView === "home" ? (
        <HomeView orders={orders} debts={debts} onNavigate={setActiveView}/>
      ) : activeView === "orders" ? (
        <OrdersView orders={orders} setOrders={setOrders} onRepeat={handleRepeatOrder} onAutoSync={updateOrderWithSync}/>
      ) : activeView === "svcstats" ? (
        <ServiceStatsView orders={orders} onOpenOrder={setSvcSelectedOrder} />
      ) : activeView === "debts" ? (
        <DebtsView orders={orders} debts={debts} setDebts={setDebts}/>
      ) : activeView === "report" ? (
        <ReportView orders={orders}/>
      ) : activeView === "analytics" ? (
        <AnalyticsView orders={orders}/>
      ) : activeView === "cfg" ? (
        <div style={{ flex:1, overflowY:"auto", WebkitOverflowScrolling:"touch", padding:"20px", paddingBottom:"calc(100px + env(safe-area-inset-bottom))", display:"flex", flexDirection:"column", gap:20 }}>
          <div style={{ fontSize:16, fontWeight:800, color:"var(--text)", marginBottom:4 }}>Настройки</div>

          {/* Google Calendar */}
          <CalendarSyncSettings auth={auth} />

          <div style={{ height:1, background:"var(--w07)" }}/>

          {/* Google Sheets */}
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:"var(--w35)", letterSpacing:"0.07em", textTransform:"uppercase", marginBottom:8 }}>
              Google Sheets — URL Apps Script
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <input
                type="url"
                placeholder="https://script.google.com/macros/s/YOUR_ID/exec"
                value={sheetsUrl}
                onChange={e => { setSheetsUrl(e.target.value); localStorage.setItem("dispatch_sheets_url", e.target.value); notifyLocalChanged(); }}
                style={{
                  flex:1, background:"var(--card-2)", border:"1px solid var(--w10)",
                  borderRadius:9, color:"var(--w85)", fontSize:12,
                  padding:"8px 12px", outline:"none", fontFamily:"inherit",
                }}
              />
              {sheetsUrl && <span style={{ color:"#79B391", fontSize:12, alignSelf:"center" }}>✓</span>}
            </div>
          </div>

          <div style={{ height:1, background:"var(--w07)" }}/>

          {/* Backup */}
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:"var(--w35)", letterSpacing:"0.07em", textTransform:"uppercase", marginBottom:8 }}>
              Резервная копия данных
            </div>
            <div style={{ fontSize:11, color:"var(--w35)", marginBottom:10, lineHeight:1.5 }}>
              Экспорт сохраняет все заказы и долги в JSON-файл. Импорт восстанавливает данные из файла.
            </div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
              <button onClick={handleExport} style={{
                background:"rgba(121,179,145,0.12)", border:"1.5px solid #79B39155",
                color:"#79B391", borderRadius:9, padding:"8px 18px",
                fontSize:12, fontWeight:800, cursor:"pointer", fontFamily:"inherit",
              }}>Экспорт данных</button>
              <label style={{
                background:"rgba(126,154,214,0.12)", border:"1.5px solid #2a5aad",
                color:"#7E9AD6", borderRadius:9, padding:"8px 18px",
                fontSize:12, fontWeight:800, cursor:"pointer", fontFamily:"inherit",
              }}>
                Импорт данных
                <input type="file" accept=".json" onChange={handleImport} style={{ display:"none" }}/>
              </label>
              {importStatus === "ok" && <span style={{ fontSize:12, color:"#79B391", fontWeight:700 }}>✓ Данные восстановлены!</span>}
              {importStatus === "err" && <span style={{ fontSize:12, color:"#CD8585", fontWeight:700 }}>✕ Ошибка импорта</span>}
            </div>
          </div>
        </div>
      ) : (
      <div style={{
        flex: 1,
        display: "grid",
        gridTemplateColumns: showPreview ? "1fr 320px" : "1fr",
        gap: 0,
        minHeight: 0,
        overflow: "hidden",
        position: "relative",
        alignItems: "stretch",
      }}>
        {/* LEFT — FORM */}
        <div style={{
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          padding: "16px 20px",
          paddingBottom: "calc(120px + env(safe-area-inset-bottom))",
          borderRight: showPreview ? "1px solid var(--w07)" : "none",
        }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginBottom: 16,
          }}>
            <div/>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                onClick={() => { setShowParser(p => !p); setParseError(""); }}
                style={{
                  background: showParser ? "var(--card-2)" : "transparent",
                  border: `1px solid ${showParser ? "#4E7A52" : "var(--w10)"}`,
                  color: showParser ? "#79B391" : "var(--w45)",
                  borderRadius: 7, padding: "4px 10px",
                  fontSize: 11, fontWeight: 600, cursor: "pointer",
                  fontFamily: "inherit", whiteSpace: "nowrap",
                  transition: "all 0.15s",
                }}
              >Из чата</button>
              <button
                onClick={() => setShowPreview(p => !p)}
                title={showPreview ? "Скрыть превью" : "Показать превью"}
                style={{
                  background: showPreview ? "rgba(126,154,214,0.12)" : "var(--card)",
                  border: `1px solid ${showPreview ? "rgba(126,154,214,0.6)" : "var(--w10)"}`,
                  color: showPreview ? "#7E9AD6" : "var(--w45)",
                  borderRadius: 7, padding: "4px 10px",
                  fontSize: 11, fontWeight: 600, cursor: "pointer",
                  fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5,
                  transition: "all 0.15s",
                }}
              >
                {showPreview ? "Скрыть" : "Превью"}
              </button>
              <button onClick={clearForm} style={{
                background: "transparent", border: "none",
                color: "var(--w35)", cursor: "pointer", fontSize: 12,
                fontFamily: "inherit", fontWeight: 600,
              }}>✕ Очистить</button>
            </div>
          </div>

          {/* Parser panel */}
          {showParser && (
            <div style={{
              marginBottom: 16,
              background: "rgba(121,179,145,0.08)",
              border: "1.5px solid #4E7A52",
              borderRadius: 12,
              padding: "14px 16px",
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#79B391", marginBottom: 8, display: "flex", alignItems: "center", gap: 7 }}>
                📥 Вставь текст заявки из Google Chat
              </div>
              <textarea
                placeholder={"Вставь сюда текст заявки из Google Chat..."}
                value={parseText}
                onChange={e => setParseText(e.target.value)}
                rows={8}
                style={{
                  width: "100%", background: "var(--card-2)",
                  border: "1px solid var(--w10)", borderRadius: 9,
                  color: "var(--w85)", fontSize: 13, padding: "10px 12px",
                  outline: "none", fontFamily: "inherit",
                  boxSizing: "border-box", resize: "vertical",
                  lineHeight: 1.5,
                }}
              />
              {parseError && (
                <div style={{ fontSize: 11, color: "#CD8585", marginTop: 6 }}>{parseError}</div>
              )}
              <button
                onClick={parseFromChat}
                disabled={!parseText.trim()}
                style={{
                  marginTop: 10, width: "100%", padding: "10px",
                  background: parsing ? "var(--card)" : "rgba(121,179,145,0.12)",
                  border: `1.5px solid ${parsing ? "var(--w08)" : "#79B39188"}`,
                  color: parsing ? "var(--w35)" : "#79B391",
                  borderRadius: 9, fontSize: 13, fontWeight: 800,
                  cursor: (!parseText.trim() || parsing) ? "not-allowed" : "pointer",
                  fontFamily: "inherit", transition: "all 0.15s",
                }}
              >
                "Заполнить из чата"
              </button>
            </div>
          )}

          {FormComponent && <FormComponent f={f} set={setField} />}

          {/* Стадия заказа */}
          {FormComponent && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--w35)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 8 }}>
                Стадия заказа
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {ORDER_STATUSES.map(s => {
                  const active = (f.status || "new") === s.id;
                  return (
                    <button key={s.id} onClick={() => setField("status", s.id)} style={{
                      padding: "6px 13px", borderRadius: 20, flexShrink: 0,
                      border: `1.5px solid ${active ? s.color : "var(--w10)"}`,
                      background: active ? s.color + "1f" : "transparent",
                      color: active ? s.color : "var(--w45)",
                      fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                    }}>{s.label}</button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action buttons inline when preview hidden */}
          {!showPreview && (
            <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                onClick={handleCopy}
                disabled={!message}
                style={{
                  background: message ? "rgba(126,154,214,0.12)" : "var(--card)",
                  border: `1.5px solid ${message ? "rgba(126,154,214,0.6)" : "var(--w08)"}`,
                  color: message ? "#7E9AD6" : "var(--w35)",
                  borderRadius: 10, padding: "12px",
                  cursor: message ? "pointer" : "not-allowed",
                  fontSize: 13, fontWeight: 700,
                  fontFamily: "inherit", transition: "all 0.15s",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                }}
              >
                {copied ? "✓ Скопировано!" : "Копировать в буфер"}
              </button>
              <button
                onClick={saveOrder}
                disabled={!message}
                style={{
                  background: orderSaved ? "rgba(121,179,145,0.12)" : (message ? "rgba(169,143,208,0.12)" : "var(--card)"),
                  border: `1.5px solid ${orderSaved ? "#79B39155" : (message ? "#8b5cf655" : "var(--w08)")}`,
                  color: orderSaved ? "#79B391" : (message ? "#C3B0DD" : "var(--w35)"),
                  borderRadius: 10, padding: "12px",
                  cursor: message ? "pointer" : "not-allowed",
                  fontSize: 13, fontWeight: 700,
                  fontFamily: "inherit", transition: "all 0.2s",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                }}
              >
                {orderSaved ? "✓ Сохранён" : "Сохранить заказ"}
              </button>
            </div>
          )}
        </div>

        {/* RIGHT — PREVIEW */}
        {showPreview && (
        <div style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          minHeight: 0,
          overflow: "hidden",
          padding: "20px 20px calc(16px + env(safe-area-inset-bottom))",
          gap: 10,
          boxSizing: "border-box",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexShrink: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#2a4a70", letterSpacing: "0.07em", textTransform: "uppercase" }}>
              Предпросмотр сообщения
            </div>
            <button
              onClick={() => setShowPreview(false)}
              title="Закрыть превью"
              style={{
                width: 28, height: 28, flexShrink: 0,
                background: "transparent",
                border: "1px solid var(--w12)",
                borderRadius: 8,
                color: "var(--w45)",
                fontSize: 14, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "inherit", lineHeight: 1,
              }}
            >✕</button>
          </div>

          {/* Message bubble — scrollable, does not overflow onto buttons */}
          <div style={{
            background: "var(--card-2)",
            border: "1px solid #1e3a6a",
            borderRadius: 14,
            padding: "16px 18px",
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
            position: "relative",
          }}>
            {message ? (
              <pre style={{
                margin: 0,
                fontFamily: "'Outfit',-apple-system,sans-serif",
                fontSize: 13,
                lineHeight: 1.65,
                color: "var(--w85)",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}>{message}</pre>
            ) : (
              <div style={{ color: "var(--w35)", fontSize: 13, fontStyle: "italic" }}>
                Заполните форму — здесь появится готовое сообщение для Google Chat
              </div>
            )}
          </div>

          {/* Action buttons */}
          <button
            onClick={handleCopy}
            disabled={!message}
            style={{
              background: message ? "rgba(126,154,214,0.12)" : "var(--card)",
              border: `1.5px solid ${message ? "rgba(126,154,214,0.6)" : "var(--w08)"}`,
              color: message ? "#7E9AD6" : "var(--w35)",
              borderRadius: 10, padding: "10px",
              cursor: message ? "pointer" : "not-allowed",
              fontSize: 13, fontWeight: 700,
              fontFamily: "inherit", transition: "all 0.15s",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            }}
          >
            {copied ? "✓ Скопировано + сохранено в «Заказы»" : "Копировать в буфер"}
          </button>

          <button
            onClick={saveOrder}
            disabled={!message}
            style={{
              background: orderSaved ? "rgba(121,179,145,0.12)" : (message ? "rgba(169,143,208,0.12)" : "var(--card)"),
              border: `1.5px solid ${orderSaved ? "#79B39155" : (message ? "#8b5cf655" : "var(--w08)")}`,
              color: orderSaved ? "#79B391" : (message ? "#C3B0DD" : "var(--w35)"),
              borderRadius: 10, padding: "10px",
              cursor: message ? "pointer" : "not-allowed",
              fontSize: 13, fontWeight: 700,
              fontFamily: "inherit", transition: "all 0.2s",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            }}
          >
            {orderSaved ? "✓ Заказ сохранён в «Заказы»" : "Сохранить заказ"}
          </button>

          <button
            onClick={handleCalendar}
            disabled={calStatus === "loading" || !f.date}
            style={{
              background: calStatus === "ok" ? "rgba(121,179,145,0.12)" : calStatus === "err" ? "rgba(205,133,133,0.12)" : "var(--card)",
              border: `1.5px solid ${calStatus === "ok" ? "#79B39155" : calStatus === "err" ? "#CD858555" : "var(--w08)"}`,
              color: calStatus === "ok" ? "#79B391" : calStatus === "err" ? "#CD8585" : (f.date ? "var(--w45)" : "var(--w18)"),
              borderRadius: 10, padding: "10px",
              cursor: f.date && calStatus !== "loading" ? "pointer" : "not-allowed",
              fontSize: 13, fontWeight: 600,
              fontFamily: "inherit", transition: "all 0.2s",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            }}
          >
            {calStatus === "loading" ? "⏳ Создаю событие..." :
             calStatus === "ok" ? "✓ " + calMsg :
             calStatus === "err" ? "✗ " + calMsg :
             "Добавить в Calendar"}
          </button>

          <button
            onClick={handleSheets}
            disabled={sheetsStatus === "loading" || !message}
            style={{
              background: sheetsStatus === "ok" ? "rgba(121,179,145,0.12)" : sheetsStatus === "err" ? "rgba(205,133,133,0.12)" : "var(--card)",
              border: `1.5px solid ${sheetsStatus === "ok" ? "#79B39155" : sheetsStatus === "err" ? "#CD858555" : "var(--w08)"}`,
              color: sheetsStatus === "ok" ? "#79B391" : sheetsStatus === "err" ? "#CD8585" : (message ? "var(--w45)" : "var(--w18)"),
              borderRadius: 10, padding: "10px",
              cursor: message && sheetsStatus !== "loading" ? "pointer" : "not-allowed",
              fontSize: 13, fontWeight: 600,
              fontFamily: "inherit", transition: "all 0.2s",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            }}
          >
            {sheetsStatus === "loading" ? "⏳ Записываю..." :
             sheetsStatus === "ok" ? "✓ Записано в Sheets" :
             sheetsStatus === "err" ? (sheetsUrl ? "✗ Ошибка Sheets" : "⚠ Укажи URL в настройках") :
             "Сохранить в Sheets"}
          </button>

          {/* Date/time summary */}
          {f.date && (
            <div style={{
              background: "var(--card)",boxShadow:"var(--elev)",
              border: "1px solid var(--w07)",
              borderRadius: 10,
              padding: "10px 14px",
              fontSize: 12,
              color: "var(--w45)",
              lineHeight: 1.6,
            }}>
              <div><span style={{ color: "var(--w35)", fontSize:11 }}>📅</span> {formatDate(f.date)}</div>
              <div><span style={{ color: "var(--w45)" }}>🕐</span> {formatTimeSlot(f.hour)}</div>
              {f.address && <div><span style={{ color: "var(--w35)", fontSize:11 }}>📍</span> {f.address.slice(0, 40)}{f.address.length > 40 ? "…" : ""}</div>}
            </div>
          )}
        </div>
        )}
      </div>
      )}

      {svcSelectedOrder && (
        <OrderDetailModal
          order={svcSelectedOrder}
          onClose={() => setSvcSelectedOrder(null)}
          onSave={(updated) => { updateOrderWithSync(updated, svcSelectedOrder); setSvcSelectedOrder(null); }}
        />
      )}
    </div>
  );
}



// ════════════════════════════════════════════════════════════
// ЛИДЫ
// ════════════════════════════════════════════════════════════


// ── Persistence
const LS_LEADS = "leads_data_v2";
const LS_URL   = "leads_sheets_url_v2";

// ── Data
const LEAD_SERVICES = [
  { id:"trash",   label:"Вывоз мусора", icon:"trash_svc", color:"#79B391" },
  { id:"sawdust", label:"Опилки",       icon:"sawdust_svc", color:"#D2A86A" },
  { id:"offcuts", label:"Обрезки доски",icon:"offcuts_svc", color:"#C98E73" },
  { id:"other",   label:"Другое",       icon:"other_svc", color:"var(--w38)" },
];
const SOURCES = [
  { id:"call",   label:"Звонок",     icon:"" },
  { id:"avito",  label:"Avito",      icon:"" },
  { id:"refer",  label:"Рекомендация",icon:"" },
  { id:"web",    label:"Сайт",       icon:"" },
  { id:"repeat",   label:"Повторный",  icon:"" },
  { id:"mailing",  label:"Рассылка",   icon:"" },
];
const STATUSES = [
  { id:"new",      label:"Новый",       color:"#7E9AD6" },
  { id:"callback", label:"Перезвонить", color:"#D2A86A" },
  { id:"working",  label:"В работе",    color:"#A98FD0" },
  { id:"done",     label:"Оформлен",    color:"#79B391" },
  { id:"lost",     label:"Отказ",       color:"#CD8585" },
];
const LOST_REASONS = ["Дорого","Не дозвонился","Передумал","Конкурент","Не тот объём","Другое"];

function mkLead(partial = {}) {
  return {
    id: Date.now().toString(36).toUpperCase(),
    createdAt: new Date().toISOString(),
    status: "new",
    clientName:"", phone:"", service:"", source:"", note:"",
    address:"", amount:"", margin:"", timing:"", callDate:"", lostReason:"",
    savedToSheets: false,
    ...partial,
  };
}
function getSt(id) { return STATUSES.find(s=>s.id===id)||STATUSES[0]; }
function fmtDt(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ru-RU",{day:"2-digit",month:"2-digit",year:"2-digit",hour:"2-digit",minute:"2-digit"});
}

// ── Tiny UI atoms
const css = {
  input: {
    width:"100%", background:"var(--w10)", border:"1px solid var(--w10)",
    borderRadius:12, color:"var(--w85)", fontSize:14, padding:"11px 13px",
    outline:"none", fontFamily:"inherit", boxSizing:"border-box",
  },
  label: {
    fontSize:11, fontWeight:700, color:"var(--w45)",
    letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:6, display:"block",
  },
};

function LInput({ value, onChange, placeholder, type="text", multiline, rows=3 }) {
  const s = { ...css.input };
  const ev = {
    onFocus: e => e.target.style.borderColor="var(--w30)",
    onBlur:  e => e.target.style.borderColor="var(--w10)",
  };
  if (multiline) return <textarea rows={rows} placeholder={placeholder} value={value}
    onChange={e=>onChange(e.target.value)} style={{...s,resize:"vertical"}} {...ev}/>;
  return <input type={type} placeholder={placeholder} value={value}
    onChange={e=>onChange(e.target.value)} style={s} {...ev}/>;
}

function DateHourPicker({ value, onChange }) {
  // value stored as "YYYY-MM-DDTHH:00" or ""
  const date = value ? value.slice(0, 10) : "";
  const hour = value ? value.slice(11, 13) : "";

  const handleDate = d => {
    if (!d) { onChange(""); return; }
    onChange(d + "T" + (hour || "09") + ":00");
  };
  const handleHour = h => {
    if (!date) return;
    onChange(date + "T" + h + ":00");
  };

  const hours = Array.from({length:16}, (_,i) => String(i+7).padStart(2,"0")); // 07–22

  const sel = {
    background:"var(--w10)", border:"1px solid var(--w10)",
    borderRadius:12, color:"var(--w85)", fontSize:14,
    padding:"11px 10px", outline:"none", fontFamily:"inherit",
    cursor:"pointer", width:"100%",
  };

  return (
    <div style={{display:"grid", gridTemplateColumns:"1fr 90px auto", gap:8, alignItems:"center"}}>
      <input type="date" value={date} onChange={e=>handleDate(e.target.value)}
        style={{...sel}}
        onFocus={e=>e.target.style.borderColor="var(--w30)"}
        onBlur={e=>e.target.style.borderColor="var(--w10)"}
      />
      <select value={hour} onChange={e=>handleHour(e.target.value)}
        disabled={!date}
        style={{...sel, opacity: date?1:0.4}}
        onFocus={e=>e.target.style.borderColor="var(--w30)"}
        onBlur={e=>e.target.style.borderColor="var(--w10)"}
      >
        <option value="">—</option>
        {hours.map(h=><option key={h} value={h}>{h}:00</option>)}
      </select>
      <button
        onClick={() => onChange("")}
        disabled={!value}
        style={{
          width:32, height:36, flexShrink:0,
          background:"transparent",
          border:"1px solid var(--w10)",
          borderRadius:8, color: value ? "var(--w50)" : "var(--w15)",
          fontSize:14, cursor: value ? "pointer" : "default",
          display:"flex", alignItems:"center", justifyContent:"center",
          fontFamily:"inherit",
        }}
      >✕</button>
    </div>
  );
}


function Chip({ active, color="#7E9AD6", onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding:"7px 14px", borderRadius:20,
      border: `1.5px solid ${active ? color : "var(--w10)"}`,
      background: active ? color+"22" : "transparent",
      color: active ? color : "var(--w45)",
      fontSize:13, fontWeight: active?700:500,
      cursor:"pointer", fontFamily:"inherit",
      transition:"all 0.15s", whiteSpace:"nowrap",
    }}>{children}</button>
  );
}

function ActionBtn({ onClick, disabled, color="#7E9AD6", children }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background: color+"18", border:`1px solid ${color}44`, color,
      borderRadius:10, padding:"7px 14px", fontSize:12, fontWeight:600,
      cursor: disabled?"not-allowed":"pointer", fontFamily:"inherit",
      opacity: disabled?0.4:1, transition:"all 0.15s",
    }}>{children}</button>
  );
}

// ── New Lead Form (quick entry)
function NewLeadTab({ onSave, sheetsUrl }) {
  const [f, setF] = useState({ clientName:"", phone:"", address:"", service:"", source:"", amount:"", margin:"", timing:"", callDate:"", note:"" });
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const set = (k,v) => setF(p=>({...p,[k]:v}));

  const handleSave = async () => {
    if (!f.phone && !f.clientName) return;
    setSaving(true);
    const lead = mkLead(f);
    onSave(lead);

    if (sheetsUrl) {
      try {
        await fetch(sheetsUrl, {
          method:"POST", headers:{"Content-Type":"application/json"},
          body: JSON.stringify({
            _type:      "lead",
            date:       lead.callDate ? lead.callDate.slice(0,10) : lead.createdAt?.slice(0,10) || "",
            status:     getSt(lead.status).label,
            service:    LEAD_SERVICES.find(s=>s.id===lead.service)?.label || lead.service || "",
            source:     SOURCES.find(s=>s.id===lead.source)?.label || lead.source || "",
            callDate:   lead.callDate ? lead.callDate.slice(0,10) : "",
            clientName: lead.clientName || "",
            phone:      lead.phone      || "",
            address:    lead.address    || "",
            amount:     lead.amount     || "",
            margin:     lead.margin     || "",
            note:       lead.note       || "",
            createdAt:  lead.createdAt?.slice(0,10) || "",
          }),
          mode:"no-cors",
        });
      } catch(e){}
    }

    setF({ clientName:"", phone:"", address:"", service:"", source:"", amount:"", margin:"", timing:"", callDate:"", note:"" });
    setSaving(false);
    setDone(true);
    setTimeout(()=>setDone(false), 2000);
  };

  return (
    <div style={{ flex:1, overflowY:"auto", WebkitOverflowScrolling:"touch", padding:"20px 18px", paddingBottom:"calc(120px + env(safe-area-inset-bottom))" }}>
      <div style={{ marginBottom:22 }}>
        <div style={{ fontSize:22, fontWeight:800, color:"var(--text)", letterSpacing:"-0.03em" }}>Быстрая запись</div>
        <div style={{ fontSize:13, color:"var(--w35)", marginTop:3 }}>Не потеряй контакт — запиши за 10 секунд</div>
      </div>

      {/* Row 1: Телефон + Имя */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
        <div>
          <label style={css.label}>Телефон *</label>
          <LInput placeholder="+7 (999) 123-45-67" type="tel" value={f.phone} onChange={v=>set("phone", formatPhone(v))}/>
        </div>
        <div>
          <label style={css.label}>Имя клиента</label>
          <LInput placeholder="Имя клиента" value={f.clientName} onChange={v=>set("clientName",v)}/>
        </div>
      </div>

      {/* Row 2: Адрес */}
      <div style={{ marginBottom:12 }}>
        <label style={css.label}>Адрес</label>
        <div style={{display:"flex", gap:8, alignItems:"center"}}>
          <LInput placeholder="Адрес объекта" value={f.address} onChange={v=>set("address",v)}/>
          {f.address && (
            <button
              onClick={()=>{
                const addr = encodeURIComponent(f.address);
                const appUrl = `yandexnavi://show_point_on_map?text=${addr}&zoom=14`;
                const webUrl = `https://yandex.ru/navi/?text=${addr}`;
                window.location = appUrl;
                setTimeout(()=>{ window.open(webUrl,"_blank"); }, 1500);
              }}
              title="Открыть в Яндекс Навигаторе"
              style={{
                flexShrink:0, width:38, height:38,
                background:"rgba(126,154,214,0.12)", border:"1.5px solid #2a5aad",
                borderRadius:11, display:"flex", alignItems:"center",
                justifyContent:"center", fontSize:18,
                cursor:"pointer", fontFamily:"inherit",
              }}
            >→</button>
          )}
        </div>
      </div>

      {/* Row 3: Услуга */}
      <div style={{ marginBottom:12 }}>
        <label style={css.label}>Интерес к услуге</label>
        <div style={{ display:"flex", gap:7, flexWrap:"wrap" }}>
          {LEAD_SERVICES.map(s=>(
            <Chip key={s.id} active={f.service===s.id} color={s.color}
              onClick={()=>set("service", f.service===s.id?"":s.id)}>
              {s.label}
            </Chip>
          ))}
        </div>
      </div>

      {/* Row 4: Источник */}
      <div style={{ marginBottom:12 }}>
        <label style={css.label}>Источник</label>
        <div style={{ display:"flex", gap:7, flexWrap:"wrap" }}>
          {SOURCES.map(s=>(
            <Chip key={s.id} active={f.source===s.id} color="#7E9AD6"
              onClick={()=>set("source", f.source===s.id?"":s.id)}>
              {s.label}
            </Chip>
          ))}
        </div>
      </div>

      {/* Row 5: Сумма + Маржа */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
        <div>
          <label style={css.label}>Сумма (тонн)</label>
          <LInput type="number" step="0.1" placeholder="Сумма" value={f.amount} onChange={v=>set("amount",v)}/>
        </div>
        <div>
          <label style={css.label}>Маржа (тонн)</label>
          <LInput type="number" step="0.1" placeholder="Маржа" value={f.margin} onChange={v=>set("margin",v)}/>
        </div>
      </div>

      {/* Row 6: Срок */}
      <div style={{ marginBottom:12 }}>
        <label style={css.label}>Срок — когда планирует</label>
        <div style={{ display:"flex", gap:7, flexWrap:"wrap" }}>
          {[
            ["Сегодня","today"],
            ["Завтра","tomorrow"],
            ["На этой неделе","this_week"],
            ["Следующая неделя","next_week"],
            ["Через 2 недели","two_weeks"],
            ["Через месяц","month"],
            ["Не определился","unknown"],
          ].map(([lbl,val])=>(
            <Chip key={val} active={f.timing===val} color="#7E9AD6"
              onClick={()=>set("timing", f.timing===val?"":val)}>
              {lbl}
            </Chip>
          ))}
        </div>
      </div>

      {/* Row 7: Дата перезвона */}
      <div style={{ marginBottom:12 }}>
        <label style={css.label}>Дата перезвона</label>
        <div style={{display:"flex", gap:8, alignItems:"center"}}>
          <input
            key={f.callDate?"cd1":"cd0"}
            type="date"
            value={f.callDate||""}
            onChange={e=>set("callDate", e.target.value)}
            style={{
              flex:1, background:"var(--w10)", border:"1px solid var(--w10)",
              borderRadius:12, color: f.callDate?"var(--w85)":"var(--w45)",
              fontSize:14, padding:"11px 13px",
              outline:"none", fontFamily:"inherit", boxSizing:"border-box",
              WebkitAppearance:"none", appearance:"none",
            }}
          />
          {f.callDate && (
            <button onClick={()=>set("callDate","")} style={{
              flexShrink:0, padding:"0 14px", height:42,
              background:"rgba(205,133,133,0.12)", border:"1px solid rgba(205,133,133,0.3)",
              borderRadius:12, color:"#CD8585", fontSize:12, fontWeight:700,
              cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap",
            }}>Сброс</button>
          )}
        </div>
      </div>

      {/* Row 8: Заметка */}
      <div style={{ marginBottom:18 }}>
        <label style={css.label}>Заметка</label>
        <LInput multiline rows={2} placeholder="Что хотел, нюансы..."
          value={f.note} onChange={v=>set("note",v)}/>
      </div>

      <button onClick={handleSave} disabled={saving||(!f.phone&&!f.clientName)} style={{
        width:"100%", padding:"13px",
        background: done ? "#79B39122" : "linear-gradient(135deg,#1a4a9e,#0e2d6e)",
        border: `1.5px solid ${done?"#79B39155":"rgba(126,154,214,0.6)"}`,
        color: done?"#79B391":"#7E9AD6",
        borderRadius:12, fontSize:15, fontWeight:800,
        cursor: (saving||(!f.phone&&!f.clientName))?"not-allowed":"pointer",
        fontFamily:"inherit", transition:"all 0.2s",
        opacity: (!f.phone&&!f.clientName)?0.4:1,
      }}>
        {done ? "✓ Лид сохранён!" : saving ? "Сохраняю..." : "Сохранить лид"}
      </button>

      {!sheetsUrl && (
        <div style={{ marginTop:12, fontSize:12, color:"#3a2a10", textAlign:"center" }}>
          Настрой Google Sheets в разделе «Настройки»
        </div>
      )}
    </div>
  );
}

// ── Lead detail expand
function LeadRow({ lead, onUpdate, onDelete, sheetsUrl }) {
  const auth = useContext(AuthCtx);
  const [open, setOpen] = useState(false);
  const [calSt, setCalSt] = useState(null);
  const [sheetSt, setSheetSt] = useState(null);
  const [orderSent, setOrderSent] = useState(false);
  const set = (k,v) => onUpdate({...lead,[k]:v});
  const st = getSt(lead.status);

  const handleMakeOrder = () => {
    localStorage.setItem("dispatch_prefill", JSON.stringify({
      clientName: lead.clientName,
      phone:      lead.phone,
      address:    lead.address,
      amount:     lead.amount,
      service:    lead.service,
      note:       lead.note,
      fromLeadId: lead.id,
    }));
    onUpdate({...lead, status:"working"});
    setOrderSent(true);
    setTimeout(() => setOrderSent(false), 3000);
  };

  const handleSheets = async () => {
    if (!sheetsUrl) return;
    setSheetSt("loading");
    try {
      await fetch(sheetsUrl,{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          _type:       "lead",
          date:        lead.callDate ? lead.callDate.slice(0,10) : lead.createdAt?.slice(0,10) || "",
          status:      getSt(lead.status).label,
          service:     LEAD_SERVICES.find(s=>s.id===lead.service)?.label || lead.service || "",
          source:      SOURCES.find(s=>s.id===lead.source)?.label || lead.source || "",
          callDate:    lead.callDate ? lead.callDate.slice(0,10) : "",
          clientName:  lead.clientName || "",
          phone:       lead.phone      || "",
          address:     lead.address    || "",
          amount:      lead.amount     || "",
          margin:      lead.margin     || "",
          note:        lead.note       || "",
          lostReason:  lead.lostReason || "",
          createdAt:   lead.createdAt?.slice(0,10) || "",
        }),mode:"no-cors",
      });
      onUpdate({...lead,savedToSheets:true});
      setSheetSt("ok");
    } catch { setSheetSt("err"); }
    setTimeout(()=>setSheetSt(null),3000);
  };

  const handleCal = async () => {
    if (!lead.callDate) return;
    const token = auth?.token;
    if (!token) { setCalSt("err"); setTimeout(()=>setCalSt(null),3000); return; }
    setCalSt("loading");
    try {
      await calendarCreateEvent(token, {
        date: lead.callDate.slice(0,10),
        isReminder: true,
        service: lead.service || "",
        clientName: lead.clientName || "",
        phone: lead.phone || "",
        summary: `Перезвонить: ${lead.clientName || lead.phone || "лид"}`,
        message: `Лид #${lead.id}. ${lead.note || ""}`.trim(),
      });
      setCalSt("ok");
    } catch { setCalSt("err"); }
    setTimeout(()=>setCalSt(null),3000);
  };

  return (
    <div style={{
      background:"var(--card)",boxShadow:"var(--elev)",
      border:`1px solid ${open?"var(--w20)":"var(--w04)"}`,
      borderRadius:12, overflow:"hidden", transition:"border-color 0.15s",
    }}>
      {/* Summary */}
      <div onClick={()=>setOpen(!open)} style={{
        display:"flex", alignItems:"center", gap:12,
        padding:"12px 16px", cursor:"pointer", userSelect:"none",
      }}>
        {/* Status dot */}
        <div style={{
          width:8,height:8,borderRadius:"50%",
          background:st.color, flexShrink:0,
        }}/>

        {/* Name */}
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:14,fontWeight:700,color:"var(--w85)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
            {lead.clientName||<span style={{color:"var(--w22)"}}>Без имени</span>}
          </div>
          <div style={{fontSize:11,color:"var(--w35)",marginTop:1}}>{lead.phone||"—"}</div>
        </div>

        {/* Service */}
        {lead.service && (
          <div style={{
            fontSize:11,padding:"3px 9px",borderRadius:6,
            background: (LEAD_SERVICES.find(s=>s.id===lead.service)?.color||"#7E9AD6")+"18",
            color: LEAD_SERVICES.find(s=>s.id===lead.service)?.color||"#7E9AD6",
            fontWeight:600, whiteSpace:"nowrap",
          }}>
            {LEAD_SERVICES.find(s=>s.id===lead.service)?.label}
          </div>
        )}

        {/* Status */}
        <div style={{
          fontSize:11,padding:"3px 9px",borderRadius:6,
          background:st.color+"18",color:st.color,
          fontWeight:700,whiteSpace:"nowrap",
        }}>{st.label}</div>

        {/* Amount + Margin */}
        {(lead.amount||lead.margin) && (
          <div style={{textAlign:"right", flexShrink:0}}>
            {lead.amount && <div style={{fontSize:12,fontWeight:700,color:"#79B391",whiteSpace:"nowrap"}}>{lead.amount} т</div>}
            {lead.margin && <div style={{fontSize:10,color:"#D2A86A",whiteSpace:"nowrap"}}>▲{lead.margin} т</div>}
          </div>
        )}

        {/* Source icon */}
        {lead.source && (
          <div style={{fontSize:14}} title={SOURCES.find(s=>s.id===lead.source)?.label}>
            {SOURCES.find(s=>s.id===lead.source)?.icon}
          </div>
        )}

        {/* Arrow */}
        <div style={{color:"var(--w22)",fontSize:10}}>{open?"▲":"▼"}</div>
      </div>

      {/* Detail */}
      {open && (
        <div style={{borderTop:"1px solid #0f1c2e", padding:"14px 14px 16px"}}>

          {/* Row 1: Телефон + Имя */}
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10}}>
            <div>
              <label style={css.label}>Телефон</label>
              <LInput value={lead.phone} onChange={v=>set("phone", formatPhone(v))} placeholder="+7 (___) ___-__-__"/>
            </div>
            <div>
              <label style={css.label}>Имя</label>
              <LInput value={lead.clientName} onChange={v=>set("clientName",v)} placeholder="Андрей"/>
            </div>
          </div>

          {/* Row 2: Адрес — полная ширина */}
          <div style={{marginBottom:10}}>
            <label style={css.label}>Адрес</label>
            <div style={{display:"flex", gap:8, alignItems:"center"}}>
              <LInput value={lead.address} onChange={v=>set("address",v)} placeholder="Адрес объекта"/>
              {lead.address && (
                <button
                  onClick={()=>{
                    const addr = encodeURIComponent(lead.address);
                    const appUrl = `yandexnavi://show_point_on_map?text=${addr}&zoom=14`;
                    const webUrl = `https://yandex.ru/navi/?text=${addr}`;
                    window.location = appUrl;
                    setTimeout(()=>{ window.open(webUrl,"_blank"); }, 1500);
                  }}
                  title="Открыть в Яндекс Навигаторе"
                  style={{
                    flexShrink:0, width:38, height:38,
                    background:"rgba(126,154,214,0.12)", border:"1.5px solid #2a5aad",
                    borderRadius:11, display:"flex", alignItems:"center",
                    justifyContent:"center", fontSize:18,
                    cursor:"pointer", fontFamily:"inherit",
                  }}
                >→</button>
              )}
            </div>
          </div>

          {/* Row 3: Услуга + Источник */}
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10}}>
            <div>
              <label style={css.label}>Услуга</label>
              <div style={{display:"flex", gap:5, flexWrap:"wrap"}}>
                {LEAD_SERVICES.map(s=>(
                  <Chip key={s.id} active={lead.service===s.id} color={s.color}
                    onClick={()=>set("service", lead.service===s.id?"":s.id)}>
                    {s.label}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <label style={css.label}>Источник</label>
              <div style={{display:"flex", gap:5, flexWrap:"wrap"}}>
                {SOURCES.map(s=>(
                  <Chip key={s.id} active={lead.source===s.id} color="#7E9AD6"
                    onClick={()=>set("source", lead.source===s.id?"":s.id)}>
                    {s.label}
                  </Chip>
                ))}
              </div>
            </div>
          </div>

          {/* Row 4: Статус */}
          <div style={{marginBottom:10}}>
            <label style={css.label}>Статус</label>
            <div style={{display:"flex", gap:6, flexWrap:"wrap"}}>
              {STATUSES.map(s=>(
                <Chip key={s.id} active={lead.status===s.id} color={s.color}
                  onClick={()=>set("status",s.id)}>{s.label}</Chip>
              ))}
            </div>
          </div>

          {/* Row 4b: Причина отказа (только если отказ) */}
          {lead.status==="lost" && (
            <div style={{
              marginBottom:10, padding:"10px 12px",
              background:"rgba(205,133,133,0.08)", border:"1px solid #2a1a1a", borderRadius:12,
            }}>
              <label style={{...css.label, color:"#5a2020"}}>Причина отказа</label>
              <div style={{display:"flex", gap:6, flexWrap:"wrap"}}>
                {LOST_REASONS.map(r=>(
                  <Chip key={r} active={lead.lostReason===r} color="#CD8585"
                    onClick={()=>set("lostReason", lead.lostReason===r?"":r)}>{r}</Chip>
                ))}
              </div>
            </div>
          )}

          {/* Row 5: Сумма + Маржа */}
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10}}>
            <div>
              <label style={css.label}>Сумма (тонн)</label>
              <LInput type="number" step="0.1" value={lead.amount} onChange={v=>set("amount",v)} placeholder="17.5"/>
            </div>
            <div>
              <label style={css.label}>Маржа (тонн)</label>
              <LInput type="number" step="0.1" value={lead.margin||""} onChange={v=>set("margin",v)} placeholder="3.0"/>
            </div>
          </div>

          {/* Row 6: Срок */}
          <div style={{marginBottom:10}}>
            <label style={css.label}>Срок — когда планирует</label>
            <div style={{display:"flex", gap:6, flexWrap:"wrap"}}>
              {[
                ["Сегодня","today"],
                ["Завтра","tomorrow"],
                ["На этой неделе","this_week"],
                ["Следующая неделя","next_week"],
                ["Через 2 недели","two_weeks"],
                ["Через месяц","month"],
                ["Не определился","unknown"],
              ].map(([lbl,val])=>(
                <Chip key={val} active={lead.timing===val} color="#7E9AD6"
                  onClick={()=>set("timing", lead.timing===val?"":val)}>
                  {lbl}
                </Chip>
              ))}
            </div>
          </div>

          {/* Row 7: Дата перезвона — с кнопкой сброса */}
          <div style={{marginBottom:10}}>
            <label style={css.label}>Дата перезвона</label>
            <div style={{display:"flex", gap:8, alignItems:"center"}}>
              <input
                key={lead.callDate?"cd1":"cd0"}
                type="date"
                value={lead.callDate ? lead.callDate.slice(0,10) : ""}
                onChange={e => set("callDate", e.target.value)}
                style={{
                  flex:1, background:"var(--w10)", border:"1px solid var(--w10)",
                  borderRadius:12, color: lead.callDate ? "var(--w85)" : "var(--w35)",
                  fontSize:14, padding:"11px 13px",
                  outline:"none", fontFamily:"inherit", boxSizing:"border-box",
                }}
                onFocus={e=>e.target.style.borderColor="var(--w30)"}
                onBlur={e=>e.target.style.borderColor="var(--w10)"}
              />
              {lead.callDate && (
                <button
                  onClick={() => set("callDate", "")}
                  title="Сбросить дату"
                  style={{
                    flexShrink:0, padding:"0 14px", height:42,
                    background:"rgba(205,133,133,0.12)", border:"1px solid rgba(205,133,133,0.3)",
                    borderRadius:10, color:"#CD8585", fontSize:12, fontWeight:700,
                    cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
                    fontFamily:"inherit", whiteSpace:"nowrap",
                  }}
                >Сброс</button>
              )}
            </div>
          </div>

          {/* Row 8: Заметка — полная ширина */}
          <div style={{marginBottom:14}}>
            <label style={css.label}>Заметка</label>
            <LInput multiline rows={2} value={lead.note} onChange={v=>set("note",v)} placeholder="Нюансы, детали, о чём договорились..."/>
          </div>

          {/* Divider */}
          <div style={{height:1, background:"var(--w06)", marginBottom:12}}/>

          {/* Make Order Banner */}
          {orderSent && (
            <div style={{
              marginBottom:10, padding:"10px 14px",
              background:"rgba(121,179,145,0.12)", border:"1px solid #79B39144",
              borderRadius:12, display:"flex", alignItems:"center", gap:10,
            }}>
              
              <div>
                <div style={{fontSize:13,fontWeight:700,color:"#79B391"}}>Данные переданы в GVR</div>
                <div style={{fontSize:11,color:"#34543F"}}>Статус лида изменён на «В работе». Открой приложение GVR — поля уже заполнены.</div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{display:"flex", gap:8, flexWrap:"wrap", alignItems:"center"}}>
            <button onClick={handleMakeOrder} style={{
              background:"var(--text)",
              border:"none",
              color:"var(--ink)", borderRadius:10, padding:"8px 16px",
              fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
              display:"flex", alignItems:"center", gap:6,
            }}>🚀 Оформить заказ</button>
            <ActionBtn onClick={handleSheets} disabled={!sheetsUrl||sheetSt==="loading"}
              color={lead.savedToSheets?"#79B391":sheetSt==="ok"?"#79B391":sheetSt==="err"?"#CD8585":"#7E9AD6"}>
              {sheetSt==="loading"?"Сохраняю...":sheetSt==="ok"?"✓ В Sheets":sheetSt==="err"?"✗ Ошибка":lead.savedToSheets?"✓ Обновить Sheets":"В Sheets"}
            </ActionBtn>

            {lead.callDate && (
              <ActionBtn onClick={handleCal} disabled={calSt==="loading"}
                color={calSt==="ok"?"#79B391":calSt==="err"?"#CD8585":"#A98FD0"}>
                {calSt==="loading"?"Создаю...":calSt==="ok"?"✓ Готово":calSt==="err"?"✗ Ошибка":"Напоминание"}
              </ActionBtn>
            )}

            {!sheetsUrl && <span style={{fontSize:11,color:"#4a3010"}}>Нет URL Sheets</span>}

            <button onClick={()=>onDelete(lead.id)} style={{
              marginLeft:"auto", background:"transparent",
              border:"1px solid #2a1a1a", color:"#4a2a2a",
              borderRadius:10, padding:"6px 12px",
              fontSize:12, cursor:"pointer", fontFamily:"inherit",
            }}>Удалить</button>
          </div>

          <div style={{fontSize:10, color:"var(--w18)", marginTop:10}}>
            Создан: {fmtDt(lead.createdAt)} · ID: {lead.id}
          </div>
        </div>
      )}
    </div>
  );
}

// ── List Tab
function ListTab({ leads, onUpdate, onDelete, sheetsUrl }) {
  const [filterSt, setFilterSt] = useState("all");
  const [filterSvc, setFilterSvc] = useState("all");
  const [search, setSearch] = useState("");

  const counts = STATUSES.reduce((a,s)=>({...a,[s.id]:leads.filter(l=>l.status===s.id).length}),{});
  const svcCounts = LEAD_SERVICES.reduce((a,s)=>({...a,[s.id]:leads.filter(l=>l.service===s.id).length}),{});

  const filtered = leads.filter(l=>{
    if (filterSt!=="all"&&l.status!==filterSt) return false;
    if (filterSvc!=="all"&&l.service!==filterSvc) return false;
    if (search) {
      const q = search.toLowerCase().trim();
      const nameMatch    = (l.clientName||"").toLowerCase().includes(q);
      const addressMatch = (l.address||"").toLowerCase().includes(q);
      const phoneMatch   = phoneMatches(l.phone, search);
      const noteMatch    = (l.note||"").toLowerCase().includes(q);
      const svc          = LEAD_SERVICES.find(s=>s.id===l.service);
      const svcMatch     = svc ? svc.label.toLowerCase().includes(q) : false;
      const srcMatch     = SOURCES.find(s=>s.id===l.source)?.label?.toLowerCase().includes(q) || false;
      if (!nameMatch && !addressMatch && !phoneMatch && !noteMatch && !svcMatch && !srcMatch) return false;
    }
    return true;
  });

  return (
    <div style={{display:"flex",flexDirection:"column",flex:1,minHeight:0}}>
      {/* Status filter row */}
      <div style={{padding:"10px 16px 8px",display:"flex",gap:6,flexWrap:"wrap",alignItems:"center",borderBottom:"1px solid var(--w07)"}}>
        <span style={{fontSize:10,fontWeight:700,color:"var(--w22)",letterSpacing:"0.07em",textTransform:"uppercase",marginRight:2}}>Статус</span>
        <Chip active={filterSt==="all"} color="#7E9AD6" onClick={()=>setFilterSt("all")}>Все ({leads.length})</Chip>
        {STATUSES.map(s=>counts[s.id]>0&&(
          <Chip key={s.id} active={filterSt===s.id} color={s.color}
            onClick={()=>setFilterSt(filterSt===s.id?"all":s.id)}>
            {s.label} {counts[s.id]}
          </Chip>
        ))}
        <input placeholder="Имя, телефон, адрес..." value={search} onChange={e=>setSearch(e.target.value)}
          style={{marginLeft:"auto",background:"var(--w10)",border:"1px solid #232f45",
            borderRadius:10,color:"var(--w85)",fontSize:12,padding:"6px 12px",
            outline:"none",fontFamily:"inherit",width:170}}/>
      </div>

      {/* Service filter row */}
      <div style={{padding:"8px 18px 10px",display:"flex",gap:6,flexWrap:"wrap",alignItems:"center",borderBottom:"1px solid var(--w05)"}}>
        <span style={{fontSize:10,fontWeight:700,color:"var(--w22)",letterSpacing:"0.07em",textTransform:"uppercase",marginRight:2}}>Услуга</span>
        <Chip active={filterSvc==="all"} color="var(--w38)" onClick={()=>setFilterSvc("all")}>Все</Chip>
        {LEAD_SERVICES.map(s=>(
          <Chip key={s.id} active={filterSvc===s.id} color={s.color}
            onClick={()=>setFilterSvc(filterSvc===s.id?"all":s.id)}>
            {s.label} {svcCounts[s.id]>0?`(${svcCounts[s.id]})` : ""}
          </Chip>
        ))}
      </div>

      <div style={{flex:1,overflowY:"auto",WebkitOverflowScrolling:"touch",padding:"10px 18px",paddingBottom:"calc(120px + env(safe-area-inset-bottom))"}}>
        {filtered.length===0 && (
          <div style={{textAlign:"center",padding:"50px 0",color:"var(--w18)",fontSize:14}}>
            {leads.length===0?"Лидов пока нет — добавь первый во вкладке «Новый лид»":"Ничего не найдено"}
          </div>
        )}
        {filtered.map(l=>(
          <div key={l.id} style={{marginBottom:6}}>
            <LeadRow lead={l} onUpdate={onUpdate} onDelete={onDelete} sheetsUrl={sheetsUrl}/>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Settings Tab
function SettingsTab({ sheetsUrl, setSheetsUrl, onExport, onImport, importStatus }) {
  const SCRIPT = `// Google Apps Script — вставить на script.google.com
// Замените YOUR_SHEET_ID на ID вашей таблицы

const SHEET_ID = "YOUR_SHEET_ID";

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getActiveSheet();

    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["ID","Дата","Статус","Имя","Телефон",
        "Услуга","Источник","Адрес","Сумма","Дата перезвона",
        "Заметка","Причина отказа"]);
    }

    sheet.appendRow([
      data.id, data.createdAt, data.status,
      data.clientName, data.phone, data.service,
      data.source, data.address, data.amount,
      data.callDate, data.note, data.lostReason,
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok:false, error:err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`;

  const [copied, setCopied] = useState(false);

  return (
    <div style={{padding:"20px 18px 80px",paddingBottom:"calc(120px + env(safe-area-inset-bottom))",overflowY:"auto",WebkitOverflowScrolling:"touch",flex:1}}>
      <div style={{fontSize:18,fontWeight:800,color:"var(--text)",marginBottom:4}}>Настройки</div>
      <div style={{fontSize:13,color:"var(--w35)",marginBottom:24}}>Подключение Google Sheets</div>

      {/* Steps */}
      {[
        {n:1,t:"Откройте Apps Script",d:<>Перейдите на <span style={{color:"#7E9AD6"}}>script.google.com</span> → «Новый проект»</>},
        {n:2,t:"Вставьте код",d:"Скопируйте код ниже и замените YOUR_SHEET_ID на ID вашей таблицы (из URL таблицы)"},
        {n:3,t:"Разверните",d:'«Развернуть» → «Новое развёртывание» → тип «Веб-приложение» → доступ «Все»'},
        {n:4,t:"Вставьте URL",d:"Скопируйте URL развёртывания и вставьте в поле ниже"},
      ].map(s=>(
        <div key={s.n} style={{display:"flex",gap:14,marginBottom:18}}>
          <div style={{
            minWidth:28,height:28,borderRadius:"50%",
            background:"rgba(126,154,214,0.12)",color:"#7E9AD6",
            display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:13,fontWeight:800,border:"1px solid #2a5aad",flexShrink:0,
          }}>{s.n}</div>
          <div>
            <div style={{fontWeight:700,fontSize:14,color:"var(--w85)",marginBottom:3}}>{s.t}</div>
            <div style={{fontSize:13,color:"var(--w45)",lineHeight:1.5}}>{s.d}</div>
          </div>
        </div>
      ))}

      {/* Code block */}
      <div style={{position:"relative",marginBottom:20}}>
        <pre style={{
          background:"var(--card)",boxShadow:"var(--elev)",border:"1px solid var(--w07)",borderRadius:12,
          padding:"14px 16px",fontFamily:"'JetBrains Mono',monospace",
          fontSize:11,color:"#9CC9B0",overflowX:"auto",whiteSpace:"pre",
          lineHeight:1.6,maxHeight:260,overflowY:"auto",margin:0,
        }}>{SCRIPT}</pre>
        <button onClick={()=>{copyToClipboard(SCRIPT);setCopied(true);setTimeout(()=>setCopied(false),2000);}}
          style={{
            position:"absolute",top:10,right:10,
            background:"rgba(126,154,214,0.12)",border:"1px solid #2a5aad",
            color:"#7E9AD6",borderRadius:9,padding:"4px 12px",
            fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
          }}>{copied?"✓ Скопировано":"Копировать"}</button>
      </div>

      <div>
        <label style={css.label}>URL Apps Script Web App</label>
        <input type="url" placeholder="https://script.google.com/macros/s/YOUR_ID/exec"
          value={sheetsUrl} onChange={e=>setSheetsUrl(e.target.value)}
          style={{...css.input}}
          onFocus={e=>e.target.style.borderColor="var(--w30)"}
          onBlur={e=>e.target.style.borderColor="var(--w10)"}/>
        {sheetsUrl && (
          <div style={{marginTop:8,display:"flex",alignItems:"center",gap:6}}>
            <div style={{width:7,height:7,borderRadius:"50%",background:"#79B391",}}/>
            <span style={{fontSize:12,color:"#79B391",fontWeight:600}}>URL сохранён и активен</span>
          </div>
        )}
      </div>

      {/* Export / Import */}
      <div style={{marginTop:24}}>
        <div style={{fontSize:11,fontWeight:700,color:"var(--w45)",letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:8}}>
          Резервная копия данных
        </div>
        <div style={{fontSize:11,color:"var(--w35)",marginBottom:10}}>
          Экспорт сохраняет все лиды в JSON-файл. Импорт восстанавливает из файла.
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
          <button onClick={onExport} style={{
            background:"rgba(121,179,145,0.12)", border:"1.5px solid #79B39155",
            color:"#79B391", borderRadius:11, padding:"8px 18px",
            fontSize:12, fontWeight:800, cursor:"pointer", fontFamily:"inherit",
            display:"flex", alignItems:"center", gap:6,
          }}>Экспорт лидов</button>
          <label style={{
            background:"rgba(126,154,214,0.12)", border:"1.5px solid #2a5aad",
            color:"#7E9AD6", borderRadius:11, padding:"8px 18px",
            fontSize:12, fontWeight:800, cursor:"pointer", fontFamily:"inherit",
            display:"flex", alignItems:"center", gap:6,
          }}>
            Импорт лидов
            <input type="file" accept=".json" onChange={onImport} style={{display:"none"}}/>
          </label>
          {importStatus==="ok" && <span style={{fontSize:12,color:"#79B391",fontWeight:700}}>✓ Восстановлено!</span>}
          {importStatus==="err" && <span style={{fontSize:12,color:"#CD8585",fontWeight:700}}>✗ Неверный файл</span>}
        </div>
        <div style={{fontSize:10,color:"var(--w18)",marginTop:8}}>
          Файл сохраняется как <code style={{color:"var(--w45)"}}>leads_backup_ДАТА.json</code>
        </div>
      </div>
    </div>
  );
}

// ── Kanban Pipeline Tab
function PipelineTab({ leads, onUpdate }) {
  const [dragging, setDragging] = useState(null); // lead id
  const [dragOver, setDragOver] = useState(null); // column id

  const handleDrop = (colId) => {
    if (dragging && colId !== dragging.status) {
      onUpdate({ ...dragging, status: colId });
    }
    setDragging(null);
    setDragOver(null);
  };

  return (
    <div style={{
      flex:1,overflowX:"auto",overflowY:"hidden",WebkitOverflowScrolling:"touch",
      display:"flex", gap:0,
      padding:"14px 0",
    }}>
      {STATUSES.map(col => {
        const colLeads = leads.filter(l => l.status === col.id);
        const isOver = dragOver === col.id;

        return (
          <div
            key={col.id}
            onDragOver={e => { e.preventDefault(); setDragOver(col.id); }}
            onDragLeave={() => setDragOver(null)}
            onDrop={() => handleDrop(col.id)}
            style={{
              minWidth: 220, maxWidth: 240, flex:"0 0 220px",
              margin:"0 8px",
              display:"flex", flexDirection:"column",
              background: isOver ? col.color+"0e" : "transparent",
              borderRadius:12,
              border: `1.5px solid ${isOver ? col.color+"55" : "var(--w06)"}`,
              transition:"all 0.15s",
            }}
          >
            {/* Column header */}
            <div style={{
              padding:"12px 14px 10px",
              borderBottom:`1px solid ${col.color}22`,
              display:"flex", alignItems:"center", justifyContent:"space-between",
              flexShrink:0,
            }}>
              <div style={{display:"flex", alignItems:"center", gap:8}}>
                <div style={{
                  width:10, height:10, borderRadius:"50%",
                  background: col.color,
                }}/>
                <span style={{fontSize:13, fontWeight:800, color:col.color}}>{col.label}</span>
              </div>
              <span style={{
                background:col.color+"22", color:col.color,
                borderRadius:10, padding:"2px 8px",
                fontSize:11, fontWeight:700,
              }}>{colLeads.length}</span>
            </div>

            {/* Cards */}
            <div style={{
              flex:1,overflowY:"auto",WebkitOverflowScrolling:"touch",padding:"10px 10px 60px",paddingBottom:"calc(120px + env(safe-area-inset-bottom))",
              display:"flex", flexDirection:"column", gap:7,
            }}>
              {colLeads.length === 0 && (
                <div style={{
                  textAlign:"center", padding:"30px 0",
                  color: isOver ? col.color+"88" : "var(--w06)",
                  fontSize:12,
                  border:`2px dashed ${isOver ? col.color+"44" : "var(--w06)"}`,
                  borderRadius:12, transition:"all 0.15s",
                }}>
                  {isOver ? "Сюда" : "—"}
                </div>
              )}

              {colLeads.map(lead => {
                const svc = LEAD_SERVICES.find(s=>s.id===lead.service);
                const src = SOURCES.find(s=>s.id===lead.source);
                return (
                  <div
                    key={lead.id}
                    draggable
                    onDragStart={() => setDragging(lead)}
                    onDragEnd={() => { setDragging(null); setDragOver(null); }}
                    style={{
                      background: dragging?.id===lead.id ? "#1a2a44" : "var(--card)",
                      border:"1px solid var(--w07)",
                      borderRadius:12, padding:"11px 12px",
                      cursor:"grab", userSelect:"none",
                      opacity: dragging?.id===lead.id ? 0.5 : 1,
                      transition:"opacity 0.15s, transform 0.1s",
                      transform: dragging?.id===lead.id ? "rotate(2deg) scale(0.97)" : "none",
                    }}
                  >
                    {/* Name */}
                    <div style={{fontSize:13,fontWeight:700,color:"var(--w85)",marginBottom:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      {lead.clientName || <span style={{color:"var(--w22)"}}>Без имени</span>}
                    </div>

                    {/* Phone */}
                    <div style={{fontSize:11,color:"#2a4a6a",marginBottom:8}}>{lead.phone||"—"}</div>

                    {/* Tags row */}
                    <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:6}}>
                      {svc && (
                        <span style={{
                          fontSize:10,padding:"2px 7px",borderRadius:5,
                          background:svc.color+"18",color:svc.color,fontWeight:600,
                        }}>{svc.label}</span>
                      )}
                      {src && (
                        <span style={{
                          fontSize:10,padding:"2px 7px",borderRadius:5,
                          background:"var(--w18)",color:"#3a5a80",fontWeight:600,
                        }}>{src.label}</span>
                      )}
                      {lead.amount && (
                        <span style={{fontSize:10,padding:"2px 7px",borderRadius:5,background:"#0f1e30",color:"#3a6080"}}>{lead.amount}т</span>
                      )}
                    </div>

                    {/* Note preview */}
                    {lead.note && (
                      <div style={{fontSize:11,color:"#2a3a55",lineHeight:1.4,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>
                        {lead.note}
                      </div>
                    )}

                    {/* Quick status buttons at bottom */}
                    <div style={{display:"flex",gap:4,marginTop:9,flexWrap:"wrap"}}>
                      {STATUSES.filter(s=>s.id!==col.id).map(s=>(
                        <button
                          key={s.id}
                          onClick={e=>{e.stopPropagation();onUpdate({...lead,status:s.id});}}
                          title={`→ ${s.label}`}
                          style={{
                            background:"transparent",border:`1px solid ${s.color}33`,
                            color:s.color+"99",borderRadius:5,padding:"2px 7px",
                            fontSize:10,cursor:"pointer",fontFamily:"inherit",
                            transition:"all 0.12s",
                          }}
                          onMouseOver={e=>{e.currentTarget.style.background=s.color+"22";e.currentTarget.style.color=s.color;}}
                          onMouseOut={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=s.color+"99";}}
                        >→ {s.label}</button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── ROOT APP
function LeadsApp() {
  const auth = useContext(AuthCtx);
  const syncCtx = useContext(SyncCtx) || {};
  const syncing  = !!syncCtx.syncing;
  const lastSync = syncCtx.lastSync || null;
  const [tab, setTab] = useState("new");
  const [importLeadsStatus, setImportLeadsStatus] = useState(null);
  const [sheetsUrl, setSheetsUrl] = useState(()=>localStorage.getItem(LS_URL)||"");
  const [leads, setLeadsState] = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_LEADS)||"[]"); } catch { return []; }
  });

  // Любое изменение лидов: localStorage + сигнал движку синхронизации
  const setLeads = (updater) => {
    setLeadsState(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      localStorage.setItem(LS_LEADS, JSON.stringify(next));
      notifyLocalChanged();
      return next;
    });
  };

  // Перечитываем лиды после слияния с облаком (изменения с других устройств)
  useEffect(() => {
    const h = () => { try { setLeadsState(JSON.parse(localStorage.getItem(LS_LEADS)||"[]")); } catch {} };
    window.addEventListener(SYNC_MERGED, h);
    return () => window.removeEventListener(SYNC_MERGED, h);
  }, []);

  useEffect(()=>{ localStorage.setItem(LS_URL,sheetsUrl); notifyLocalChanged(); },[sheetsUrl]);

  const addLead   = l  => setLeads(p=>[l,...p]);
  const updateLead= u  => setLeads(p=>p.map(l=>l.id===u.id?{...u, updatedAt:new Date().toISOString()}:l));
  const deleteLead= id => { addTombstone(id); setLeads(p=>p.filter(l=>l.id!==id)); };

  const newCount = leads.filter(l=>l.status==="new").length;
  const cbCount  = leads.filter(l=>l.status==="callback").length;

  const handleLeadsExport = () => {
    const data = { version:1, exportedAt: new Date().toISOString(), leads };
    const blob = new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    const d    = new Date();
    a.download = `leads_backup_${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}.json`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const handleLeadsImport = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        const imported = data.leads || (Array.isArray(data) ? data : null);
        if (!imported) throw new Error("bad format");
        setLeads(imported);
        setImportLeadsStatus("ok");
        setTimeout(()=>setImportLeadsStatus(null), 3000);
      } catch { setImportLeadsStatus("err"); setTimeout(()=>setImportLeadsStatus(null),3000); }
    };
    reader.readAsText(file);
    e.target.value="";
  };

  const TABS = [
    { id:"new",      icon:"+", label:"Новый лид" },
    { id:"pipeline", icon:"pipe", label:"Воронка",  badge: leads.length||null },
    { id:"list",     icon:"list", label:"Список" },
    { id:"settings", icon:"cfg", label:"Настройки" },
  ];

  return (
    <div style={{
      height:"100%", minHeight:0, background:"var(--bg)",
      color:"var(--w85)", fontFamily:"'Outfit',-apple-system,sans-serif",
      display:"flex", flexDirection:"column", overflow:"hidden",
    }}>
      <style>{`*{box-sizing:border-box;-webkit-tap-highlight-color:transparent;-webkit-overflow-scrolling:touch}::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:var(--bg)}::-webkit-scrollbar-thumb{background:var(--card-2);border-radius:4px}select option{background:var(--card-2)}input[type=date]::-webkit-calendar-picker-indicator{filter:invert(0.5)}body{overscroll-behavior:none}`}</style>

      {/* HEADER */}
      <div style={{
        background:"var(--bg)", borderBottom:"1px solid var(--w08)",
        padding:"12px 16px 0",
      }}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{
              width:30,height:30,borderRadius:8,
              background:"var(--card-2)",
              border:"1px solid var(--w15)",
              display:"flex",alignItems:"center",justifyContent:"center",
            }}><IcTab name="leads" size={16}/></div>
            <div>
              <div style={{fontSize:14,fontWeight:800,color:"var(--text)",letterSpacing:"-0.02em"}}>Лиды</div>
              <div style={{fontSize:10,color:"var(--w35)",fontWeight:600,letterSpacing:"0.06em",textTransform:"uppercase"}}>
                {leads.length} контакт{leads.length===1?"":leads.length<5&&leads.length>1?"а":"ов"} сохранено
              </div>
            </div>
          </div>

          {/* Mini stats + sync */}
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            {newCount>0&&<div style={{background:"#3b82f618",border:"1px solid #3b82f644",color:"#7E9AD6",borderRadius:10,padding:"4px 10px",fontSize:11,fontWeight:700}}>● {newCount} новых</div>}
            {cbCount>0&&<div style={{background:"#f59e0b18",border:"1px solid #f59e0b44",color:"#D2A86A",borderRadius:10,padding:"4px 10px",fontSize:11,fontWeight:700}}>{cbCount} перезвонить</div>}
            {auth && <SyncBadge syncing={syncing} lastSync={lastSync} user={auth.user} onSignOut={auth.signOut}/>}
          </div>
        </div>

        {/* Tabs */}
        <div style={{display:"flex",gap:0}}>
          {TABS.map(t=>{
            const active = tab===t.id;
            return (
              <button key={t.id} onClick={()=>setTab(t.id)} style={{
                display:"flex",alignItems:"center",gap:6,
                padding:"9px 16px",
                background:"transparent",border:"none",
                borderBottom:`2px solid ${active?"var(--text)":"transparent"}`,
                color:active?"var(--text)":"var(--w40)",
                fontSize:13,fontWeight:active?700:500,
                cursor:"pointer",fontFamily:"inherit",
                transition:"all 0.15s",position:"relative",
              }}>
                {t.label}
                {t.badge&&<span style={{
                  background:"var(--w10)",color:"#7E9AD6",
                  borderRadius:12,padding:"1px 7px",fontSize:10,fontWeight:800,
                }}>{t.badge}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* CONTENT */}
      <div style={{flex:1,display:"flex",flexDirection:"column",minHeight:0,overflow:"hidden"}}>
        {tab==="new"      && <NewLeadTab  onSave={addLead} sheetsUrl={sheetsUrl}/>}
        {tab==="pipeline" && <PipelineTab leads={leads} onUpdate={updateLead}/>}
        {tab==="list"     && <ListTab leads={leads} onUpdate={updateLead} onDelete={deleteLead} sheetsUrl={sheetsUrl}/>}
        {tab==="settings" && <SettingsTab sheetsUrl={sheetsUrl} setSheetsUrl={setSheetsUrl} onExport={handleLeadsExport} onImport={handleLeadsImport} importStatus={importLeadsStatus}/>}
      </div>
    </div>
  );
}


// ─── GVR LOGO (base64 embedded) ──────────────────────────────────────────────
const GVR_LOGO = "data:image/png;base64,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7k3T9Hq988//7Jln/tPy5cubUCjGF6mqasOGDc94xjOuv/76/88n33feeecVV1xx4YUXPvjgg0uXLm2aJnJI9Kmo63rdunVf/epXDzvssK5Oc0iAwd1zzM5CuwxaF7fUHILpZopC3DStCZ41CKq4qte/LDtnBmNJlt8bOEa6KMb0T2E1/+9PfOJd73zniuXLA3kg40ZzXfHq1WuWLVt28sknn/jqE3d7/G4Up31Os43nftu24UkIF3p68/S3v/Pt884778Ybb5ycmOz3w8Zj3JeYeHxs7JFVq444/IgvfvGLda9GH4+i7YGCbSQ+FD4zOyyKvpw8LOEfLbVMvGHDhkMPO+y++/46PjYe6+MO6O71e2tWr7nkkkuOOeaYubm5bo+UHDN7LMwNsxLrug4X7d57733v+973rauuWrRoEY7HO5C0qtavW7vffs/+zne+w2bihxy9ZJGeDwIFJ3T+JM/EnG4yjbUZN23L5Ms7y5jjjPCZV8+FUSWXbAJNMmw8XJth0+v3rr766te85tVTUwsUD02yPKG6rmfnZqenp1/6kpe84x3vfNKTnkREw8GQmHKOTryGjkjKIm3btL1ejyuemZn5zGc+c84558zMzC5cuLAZDkO70729iiviutd74IEHXvf3r/voxz46GAx6dU2jE1ucZXIxIjJnjdpjDM5amKQGXsqnP/3pd7z97UuXLUvVc4ej1fXmTZsOOuigr3zlK6g1zlxQmN1OGDcVyUwGtWZglrZtmmZsbIyI3vGOd376059aumxpM2xhDC9C3KuqTZs3f/WrXz3kkEMGg2GvV2ldQTDxHsHiKtarBV8OQPEcyBgWdP0v73u/881npAFbQhmKZFQB4EPefGR81nAYcnfYm++4444TTjhBROqqNtPyiomo1+tt3rx5anLqo+f857vf855ly5YNBgMiqqs694uP1mx2BhmRn7quwgk+1u8/e//9Dz/88N/f/Ps777xzanKylQYLhQCMLFiw4L//+8crd1259957N82QuSIqB8l1yDRlAj7rzOn86ou+ysyMhuVVXa1eveaMM86YGwxyr3gmmp2b/djHzl25cmWbeEg2253ROiyCmDreY2+XyHaEVNVV27TSypFHHnH//ff/+je/mZg/vw3HWoTXq6qamZlp2uaYY46Rtu2wP/v85luvd79mmx7I4BoVx0zKPWVwE49D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fYipi0u0lcDK+MEPfvCLn/9815Urd9lll6qqmuGwjbognKnmdXz3bLbStE3SXNxwww2nn376l7982YKpBVVdt22bjsk2NsPD4fCuu+868cQT582f10qLs4DkhtQ07ZOf/ORf/fJXd9199/j4uKS1TyTSjo/PW7XqkeFweP111916663z5s3rMuDiu6vrejgYnnPOObvvvjuAG5w71GRolzPQ1HvCKWiLnZEF6R5EVHE1HA6f9KQnPeUpT/nOd74TYoEiUqnBzK20k5NTN9/8+xt/c+NRRx01f/78tmm5YsjzVJWTtXi1ylKrbiZgSrHt6hkWk+E/dvujjd/GAU3bNlh6qvaJyUrtDckVmHv2amMGsibPSgbOMCFNSnjYDPv9/uc+97mzzjorMPTRXKtLjaiqXq+3ccMGrqqjjz769NNP33fffZOQs3MRqLALROCOawhr+8lPfnLxxRdfffXVg8FganJyqPzppDGTqqqCGvHSS79w+BFHYB4wobKPqG3aXr/385//7LjjXtbvjzXNMAVah2tbVdXc3BxXVb/XU2BbQspOvWHDhkMPPfSrX/2qtJLcv30MkssJd1oYjcXANyimghVC3xWU+gQi63XXXf/a154SpuVhRqgCPhIS6vd7jz66+tBDDw0getM0HA0VCp4tlq7ow+/w/fgPk/0Rxzn28zpfQKaQ9R09NVyKNaTB5pxXDHECAhNaezG2zYzRJzjai/7UHPymzvnP//y//tf/CiHpaPCTeGRVxW3Trl+3bnJy8pBDDjn6mGP233//lStXbtUzRUTuueeen/70p1/72td+8t//PWiGixYuYuZOOKOHYLDCqEO020UXXXTUUUdrJaBODuz8fOu6/vu///vLL7986dIlw2FDJB0NI+wtFav9awSyAmNk44YNV37jyoMPOaQZDquq9qJJ8pZwJrkGUx6AkJ40GaiKwGAqtAcg5mY47Pf711x77amvfW3gwXapLgCZMdHY2NiaNWsOOujgiy++eOGihSrzjvGsxvQjJmHAWIXFuVdBlhh1/tyQwwRZ4VHfJbh74vHQVSY6X/Xp6oZnDRFgZrMoJMi5DEwyLEFzS+K7T7YBoa794H/8xwf//d+XLl2ajGAQ7wm3o1f3SGTT5s1hCrDHHnvstddeT3jCE3bcccfly5fPmzevrutmONy4adOqR1fdf9/9//M/t/7u9zffcfvta9asqapqcmKCmINDHPqNhmqh1+sNZudmZmfPP+/841523NzcXFQZIe8vHZ0kxCH36ZZbbj3iiMMDDTrNbIB/yGDtLkLSq3tr16752+f/7WVf/nIzHHLn2ClukwYthZjXAVe0PEdd0BTOBmYbjnK8X2Gfvubaa197yilVXfV7fen8aQQjgvu93iOrVj33wOd+8UtfXLRoUXjUVcCR+8hZySAYt1nSvFhivSHnd1/NZZDD7I+cIE9kZotxrfR2BbpbgLtFAqf17EuZXNnKdh+vA9ejgUuv1/v0pz/9vve9P3CTu6x2TuFf0Tk/lhCDwXB2dmYwGBK14+Pz5s0bD1r7pmnnBnNzs3Nt04Tc2Hnj471+P+AbIujPoShsr643bdo8OTnxyU986oVHvXAwHGBiCHDQybnSNMOm1++9453v/OQnPrFixYqgQCFk1lgbobCpz83Nfetb39pnn31SNiuGoDkSiC82WA3vjXVE6QB3pzdaT6WNIqzp7373u6eddloQ4MSLn6zIqZW23+uvXr36kEMOufTSSxcsWNA0TRW1RcYIjpElZrbXBDqJ2ARAcOEyzyeDWxKcTrhWO/uOpmmYTB4YF2KlSo84Fmfkw9kzeblGiKV8SDLxgXqVpZW6V1911VX/dOaZ69auXbRokaYqZSzbsEwqFZBK0zZdV8YUNZ8BFW6DpSGC8wJpREENuurRVXs8eY/zzjt/772fNgiqmY6ZYFLSdbYMimBmfvihh454/vPXrllTV3XIKnCtQ6xcparrNWvW/t0rXnH++ed3+5xIrj/nTDwtuE3Ye6wWLlCQIOkTicc2OqX7h9DMXH/99aeeemrgkQanEbZzt7GxsTVr1z73wAMvueSScIM6PzuwmHGhkpgyb+RW6uRd0Br6Ab5jQ0OaQthVKwf/MZjfCjBK2XAnmMgHp7FPVrE28WD8RBltT3SuLsRcVdVwMHzRi150zdVXP/vZz3744YcD87gYFB22gLZth81wMBw0zVCDNYiDTfdw2AybYdsFKEhm8kZM3O/3m6ZZ9egjL37Rsd/5znf23vtpg8GgF+Z5nKb+aoXBaHgQn7S2abfbfvvXv+51mzZtiiNl8bZg8bBqm3ZqavItb3kzeVG+UmI05lBM/I1VaTAKhfA5E/V+VwcDQVjWIcEsda8OvLzPfe5zIjQYDGvrvBheeW4wt3jRoh/+8AfHH3/82rVre71eyClNuotUhIjj6PoqQK+q0RODOQmk2DufZhPmFT5a5XSIVnDAWnAzAvfG7teNNIFeICBVpyIVEL28lCjEVPfq4WD4pCc96Rvf+Mb73v++fr+/Zs0a4iqJ8o2VCbG700DITR45aBVjWIvhNVetWrVo4cKPf/x/X/qFL4TYViVYgleRjecFkk3If6urtm1f85rXPPGJT9y4YQO75gLcXqq6Wrdu3QnHn7DHHk8ZDocVY5y9BWZzrx3yVhWZrSZ4mIABCBurbuwTjXQ6zMYPP/zwiy++iCseDge9YHbK6s3MRIPBYPny5T//+c9f/epXr169OqxpoMognV7AJMMZf2LZJiqAYdVq2QR1IJEAeUl3T2wKfXIttCJkQ6qNRtfumb4jdOnfMSocKd7uHEkwQjJE/NOf/vTBD37w6quvbtt2amqqqmqRtm1alJeLOpsw1gDoJY623uG5GzbDTRs3TUxOHveSl77t7W/baaedkoloytCgLJ61gPiwykj7/f6ll176hte/YcWKFcGklKxhIZG0bTs2Pv797/1g1113adu2w798L2igpy3QL40CL5Z23gyFKK/LmU2qAYEvaPggP/zhD0855ZTZ2dkur0w6s9tQrUkr4+Pja9as2ecZ+1z25cuWLVvWDJswE1XJEpY6Kc2HGLNlbWMGeIh2CUyZLhF6MNHYirAscCciyPwx1mOMH91o9M20vJN+aTIgFvhpt2P8KRDw6nrKhPIG8PiCCy647rrrNm3aNG983vj4eFVVeOgbUm5MQE3PZRVHDhVXRDQzM7Np06aFCxccc8yLXve61++999OIKEi1PYcGx1Y52CsWEBMKjhYvetGLbvrtbycnJtqm6dKSYotY1fWqVY+87W1ve8973jscDKu6srUmadySWKKzXfTOtNulBQtS0lvMtzSBAYqTEAT2MIWrMTY29uMf//iEE04cDgfB+xSFduHVenXvkUce2X///b/yla8sWbJE7avVGtN3Ypj3RZgJQsYRlDUIyWffqFMzLD0W7mwMwJoDoY0OV9OgT45JDp2DhRSQxbRA3RwRoRxD4gapmLE2Tf0TB7leWGo333zzN77xjauvvvq2224PPhJjY2Nh8he2PgEFDTpvBHBjemZmZvPmefPnP3mPPY488sjjXvrSPfbYI+yszJXx4TaZTVQ0RjHe//GD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+U/h9YJfba/Xm5mZCQVS0LqtXbu21+/VVdh6m+TEVXElQm0rYZWEpfChD33oU5/+dMhlI6J58ycWL1k8MzMTKG/OZpiI67qu617dq2M5Ia1I+BEnHP+qO++889e//nVV1UR08UUXPec5+2+77bYhpPKRVavquu44wURVVfX7/YRmgSE8M1eBjiIi6zds6PV6wWWd0xBOqKqqXr8XPr4i6/EePfLIw7vussv3vv/9H/7wh5s3b37/+98fyKj9fn96enrd+nXBxKwZhiC2OryfEKIQ1Doism79uvQx27atKq579erVq0PgpmgBEyRtXfgGRWJjkGDVdR2RN0a6HjapCP9h+pFJV+nI3FyS6ZiWrJseJDOjsA2EoJ1g1JLyytuYsOP+JoWcaxKP+a/7mraBr47fHv4n/B/zE4eNiKxfv3758uXfvPKb+BRt3rwp5E/+5sbfHHXUUS956Uuff+TzB4OBiFx22WX77bff3ns/7VWvOn7VqlUi8tnPfvbUU08Vkdtvv/0Zz9jnhht+HPybP/zhD4vIpz/96YULF+64447vete7guT7+X/7/Oc973kHHHDAk/d48g033CAiw+EQ3/PNN9987IuPfclLXvKn//mTtBJioIJCUUSOPvroU089TUQeeOCB7bbb7oc/+KGI3HTTbw888Ln77rfv3z7/+bffdnv4QQceeOAnPvEJEbnrrruOPPLI++67T0Te+tazzjvvvPAxr7766mc+81nPfOYzTz/99I0bNzYhZL7Ri3/uuR8/8MADP/ShDw2Hw6Zt26YdDptwHT7wb/926KGHhtc56aSTjj322PD7T3zik8985jP32uup//qvH2jbdnp684tf/OJrr722aZrbb7v9iCOOuPfee0Xkqqu+tc8++zzjGc846aSTNmzYKCJ333P3sccee+pppz31qU894ogj//rX+0Rk3bp1L33pS2+55RYR+dcPfODtb397+Ck/+9nPnvOc5+y///6vfOXfPfzQw+FuNmm1xDveZoFNadV1f9/APzctLDnzy6yoNi25Bl+B4h91oaWrqa/e2DfTxheKCxsfiO7FG/Nm8GXx/bVtG4zy//SnP+2888633377cDi86abfvvvd7/73f/u3c88997bbbxeRX//610T05re8+be//W34404773zttdfefffdBxxwwCmnnCIiP//5zxcvXrxx46ZPf+bTRPTud717MBzuuuuuP/rRj0TkvvvuO/pFRx//quPvvefesBQOfO6BRx555F133XXyKaccfPDBgYUXrDiHg6GIvOjYY/v9/li//3d/93dhuQ+HwyaupCuuuGLbbbdt2/b8889/8pOfPDc317btBRdc8M53vHP16tXHHXfc8a86Ptz15z3veWFB3/LHP65YseKuu+4SkaOPPuodb39H8L7ZbbfdLrvsy3/5y1+e9rS93/++9we/9LZtww/65S9/OTExsXDhwl6vHx68wdwgWNEF98ftttvulFNOeeWrXvn43Xb7yU9+IiJXX3P1DjvueOONN/7xD3/Ybrvtvv3t74jIGW9609/+7QtE5L3vfe9BBx0kInfdffeKbba56KKL/vKXvzzrWc8Ky/Suu+4cHx//j//4j7vvvvvxj3/8+9//LyLyyKpHdtlll/Dip59++ite8XdhlT/xiU/84Ac/+PDDDx977LGveuUrwzuPNzdtf7pMcffUVW6WRBv/H34Lfldj11r4x+4patq2YgI7H0/Ikq7DMhMgVZIka8BUurMiF4IekPojMIUIavRly5bNzEz/+c9/rut63bq1d91116OPrnrb28763e9+F87BXXfZ9f/6l//1tKc9jYi++1/fffZ++z3/+c9fuXLlhz78oZ/99Gezs3P77bff4x73+G9+85v//eOfnH322bfcess3rrhi2bJlz33uc4fD4Q477LDNim1WbLPNLrvu0rQtEU1PT7/sZS9/3OMe96JjjgnlbwKWAqdsanJyMBgMm+G8+fO6JqzrxisRecELXjAxMXnFN75x1VXfOvHVr+73+9LKC17wgnXr173xjW+85957p2emE/gQCKt1r7dkyZIQyzI+b15wUv3Vr361cePGa665+h/POGPx4kXT05sd9aLf73PFM7Mzk1OTXdMJcTtt2y5cuHDPPfe84utX/Oc5//mc5zyHiG644ce9Xu/ss89+37/8y+Me97hVj64ioje/6U233377fffdd+13v/umM95ERL/8xS/mZmevv/76M888c2rB1Jo1a0N1t80227zyla9auXLlIYccsmbN6mA5Mj4+HizCFi1aFC7IH2/548OPPHLjjTf+4z+eMTc3Nxg2iLpEk06AJEuLQQcIBvZhYaTo4ACIiQxIGClxHV7UEy6pAw0FEdgwqkyJ6UNiSamGXEqOl+gBu5ieFtyPjjrq6Le85S0/+tGPDj744IMPPvjb37n661dcud+++4bbNjk5GY6guq533mmXCz930WAw7Pd7P/vpz5YtX9br1UR03HEvfc973r1y5eM++9nzfvrTn5511lknnXQSMwel4Mz09NTkAiJqBkMaGxsfHw9tT1hD6c0EcqeIfOhDH5qaWjA21n/3u98tIlxVnaxIZDgYzps37/jjX/WWN795amrqU5/6JBFVdXXqqaduv93255133lvf+tb777s/yggGw3Cz62r16jWhnX3wgQefsfcziGjFim2GTXPW29628847/+iHP9ph++3TvQ3N1t57733BBRd8/Wtfe9nLXr7PPvskc/9wMWdnZ3feeeczzzzzgQceOPfcc4899kVEtP32282fP//cc8+t6/r7P/jBs571rLZtd9ttt/322/dVrzp+rN8/8vnPJ6Kdd9653x8788wzd99995/85KcLFkwl7G9mZjocWSEpmYlWr1k9OzNT1/U99947f3weES1fvnx8bOy000474IADfv7znycoM6BJSU7odZD57EbXpGDyfHGWCeFwiOSEKl9ImHxNkwrovG7A8jp9DVY2TYv1d/7K5sSBUMzhsGmaZv36Dcce+6Jdd931JS95yb777rt06bKvfvWr4dT++c9/vuOOOz766KPh6N+0afORRx65zz77nHDiibvuuvJ73/te+LJbbrmFiMLR+ZGPfCQIEEUkJLOfe+7HFi1a9LGPfSwUOfvut+/5550nIp+94LO77757uH8Quml+YZnXRbqL3Hb7bUT0yle+UkRmZmZF5IwzznjWs571vve/f9ddd03l7NOf/vSPfOQjIrJ58+bnPvegPffc87Wnnjp//vwPfvCD4Yx+9atfvf/++7/xjW/cZdddv3XVt0KxEUNEW/c20lk8OzsrIu9///uf/vSnD4fD1atX77DDDpdccomIPPLII/vtt+/RRx19yimn7Lnnnrfddlt4teuuv46I/vM/PyoioUY6+eSTn/70Z7z+DW9YuXLlFVdcEWq/7bff7rbbbhORl7/iFW984xvDNT/2xcfuuONOJ5100tSCBaedelp4P+985zv3fMpTXv/616983OM+9alPichgbq6BqgDfcGENYLmrdWlTKLtxaZl/8lV1VKxk0iPjrIegc6YHMlHjOYBdmksXKc7hW77//e/feOONCxcu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";

// ─── SPLASH SCREEN ───────────────────────────────────────────────────────────
const GVR_LOGO_DARK = "data:image/png;base64,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";   // светлый знак — для тёмной темы
const GVR_LOGO_LIGHT = "data:image/png;base64,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2dlZgf37K8ZXrcpmJiezUWWlyxQKWQ+sFpEKy4IkjAWaj6KIVTiiWjHl3IROTmai1asnCsC6yV27dk3OE6EJCAgIWOmB37L1jYEglOecEAC7AG6Pv7cQrXEJQJL3sKAMrCiHlkY1w5CLErCS1tRi76XHS1wsBqBnRGICQVjaZI5nYDyn8v2AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAMgSXyWc43uew5CtgcedHSuZDV9C6snlamxbmKPji4MsCAk5jQXUBmVNYdJllQoQCliZx5Rn+bkCwmbn8nQv2ERAUhJNHO774jY6mpuYp52vNuL5CJGO+cKdY9tCuPXsGSn7Plf5OQCrzZBc0NJwTVeAxAOAhPfn8nl8U/y2oB4vyenedowsazpk6ygeRzELZ1zMwcPMyn6PlAEFQegIWGJkluih8a+s5DRlkn2fgwz3tPs6kzmBZr0pKRiKz/e25ppuh+kNkV32yu7t7JPn9cOxw5nAlf9eTjKMA8FPO3YOm15OkmH0PwKXLdPwdAL+5pem54uwFqnZEjIeORvbioaGhI6dh39bR1PRAzeBaNSMASMY/p7t73x0LsCkIAB9N8D4i/BpJePhPALg5+TxRMPmF92dtuU1/T8jj1GwSBpJQMwhAR8aKgsGmYOgTkW935/d8O7GDQBICAkEoXUwNDQ2rV2X5GoO9ysC1ZpikmYGsJDmtiJDYaGZPpMgTNTr6mvbcprd15/d+qDRyCtN/2jhtBUbERwYeVrVK0KaW8dgYAJjY70zxUEdxEKJCohsA3IBTV7AsEvsbR3lshkSk+oPu7n0HS8jtvENVChT1AAgyqGxpQ3kRhI+lYQJElZDJQcOxaShmgJm9aHOu6ccGe20+P3hLIAkBgSAUmXbbuRvh+UWKPMxUJwEoiUoDfkfgVoMdIChmuoHgFopcaGYg2Ei6D7a1Njx81dHor3bu3z8eSMLp28rm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"; // тёмный знак — для светлой темы

function SplashScreen() {
  const { theme } = useTheme();
  const splashLogo = theme === "light" ? GVR_LOGO_LIGHT : GVR_LOGO_DARK;
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "var(--bg)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      animation: "gvrSplashFade 0.5s ease-out 1.2s forwards",
      opacity: 1,
    }}>
      <style>{`
        @keyframes gvrSplashFade {
          0%   { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.04); pointer-events: none; }
        }
        @keyframes gvrLogoIn {
          0%   { opacity: 0; transform: scale(0.82); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
      <img
        src={splashLogo}
        alt="GVR — Growth · Value · Revenue"
        style={{
          width: 300, maxWidth: "74vw", height: "auto",
          animation: "gvrLogoIn 0.38s cubic-bezier(0.34,1.56,0.64,1) 0.05s both",
        }}
      />
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// НАПОМИНАНИЯ
// ════════════════════════════════════════════════════════════

const SVC_LABELS = { trash:"Вывоз мусора", sawdust:"Опилки россыпью", offcuts:"Обрезки доски" };
const SVC_COLORS = { trash:"#79B391", sawdust:"#D2A86A", offcuts:"#C98E73" };

// ── Detail modals ─────────────────────────────────────────────────────────────

function LeadDetailModal({ lead: initLead, onClose, onSave }) {
  const [lead, setLead] = useState(initLead);
  const set = (k, v) => setLead(p => ({ ...p, [k]: v }));
  const st = STATUSES.find(s => s.id === lead.status) || STATUSES[0];
  const svc = LEAD_SERVICES.find(s => s.id === lead.service);
  const [orderSent, setOrderSent] = useState(false);

  const handleMakeOrder = () => {
    localStorage.setItem("dispatch_prefill", JSON.stringify({
      clientName: lead.clientName, phone: lead.phone,
      address: lead.address, amount: lead.amount,
      service: lead.service, note: lead.note, fromLeadId: lead.id,
    }));
    set("status", "working");
    setOrderSent(true);
  };

  const save = () => { onSave(lead); onClose(); };

  return (
    <div style={{
      position:"fixed", inset:0, zIndex:2000,
      background:"rgba(0,0,0,0.75)", backdropFilter:"blur(4px)",
      display:"flex", alignItems:"flex-end", justifyContent:"center",
      overflowY:"hidden",
    }} onClick={e => { if (e.target === e.currentTarget) { save(); } }}>
      <div style={{
        width:"100%", maxWidth:560,
        background:"var(--card)",boxShadow:"var(--elev)", borderRadius:"20px 20px 0 0",
        border:"1px solid var(--w10)",
        maxHeight:"92dvh", display:"flex", flexDirection:"column",
        overflow:"hidden",
      }}>
        {/* Handle */}
        <div style={{ display:"flex", justifyContent:"center", padding:"10px 0 4px", flexShrink:0 }}>
          <div style={{ width:36, height:4, borderRadius:2, background:"var(--w15)" }}/>
        </div>

        {/* Header */}
        <div style={{
          padding:"8px 18px 14px", borderBottom:"1px solid var(--w07)",
          display:"flex", alignItems:"center", gap:12, flexShrink:0,
        }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:2 }}>
              <span style={{ fontSize:16, fontWeight:800, color:"var(--text)" }}>
                {lead.clientName || "Без имени"}
              </span>
              <span style={{
                fontSize:10, padding:"2px 8px", borderRadius:6,
                background: st.color+"22", color: st.color, fontWeight:700,
              }}>{st.label}</span>
              {svc && <span style={{
                fontSize:10, padding:"2px 8px", borderRadius:6,
                background: svc.color+"18", color: svc.color, fontWeight:700,
              }}>{svc.label}</span>}
            </div>
            {lead.phone && (
              <a href={`tel:${lead.phone}`} style={{ fontSize:13, color:"#7E9AD6", textDecoration:"none" }}>
                {lead.phone}
              </a>
            )}
          </div>
          <button onClick={() => { save(); }} style={{
            background:"transparent", border:"none", color:"var(--w40)",
            fontSize:22, cursor:"pointer", padding:"0 4px", lineHeight:1,
          }}>✕</button>
        </div>

        {/* Body — scrollable */}
        <div style={{
          overflowY:"auto", WebkitOverflowScrolling:"touch",
          padding:"14px 18px", paddingBottom:"calc(32px + env(safe-area-inset-bottom))",
          flex:1, minHeight:0,
        }}>

          {/* Info rows */}
          {lead.address && (
            <div style={{ marginBottom:10, padding:"8px 12px", background:"var(--w04)", borderRadius:10 }}>
              <div style={{ fontSize:10, color:"var(--w35)", fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:2 }}>Адрес</div>
              <div style={{ fontSize:13, color:"var(--w75)" }}>{lead.address}</div>
            </div>
          )}
          {lead.note && (
            <div style={{ marginBottom:10, padding:"8px 12px", background:"var(--w04)", borderRadius:10 }}>
              <div style={{ fontSize:10, color:"var(--w35)", fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:2 }}>Заметка</div>
              <div style={{ fontSize:13, color:"var(--w75)", lineHeight:1.5 }}>{lead.note}</div>
            </div>
          )}
          {(lead.amount || lead.margin) && (
            <div style={{ display:"flex", gap:10, marginBottom:10 }}>
              {lead.amount && <div style={{ flex:1, padding:"8px 12px", background:"rgba(121,179,145,0.08)", borderRadius:10 }}>
                <div style={{ fontSize:10, color:"#79B391", fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:2 }}>Сумма</div>
                <div style={{ fontSize:16, fontWeight:800, color:"var(--text)" }}>{lead.amount} т</div>
              </div>}
              {lead.margin && <div style={{ flex:1, padding:"8px 12px", background:"rgba(210,168,106,0.08)", borderRadius:10 }}>
                <div style={{ fontSize:10, color:"#D2A86A", fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:2 }}>Маржа</div>
                <div style={{ fontSize:16, fontWeight:800, color:"var(--text)" }}>{lead.margin} т</div>
              </div>}
            </div>
          )}

          {/* Status */}
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:11, fontWeight:700, color:"var(--w35)", letterSpacing:"0.07em", textTransform:"uppercase", marginBottom:8 }}>Статус</div>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {STATUSES.map(s => (
                <button key={s.id} onClick={() => set("status", s.id)} style={{
                  padding:"6px 12px", borderRadius:20, cursor:"pointer", fontFamily:"inherit",
                  border:`1.5px solid ${lead.status===s.id ? s.color : "var(--w10)"}`,
                  background: lead.status===s.id ? s.color+"22" : "transparent",
                  color: lead.status===s.id ? s.color : "var(--w45)",
                  fontSize:12, fontWeight:700, transition:"all 0.12s",
                }}>{s.label}</button>
              ))}
            </div>
          </div>

          {/* Call date */}
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:11, fontWeight:700, color:"var(--w35)", letterSpacing:"0.07em", textTransform:"uppercase", marginBottom:8 }}>Дата перезвона</div>
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              <input type="date" value={lead.callDate ? lead.callDate.slice(0,10) : ""}
                onChange={e => set("callDate", e.target.value)}
                style={{
                  flex:1, background:"var(--w08)", border:"1px solid var(--w12)",
                  borderRadius:10, color:"var(--w85)", fontSize:14, padding:"9px 12px",
                  outline:"none", fontFamily:"inherit", boxSizing:"border-box",
                  WebkitAppearance:"none", appearance:"none",
                }}
              />
              {lead.callDate && (
                <button onClick={() => set("callDate", "")} style={{
                  width:36, height:36, flexShrink:0, background:"rgba(205,133,133,0.1)",
                  border:"1px solid rgba(205,133,133,0.25)", borderRadius:9,
                  color:"#CD8585", fontSize:16, cursor:"pointer",
                  display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"inherit",
                }}>✕</button>
              )}
            </div>
          </div>

          {/* Note edit */}
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:11, fontWeight:700, color:"var(--w35)", letterSpacing:"0.07em", textTransform:"uppercase", marginBottom:8 }}>Заметка</div>
            <textarea rows={2} value={lead.note || ""} onChange={e => set("note", e.target.value)}
              placeholder="Нюансы, детали..."
              style={{
                width:"100%", background:"var(--w08)", border:"1px solid var(--w12)",
                borderRadius:10, color:"var(--w85)", fontSize:13, padding:"9px 12px",
                outline:"none", fontFamily:"inherit", boxSizing:"border-box", resize:"none",
              }}
            />
          </div>

          {/* Actions */}
          {orderSent ? (
            <div style={{
              padding:"10px 14px", background:"rgba(121,179,145,0.1)", border:"1px solid #79B39133",
              borderRadius:12, fontSize:13, fontWeight:700, color:"#79B391",
            }}>Данные переданы в Заказы</div>
          ) : (
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {lead.phone && (
                <a href={`tel:${lead.phone}`} style={{
                  flex:1, padding:"11px", background:"rgba(121,179,145,0.1)", border:"1.5px solid #79B39144",
                  color:"#79B391", borderRadius:12, fontSize:13, fontWeight:700,
                  textDecoration:"none", textAlign:"center",
                }}>Позвонить</a>
              )}
              <button onClick={handleMakeOrder} style={{
                flex:1, padding:"11px", background:"rgba(126,154,214,0.12)", border:"1.5px solid rgba(126,154,214,0.4)",
                color:"#7E9AD6", borderRadius:12, fontSize:13, fontWeight:700,
                cursor:"pointer", fontFamily:"inherit",
              }}>Оформить заказ</button>
            </div>
          )}

          <div style={{ fontSize:10, color:"var(--w18)", marginTop:12 }}>
            Создан: {fmtDt(initLead.createdAt)} · ID: {initLead.id}
          </div>
        </div>
      </div>
    </div>
  );
}

function OrderDetailModal({ order: initOrder, onClose, onSave }) {
  const [order, setOrder] = useState(initOrder);
  const set = (k, v) => setOrder(p => ({ ...p, [k]: v }));
  const svcColor = SVC_COLORS[order.service] || "#7E9AD6";
  const svcLabel = SVC_LABELS[order.service] || order.service || "";
  const STATUS_LIST = [
    { id:"new",       label:"Новый",     color:"#7E9AD6" },
    { id:"queue",     label:"В очереди", color:"#D2A86A" },
    { id:"working",   label:"В работе",  color:"#A98FD0" },
    { id:"done",      label:"Выполнен",  color:"#79B391" },
    { id:"cancelled", label:"Отменён",   color:"#CD8585" },
  ];
  const st = STATUS_LIST.find(s => s.id === order.status) || STATUS_LIST[0];
  const RU_DAYS2 = ["вс","пн","вт","ср","чт","пт","сб"];
  const RU_MON2  = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];
  const fmtD = iso => { const d=new Date(iso+"T00:00:00"); return `${RU_DAYS2[d.getDay()]} ${d.getDate()} ${RU_MON2[d.getMonth()]}`; };
  const save = () => { onSave(order); onClose(); };

  return (
    <div style={{
      position:"fixed", inset:0, zIndex:2000,
      background:"rgba(0,0,0,0.75)", backdropFilter:"blur(4px)",
      display:"flex", alignItems:"flex-end", justifyContent:"center",
      overflowY:"hidden",
    }} onClick={e => { if (e.target === e.currentTarget) save(); }}>
      <div style={{
        width:"100%", maxWidth:560,
        background:"var(--card)",boxShadow:"var(--elev)", borderRadius:"20px 20px 0 0",
        border:"1px solid var(--w10)",
        maxHeight:"92dvh", display:"flex", flexDirection:"column",
        overflow:"hidden",
      }}>
        {/* Handle */}
        <div style={{ display:"flex", justifyContent:"center", padding:"10px 0 4px", flexShrink:0 }}>
          <div style={{ width:36, height:4, borderRadius:2, background:"var(--w15)" }}/>
        </div>

        {/* Header */}
        <div style={{
          padding:"8px 18px 14px", borderBottom:"1px solid var(--w07)",
          display:"flex", alignItems:"center", gap:12, flexShrink:0,
        }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:2 }}>
              <span style={{ fontSize:16, fontWeight:800, color:"var(--text)" }}>
                {order.clientName || "Клиент"}
              </span>
              <span style={{
                fontSize:10, padding:"2px 8px", borderRadius:6,
                background: st.color+"22", color: st.color, fontWeight:700,
              }}>{st.label}</span>
              {svcLabel && <span style={{
                fontSize:10, padding:"2px 8px", borderRadius:6,
                background: svcColor+"18", color: svcColor, fontWeight:700,
              }}>{svcLabel}</span>}
            </div>
            {order.phone && (
              <a href={`tel:${order.phone}`} style={{ fontSize:13, color:"#7E9AD6", textDecoration:"none" }}>
                {order.phone}
              </a>
            )}
          </div>
          <button onClick={save} style={{
            background:"transparent", border:"none", color:"var(--w40)",
            fontSize:22, cursor:"pointer", padding:"0 4px", lineHeight:1,
          }}>✕</button>
        </div>

        {/* Body */}
        <div style={{
          overflowY:"auto", WebkitOverflowScrolling:"touch",
          padding:"14px 18px", paddingBottom:"calc(32px + env(safe-area-inset-bottom))",
          flex:1, minHeight:0,
        }}>

          {/* Order info */}
          <div style={{ display:"flex", gap:10, marginBottom:10, flexWrap:"wrap" }}>
            {order.date && <div style={{ padding:"8px 12px", background:"var(--w04)", borderRadius:10, flex:1 }}>
              <div style={{ fontSize:10, color:"var(--w35)", fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:2 }}>Дата заказа</div>
              <div style={{ fontSize:13, fontWeight:600, color:"var(--w75)" }}>{fmtD(order.date)}</div>
            </div>}
            {order.amount && <div style={{ padding:"8px 12px", background:"rgba(121,179,145,0.08)", borderRadius:10, flex:1 }}>
              <div style={{ fontSize:10, color:"#79B391", fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:2 }}>Сумма</div>
              <div style={{ fontSize:16, fontWeight:800, color:"var(--text)" }}>{order.amount} т</div>
            </div>}
            {order.margin && <div style={{ padding:"8px 12px", background:"rgba(210,168,106,0.08)", borderRadius:10, flex:1 }}>
              <div style={{ fontSize:10, color:"#D2A86A", fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:2 }}>Маржа</div>
              <div style={{ fontSize:16, fontWeight:800, color:"var(--text)" }}>{order.margin} т</div>
            </div>}
          </div>

          {order.address && (
            <div style={{ marginBottom:10, padding:"8px 12px", background:"var(--w04)", borderRadius:10 }}>
              <div style={{ fontSize:10, color:"var(--w35)", fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:2 }}>Адрес</div>
              <div style={{ fontSize:13, color:"var(--w75)" }}>{order.address}</div>
            </div>
          )}

          {order.summary && (
            <div style={{ marginBottom:10, padding:"8px 12px", background:"var(--w04)", borderRadius:10 }}>
              <div style={{ fontSize:10, color:"var(--w35)", fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:2 }}>Заказ</div>
              <div style={{ fontSize:13, color:"var(--w60)", lineHeight:1.4 }}>{order.summary}</div>
            </div>
          )}

          {/* Status */}
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:11, fontWeight:700, color:"var(--w35)", letterSpacing:"0.07em", textTransform:"uppercase", marginBottom:8 }}>Статус</div>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {STATUS_LIST.map(s => (
                <button key={s.id} onClick={() => set("status", s.id)} style={{
                  padding:"6px 12px", borderRadius:20, cursor:"pointer", fontFamily:"inherit",
                  border:`1.5px solid ${order.status===s.id ? s.color : "var(--w10)"}`,
                  background: order.status===s.id ? s.color+"22" : "transparent",
                  color: order.status===s.id ? s.color : "var(--w45)",
                  fontSize:12, fontWeight:700, transition:"all 0.12s",
                }}>{s.label}</button>
              ))}
            </div>
          </div>

          {/* Next date */}
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:11, fontWeight:700, color:"var(--w35)", letterSpacing:"0.07em", textTransform:"uppercase", marginBottom:8 }}>Следующий заказ</div>
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              <input type="date" value={order.nextDate || ""}
                onChange={e => set("nextDate", e.target.value)}
                style={{
                  flex:1, background:"var(--w08)", border:"1px solid var(--w12)",
                  borderRadius:10, color:"var(--w85)", fontSize:14, padding:"9px 12px",
                  outline:"none", fontFamily:"inherit", boxSizing:"border-box",
                  WebkitAppearance:"none", appearance:"none",
                }}
              />
              {order.nextDate && (
                <button onClick={() => set("nextDate", "")} style={{
                  width:36, height:36, flexShrink:0, background:"rgba(205,133,133,0.1)",
                  border:"1px solid rgba(205,133,133,0.25)", borderRadius:9,
                  color:"#CD8585", fontSize:16, cursor:"pointer",
                  display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"inherit",
                }}>✕</button>
              )}
            </div>
          </div>

          {/* Reminder date */}
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:11, fontWeight:700, color:"var(--w35)", letterSpacing:"0.07em", textTransform:"uppercase", marginBottom:8 }}>Напоминание</div>
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              <input type="date" value={order.reminderDate || ""}
                onChange={e => set("reminderDate", e.target.value)}
                style={{
                  flex:1, background:"var(--w08)", border:"1px solid rgba(169,143,208,0.3)",
                  borderRadius:10, color:"var(--w85)", fontSize:14, padding:"9px 12px",
                  outline:"none", fontFamily:"inherit", boxSizing:"border-box",
                  WebkitAppearance:"none", appearance:"none",
                }}
              />
              {order.reminderDate && (
                <button onClick={() => set("reminderDate", "")} style={{
                  width:36, height:36, flexShrink:0, background:"rgba(205,133,133,0.1)",
                  border:"1px solid rgba(205,133,133,0.25)", borderRadius:9,
                  color:"#CD8585", fontSize:16, cursor:"pointer",
                  display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"inherit",
                }}>✕</button>
              )}
            </div>
          </div>

          {/* Call action */}
          {order.phone && (
            <a href={`tel:${order.phone}`} style={{
              display:"block", padding:"11px", textAlign:"center",
              background:"rgba(121,179,145,0.1)", border:"1.5px solid #79B39144",
              color:"#79B391", borderRadius:12, fontSize:13, fontWeight:700,
              textDecoration:"none",
            }}>Позвонить</a>
          )}

          <div style={{ fontSize:10, color:"var(--w18)", marginTop:12 }}>
            Заказ: {initOrder.id} · Создан: {initOrder.createdAt ? new Date(initOrder.createdAt).toLocaleDateString("ru-RU") : "—"}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main RemindersApp ─────────────────────────────────────────────────────────

function RemindersApp() {
  // Re-read on focus (data may have changed in other tabs)
  const [rev, setRev] = useState(0);
  useEffect(() => {
    const h = () => setRev(r => r + 1);
    window.addEventListener("focus", h);
    return () => window.removeEventListener("focus", h);
  }, []);

  // Local copies of leads/orders so we can save edits inline
  const [leads, setLeads] = useState(() => {
    try { return JSON.parse(localStorage.getItem("leads_data_v2") || "[]"); } catch { return []; }
  });
  const [orders, setOrders] = useState(() => {
    try { return JSON.parse(localStorage.getItem("dispatch_orders") || "[]"); } catch { return []; }
  });

  // Сохраняем в localStorage и сообщаем движку синхронизации
  useEffect(() => { localStorage.setItem("leads_data_v2",   JSON.stringify(leads));  notifyLocalChanged(); }, [leads]);
  useEffect(() => { localStorage.setItem("dispatch_orders", JSON.stringify(orders)); notifyLocalChanged(); }, [orders]);

  // Перечитываем после слияния с облаком (изменения с других устройств)
  useEffect(() => {
    const h = () => {
      try { setLeads(JSON.parse(localStorage.getItem("leads_data_v2")   || "[]")); } catch {}
      try { setOrders(JSON.parse(localStorage.getItem("dispatch_orders") || "[]")); } catch {}
    };
    window.addEventListener(SYNC_MERGED, h);
    return () => window.removeEventListener(SYNC_MERGED, h);
  }, []);

  // Persist "done" marks
  const [done, setDone] = useState(() => {
    try { return JSON.parse(localStorage.getItem("reminders_done") || "{}"); } catch { return {}; }
  });
  const toggleDone = (key) => {
    setDone(prev => {
      const next = { ...prev };
      if (next[key]) delete next[key]; else next[key] = true;
      localStorage.setItem("reminders_done", JSON.stringify(next));
      notifyLocalChanged();
      return next;
    });
  };

  // Filters
  const [filterType, setFilterType] = useState("all"); // all | callback | repeat
  const [filterSvc,  setFilterSvc]  = useState("all"); // all | trash | sawdust | offcuts | other

  // Selected item for detail modal
  const [selected, setSelected] = useState(null); // { type:"lead"|"order", id }

  const todayStr = localISODate();
  const RU_DAYS3  = ["вс","пн","вт","ср","чт","пт","сб"];
  const RU_MON3   = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];
  const fmtDate = iso => { const d=new Date(iso+"T00:00:00"); return `${RU_DAYS3[d.getDay()]} ${d.getDate()} ${RU_MON3[d.getMonth()]}`; };
  const daysUntil = iso => {
    const diff = Math.ceil((new Date(iso+"T00:00:00") - new Date(todayStr+"T00:00:00")) / 86400000);
    if (diff < 0)  return `${Math.abs(diff)} дн. назад`;
    if (diff === 0) return "сегодня";
    if (diff === 1) return "завтра";
    return `через ${diff} дн.`;
  };

  // Build items
  const rawItems = [];

  leads.forEach(lead => {
    if (!lead.callDate || lead.status === "done" || lead.status === "lost") return;
    const date = lead.callDate.slice(0, 10);
    const svc = LEAD_SERVICES.find(s => s.id === lead.service);
    rawItems.push({
      key: "lead_" + lead.id,
      type: "callback", sourceType: "lead",
      date, id: lead.id,
      name: lead.clientName || "Без имени",
      phone: lead.phone || "",
      note: lead.note || "",
      label: "Перезвонить",
      typeColor: "#D2A86A",
      service: lead.service || "other",
      svcLabel: svc?.label || "Другое",
      svcColor: svc?.color || "var(--w40)",
      statusColor: STATUSES.find(s=>s.id===lead.status)?.color || "#7E9AD6",
      statusLabel: STATUSES.find(s=>s.id===lead.status)?.label || "",
    });
  });

  orders.forEach(order => {
    if (!order.nextDate) return;
    const date = order.nextDate.slice(0, 10);
    rawItems.push({
      key: "order_" + order.id,
      type: "repeat", sourceType: "order",
      date, id: order.id,
      name: order.clientName || "Клиент",
      phone: order.phone || "",
      note: order.summary || "",
      label: "Повторный заказ",
      typeColor: "#7E9AD6",
      service: order.service || "other",
      svcLabel: SVC_LABELS[order.service] || order.service || "Другое",
      svcColor: SVC_COLORS[order.service] || "var(--w40)",
      statusColor: "#7E9AD6",
      statusLabel: "",
    });
  });

  // Reminder dates manually added to orders
  orders.forEach(order => {
    if (!order.reminderDate) return;
    const date = order.reminderDate.slice(0, 10);
    rawItems.push({
      key: "reminder_" + order.id,
      type: "reminder", sourceType: "order",
      date, id: order.id,
      name: order.clientName || "Клиент",
      phone: order.phone || "",
      note: order.summary || "",
      label: "Напоминание",
      typeColor: "#A98FD0",
      service: order.service || "other",
      svcLabel: SVC_LABELS[order.service] || order.service || "Другое",
      svcColor: SVC_COLORS[order.service] || "var(--w40)",
      statusColor: "#A98FD0",
      statusLabel: "",
    });
  });

  rawItems.sort((a, b) => a.date.localeCompare(b.date));

  // Apply filters
  const filtered = rawItems.filter(item => {
    if (filterType !== "all") {
      if (filterType === "callback" && item.type !== "callback") return false;
      if (filterType === "repeat"   && item.sourceType !== "order") return false;
    }
    if (filterSvc !== "all" && item.service !== filterSvc) return false;
    return true;
  });

  // All services present in rawItems (for filter chips)
  const presentSvcs = [...new Set(rawItems.map(i => i.service))];
  const allKnownSvcs = [
    ...SERVICES.filter(s => !s.add),
    { id:"other", label:"Другое", color:"var(--w50)" },
  ].filter(s => presentSvcs.includes(s.id));

  // Group by urgency
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const tmrStr  = localISODate(tomorrow);
  const weekEnd = new Date(); weekEnd.setDate(weekEnd.getDate() + 7);
  const weekStr = localISODate(weekEnd);

  const groups = [
    { id:"overdue",  label:"Просрочено",    color:"#CD8585",             items:[] },
    { id:"today",    label:"Сегодня",        color:"#D2A86A",             items:[] },
    { id:"tomorrow", label:"Завтра",         color:"#D2A86A",             items:[] },
    { id:"week",     label:"На этой неделе", color:"#7E9AD6",             items:[] },
    { id:"later",    label:"Позже",          color:"var(--w40)", items:[] },
    { id:"done",     label:"Выполнено",      color:"#79B391",             items:[] },
  ];

  filtered.forEach(item => {
    if (done[item.key]) { groups[5].items.push(item); return; }
    if (item.date < todayStr)       groups[0].items.push(item);
    else if (item.date === todayStr) groups[1].items.push(item);
    else if (item.date === tmrStr)  groups[2].items.push(item);
    else if (item.date <= weekStr)  groups[3].items.push(item);
    else                            groups[4].items.push(item);
  });

  const urgentCount = rawItems.filter(i => !done[i.key] && i.date <= todayStr).length;
  const activeCount = filtered.filter(i => !done[i.key]).length;

  // Save handlers
  const saveLead = (updated) => {
    const stamped = { ...updated, updatedAt: new Date().toISOString() };
    setLeads(prev => prev.map(l => l.id === stamped.id ? stamped : l));
    // clear done mark if callDate changed / removed
    if (!updated.callDate) {
      setDone(prev => { const n={...prev}; delete n["lead_"+updated.id]; localStorage.setItem("reminders_done",JSON.stringify(n)); return n; });
    }
  };
  const saveOrder = (updatedRaw, prevOrder) => {
    const updated = { ...updatedRaw, updatedAt: new Date().toISOString() };
    setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
    if (!updated.nextDate) {
      setDone(prev => { const n={...prev}; delete n["order_"+updated.id]; localStorage.setItem("reminders_done",JSON.stringify(n)); return n; });
    }
    if (!updated.reminderDate) {
      setDone(prev => { const n={...prev}; delete n["reminder_"+updated.id]; localStorage.setItem("reminders_done",JSON.stringify(n)); return n; });
    }

    // Если появилась новая дата повторного заказа — создаём заказ
    const prevNext = prevOrder?.nextDate || "";
    const newNext  = updated.nextDate || "";
    if (newNext && newNext !== prevNext) {
      const alreadyExists = orders.some(o => o.parentId === updated.id && o.date === newNext);
      if (!alreadyExists) {
        const repeatOrder = {
          id:         "ORD-" + Date.now().toString(36).toUpperCase() + "R",
          parentId:   updated.id,
          createdAt:  newNext + "T12:00:00.000Z",
          service:    updated.service,
          status:     "queue",
          clientName: updated.clientName || "",
          phone:      updated.phone       || "",
          address:    updated.address     || "",
          amount:     updated.amount      || "",
          margin:     updated.margin      || "",
          date:       newNext,
          hour:       updated.hour        || "",
          message:    updated.message     || "",
          summary:    (updated.summary    || "Заказ") + " (повтор)",
          data:       { ...(updated.data || {}) },
          isRepeat:   true,
        };
        setOrders(prev => [repeatOrder, ...prev]);
        // Попытка синхронизации с Calendar если токен есть
        const token = localStorage.getItem("gauth_token");
        if (token) calendarCreateEvent(token, { ...repeatOrder, isReminder: false }).catch(() => {});
      }
    }
  };

  // Selected lead/order objects
  const selectedLead  = selected?.type === "lead"  ? leads.find(l => l.id === selected.id)  : null;
  const selectedOrder = selected?.type === "order" ? orders.find(o => o.id === selected.id) : null;

  // ── Card component ──────────────────────────────────────────────────────────
  const ReminderCard = ({ item, groupColor }) => {
    const isDone = !!done[item.key];
    return (
      <div
        onClick={() => setSelected({ type: item.sourceType, id: item.id })}
        style={{
          background: isDone ? "transparent" : "var(--card)",
          border: `1px solid ${isDone ? "var(--w05)" : "var(--w07)"}`,
          borderLeft: `3px solid ${isDone ? "var(--w08)" : groupColor}`,
          borderRadius: 10, padding: "10px 12px", marginBottom: 6,
          opacity: isDone ? 0.4 : 1, cursor: "pointer",
          transition: "opacity 0.15s", display: "flex", alignItems: "center", gap: 12,
        }}
      >
        {/* Main info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", letterSpacing:"-0.01em" }}>{item.name}</span>
            <span style={{
              fontSize: 10, color: item.typeColor, fontWeight: 600,
              letterSpacing: "0.02em",
            }}>{item.label}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {item.svcLabel && (
              <span style={{
                fontSize: 10, color: item.svcColor, fontWeight: 600,
              }}>{item.svcLabel}</span>
            )}
            {item.svcLabel && item.phone && <span style={{ fontSize:10, color:"var(--w15)" }}>·</span>}
            {item.phone && <span style={{ fontSize: 11, color: "var(--w30)" }}>{item.phone}</span>}
          </div>
          {item.note && (
            <div style={{
              fontSize: 11, color: "var(--w25)", marginTop: 3,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>{item.note}</div>
          )}
        </div>

        {/* Right: date + check */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: groupColor, letterSpacing:"-0.01em" }}>{daysUntil(item.date)}</div>
            <div style={{ fontSize: 10, color: "var(--w22)", marginTop:1 }}>{fmtDate(item.date)}</div>
          </div>
          <button
            onClick={e => { e.stopPropagation(); toggleDone(item.key); }}
            style={{
              width: 22, height: 22, borderRadius: "50%",
              background: isDone ? "rgba(121,179,145,0.15)" : "transparent",
              border: `1px solid ${isDone ? "#79B391" : "var(--w15)"}`,
              color: isDone ? "#79B391" : "var(--w20)",
              fontSize: 10, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "inherit", transition: "all 0.15s",
            }}
          >{isDone ? "✓" : ""}</button>
        </div>
      </div>
    );
  };

  const visibleGroups = groups.slice(0, 5).filter(g => g.items.length > 0);
  const doneGroup = groups[5];

  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column", minHeight: 0,
      background: "var(--bg)", fontFamily: "'Outfit',-apple-system,sans-serif",
    }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box} input[type=date]{-webkit-appearance:none;appearance:none}`}</style>

      {/* ── Header ── */}
      <div style={{ padding: "18px 18px 0", flexShrink: 0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
          <div style={{ fontSize:24, fontWeight:800, color:"var(--text)", letterSpacing:"-0.03em" }}>Напоминания</div>
          {urgentCount > 0 && (
            <div style={{
              background:"#CD8585", color:"var(--text)",
              borderRadius:20, padding:"2px 10px", fontSize:12, fontWeight:800,
            }}>{urgentCount}</div>
          )}
        </div>
        <div style={{ fontSize:12, color:"var(--w35)", marginBottom:14 }}>
          {activeCount > 0 ? `${activeCount} активных` : "Всё выполнено"}
        </div>

        {/* ── Filters ── */}
        {/* Type filter */}
        <div style={{ display:"flex", gap:6, marginBottom:8, overflowX:"auto" }}>
          {[
            { id:"all",      label:"Все" },
            { id:"callback", label:"Лиды" },
            { id:"repeat",   label:"Заказы" },
          ].map(f => (
            <button key={f.id} onClick={() => setFilterType(f.id)} style={{
              padding:"5px 12px", borderRadius:20, flexShrink:0,
              border:`1.5px solid ${filterType===f.id ? "#7E9AD6" : "var(--w10)"}`,
              background: filterType===f.id ? "rgba(126,154,214,0.14)" : "transparent",
              color: filterType===f.id ? "#7E9AD6" : "var(--w45)",
              fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
            }}>{f.label}</button>
          ))}
        </div>

        {/* Service filter — only when services present */}
        {allKnownSvcs.length > 1 && (
          <div style={{ display:"flex", gap:6, marginBottom:14, overflowX:"auto" }}>
            <button onClick={() => setFilterSvc("all")} style={{
              padding:"5px 12px", borderRadius:20, flexShrink:0,
              border:`1.5px solid ${filterSvc==="all" ? "var(--w50)" : "var(--w10)"}`,
              background: filterSvc==="all" ? "var(--w08)" : "transparent",
              color: filterSvc==="all" ? "var(--text)" : "var(--w40)",
              fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
            }}>Все услуги</button>
            {allKnownSvcs.map(s => (
              <button key={s.id} onClick={() => setFilterSvc(filterSvc===s.id ? "all" : s.id)} style={{
                padding:"5px 12px", borderRadius:20, flexShrink:0,
                border:`1.5px solid ${filterSvc===s.id ? s.color : "var(--w10)"}`,
                background: filterSvc===s.id ? s.color+"18" : "transparent",
                color: filterSvc===s.id ? s.color : "var(--w40)",
                fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
              }}>{s.label}</button>
            ))}
          </div>
        )}
        {allKnownSvcs.length <= 1 && <div style={{ marginBottom:14 }}/>}
      </div>

      {/* ── List ── */}
      <div style={{ flex:1, overflowY:"auto", WebkitOverflowScrolling:"touch", padding:"0 18px", paddingBottom:"calc(90px + env(safe-area-inset-bottom))" }}>

        {rawItems.length === 0 && (
          <div style={{ textAlign:"center", padding:"70px 0 40px" }}>
            <div style={{
              width:44, height:44, borderRadius:12, margin:"0 auto 16px",
              background:"var(--w04)", border:"1px solid var(--w07)",
              display:"flex", alignItems:"center", justifyContent:"center",
            }}>
              <IcTab name="reminders" size={20}/>
            </div>
            <div style={{ fontSize:14, fontWeight:700, color:"var(--w35)", marginBottom:8 }}>Нет напоминаний</div>
            <div style={{ fontSize:12, color:"var(--w18)", lineHeight:1.6 }}>
              Укажи дату перезвона в лиде или дату следующего заказа
            </div>
          </div>
        )}

        {filtered.length === 0 && rawItems.length > 0 && (
          <div style={{ textAlign:"center", padding:"40px 0", color:"var(--w25)", fontSize:12 }}>
            Нет напоминаний по выбранному фильтру
          </div>
        )}

        {visibleGroups.map(group => (
          <div key={group.id} style={{ marginBottom:22 }}>
            <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:9 }}>
              <div style={{ width:7, height:7, borderRadius:"50%", background:group.color, flexShrink:0 }}/>
              <div style={{ fontSize:11, fontWeight:700, color:group.color, letterSpacing:"0.07em", textTransform:"uppercase" }}>
                {group.label}
              </div>
              <div style={{
                fontSize:11, color:"var(--w30)",
                background:"var(--w06)", borderRadius:20,
                padding:"0px 7px", fontWeight:700,
              }}>{group.items.length}</div>
            </div>
            {group.items.map(item => <ReminderCard key={item.key} item={item} groupColor={group.color} />)}
          </div>
        ))}

        {/* Done section */}
        {doneGroup.items.length > 0 && (
          <DoneSection items={doneGroup.items} ReminderCard={ReminderCard} />
        )}
      </div>

      {/* ── Detail modals ── */}
      {selectedLead && (
        <LeadDetailModal
          lead={selectedLead}
          onClose={() => setSelected(null)}
          onSave={(updated) => { saveLead(updated); setSelected(null); }}
        />
      )}
      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          onClose={() => setSelected(null)}
          onSave={(updated) => { saveOrder(updated, selectedOrder); setSelected(null); }}
        />
      )}
    </div>
  );
}

function DoneSection({ items, ReminderCard }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginBottom:16 }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width:"100%", background:"transparent",
        border:"1px solid var(--w07)", borderRadius:10,
        padding:"9px 14px", color:"var(--w35)", fontSize:12, fontWeight:600,
        cursor:"pointer", fontFamily:"inherit",
        display:"flex", alignItems:"center", justifyContent:"space-between",
        marginBottom: open ? 10 : 0,
      }}>
        <span>Выполнено ({items.length})</span>
        <span style={{ fontSize:10 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && items.map(item => <ReminderCard key={item.key} item={item} groupColor="#79B391" />)}
    </div>
  );
}

// ─── THEME (Вариант B — Мягкие плашки) ───────────────────────────────────────
const ThemeCtx = createContext({ theme:"dark", toggle:()=>{} });
const useTheme = () => useContext(ThemeCtx);

const _wAlphas = ["04","05","06","07","08","09","10","12","15","18","20","22","25","28","30","35","38","40","45","50","55","60","70","75","80","85","90"];
const _wVars = (r,g,b) => _wAlphas.map(a=>`--w${a}:rgba(${r},${g},${b},0.${a});`).join("");
const THEME_CSS = `
[data-theme="dark"]{
  --bg:#100F0E; --card:#1A1917; --card-2:#221F1C; --bg-nav:rgba(16,15,14,0.92);
  --text:#F3F1EE; --ink:#100F0E;
  --elev:0 1px 2px rgba(0,0,0,0.30), 0 6px 18px -8px rgba(0,0,0,0.45);
  ${_wVars(243,241,238)}
}
[data-theme="light"]{
  --bg:#F4F2EE; --card:#FFFFFF; --card-2:#FAF7F2; --bg-nav:rgba(255,255,255,0.92);
  --text:#211E1A; --ink:#FFFFFF;
  --elev:0 1px 2px rgba(31,28,22,0.06), 0 8px 22px -10px rgba(31,28,22,0.14);
  ${_wVars(33,30,26)}
}
html,body{ background:var(--bg); }
* { -webkit-tap-highlight-color:transparent; }
::selection{ background:rgba(126,154,214,0.28); }
`;

// Тема по времени суток: день — светлая, вечер/ночь — тёмная
const THEME_DAY_START = 7;   // с 07:00 светлая
const THEME_DAY_END   = 19;  // до 19:00 светлая, дальше тёмная
function timeTheme(){
  const h = new Date().getHours();
  return (h >= THEME_DAY_START && h < THEME_DAY_END) ? "light" : "dark";
}
// Ручной выбор действует, пока не сменилась часть суток, затем снова авто
function resolveTheme(){
  const auto = timeTheme();
  try {
    const manual = localStorage.getItem("gvr_theme_manual");
    const base   = localStorage.getItem("gvr_theme_manual_base");
    if (manual) {
      if (base === auto) return manual;
      localStorage.removeItem("gvr_theme_manual");
      localStorage.removeItem("gvr_theme_manual_base");
    }
  } catch {}
  return auto;
}

function ThemeProvider({ children }){
  const [theme, setTheme] = useState(() => resolveTheme());
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("gvr_theme", theme); } catch {}
  }, [theme]);
  // Авто-смена по времени: пересчёт раз в минуту и при возврате в приложение
  useEffect(() => {
    const tick = () => setTheme(resolveTheme());
    const iv = setInterval(tick, 60000);
    const onVis = () => { if (!document.hidden) tick(); };
    window.addEventListener("focus", onVis);
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(iv); window.removeEventListener("focus", onVis); document.removeEventListener("visibilitychange", onVis); };
  }, []);
  // Ручной переключатель: запоминаем выбор и текущую часть суток
  const toggle = useCallback(() => {
    setTheme(prev => {
      const next = prev === "dark" ? "light" : "dark";
      try {
        localStorage.setItem("gvr_theme_manual", next);
        localStorage.setItem("gvr_theme_manual_base", timeTheme());
      } catch {}
      return next;
    });
  }, []);
  return (
    <ThemeCtx.Provider value={{ theme, toggle }}>
      <style>{THEME_CSS}</style>
      {children}
    </ThemeCtx.Provider>
  );
}

function ThemeToggle({ style }){
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";
  return (
    <button onClick={toggle} aria-label="Сменить тему" style={{
      width:38, height:38, borderRadius:"50%", flexShrink:0,
      border:"1px solid var(--w10)", background:"var(--card)", boxShadow:"var(--elev)",
      color:"var(--w60)", cursor:"pointer", fontFamily:"inherit",
      display:"flex", alignItems:"center", justifyContent:"center", fontSize:16,
      transition:"transform .15s ease", ...style,
    }}>{dark ? "☾" : "☀"}</button>
  );
}

export default function App(){
  const [showSplash, setShowSplash] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setShowSplash(false), 1750);
    return () => clearTimeout(t);
  }, []);

  const auth = useGoogleAuth();
  const [app, setApp]       = useState(() => localStorage.getItem("active_app") || "dispatch");
  const [skipped, setSkipped] = useState(() => localStorage.getItem("auth_skipped") === "1");
  const switchTo = (a) => { setApp(a); localStorage.setItem("active_app", a); };
  const handleSkip = () => { setSkipped(true); localStorage.setItem("auth_skipped","1"); };
  // Намерение открыть конкретный экран раздела «Заказы» из нижнего меню
  const [dispatchIntent, setDispatchIntent] = useState({ view: "home", n: 0 });
  const [dispatchView, setDispatchView]     = useState("home"); // текущий экран раздела «Заказы»
  const goDispatch = (view) => {
    setApp("dispatch");
    localStorage.setItem("active_app", "dispatch");
    setDispatchIntent(p => ({ view, n: p.n + 1 }));
  };

  // Badge: count of overdue + today reminders that aren't marked done
  const reminderBadge = (() => {
    try {
      const leads  = JSON.parse(localStorage.getItem("leads_data_v2")   || "[]");
      const orders = JSON.parse(localStorage.getItem("dispatch_orders") || "[]");
      const done   = JSON.parse(localStorage.getItem("reminders_done")  || "{}");
      const today  = localISODate();
      let n = 0;
      leads.forEach(l => {
        if (!l.callDate || l.status==="done" || l.status==="lost") return;
        if (l.callDate.slice(0,10) <= today && !done["lead_"+l.id]) n++;
      });
      orders.forEach(o => {
        if (o.nextDate && o.nextDate.slice(0,10) <= today && !done["order_"+o.id]) n++;
        if (o.reminderDate && o.reminderDate.slice(0,10) <= today && !done["reminder_"+o.id]) n++;
      });
      return n;
    } catch { return 0; }
  })();

  if (!auth.user && !skipped) {
    return <ThemeProvider><LoginScreen auth={auth} onSkip={handleSkip}/></ThemeProvider>;
  }

  return(
   <ThemeProvider>
    <AuthCtx.Provider value={auth}>
      <SyncEngine>
      {showSplash && <SplashScreen />}
      <div style={{height:"100dvh",background:"var(--bg)",display:"flex",flexDirection:"column",fontFamily:"'Outfit',-apple-system,sans-serif",overflow:"hidden"}}>
        {/* CONTENT */}
        <div style={{flex:1,display:"flex",flexDirection:"column",minHeight:0,overflow:"hidden"}}>
          {app==="dispatch" ? <DispatchApp navIntent={dispatchIntent} onViewChange={setDispatchView}/> : app==="reminders" ? <RemindersApp/> : <LeadsApp/>}
        </div>
        {/* BOTTOM TAB BAR */}
        <div style={{
          background:"var(--bg-nav)",
          borderTop:"1px solid var(--w08)",
          display:"flex", alignItems:"center",
          padding:"8px 0 max(12px, env(safe-area-inset-bottom))",
          flexShrink:0,
        }}>
          {[
            { id:"home",      icon:"home",      label:"Главная" },
            { id:"form",      icon:"plus",      label:"Новый заказ" },
            { id:"reminders", icon:"reminders", label:"Напоминания", badge: reminderBadge },
            { id:"leads",     icon:"leads",     label:"Лиды" },
          ].map(t => {
            const active =
              t.id === "home" ? (app === "dispatch" && dispatchView !== "form") :
              t.id === "form" ? (app === "dispatch" && dispatchView === "form") :
              app === t.id;
            const onTap =
              t.id === "home" ? () => goDispatch("home") :
              t.id === "form" ? () => goDispatch("form") :
              () => switchTo(t.id);
            return (
              <button key={t.id} onClick={onTap} style={{
                flex:1, display:"flex", flexDirection:"column",
                alignItems:"center", gap:3,
                background:"transparent", border:"none",
                cursor:"pointer", fontFamily:"inherit", padding:"4px 0",
              }}>
                <span style={{ display:"flex", alignItems:"center", opacity:active?1:0.38, color:"var(--text)" }}>
                  <IcTab name={t.icon} size={22}/>
                </span>
                <span style={{
                  display:"flex", alignItems:"center", gap:4,
                  fontSize:10, fontWeight:active?700:400,
                  color:active?"var(--text)":"var(--w45)",
                  letterSpacing:"0.01em",
                }}>
                  {t.label}
                  {t.badge > 0 && (
                    <span style={{
                      background:"#CD8585", color:"var(--text)",
                      borderRadius:"50%", minWidth:15, height:15,
                      fontSize:9, fontWeight:800, padding:"0 3px",
                      display:"flex", alignItems:"center", justifyContent:"center",
                      lineHeight:1,
                    }}>{t.badge > 9 ? "9+" : t.badge}</span>
                  )}
                </span>
                {active && <div style={{width:4,height:4,borderRadius:"50%",background:"#7E9AD6",marginTop:1}}/>}
              </button>
            );
          })}
        </div>
      </div>
      </SyncEngine>
    </AuthCtx.Provider>
   </ThemeProvider>
  );
}
