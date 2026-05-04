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
    dispatch: <><path d="M7 4h7l4 4v12H7z" /><path d="M14 4v4h4" /><path d="M10 13h5M10 16h3" /></>,
    leads: <><circle cx="9" cy="8" r="3" /><path d="M4 20c.5-3.2 2.4-5 5-5s4.5 1.8 5 5" /><path d="M16 11a2.5 2.5 0 1 0 0-5" /><path d="M17 15c1.8.6 3 2.2 3.4 5" /></>,
  };
  return <IconSvg size={size} strokeWidth={1.75}>{icons[name] || null}</IconSvg>;
}


// ─── GOOGLE AUTH & DRIVE SYNC ─────────────────────────────────────────────────
const DRIVE_FILE = "dispatch_app_data_v1.json";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.appdata profile email";
const AuthCtx = createContext(null);

function loadGSI() {
  return new Promise((res) => {
    if (window.google?.accounts) { res(); return; }
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.onload = res; s.onerror = res;
    document.head.appendChild(s);
  });
}

async function driveListFiles(token) {
  const r = await fetch(
    `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name="${DRIVE_FILE}"&fields=files(id,name,modifiedTime)`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return r.json();
}
async function driveReadFile(token, fileId) {
  const r = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return r.json();
}
async function driveCreateFile(token, data) {
  const meta = JSON.stringify({ name: DRIVE_FILE, parents: ["appDataFolder"] });
  const body = new FormData();
  body.append("metadata", new Blob([meta], { type: "application/json" }));
  body.append("file", new Blob([JSON.stringify(data)], { type: "application/json" }));
  const r = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
    { method: "POST", headers: { Authorization: `Bearer ${token}` }, body }
  );
  return r.json();
}
async function driveUpdateFile(token, fileId, data) {
  const r = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
    { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(data) }
  );
  return r.json();
}

function useGoogleAuth() {
  const [user, setUser]       = useState(() => { try { return JSON.parse(localStorage.getItem("gauth_user")||"null"); } catch { return null; } });
  const [token, setToken]     = useState(() => localStorage.getItem("gauth_token")||null);
  const [clientId, setClientId] = useState(() => localStorage.getItem("google_client_id")||"");
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
    });
  }, []);

  const signIn = useCallback(async () => {
    if (!clientId) { setError("Введи Google Client ID"); return; }
    setLoading(true); setError("");
    await loadGSI();
    initTokenClient(clientId);
    if (!tokenClientRef.current) { setError("Не удалось загрузить Google SDK"); setLoading(false); return; }
    tokenClientRef.current.requestAccessToken({ prompt: "consent" });
  }, [clientId, initTokenClient]);

  const signOut = useCallback(() => {
    if (token && window.google?.accounts?.oauth2) {
      window.google.accounts.oauth2.revoke(token, ()=>{});
    }
    setUser(null); setToken(null);
    localStorage.removeItem("gauth_user");
    localStorage.removeItem("gauth_token");
    localStorage.removeItem("auth_skipped");
    window.location.reload();
  }, [token]);

  useEffect(() => {
    loadGSI().then(() => { if (clientId) initTokenClient(clientId); });
  }, [clientId, initTokenClient]);

  return { user, token, clientId, saveClientId, signIn, signOut, loading, error };
}

function useDriveSync(token, key, initialData) {
  const [data, setData]       = useState(initialData);
  const [fileId, setFileId]   = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const pendingRef            = useRef(false);
  const saveTimerRef          = useRef(null);

  // Load on login
  useEffect(() => {
    if (!token) return;
    (async () => {
      setSyncing(true);
      try {
        const list = await driveListFiles(token);
        const files = list.files || [];
        if (files.length > 0) {
          const fid = files[0].id;
          setFileId(fid);
          const cloud = await driveReadFile(token, fid);
          if (cloud && cloud[key]) { setData(cloud[key]); }
          else if (Array.isArray(cloud)) { setData(cloud); }
          setLastSync(new Date());
        }
      } catch(e) {}
      setSyncing(false);
    })();
  }, [token]);

  // Debounced save
  const save = useCallback(async (newData) => {
    if (!token) { setData(newData); return; }
    setData(newData);
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setSyncing(true);
      try {
        const payload = { [key]: newData, savedAt: new Date().toISOString() };
        if (fileId) { await driveUpdateFile(token, fileId, payload); }
        else {
          const res = await driveCreateFile(token, payload);
          if (res.id) setFileId(res.id);
        }
        setLastSync(new Date());
      } catch(e) {}
      setSyncing(false);
    }, 1500);
  }, [token, fileId, key]);

  return { data, save, syncing, lastSync };
}

function LoginScreen({ auth, onSkip }) {
  const [showSetup, setShowSetup] = useState(!auth.clientId);
  const [cid, setCid] = useState(auth.clientId);
  const isSdkError = auth.error?.includes("SDK") || auth.error?.includes("загрузить");

  return (
    <div style={{
      minHeight:"100vh", background:"#0A0A0B",
      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      fontFamily:"'Outfit',-apple-system,sans-serif", padding:24,
    }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap');*{box-sizing:border-box}`}</style>

      <div style={{ maxWidth:420, width:"100%" }}>
        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:36 }}>
          <div style={{
            width:64, height:64, borderRadius:14,
            background:"linear-gradient(135deg,#1F1F20,#151516)",
            border:"1.5px solid rgba(255,255,255,0.3)",
            display:"inline-flex", alignItems:"center", justifyContent:"center",
          }}><LogoSvg/></div>
          <div style={{ fontSize:24, fontWeight:800, color:"#e0ecff", letterSpacing:"-0.03em" }}>GVR</div>
          <div style={{ fontSize:13, color:"#2a4060", marginTop:4 }}>Growth · Value · Revenue</div>
        </div>

        {/* Main card */}
        <div style={{
          background:"#101011", border:"1px solid rgba(255,255,255,0.07)",
          borderRadius:14, padding:28,
        }}>
          {!showSetup ? (
            <>
              {/* CSP warning banner */}
              <div style={{
                marginBottom:16, padding:"12px 14px",
                background:"#181819", border:"1px solid #f59e0b44",
                borderRadius:12, fontSize:12, color:"#f59e0b", lineHeight:1.6,
              }}>
                <strong>Google вход недоступен внутри Claude</strong><br/>
                <span style={{color:"#8a6a20"}}>Браузер блокирует внешние скрипты в предпросмотре. Войди через Google когда приложение будет открыто как отдельный сайт. Пока — используй локальный режим.</span>
              </div>

              {/* Skip button — primary */}
              <button onClick={onSkip} style={{
                width:"100%", padding:"14px",
                background:"linear-gradient(135deg,#1a4a9e,#0e2d6e)",
                border:"1.5px solid #2a5aad",
                color:"#94BFFF", borderRadius:12,
                fontSize:15, fontWeight:800, cursor:"pointer",
                fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:10,
                marginBottom:10,
              }}>
                Продолжить без входа
              </button>

              <div style={{
                textAlign:"center", fontSize:11, color:"#2a4060", marginBottom:14,
              }}>Данные сохранятся на этом устройстве</div>

              {/* Divider */}
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
                <div style={{ flex:1, height:1, background:"#1a2a40" }}/>
                <span style={{ fontSize:11, color:"#1e3050" }}>или при деплое сайта</span>
                <div style={{ flex:1, height:1, background:"#1a2a40" }}/>
              </div>

              {/* Google button — secondary */}
              <button onClick={auth.signIn} disabled={auth.loading} style={{
                width:"100%", padding:"12px",
                background:"transparent",
                border:"1.5px solid #1a2a40",
                color:"rgba(255,255,255,0.3)", borderRadius:12,
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
                background:"transparent", border:"1px solid rgba(255,255,255,0.07)",
                color:"#1e3050", borderRadius:10, fontSize:12,
                cursor:"pointer", fontFamily:"inherit",
              }}>Настроить для деплоя</button>
            </>
          ) : (
            <>
              <div style={{ fontSize:15, fontWeight:800, color:"#e0ecff", marginBottom:4 }}>Настройка Google Client ID</div>
              <div style={{ fontSize:12, color:"#2a4060", marginBottom:20, lineHeight:1.6 }}>
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
                    background:"#1A1A1B",color:"#94BFFF",
                    display:"flex",alignItems:"center",justifyContent:"center",
                    fontSize:11,fontWeight:800,border:"1px solid #2a5aad",flexShrink:0,
                  }}>{s.n}</div>
                  <div>
                    <div style={{fontWeight:700,fontSize:12,color:"#c8d8f8",marginBottom:2}}>{s.t}</div>
                    <div style={{fontSize:11,color:"#2a4060",lineHeight:1.5}}>{s.d}</div>
                  </div>
                </div>
              ))}

              <input
                placeholder="1234567890-abc...apps.googleusercontent.com"
                value={cid} onChange={e=>setCid(e.target.value)}
                style={{
                  width:"100%", background:"#0d1520", border:"1.5px solid #1a2a40",
                  borderRadius:10, color:"#c8d8f8", fontSize:12, padding:"10px 12px",
                  outline:"none", fontFamily:"monospace", marginBottom:10,
                }}
                onFocus={e=>e.target.style.borderColor="rgba(255,255,255,0.3)"}
                onBlur={e=>e.target.style.borderColor="#1a2a40"}
              />
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={()=>{ auth.saveClientId(cid); setShowSetup(false); }} style={{
                  flex:1, padding:"10px", background:"#1A1A1B", border:"1.5px solid #2a5aad",
                  color:"#94BFFF", borderRadius:10, fontSize:13, fontWeight:700,
                  cursor:"pointer", fontFamily:"inherit",
                }}>Сохранить</button>
                <button onClick={()=>setShowSetup(false)} style={{
                  padding:"10px 16px", background:"transparent", border:"1px solid rgba(255,255,255,0.07)",
                  color:"#2a4060", borderRadius:10, fontSize:13, cursor:"pointer", fontFamily:"inherit",
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
        background:"transparent", border:"1px solid rgba(255,255,255,0.07)",
        borderRadius:20, padding:"4px 10px 4px 5px",
        cursor:"pointer", fontFamily:"inherit",
      }}>
        {user?.picture
          ? <img src={user.picture} style={{width:22,height:22,borderRadius:"50%"}} alt=""/>
          : <div style={{width:22,height:22,borderRadius:"50%",background:"#1A1A1B",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11}}>👤</div>
        }
        <span style={{ fontSize:11, color: syncing?"#f59e0b":"#22c55e", fontWeight:700 }}>
          {syncing ? "Синхр..." : lastSync ? "Синхр" : "●"}
        </span>
      </button>
      {showMenu && (
        <div style={{
          position:"absolute", right:0, top:"calc(100% + 6px)",
          background:"#101011", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12,
          padding:"10px", minWidth:200, zIndex:100,
          boxShadow:"0 8px 24px rgba(0,0,0,0.4)",
        }}>
          <div style={{ fontSize:12, color:"#c8d8f8", fontWeight:700, marginBottom:2 }}>{user?.name}</div>
          <div style={{ fontSize:11, color:"#2a4060", marginBottom:10 }}>{user?.email}</div>
          {lastSync && <div style={{ fontSize:10, color:"#1e3050", marginBottom:10 }}>
            Синхр: {lastSync.toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"})}
          </div>}
          <button onClick={()=>{setShowMenu(false);onSignOut();}} style={{
            width:"100%", padding:"7px", background:"#2d0d0d",
            border:"1px solid #ef444433", color:"#ef4444",
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

// ─── SERVICES CONFIG ────────────────────────────────────────────────────────
const SERVICES = [
  { id: "trash",   icon: "trash_svc", label: "Вывоз мусора",  color: "#34D368" },
  { id: "sawdust", icon: "sawdust_svc", label: "Опилки россыпью", color: "#F5A23A" },
  { id: "offcuts", icon: "offcuts_svc", label: "Обрезки доски", color: "#F87255" },
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

      {/* Контейнер нужен */}
      <div style={{marginBottom:12}}>
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
          <input
            type="date"
            value={f.date||""}
            onChange={e => set("date", e.target.value)}
            style={{
              width:"100%", background:"#181819",
              border:"1px solid rgba(255,255,255,0.1)", borderRadius:11,
              color: f.date ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.45)",
              fontSize:13, padding:"9px 12px",
              outline:"none", fontFamily:"inherit",
              boxSizing:"border-box", display:"block",
              WebkitAppearance:"none", appearance:"none",
              lineHeight:"1.4",
            }}
          />
        </Field>
      </div>

      {/* Время */}
      <div style={{marginBottom:12}}>
        <Field label="Время">
          <select
            value={f.hour || "day"}
            onChange={e => set("hour", e.target.value)}
            style={{
              width:"100%", background:"#181819",
              border:"1px solid rgba(255,255,255,0.1)", borderRadius:11,
              color:"rgba(255,255,255,0.85)", fontSize:13, padding:"9px 12px",
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
          <Input multiline rows={2} placeholder="Доп. информация, пожелания клиента..." value={f.note||""} onChange={v => set("note",v)} />
        </Field>
        <Field label="Следующий заказ">
          <Input type="date" value={f.nextDate||""} onChange={v => set("nextDate",v)} />
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
          <input
            type="date"
            value={f.date||""}
            onChange={e => set("date", e.target.value)}
            style={{
              width:"100%", background:"#181819",
              border:"1px solid rgba(255,255,255,0.1)", borderRadius:11,
              color: f.date ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.45)",
              fontSize:13, padding:"9px 12px",
              outline:"none", fontFamily:"inherit",
              boxSizing:"border-box", display:"block",
              WebkitAppearance:"none", appearance:"none",
              lineHeight:"1.4",
            }}
          />
        </Field>
      </div>

      {/* Время */}
      <div style={{marginBottom:12}}>
        <Field label="Время">
          <select
            value={f.hour || "day"}
            onChange={e => set("hour", e.target.value)}
            style={{
              width:"100%", background:"#181819",
              border:"1px solid rgba(255,255,255,0.1)", borderRadius:11,
              color:"rgba(255,255,255,0.85)", fontSize:13, padding:"9px 12px",
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
          <Input multiline rows={2} placeholder="Доп. информация, пожелания клиента..." value={f.note||""} onChange={v => set("note",v)} />
        </Field>
        <Field label="Следующая доставка">
          <Input type="date" value={f.nextDate||""} onChange={v => set("nextDate",v)} />
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
          <input
            type="date"
            value={f.date||""}
            onChange={e => set("date", e.target.value)}
            style={{
              width:"100%", background:"#181819",
              border:"1px solid rgba(255,255,255,0.1)", borderRadius:11,
              color: f.date ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.45)",
              fontSize:13, padding:"9px 12px",
              outline:"none", fontFamily:"inherit",
              boxSizing:"border-box", display:"block",
              WebkitAppearance:"none", appearance:"none",
              lineHeight:"1.4",
            }}
          />
        </Field>
      </div>

      {/* Время */}
      <div style={{marginBottom:12}}>
        <Field label="Время">
          <select
            value={f.hour || "day"}
            onChange={e => set("hour", e.target.value)}
            style={{
              width:"100%", background:"#181819",
              border:"1px solid rgba(255,255,255,0.1)", borderRadius:11,
              color:"rgba(255,255,255,0.85)", fontSize:13, padding:"9px 12px",
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
          <Input multiline rows={2} placeholder="Доп. информация, пожелания клиента..." value={f.note||""} onChange={v => set("note",v)} />
        </Field>
        <Field label="Следующая доставка">
          <Input type="date" value={f.nextDate||""} onChange={v => set("nextDate",v)} />
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
      <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.38)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}
function Input({ placeholder, value, onChange, type = "text", step, prefix, suffix, multiline, rows = 3 }) {
  const baseStyle = {
    width: "100%",
    background: "#181819",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 9,
    color: "rgba(255,255,255,0.85)",
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
      onFocus={e => e.target.style.borderColor="rgba(255,255,255,0.3)"}
      onBlur={e => e.target.style.borderColor="rgba(255,255,255,0.1)"}
    />
  );
  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
      {prefix && <span style={{ position:"absolute", left:10, color:"rgba(255,255,255,0.45)", fontSize:12, pointerEvents:"none", userSelect:"none" }}>{prefix}</span>}
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
        onFocus={e => e.target.style.borderColor = "rgba(255,255,255,0.3)"}
        onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
      />
      {suffix && <span style={{ position:"absolute", right:10, color:"rgba(255,255,255,0.45)", fontSize:12, pointerEvents:"none" }}>{suffix}</span>}
    </div>
  );
}
function SelectPick({ options, value, onChange }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        width:"100%", background:"#181819",
        border:"1px solid rgba(255,255,255,0.1)", borderRadius:12,
        color: value ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.45)",
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
            border: value === val ? "1.5px solid #2a5aad" : "1px solid rgba(255,255,255,0.1)",
            background: value === val ? "rgba(0,122,255,0.12)" : "#181819",
            color: value === val ? "#5B9AFF" : "#5a6a88",
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
        background: "#181819",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 9,
        color: "rgba(255,255,255,0.85)",
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
  { id:"new",      label:"Новый",     color:"#5B9AFF" },
  { id:"queue",    label:"В очереди", color:"#FF9500" },
  { id:"working",  label:"В работе",  color:"#AF52DE" },
  { id:"done",     label:"Выполнен",  color:"#34C759" },
  { id:"cancelled",label:"Отменён",   color:"#FF3B30" },
];
const getOrderStatus = id => ORDER_STATUSES.find(s => s.id === id) || ORDER_STATUSES[0];

function normalizePhone(raw) {
  if (!raw) return "";
  return raw.replace(/\D/g, "").replace(/^8/, "7");
}

function OrderCard({ order, onUpdate, onDelete, onRepeat }) {
  const [open, setOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState({});
  const [copiedOrder, setCopiedOrder] = useState(false);
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
    onUpdate({ ...order, ...draft, summary: (draft.summary || draft.message?.split("\n")[0] || order.summary) });
    setEditMode(false); setDraft({});
  };
  const setD = (k, v) => setDraft(p => ({ ...p, [k]: v }));

  const fieldStyle = {
    width: "100%", background: "#111112", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 7, color: "rgba(255,255,255,0.85)", fontSize: 12,
    padding: "6px 10px", outline: "none", fontFamily: "inherit",
    boxSizing: "border-box",
  };

  return (
    <div style={{
      background:"#111112", border:`1px solid ${editMode ? "rgba(0,122,255,0.6)" : "rgba(255,255,255,0.08)"}`,
      borderRadius:11, marginBottom:6, overflow:"hidden",
      transition: "border-color 0.15s",
    }}>
      <div onClick={()=>{ if (!editMode) setOpen(!open); }} style={{
        display:"flex", alignItems:"center", gap:10,
        padding:"9px 12px", cursor: editMode ? "default" : "pointer", userSelect:"none",
      }}>
        <div style={{width:7,height:7,borderRadius:"50%",background:st.color,flexShrink:0,}}/>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:12,color:"rgba(255,255,255,0.85)",fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
            {order.summary || "Заказ"}
          </div>
          <div style={{fontSize:10,color:"rgba(255,255,255,0.45)",marginTop:2}}>
            {order.date ? new Date(order.date).toLocaleDateString("ru-RU") : "—"}
            {order.amount ? ` · ${order.amount} т` : ""}
            {order.clientName ? ` · ${order.clientName}` : ""}
            {order.nextDate ? <span style={{color:"#F5A23A",marginLeft:4}}>↻ {new Date(order.nextDate).toLocaleDateString("ru-RU")}</span> : ""}
          </div>
        </div>
        <div style={{fontSize:10,padding:"2px 7px",borderRadius:5,background:st.color+"22",color:st.color,fontWeight:700,whiteSpace:"nowrap"}}>
          {st.label}
        </div>
      </div>
      {open && !editMode && (
        <div style={{borderTop:"1px solid rgba(255,255,255,0.07)",padding:"10px 12px"}}>
          <div style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:6}}>Стадия</div>
          <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:10}}>
            {ORDER_STATUSES.map(s=>{
              const active = order.status === s.id;
              return (
                <button key={s.id} onClick={()=>onUpdate({...order,status:s.id})} style={{
                  padding:"4px 10px", borderRadius:6,
                  border:`1.5px solid ${active?s.color+"88":"rgba(255,255,255,0.1)"}`,
                  background: active ? s.color+"22" : "transparent",
                  color: active ? s.color : "rgba(255,255,255,0.45)",
                  fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
                }}>{s.label}</button>
              );
            })}
          </div>
          {order.message && (
            <pre style={{
              background:"#111112", border:"1px solid rgba(255,255,255,0.07)", borderRadius:9,
              padding:"8px 10px", fontSize:11, color:"rgba(255,255,255,0.45)",
              fontFamily:"'Outfit',-apple-system,sans-serif", whiteSpace:"pre-wrap", margin:0, maxHeight:160, overflowY:"auto",
            }}>{order.message}</pre>
          )}
          {order.nextDate && (
            <div style={{
              marginTop:8, display:"inline-flex", alignItems:"center", gap:6,
              background:"rgba(255,159,10,0.1)", border:"1px solid rgba(255,159,10,0.35)",
              borderRadius:8, padding:"5px 12px",
            }}>
              <span style={{fontSize:11}}>↻</span>
              <span style={{fontSize:11, fontWeight:700, color:"#FF9F0A"}}>Следующий заказ:</span>
              <span style={{fontSize:11, color:"rgba(255,255,255,0.7)"}}>
                {new Date(order.nextDate).toLocaleDateString("ru-RU",{weekday:"long",day:"numeric",month:"long"})}
              </span>
            </div>
          )}
          <div style={{display:"flex",gap:7,marginTop:10,alignItems:"center",flexWrap:"wrap"}}>
            <button onClick={handleCopyOrder} style={{
              background: copiedOrder ? "rgba(52,199,89,0.12)" : "rgba(0,122,255,0.12)",
              border: `1.5px solid ${copiedOrder ? "#22c55e88" : "rgba(0,122,255,0.6)"}`,
              color: copiedOrder ? "#34C759" : "#5B9AFF",
              borderRadius:9, padding:"5px 12px", fontSize:11, fontWeight:700,
              cursor:"pointer", fontFamily:"inherit", transition:"all 0.2s",
              minWidth:110,
            }}>{copiedOrder ? "✓ Скопировано" : "Копировать"}</button>
            <button onClick={startEdit} style={{
              background:"#181818", border:"1.5px solid #3a6a2a", color:"#6aaa4a",
              borderRadius:9, padding:"5px 12px", fontSize:11, fontWeight:700,
              cursor:"pointer", fontFamily:"inherit",
            }}>✏️ Изменить</button>
            {onRepeat && (
              <button onClick={()=>onRepeat(order)} style={{
                background:"#181819", border:"1.5px solid #5a4aad", color:"#D8B4FE",
                borderRadius:9, padding:"5px 12px", fontSize:11, fontWeight:700,
                cursor:"pointer", fontFamily:"inherit",
              }}>🔄 Повторить</button>
            )}
            <div style={{fontSize:9,color:"rgba(255,255,255,0.18)"}}>{order.id}</div>
            <button
              onClick={()=>{
                if (confirmDel) { onDelete(order.id); }
                else { setConfirmDel(true); setTimeout(()=>setConfirmDel(false), 3000); }
              }}
              style={{
                marginLeft:"auto",
                background: confirmDel ? "#ef444422" : "transparent",
                border: `1px solid ${confirmDel ? "#ef444488" : "#2a1a1a"}`,
                color: confirmDel ? "#FF3B30" : "#4a2a2a",
                borderRadius:6, padding:"4px 10px",
                fontSize:11, fontWeight: confirmDel ? 800 : 500,
                cursor:"pointer", fontFamily:"inherit",
                transition: "all 0.15s",
              }}
            >{confirmDel ? "Удалить?" : "✕"}</button>
          </div>
        </div>
      )}
      {editMode && (
        <div style={{borderTop:"1px solid rgba(255,255,255,0.25)",padding:"12px"}}>
          <div style={{fontSize:10,fontWeight:700,color:"#5B9AFF",letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:10}}>
            Редактирование заказа
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
            <div>
              <div style={{fontSize:10,color:"rgba(255,255,255,0.45)",fontWeight:700,marginBottom:4}}>Клиент</div>
              <input value={draft.clientName||""} onChange={e=>setD("clientName",e.target.value)} placeholder="Имя" style={fieldStyle}/>
            </div>
            <div>
              <div style={{fontSize:10,color:"rgba(255,255,255,0.45)",fontWeight:700,marginBottom:4}}>Телефон</div>
              <input value={draft.phone||""} onChange={e=>setD("phone",e.target.value)} placeholder="+7..." style={fieldStyle}/>
            </div>
          </div>
          <div style={{marginBottom:8}}>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.45)",fontWeight:700,marginBottom:4}}>Адрес</div>
            <input value={draft.address||""} onChange={e=>setD("address",e.target.value)} placeholder="Адрес" style={{...fieldStyle}}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:8}}>
            <div>
              <div style={{fontSize:10,color:"rgba(255,255,255,0.45)",fontWeight:700,marginBottom:4}}>Дата</div>
              <input type="date" value={draft.date||""} onChange={e=>setD("date",e.target.value)} style={{...fieldStyle,WebkitAppearance:"none"}}/>
            </div>
            <div>
              <div style={{fontSize:10,color:"rgba(255,255,255,0.45)",fontWeight:700,marginBottom:4}}>Сумма (т)</div>
              <input type="number" step="0.1" value={draft.amount||""} onChange={e=>setD("amount",e.target.value)} placeholder="0.0" style={fieldStyle}/>
            </div>
            <div>
              <div style={{fontSize:10,color:"rgba(255,255,255,0.45)",fontWeight:700,marginBottom:4}}>Маржа (т)</div>
              <input type="number" step="0.1" value={draft.margin||""} onChange={e=>setD("margin",e.target.value)} placeholder="0.0" style={fieldStyle}/>
            </div>
          </div>
          <div style={{marginBottom:10}}>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.45)",fontWeight:700,marginBottom:4}}>Стадия</div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
              {ORDER_STATUSES.map(s=>{
                const active = (draft.status||order.status) === s.id;
                return (
                  <button key={s.id} onClick={()=>setD("status",s.id)} style={{
                    padding:"4px 10px", borderRadius:6,
                    border:`1.5px solid ${active?s.color+"88":"rgba(255,255,255,0.1)"}`,
                    background: active ? s.color+"22" : "transparent",
                    color: active ? s.color : "rgba(255,255,255,0.45)",
                    fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
                  }}>{s.label}</button>
                );
              })}
            </div>
          </div>
          <div style={{marginBottom:10}}>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.45)",fontWeight:700,marginBottom:4}}>Следующий заказ</div>
            <input type="date" value={draft.nextDate||""} onChange={e=>setD("nextDate",e.target.value)}
              style={{...fieldStyle, WebkitAppearance:"none", appearance:"none"}}/>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={saveEdit} style={{
              background:"rgba(52,199,89,0.12)", border:"1.5px solid #22c55e88",
              color:"#34C759", borderRadius:10, padding:"7px 18px",
              fontSize:12, fontWeight:800, cursor:"pointer", fontFamily:"inherit",
            }}>✓ Сохранить</button>
            <button onClick={cancelEdit} style={{
              background:"transparent", border:"1px solid rgba(255,255,255,0.1)",
              color:"rgba(255,255,255,0.45)", borderRadius:10, padding:"7px 14px",
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

  const dates = orders.map(o=>o.createdAt||"").filter(Boolean).sort();
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
    .sort((a,b) => (a.createdAt||"").localeCompare(b.createdAt||""))
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
      background:"#111112", border:"1px solid rgba(255,255,255,0.08)",
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
          background:"#1A1A1B", border:"1px solid rgba(255,255,255,0.12)",
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:14, fontWeight:800, color:"#FFFFFF", flexShrink:0,
        }}>{initials}</div>

        <div style={{flex:1, minWidth:0}}>
          <div style={{fontSize:14,fontWeight:700,color:"#FFFFFF",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
            {client.name || "Без имени"}
          </div>
          <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginTop:2,display:"flex",gap:8,alignItems:"center"}}>
            {client.phone && <span>{client.phone}</span>}
            {client.phone && client.address && <span style={{color:"rgba(255,255,255,0.2)"}}>·</span>}
            {client.address && <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:160}}>{client.address}</span>}
          </div>
        </div>

        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4,flexShrink:0}}>
          <div style={{fontSize:13,fontWeight:800,color:"#FFFFFF"}}>{orders.length} зак.</div>
          <div style={{fontSize:10,color:"rgba(255,255,255,0.35)"}}>{periodStr}</div>
        </div>
      </div>

      {/* Quick stats strip */}
      {orders.length > 0 && (
        <div style={{
          display:"flex", borderTop:"1px solid rgba(255,255,255,0.06)",
          padding:"8px 16px", gap:16, background:"rgba(0,0,0,0.2)",
        }}>
          {[
            { label:"Активных", value: activeCount, color:"#5B9AFF" },
            { label:"Выполнено", value: doneCount, color:"#34D368" },
            { label:"Сумма", value: `${fmt(totalAmount)} т`, color:"#FFFFFF" },
            { label:"Маржа", value: `${fmt(totalMargin)} т`, color:"#F5A23A" },
          ].map(s => (
            <div key={s.label} style={{display:"flex",flexDirection:"column",gap:1}}>
              <div style={{fontSize:9,color:"rgba(255,255,255,0.35)",letterSpacing:"0.06em",textTransform:"uppercase",fontWeight:600}}>{s.label}</div>
              <div style={{fontSize:13,fontWeight:700,color:s.color}}>{s.value}</div>
            </div>
          ))}
          {recentAmounts.length >= 3 && (
            <div style={{marginLeft:"auto"}}>
              <Sparkline values={recentAmounts} color="#5B9AFF" w={60} h={22}/>
            </div>
          )}
        </div>
      )}

      {/* Expanded content */}
      {expanded && (
        <div style={{borderTop:"1px solid rgba(255,255,255,0.07)"}}>
          {/* Tab switcher */}
          <div style={{display:"flex",borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
            {[["orders","Заказы"],["stats","Статистика"]].map(([id,lbl]) => (
              <button key={id} onClick={e=>{e.stopPropagation();setTab(id);}} style={{
                flex:1, padding:"10px", background:"transparent", border:"none",
                borderBottom:`2px solid ${tab===id?"#5B9AFF":"transparent"}`,
                color: tab===id ? "#5B9AFF" : "rgba(255,255,255,0.4)",
                fontSize:12, fontWeight: tab===id ? 700 : 500,
                cursor:"pointer", fontFamily:"inherit",
              }}>{lbl}</button>
            ))}
          </div>

          {tab === "orders" && (
            <div style={{padding:"8px 12px", background:"#0F0F10"}}>
              {orders.length === 0 ? (
                <div style={{textAlign:"center",padding:"20px 0",color:"rgba(255,255,255,0.3)",fontSize:12}}>Нет заказов</div>
              ) : (
                orders.sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||"")).map(o => (
                  <OrderCard key={o.id} order={o} onUpdate={onUpdateOrder} onDelete={onDeleteOrder} onRepeat={onRepeat}/>
                ))
              )}
            </div>
          )}

          {tab === "stats" && (
            <div style={{padding:"14px 16px", background:"#0F0F10"}}>
              {/* Period */}
              <div style={{marginBottom:16}}>
                <div style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.4)",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:6}}>Период сотрудничества</div>
                <div style={{fontSize:13,color:"#FFFFFF",fontWeight:600}}>{periodStr}</div>
                {firstDate && lastDate && firstDate.getTime() !== lastDate.getTime() && (
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginTop:3}}>
                    {Math.ceil((lastDate - firstDate) / 86400000)} дней
                  </div>
                )}
              </div>

              {/* Status breakdown */}
              <div style={{marginBottom:16}}>
                <div style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.4)",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:8}}>Статусы</div>
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
                        <span style={{fontSize:11,color:"rgba(255,255,255,0.4)",fontWeight:600}}>{cnt}</span>
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
                  <div style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.4)",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:8}}>По услугам</div>
                  {Object.entries(bySvc).map(([id, s]) => (
                    <div key={id} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                      <div style={{width:8,height:8,borderRadius:"50%",background:s.color,flexShrink:0}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                          <span style={{fontSize:12,color:"rgba(255,255,255,0.85)",fontWeight:600}}>{s.label}</span>
                          <span style={{fontSize:12,color:s.color,fontWeight:700}}>{s.count} зак.</span>
                        </div>
                        <div style={{background:"rgba(255,255,255,0.06)",borderRadius:3,height:3}}>
                          <div style={{
                            height:"100%",background:s.color,borderRadius:3,
                            width:`${Math.round((s.count/orders.length)*100)}%`,
                          }}/>
                        </div>
                        <div style={{fontSize:10,color:"rgba(255,255,255,0.4)",marginTop:3}}>
                          {fmt(s.amount)} т · маржа {fmt(s.margin)} т
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Total summary */}
              <div style={{background:"#181819",border:"1px solid rgba(255,255,255,0.07)",borderRadius:10,padding:"12px 14px"}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                  {[
                    ["Всего заказов",orders.length,""],
                    ["Выполнено",`${doneCount} (${orders.length>0?Math.round((doneCount/orders.length)*100):0}%)`,orders.length>0&&doneCount/orders.length>0.7?"#34D368":"rgba(255,255,255,0.7)"],
                    ["Общая сумма",`${fmt(totalAmount)} т`,"#34D368"],
                    ["Общая маржа",`${fmt(totalMargin)} т`,"#F5A23A"],
                  ].map(([lbl,val,clr]) => (
                    <div key={lbl}>
                      <div style={{fontSize:9,fontWeight:700,color:"rgba(255,255,255,0.38)",letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:3}}>{lbl}</div>
                      <div style={{fontSize:16,fontWeight:800,color:clr||"#FFFFFF"}}>{val}</div>
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


function OrdersView({ orders, setOrders, onRepeat }) {
  const [filter, setFilter] = useState("all");
  const [filterService, setFilterService] = useState("all");
  const [search, setSearch] = useState("");

  const updateOrder = u => setOrders(p => p.map(o => o.id===u.id?u:o));
  const deleteOrder = id => setOrders(p => p.filter(o => o.id !== id));

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
  // Поиск
  if (search) {
    const q = search.toLowerCase();
    clients = clients.filter(c =>
      (c.name||"").toLowerCase().includes(q) ||
      (c.phone||"").includes(q) ||
      (c.address||"").toLowerCase().includes(q)
    );
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
    <div style={{flex:1,overflowY:"auto",WebkitOverflowScrolling:"touch",padding:"16px 20px"}}>
      {/* Header */}
      <div style={{marginBottom:14}}>
        <div style={{fontSize:20,fontWeight:800,color:"#FFFFFF",letterSpacing:"-0.02em"}}>Заказы клиентов</div>
        <div style={{fontSize:12,color:"rgba(255,255,255,0.35)",marginTop:2}}>
          {clients.length} клиент{clients.length===1?"":clients.length<5&&clients.length>1?"а":"ов"} · {orders.length} заказ{orders.length===1?"":orders.length<5&&orders.length>1?"а":"ов"} всего
        </div>
      </div>

      {/* Фильтр по статусу */}
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8,alignItems:"center"}}>
        <span style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.22)",letterSpacing:"0.07em",textTransform:"uppercase",marginRight:2}}>Статус</span>
        <button onClick={()=>setFilter("all")} style={{
          padding:"4px 11px", borderRadius:9,
          border:`1.5px solid ${filter==="all"?"rgba(0,122,255,0.6)":"rgba(255,255,255,0.1)"}`,
          background: filter==="all"?"rgba(0,122,255,0.12)":"transparent",
          color: filter==="all"?"#5B9AFF":"rgba(255,255,255,0.45)",
          fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
        }}>Все ({orders.length})</button>
        {ORDER_STATUSES.map(s=>counts[s.id]>0&&(
          <button key={s.id} onClick={()=>setFilter(filter===s.id?"all":s.id)} style={{
            padding:"4px 11px", borderRadius:9,
            border:`1.5px solid ${filter===s.id?s.color+"88":"rgba(255,255,255,0.1)"}`,
            background: filter===s.id?s.color+"22":"transparent",
            color: filter===s.id?s.color:"rgba(255,255,255,0.45)",
            fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
          }}>{s.label} ({counts[s.id]})</button>
        ))}
        <input
          placeholder="Поиск..."
          value={search}
          onChange={e=>setSearch(e.target.value)}
          style={{
            marginLeft:"auto", background:"#181819",
            border:"1px solid rgba(255,255,255,0.08)", borderRadius:10,
            color:"rgba(255,255,255,0.85)", fontSize:12, padding:"5px 12px",
            outline:"none", fontFamily:"inherit", width:180,
          }}
        />
      </div>

      {/* Фильтр по услуге */}
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14,alignItems:"center"}}>
        <span style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.22)",letterSpacing:"0.07em",textTransform:"uppercase",marginRight:2}}>Услуга</span>
        <button onClick={()=>setFilterService("all")} style={{
          padding:"4px 11px", borderRadius:9,
          border:`1.5px solid ${filterService==="all"?"rgba(0,122,255,0.6)":"rgba(255,255,255,0.1)"}`,
          background: filterService==="all"?"rgba(0,122,255,0.12)":"transparent",
          color: filterService==="all"?"#5B9AFF":"rgba(255,255,255,0.45)",
          fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
        }}>Все</button>
        {SERVICES.filter(s=>!s.add).map(s=>(
          <button key={s.id} onClick={()=>setFilterService(filterService===s.id?"all":s.id)} style={{
            padding:"4px 11px", borderRadius:9,
            border:`1.5px solid ${filterService===s.id?s.color+"88":"rgba(255,255,255,0.1)"}`,
            background: filterService===s.id?s.color+"22":"transparent",
            color: filterService===s.id?s.color:"rgba(255,255,255,0.45)",
            fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
          }}>{s.label} {svcCounts[s.id]>0?`(${svcCounts[s.id]})`:""}</button>
        ))}
      </div>

      {/* Clients list */}
      {clients.length === 0 ? (
        <div style={{textAlign:"center",padding:"60px 0",color:"rgba(255,255,255,0.18)",fontSize:14}}>
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

function filterOrdersByPeriod(orders, range) {
  return orders.filter(o => {
    const d = new Date(o.createdAt);
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
function Sparkline({ values, color="#5B9AFF", w=80, h=28 }) {
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
function SvgBarChart({ data, color="#5B9AFF", height=90 }) {
  if (!data || data.length === 0) return (
    <div style={{height,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <span style={{color:"rgba(255,255,255,0.18)",fontSize:11}}>Нет данных</span>
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
              background: d.value > 0 ? color : "rgba(255,255,255,0.06)",
              borderRadius:"3px 3px 0 0",
              opacity: d.value > 0 ? 0.85 : 1,
              height:`${pct}%`,
              minHeight: d.value > 0 ? 3 : 2,
              transition:"height 0.3s ease",
            }}/>
            <div style={{fontSize:8,color:"rgba(255,255,255,0.25)",textAlign:"center",lineHeight:1}}>{d.label}</div>
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
  const deltaColor = (a,b) => b === 0 ? "rgba(255,255,255,0.4)" : a >= b ? "#34D368" : "#F05050";

  // Chart data
  const buildChart = (metric) => {
    if (!filtered.length) return [];
    const days = Math.ceil((range.end - range.start) / 86400000);
    if (days <= 31) {
      const buckets = {};
      filtered.forEach(o => {
        const d  = new Date(o.createdAt);
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
      const wOrd = filtered.filter(o => { const d=new Date(o.createdAt); return d>=cur&&d<=wEnd; });
      const val  = metric === "count" ? wOrd.length : wOrd.reduce((s,o)=>s+(parseFloat(o[metric])||0),0);
      out.push({ label: `${String(cur.getDate()).padStart(2,"0")}.${String(cur.getMonth()+1).padStart(2,"0")}`, value: val });
      cur = new Date(cur.getTime() + 7*86400000);
    }
    return out;
  };

  const chartData = buildChart(activeMetric);
  const C = { count:"#5B9AFF", amount:"#34D368", margin:"#F5A23A" };
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
    <div style={{flex:1,overflowY:"auto",WebkitOverflowScrolling:"touch",background:"#0A0A0B"}}>
      {/* ── Header ── */}
      <div style={{padding:"20px 18px 0"}}>
        <div style={{fontSize:28,fontWeight:800,color:"#FFFFFF",letterSpacing:"-0.04em",lineHeight:1}}>Отчёт</div>
        <div style={{fontSize:13,color:"rgba(255,255,255,0.35)",marginTop:4}}>{periodLabel}</div>
      </div>

      {/* ── Period pills ── */}
      <div style={{display:"flex",gap:6,padding:"16px 18px 0",overflowX:"auto",scrollbarWidth:"none"}}>
        {PERIOD_PRESETS.map(p => {
          const on = preset === p.id;
          return (
            <button key={p.id} onClick={() => setPreset(p.id)} style={{
              padding:"8px 18px", borderRadius:22, flexShrink:0,
              background: on ? "#FFFFFF" : "#1A1A1B",
              color: on ? "#000000" : "rgba(255,255,255,0.5)",
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
              <div style={{fontSize:10,fontWeight:600,color:"rgba(255,255,255,0.38)",letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:5}}>{lbl}</div>
              <input type="date" value={val} onChange={e=>setter(e.target.value)}
                style={{width:"100%",background:"#181819",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,color:"rgba(255,255,255,0.85)",fontSize:13,padding:"10px 12px",outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>
            </div>
          ))}
        </div>
      )}

      {/* ── PRIMARY METRIC CARD (full-width, large) ── */}
      <div style={{padding:"16px 18px 0"}}>
        <div style={{
          background:"#141415", borderRadius:18, padding:"20px 22px",
          border:"1px solid rgba(255,255,255,0.08)",
        }}>
          {/* Metric switcher row */}
          <div style={{display:"flex",gap:4,marginBottom:18}}>
            {METRICS.map(m => (
              <button key={m.id} onClick={() => setActiveMetric(m.id)} style={{
                padding:"5px 14px", borderRadius:20,
                background: activeMetric===m.id ? "rgba(255,255,255,0.12)" : "transparent",
                color: activeMetric===m.id ? "#FFFFFF" : "rgba(255,255,255,0.38)",
                border:"none", fontSize:12, fontWeight: activeMetric===m.id ? 700 : 500,
                cursor:"pointer", fontFamily:"inherit", transition:"all 0.12s",
              }}>{m.label}</button>
            ))}
          </div>

          {/* Big number */}
          <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",marginBottom:6}}>
            <div>
              <div style={{fontSize:52,fontWeight:800,color:"#FFFFFF",letterSpacing:"-0.05em",lineHeight:1}}>
                {fmt(totals[activeMetric])}
                {active.suffix && (
                  <span style={{fontSize:20,fontWeight:500,color:"rgba(255,255,255,0.4)",marginLeft:4}}>{active.suffix.trim()}</span>
                )}
              </div>
              <div style={{fontSize:12,color:"rgba(255,255,255,0.35)",marginTop:6}}>
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
              <div style={{fontSize:11,color:"rgba(255,255,255,0.3)"}}>Предыдущий</div>
              <div style={{fontSize:22,fontWeight:700,color:"rgba(255,255,255,0.35)",letterSpacing:"-0.02em"}}>
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
              background:"#141415", borderRadius:18, padding:"18px 18px 16px",
              border:"1px solid rgba(255,255,255,0.07)", cursor:"pointer",
              transition:"border-color 0.15s",
            }}>
              <div style={{fontSize:32,fontWeight:800,color:"#FFFFFF",letterSpacing:"-0.04em",lineHeight:1,marginBottom:12}}>
                {fmt(totals[m.id])}
                {m.suffix && <span style={{fontSize:14,fontWeight:500,color:"rgba(255,255,255,0.4)",marginLeft:3}}>{m.suffix.trim()}</span>}
              </div>
              <div style={{fontSize:13,fontWeight:600,color:"rgba(255,255,255,0.75)"}}>{m.label}</div>
              <div style={{fontSize:11,color:deltaColor(totals[m.id],prevTotals[m.id]),marginTop:3,fontWeight:600}}>
                {delta(totals[m.id],prevTotals[m.id])}
              </div>
            </div>
          ))}
        </div>

        {/* Total orders count — full width strip if more detail needed */}
        <div style={{
          background:"#141415", borderRadius:18, padding:"14px 20px",
          border:"1px solid rgba(255,255,255,0.07)",
          display:"flex", alignItems:"center", justifyContent:"space-between",
        }}>
          <div>
            <div style={{fontSize:13,fontWeight:600,color:"rgba(255,255,255,0.6)"}}>Всего заказов</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.3)",marginTop:2}}>за выбранный период</div>
          </div>
          <div style={{fontSize:34,fontWeight:800,color:"#FFFFFF",letterSpacing:"-0.04em"}}>{totals.count}</div>
        </div>
      </div>

      {/* ── BY SERVICE — cards like reference ── */}
      <div style={{padding:"20px 18px 0"}}>
        <div style={{fontSize:13,fontWeight:700,color:"rgba(255,255,255,0.4)",letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:12}}>
          По услугам
        </div>

        {Object.entries(agg).length === 0 ? (
          <div style={{textAlign:"center",padding:"30px 0",color:"rgba(255,255,255,0.2)",fontSize:13}}>
            Нет заказов за выбранный период
          </div>
        ) : (
          <>
            {/* Full-width card for top service */}
            {Object.entries(agg).slice(0,1).map(([id,s]) => (
              <div key={id} style={{
                background:"#141415", borderRadius:18, padding:"20px 22px",
                border:"1px solid rgba(255,255,255,0.08)", marginBottom:10,
              }}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <div>
                      <div style={{fontSize:15,fontWeight:700,color:"#FFFFFF"}}>{s.label}</div>
                      <div style={{fontSize:11,color:"rgba(255,255,255,0.35)"}}>{s.count} заказ{s.count===1?"":s.count<5?"а":"ов"}</div>
                    </div>
                  </div>
                  <div style={{fontSize:36,fontWeight:800,color:s.color,letterSpacing:"-0.04em"}}>
                    {fmt(s[activeMetric])}<span style={{fontSize:14,fontWeight:500,color:s.color+"AA",marginLeft:2}}>{active.suffix.trim()}</span>
                  </div>
                </div>
                {/* Progress bar */}
                <div style={{height:3,background:"rgba(255,255,255,0.07)",borderRadius:3,overflow:"hidden",marginBottom:16}}>
                  <div style={{height:"100%",background:s.color,width:"100%",borderRadius:3}}/>
                </div>
                {/* Sub metrics */}
                <div style={{display:"flex",gap:0}}>
                  {[["Заказов",String(s.count),"#5B9AFF"],["Выручка",`${fmt(s.amount)} т`,"#34D368"],["Маржа",`${fmt(s.margin)} т`,"#F5A23A"]].map(([lbl,val,clr],i,arr) => (
                    <div key={lbl} style={{flex:1,borderRight: i<arr.length-1 ? "1px solid rgba(255,255,255,0.07)" : "none",paddingRight:i<arr.length-1?12:0,paddingLeft:i>0?12:0}}>
                      <div style={{fontSize:9,fontWeight:600,color:"rgba(255,255,255,0.35)",letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:3}}>{lbl}</div>
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
                      background:"#141415", borderRadius:18, padding:"18px 18px 16px",
                      border:"1px solid rgba(255,255,255,0.07)",
                    }}>

                      <div style={{fontSize:28,fontWeight:800,color:"#FFFFFF",letterSpacing:"-0.04em",lineHeight:1,marginBottom:8}}>
                        {fmt(s[activeMetric])}{active.suffix && <span style={{fontSize:12,fontWeight:500,color:"rgba(255,255,255,0.4)",marginLeft:2}}>{active.suffix.trim()}</span>}
                      </div>
                      <div style={{fontSize:13,fontWeight:600,color:"rgba(255,255,255,0.7)",marginBottom:2}}>{s.label}</div>
                      <div style={{fontSize:11,color:"rgba(255,255,255,0.3)"}}>{s.count} заказ{s.count===1?"":s.count<5?"а":"ов"}</div>
                      {/* Mini bar */}
                      <div style={{height:3,background:"rgba(255,255,255,0.07)",borderRadius:3,overflow:"hidden",marginTop:10}}>
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
function AnalyticsView({ orders }) {
  const [mode, setMode]           = useState("auto");
  const [autoPreset, setAutoPreset] = useState("month");
  const [aFrom, setAFrom]         = useState("");
  const [aTo, setATo]             = useState("");
  const [bFrom, setBFrom]         = useState("");
  const [bTo, setBTo]             = useState("");
  const [metric, setMetric]       = useState("count");

  const fmt = n => typeof n === "number" ? (n % 1 === 0 ? String(n) : n.toFixed(1)) : "0";
  const metricLabel = { count:"Заказы", amount:"Сумма, т", margin:"Маржа, т" };
  const metricColor = { count:"#5B9AFF", amount:"#34D368", margin:"#F5A23A" };
  const pct = (a,b) => b === 0 ? (a > 0 ? 100 : 0) : Math.round(((a-b)/b)*100);

  const getRanges = () => {
    if (mode === "auto") {
      if (autoPreset === "week") {
        const a = currentWeek(), b = prevWeek();
        return [{ ...a, label:"Эта неделя" }, { ...b, label:"Прошлая неделя" }];
      }
      if (autoPreset === "month") {
        const a = currentAccountingMonth(), b = prevAccountingMonth();
        const now = new Date();
        return [
          { ...a, label: RU_MONTHS_FULL[now.getMonth()] },
          { ...b, label: RU_MONTHS_FULL[(now.getMonth()-1+12)%12] },
        ];
      }
      if (autoPreset === "year") {
        const y = new Date().getFullYear();
        return [{ ...accountingYear(y), label:String(y) }, { ...accountingYear(y-1), label:String(y-1) }];
      }
    }
    const parseR = (from,to) => ({
      start: from ? new Date(from+"T00:00:00") : new Date(0),
      end:   to   ? new Date(to+"T23:59:59")   : new Date(),
    });
    return [
      { ...parseR(aFrom,aTo),   label: (aFrom&&aTo) ? `${aFrom} — ${aTo}` : "Период А" },
      { ...parseR(bFrom,bTo),   label: (bFrom&&bTo) ? `${bFrom} — ${bTo}` : "Период Б" },
    ];
  };

  const [rangeA, rangeB] = getRanges();
  const ordA = filterOrdersByPeriod(orders, rangeA);
  const ordB = filterOrdersByPeriod(orders, rangeB);
  const aggA = aggregateByService(ordA);
  const aggB = aggregateByService(ordB);

  const totA = { count: ordA.length, amount: ordA.reduce((s,o)=>s+(parseFloat(o.amount)||0),0), margin: ordA.reduce((s,o)=>s+(parseFloat(o.margin)||0),0) };
  const totB = { count: ordB.length, amount: ordB.reduce((s,o)=>s+(parseFloat(o.amount)||0),0), margin: ordB.reduce((s,o)=>s+(parseFloat(o.margin)||0),0) };

  const colorA = "#5B9AFF";
  const colorB = "#F5A23A";

  const inputStyle = { background:"#181819", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, color:"rgba(255,255,255,0.85)", fontSize:13, padding:"9px 12px", outline:"none", fontFamily:"inherit", boxSizing:"border-box", width:"100%" };

  return (
    <div style={{flex:1,overflowY:"auto",WebkitOverflowScrolling:"touch",padding:"20px 16px"}}>
      {/* Header */}
      <div style={{marginBottom:20}}>
        <div style={{fontSize:22,fontWeight:800,color:"#FFFFFF",letterSpacing:"-0.03em"}}>Аналитика</div>
        <div style={{fontSize:12,color:"rgba(255,255,255,0.35)",marginTop:2}}>Сравнение двух периодов</div>
      </div>

      {/* Mode pills */}
      <div style={{display:"flex",gap:6,marginBottom:16}}>
        {[["auto","Быстрое"],["custom","Свои даты"]].map(([m,lbl]) => (
          <button key={m} onClick={()=>setMode(m)} style={{
            padding:"7px 16px", borderRadius:20,
            background: mode===m ? "#FFFFFF" : "rgba(255,255,255,0.07)",
            color: mode===m ? "#000000" : "rgba(255,255,255,0.55)",
            border:"none", fontSize:13, fontWeight: mode===m ? 700 : 500,
            cursor:"pointer", fontFamily:"inherit",
          }}>{lbl}</button>
        ))}
      </div>

      {mode === "auto" && (
        <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>
          {[["week","Неделя"],["month","Месяц"],["year","Год"]].map(([p,lbl]) => (
            <button key={p} onClick={()=>setAutoPreset(p)} style={{
              padding:"6px 14px", borderRadius:10,
              border:`1px solid ${autoPreset===p?"rgba(255,255,255,0.2)":"rgba(255,255,255,0.09)"}`,
              background: autoPreset===p ? "rgba(255,255,255,0.1)" : "transparent",
              color: autoPreset===p ? "#FFFFFF" : "rgba(255,255,255,0.4)",
              fontSize:12, fontWeight: autoPreset===p ? 600 : 400, cursor:"pointer", fontFamily:"inherit",
            }}>{lbl}</button>
          ))}
        </div>
      )}

      {mode === "custom" && (
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
          {[["A",colorA,aFrom,setAFrom,aTo,setATo],["Б",colorB,bFrom,setBFrom,bTo,setBTo]].map(([lbl,clr,vf,sf,vt,st]) => (
            <div key={lbl} style={{background:"#111112",border:`1px solid ${clr}22`,borderRadius:12,padding:"12px"}}>
              <div style={{fontSize:11,fontWeight:700,color:clr,marginBottom:8}}>Период {lbl}</div>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                <input type="date" value={vf} onChange={e=>sf(e.target.value)} style={inputStyle} placeholder="От"/>
                <input type="date" value={vt} onChange={e=>st(e.target.value)} style={inputStyle} placeholder="До"/>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Metric tabs */}
      <div style={{display:"flex",gap:6,marginBottom:20}}>
        {["count","amount","margin"].map(m => (
          <button key={m} onClick={()=>setMetric(m)} style={{
            flex:1, padding:"8px", borderRadius:10,
            background: metric===m ? "rgba(255,255,255,0.08)" : "transparent",
            border: `1px solid ${metric===m ? metricColor[m]+"55" : "rgba(255,255,255,0.08)"}`,
            color: metric===m ? metricColor[m] : "rgba(255,255,255,0.4)",
            fontSize:12, fontWeight: metric===m ? 700 : 500, cursor:"pointer", fontFamily:"inherit",
          }}>{metricLabel[m]}</button>
        ))}
      </div>

      {/* Period labels */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}}>
        {[[rangeA,colorA,totA],[rangeB,colorB,totB]].map(([range,clr,tot]) => (
          <div key={clr} style={{background:"#111112",border:`1px solid ${clr}33`,borderRadius:12,padding:"12px 14px"}}>
            <div style={{fontSize:10,fontWeight:700,color:clr,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:4}}>
              {range.label}
            </div>
            <div style={{fontSize:24,fontWeight:800,color:"#FFFFFF",letterSpacing:"-0.03em"}}>{fmt(tot[metric])}</div>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.35)",marginTop:2}}>
              {tot.count} заказ{tot.count===1?"":tot.count<5&&tot.count>1?"а":"ов"}
            </div>
          </div>
        ))}
      </div>

      {/* Delta card */}
      {(totA[metric] > 0 || totB[metric] > 0) && (() => {
        const d = pct(totA[metric], totB[metric]);
        const up = d >= 0;
        return (
          <div style={{background:"#111112",border:"1px solid rgba(255,255,255,0.07)",borderRadius:12,padding:"14px 16px",marginBottom:20,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginBottom:4}}>Изменение</div>
              <div style={{fontSize:26,fontWeight:800,color: up ? "#34D368" : "#F05050",letterSpacing:"-0.03em"}}>
                {up ? "+" : ""}{d}%
              </div>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.35)",marginTop:2}}>
                {up ? "▲" : "▼"} {fmt(Math.abs(totA[metric]-totB[metric]))}{metric!=="count"?" т":""}
              </div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:11,color:colorA,fontWeight:700,marginBottom:4}}>
                {rangeA.label}: {fmt(totA[metric])}{metric!=="count"?" т":""}
              </div>
              <div style={{fontSize:11,color:colorB,fontWeight:700}}>
                {rangeB.label}: {fmt(totB[metric])}{metric!=="count"?" т":""}
              </div>
            </div>
          </div>
        );
      })()}

      {/* By service comparison */}
      <div style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.4)",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:12}}>
        По услугам — {metricLabel[metric]}
      </div>

      <div style={{background:"#111112",border:"1px solid rgba(255,255,255,0.07)",borderRadius:14,padding:"16px",marginBottom:20}}>
        {SERVICES.filter(s=>!s.add).map(s => {
          const va = aggA[s.id]?.[metric] || 0;
          const vb = aggB[s.id]?.[metric] || 0;
          const maxV = Math.max(1, va, vb);
          return (
            <div key={s.id} style={{marginBottom:18}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:7}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:12,color:"rgba(255,255,255,0.85)",fontWeight:600}}>{s.label}</span>
                </div>
                <div style={{display:"flex",gap:14,fontSize:12}}>
                  <span style={{color:colorA,fontWeight:700}}>{fmt(va)}{metric!=="count"?" т":""}</span>
                  <span style={{color:colorB,fontWeight:700}}>{fmt(vb)}{metric!=="count"?" т":""}</span>
                </div>
              </div>
              {/* Bar A */}
              <div style={{height:6,background:"rgba(255,255,255,0.06)",borderRadius:3,overflow:"hidden",marginBottom:3}}>
                <div style={{width:`${(va/maxV)*100}%`,height:"100%",background:colorA,transition:"width 0.4s ease",borderRadius:3,opacity:0.85}}/>
              </div>
              {/* Bar B */}
              <div style={{height:6,background:"rgba(255,255,255,0.06)",borderRadius:3,overflow:"hidden"}}>
                <div style={{width:`${(vb/maxV)*100}%`,height:"100%",background:colorB,transition:"width 0.4s ease",borderRadius:3,opacity:0.8}}/>
              </div>
            </div>
          );
        })}
        {/* Legend */}
        <div style={{display:"flex",gap:16,marginTop:8,paddingTop:10,borderTop:"1px solid rgba(255,255,255,0.06)"}}>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <div style={{width:16,height:4,background:colorA,borderRadius:2}}/>
            <span style={{fontSize:11,color:colorA}}>{rangeA.label}</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <div style={{width:16,height:4,background:colorB,borderRadius:2}}/>
            <span style={{fontSize:11,color:colorB}}>{rangeB.label}</span>
          </div>
        </div>
      </div>

      {ordA.length === 0 && ordB.length === 0 && (
        <div style={{textAlign:"center",padding:"30px 0",color:"rgba(255,255,255,0.22)",fontSize:13}}>
          Нет данных за выбранные периоды
        </div>
      )}
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
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0,10));
  const [payNote, setPayNote] = useState("");
  const [manualAmount, setManualAmount] = useState("");
  const [manualMonth, setManualMonth] = useState(monthKey(new Date()));
  const [manualNote, setManualNote] = useState("");
  const [showManual, setShowManual] = useState(false);

  // Expenses state
  const [activeTab, setActiveTab] = useState("payments"); // "payments" | "expenses"
  const [expAmount, setExpAmount] = useState("");
  const [expDate, setExpDate] = useState(new Date().toISOString().slice(0,10));
  const [expNote, setExpNote] = useState("");
  const [confirmDelExpId, setConfirmDelExpId] = useState(null);

  const payments    = debts.payments    || [];
  const manualDebts = debts.manualDebts || [];
  const expenses    = debts.expenses    || [];

  // Собираем маржу из заказов по месяцам (только не отменённые заказы)
  const marginByMonth = {};
  orders.forEach(o => {
    if (o.status === "cancelled") return;
    const m = parseFloat(o.margin) || 0;
    if (m <= 0) return;
    const mk = monthKey(o.createdAt);
    if (!marginByMonth[mk]) marginByMonth[mk] = { total: 0, byService: {} };
    marginByMonth[mk].total += m;
    if (!marginByMonth[mk].byService[o.service]) marginByMonth[mk].byService[o.service] = 0;
    marginByMonth[mk].byService[o.service] += m;
  });

  // Добавим ручные долги в месяцы
  manualDebts.forEach(d => {
    if (!marginByMonth[d.month]) marginByMonth[d.month] = { total: 0, byService: {}, manual: 0 };
    if (!marginByMonth[d.month].manual) marginByMonth[d.month].manual = 0;
    marginByMonth[d.month].manual += d.amount;
    marginByMonth[d.month].total += d.amount;
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
        amount: a, date: payDate, note: payNote,
      }]
    }));
    setPayAmount(""); setPayNote("");
    setPayDate(new Date().toISOString().slice(0,10));
  };

  const handleDeletePayment = (id) => {
    setDebts(prev => ({
      ...prev,
      payments: (prev.payments || []).filter(p => p.id !== id),
    }));
  };

  const handleAddManual = () => {
    const a = parseFloat(manualAmount);
    if (!a || a <= 0) return;
    setDebts(prev => ({
      ...prev,
      manualDebts: [...(prev.manualDebts || []), {
        id: Date.now().toString(36),
        amount: a, month: manualMonth, note: manualNote,
      }]
    }));
    setManualAmount(""); setManualNote("");
    setShowManual(false);
  };

  const handleDeleteManual = (id) => {
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
    setExpDate(new Date().toISOString().slice(0,10));
  };

  const handleDeleteExpense = (id) => {
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
    <div style={{flex:1,overflowY:"auto",WebkitOverflowScrolling:"touch",padding:"18px 20px"}}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#FFFFFF", letterSpacing: "-0.02em" }}>Платежи</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>
          Учёт начислений, оплат и расходов бизнеса
        </div>
      </div>

      {/* Tab switcher: Долги / Расходы */}
      <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
        {[["payments","Долги и платежи"],["expenses","Расходы"]].map(([tab, label]) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: "8px 18px", borderRadius: 20,
            border: `1.5px solid ${activeTab === tab ? "rgba(0,122,255,0.6)" : "rgba(255,255,255,0.1)"}`,
            background: activeTab === tab ? "rgba(0,122,255,0.14)" : "transparent",
            color: activeTab === tab ? "#5B9AFF" : "rgba(255,255,255,0.45)",
            fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
          }}>{label}</button>
        ))}
      </div>

      {/* ── PAYMENTS TAB ──────────────────────────────── */}
      {activeTab === "payments" && (<>

      {/* Period selector */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14, alignItems: "center" }}>
        <button onClick={() => setSelectedMonth("all")} style={{
          padding: "6px 14px", borderRadius: 8,
          border: `1.5px solid ${selectedMonth === "all" ? "rgba(0,122,255,0.6)" : "rgba(255,255,255,0.1)"}`,
          background: selectedMonth === "all" ? "rgba(0,122,255,0.12)" : "transparent",
          color: selectedMonth === "all" ? "#5B9AFF" : "rgba(255,255,255,0.45)",
          fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
        }}>Всё время</button>
        {allMonths.map(m => (
          <button key={m} onClick={() => setSelectedMonth(m)} style={{
            padding: "6px 14px", borderRadius: 8,
            border: `1.5px solid ${selectedMonth === m ? "rgba(0,122,255,0.6)" : "rgba(255,255,255,0.1)"}`,
            background: selectedMonth === m ? "rgba(0,122,255,0.12)" : "transparent",
            color: selectedMonth === m ? "#5B9AFF" : "rgba(255,255,255,0.45)",
            fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
          }}>{monthLabel(m)}</button>
        ))}
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 18 }}>
        <div style={{ background: "#181819", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "14px 16px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#AF52DE", letterSpacing: "0.08em", textTransform: "uppercase" }}>Начислено</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#FFFFFF", marginTop: 4, letterSpacing: "-0.02em" }}>
            {fmtT(displayEarned)} <span style={{ fontSize: 16, color: "rgba(255,255,255,0.45)" }}>т</span>
          </div>
        </div>
        <div style={{ background: "#181819", border: "1px solid rgba(52,211,104,0.2)", borderRadius: 12, padding: "14px 16px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#34C759", letterSpacing: "0.08em", textTransform: "uppercase" }}>Получено</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#FFFFFF", marginTop: 4, letterSpacing: "-0.02em" }}>
            {fmtT(displayPaid)} <span style={{ fontSize: 16, color: "rgba(255,255,255,0.45)" }}>т</span>
          </div>
        </div>
        <div style={{ background: "#181819", border: displayDebt > 0.01 ? "1px solid rgba(240,80,80,0.3)" : "1px solid rgba(52,211,104,0.2)", borderRadius: 12, padding: "14px 16px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: displayDebt > 0.01 ? "#FF3B30" : "#34C759", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            {displayDebt > 0.01 ? "Должны мне" : "Рассчитались"}
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: displayDebt > 0.01 ? "#FF3B30" : "#34C759", marginTop: 4, letterSpacing: "-0.02em" }}>
            {displayDebt > 0.01 ? fmtT(displayDebt) : "✓"}
            {displayDebt > 0.01 && <span style={{ fontSize: 16, color: "rgba(255,255,255,0.45)" }}> т</span>}
          </div>
        </div>
      </div>

      {/* Add Payment */}
      <div style={{ background: "rgba(52,199,89,0.08)", border: "1px solid rgba(52,211,104,0.2)", borderRadius: 12, padding: "14px 16px", marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#34C759", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
          Записать оплату
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
          <input type="number" step="0.1" placeholder="Сумма в тоннах"
            value={payAmount} onChange={e => setPayAmount(e.target.value)}
            style={{
              background: "#181819", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8, color: "rgba(255,255,255,0.85)", fontSize: 13,
              padding: "9px 12px", outline: "none", fontFamily: "inherit",
              boxSizing: "border-box", width: "100%",
            }}
          />
          <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)}
            style={{
              background: "#181819", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8, color: "rgba(255,255,255,0.85)", fontSize: 13,
              padding: "9px 12px", outline: "none", fontFamily: "inherit",
              boxSizing: "border-box", width: "100%",
              WebkitAppearance: "none", appearance: "none",
            }}
          />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input type="text" placeholder="Комментарий (необязательно)"
            value={payNote} onChange={e => setPayNote(e.target.value)}
            style={{
              flex: 1, background: "#181819", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8, color: "rgba(255,255,255,0.85)", fontSize: 13,
              padding: "9px 12px", outline: "none", fontFamily: "inherit",
              boxSizing: "border-box",
            }}
          />
          <button onClick={handleAddPayment} disabled={!payAmount} style={{
            background: payAmount ? "rgba(52,199,89,0.12)" : "#111112",
            border: `1.5px solid ${payAmount ? "#22c55e88" : "rgba(255,255,255,0.08)"}`,
            color: payAmount ? "#34C759" : "rgba(255,255,255,0.35)",
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
          background: showManual ? "rgba(255,59,48,0.08)" : "transparent",
          border: `1.5px solid ${showManual ? "#ef444488" : "rgba(255,255,255,0.1)"}`,
          color: showManual ? "#FF3B30" : "rgba(255,255,255,0.45)",
          borderRadius: 8, padding: "6px 14px",
          fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
        }}>{showManual ? "Скрыть" : "+ Начислить долг вручную"}</button>
      </div>

      {/* Manual debt */}
      {showManual && (
        <div style={{ background: "rgba(255,59,48,0.08)", border: "1px solid #ef444433", borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#FF3B30", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
            📝 Ручное начисление
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
            <input type="number" step="0.1" placeholder="Сумма в тоннах"
              value={manualAmount} onChange={e => setManualAmount(e.target.value)}
              style={{
                background: "#181819", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8, color: "rgba(255,255,255,0.85)", fontSize: 13,
                padding: "9px 12px", outline: "none", fontFamily: "inherit",
                boxSizing: "border-box", width: "100%",
              }}
            />
            <input type="month" value={manualMonth} onChange={e => setManualMonth(e.target.value)}
              style={{
                background: "#181819", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8, color: "rgba(255,255,255,0.85)", fontSize: 13,
                padding: "9px 12px", outline: "none", fontFamily: "inherit",
                boxSizing: "border-box", width: "100%",
                WebkitAppearance: "none", appearance: "none",
              }}
            />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input type="text" placeholder="За что (необязательно)"
              value={manualNote} onChange={e => setManualNote(e.target.value)}
              style={{
                flex: 1, background: "#181819", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8, color: "rgba(255,255,255,0.85)", fontSize: 13,
                padding: "9px 12px", outline: "none", fontFamily: "inherit",
                boxSizing: "border-box",
              }}
            />
            <button onClick={handleAddManual} disabled={!manualAmount} style={{
              background: manualAmount ? "rgba(255,59,48,0.12)" : "#111112",
              border: `1.5px solid ${manualAmount ? "#ef444488" : "rgba(255,255,255,0.08)"}`,
              color: manualAmount ? "#FF3B30" : "rgba(255,255,255,0.35)",
              borderRadius: 8, padding: "9px 20px",
              fontSize: 13, fontWeight: 800,
              cursor: manualAmount ? "pointer" : "not-allowed",
              fontFamily: "inherit", whiteSpace: "nowrap",
            }}>Начислить</button>
          </div>
        </div>
      )}

      {/* Monthly breakdown */}
      <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.45)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
        По месяцам
      </div>

      {allMonths.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 0", color: "rgba(255,255,255,0.18)", fontSize: 13 }}>
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
            background: "#181819", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12, padding: "14px 16px", marginBottom: 8,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#FFFFFF" }}>{monthLabel(m)}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>
                {fmtT(paidToMonth)} / {fmtT(earned)} т
              </div>
            </div>

            {/* Progress bar */}
            <div style={{ height: 6, background: "#111112", borderRadius: 3, overflow: "hidden", marginBottom: 10 }}>
              <div style={{
                width: `${Math.min(100, pct)}%`, height: "100%",
                background: debt > 0.01 ? "linear-gradient(90deg, #22c55e, #22c55eaa)" : "#34C759",
                transition: "width 0.4s ease",
              }}/>
            </div>

            {/* By service + manual */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
              {Object.entries(data.byService || {}).map(([svcId, amt]) => {
                const svc = SERVICES.find(s => s.id === svcId);
                if (!svc) return null;
                return (
                  <span key={svcId} style={{
                    fontSize: 11, padding: "3px 10px", borderRadius: 6,
                    background: svc.color + "18", color: svc.color, fontWeight: 700,
                  }}>
                    {fmtT(amt)} т
                  </span>
                );
              })}
              {data.manual > 0 && (
                <span style={{
                  fontSize: 11, padding: "3px 10px", borderRadius: 6,
                  background: "#ef444418", color: "#FF3B30", fontWeight: 700,
                }}>
                  📝 {fmtT(data.manual)} т (ручное)
                </span>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
              <span style={{ color: debt > 0.01 ? "#FF3B30" : "#34C759", fontWeight: 700 }}>
                {debt > 0.01 ? `Долг: ${fmtT(debt)} т` : "✓ Полностью оплачено"}
              </span>
              {earned > 0 && (
                <span style={{ color: "rgba(255,255,255,0.45)" }}>
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
          <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.45)", letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 20, marginBottom: 10 }}>
            История оплат ({payments.length})
          </div>
          <div style={{ background: "#181819", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "6px" }}>
            {[...payments].sort((a,b) => (b.date||"").localeCompare(a.date||"")).map(p => (
              <div key={p.id} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "8px 12px", borderRadius: 8,
              }}>
                <div style={{ fontSize: 12 }}>
                  <span style={{ color: "rgba(255,255,255,0.45)" }}>{fmtDateShort(p.date)}</span>
                  {p.note && <span style={{ color: "rgba(255,255,255,0.35)", marginLeft: 8 }}>· {p.note}</span>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#34C759" }}>+{fmtT(p.amount)} т</span>
                  <button
                    onClick={() => {
                      if (confirmDelId === p.id) { handleDeletePayment(p.id); setConfirmDelId(null); }
                      else { setConfirmDelId(p.id); setTimeout(()=>setConfirmDelId(x => x===p.id ? null : x), 3000); }
                    }}
                    style={{
                      background: confirmDelId === p.id ? "#ef444422" : "transparent",
                      border: `1px solid ${confirmDelId === p.id ? "#ef444488" : "transparent"}`,
                      color: confirmDelId === p.id ? "#FF3B30" : "#3a1a1a",
                      borderRadius: 6, padding: "3px 9px",
                      fontSize: 11, fontWeight: confirmDelId === p.id ? 800 : 500,
                      cursor: "pointer", fontFamily: "inherit",
                      transition: "all 0.15s",
                    }}
                   style={{fontFamily:"inherit"}}>✕</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Manual debts history */}
      {manualDebts.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.45)", letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 20, marginBottom: 10 }}>
            Ручные начисления ({manualDebts.length})
          </div>
          <div style={{ background: "#181819", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "6px" }}>
            {[...manualDebts].sort((a,b) => (b.month||"").localeCompare(a.month||"")).map(d => (
              <div key={d.id} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "8px 12px", borderRadius: 8,
              }}>
                <div style={{ fontSize: 12 }}>
                  <span style={{ color: "rgba(255,255,255,0.45)" }}>{monthLabel(d.month)}</span>
                  {d.note && <span style={{ color: "rgba(255,255,255,0.35)", marginLeft: 8 }}>· {d.note}</span>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#FF3B30" }}>+{fmtT(d.amount)} т</span>
                  <button
                    onClick={() => {
                      if (confirmDelId === d.id) { handleDeleteManual(d.id); setConfirmDelId(null); }
                      else { setConfirmDelId(d.id); setTimeout(()=>setConfirmDelId(x => x===d.id ? null : x), 3000); }
                    }}
                    style={{
                      background: confirmDelId === d.id ? "#ef444422" : "transparent",
                      border: `1px solid ${confirmDelId === d.id ? "#ef444488" : "transparent"}`,
                      color: confirmDelId === d.id ? "#FF3B30" : "#3a1a1a",
                      borderRadius: 6, padding: "3px 9px",
                      fontSize: 11, fontWeight: confirmDelId === d.id ? 800 : 500,
                      cursor: "pointer", fontFamily: "inherit",
                      transition: "all 0.15s",
                    }}
                   style={{fontFamily:"inherit"}}>✕</button>
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
          <div style={{ background: "rgba(255,149,0,0.08)", border: "1px solid rgba(255,149,0,0.25)", borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#FF9500", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
              Добавить расход
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
              <input type="number" step="1" placeholder="Сумма, ₽"
                value={expAmount} onChange={e => setExpAmount(e.target.value)}
                style={{
                  background: "#181819", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8, color: "rgba(255,255,255,0.85)", fontSize: 13,
                  padding: "9px 12px", outline: "none", fontFamily: "inherit", boxSizing: "border-box",
                }}
              />
              <input type="date" value={expDate} onChange={e => setExpDate(e.target.value)}
                style={{
                  background: "#181819", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8, color: "rgba(255,255,255,0.85)", fontSize: 13,
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
                  flex: 1, background: "#181819", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8, color: "rgba(255,255,255,0.85)", fontSize: 13,
                  padding: "9px 12px", outline: "none", fontFamily: "inherit", boxSizing: "border-box",
                }}
              />
              <button onClick={handleAddExpense} disabled={!expAmount} style={{
                background: expAmount ? "rgba(255,149,0,0.12)" : "#111112",
                border: `1.5px solid ${expAmount ? "rgba(255,149,0,0.5)" : "rgba(255,255,255,0.08)"}`,
                color: expAmount ? "#FF9500" : "rgba(255,255,255,0.35)",
                borderRadius: 8, padding: "9px 20px",
                fontSize: 13, fontWeight: 800,
                cursor: expAmount ? "pointer" : "not-allowed",
                fontFamily: "inherit", whiteSpace: "nowrap",
              }}>Записать</button>
            </div>
          </div>

          {/* Total */}
          {expenses.length > 0 && (
            <div style={{ background: "#181819", border: "1px solid rgba(255,149,0,0.2)", borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#FF9500", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>Итого расходов</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#FF9500", letterSpacing: "-0.02em" }}>
                {expenses.reduce((s,e) => s + (parseFloat(e.amount)||0), 0).toLocaleString("ru-RU")}
                <span style={{ fontSize: 16, color: "rgba(255,255,255,0.45)", marginLeft: 6 }}>₽</span>
              </div>
            </div>
          )}

          {/* List */}
          {expenses.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "rgba(255,255,255,0.18)", fontSize: 13 }}>
              Расходов пока нет — добавьте первый
            </div>
          ) : (
            <div style={{ background: "#181819", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "6px" }}>
              {[...expenses].sort((a,b) => (b.date||"").localeCompare(a.date||"")).map(exp => (
                <div key={exp.id} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "10px 12px", borderRadius: 8,
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>
                      {exp.note || <span style={{ color: "rgba(255,255,255,0.35)", fontStyle: "italic" }}>Без назначения</span>}
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{fmtDateShort(exp.date)}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: "#FF9500" }}>
                      −{parseFloat(exp.amount).toLocaleString("ru-RU")} ₽
                    </span>
                    <button
                      onClick={() => {
                        if (confirmDelExpId === exp.id) { handleDeleteExpense(exp.id); setConfirmDelExpId(null); }
                        else { setConfirmDelExpId(exp.id); setTimeout(()=>setConfirmDelExpId(x => x===exp.id ? null : x), 3000); }
                      }}
                      style={{
                        background: confirmDelExpId === exp.id ? "#ef444422" : "transparent",
                        border: `1px solid ${confirmDelExpId === exp.id ? "#ef444488" : "transparent"}`,
                        color: confirmDelExpId === exp.id ? "#FF3B30" : "#3a1a1a",
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
  const todayStr = today.toISOString().slice(0,10);
  const fmt = n => n % 1 === 0 ? String(n) : n.toFixed(1);

  // ── Today's orders ──────────────────────────────────────────────────────────
  const todayOrders = orders.filter(o => {
    // Check createdAt (always set) OR the scheduled date field
    const createdDay = o.createdAt ? o.createdAt.slice(0,10) : null;
    const scheduledDay = o.date ? o.date.slice(0,10) : null;
    return createdDay === todayStr || scheduledDay === todayStr;
  });

  // ── Week KPI ────────────────────────────────────────────────────────────────
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay() + (today.getDay()===0?-6:1));
  const weekOrders = orders.filter(o => {
    if (!o.createdAt) return false;
    const d = new Date(o.createdAt); d.setHours(0,0,0,0);
    return d >= weekStart && d <= today;
  });
  const weekAmount = weekOrders.reduce((s,o)=>s+(parseFloat(o.amount)||0),0);
  const weekMargin = weekOrders.reduce((s,o)=>s+(parseFloat(o.margin)||0),0);
  const weekDone   = weekOrders.filter(o=>o.status==="done").length;

  // prev week
  const prevWeekStart = new Date(weekStart); prevWeekStart.setDate(prevWeekStart.getDate()-7);
  const prevWeekEnd   = new Date(weekStart); prevWeekEnd.setDate(prevWeekEnd.getDate()-1);
  const prevWeekOrders = orders.filter(o => {
    if (!o.createdAt) return false;
    const d = new Date(o.createdAt); d.setHours(0,0,0,0);
    return d >= prevWeekStart && d <= prevWeekEnd;
  });
  const prevAmount = prevWeekOrders.reduce((s,o)=>s+(parseFloat(o.amount)||0),0);
  const deltaAmt = prevAmount===0 ? null : Math.round(((weekAmount-prevAmount)/prevAmount)*100);

  // ── Debts ────────────────────────────────────────────────────────────────────
  const totalDebt = (() => {
    const totalPayable = orders.reduce((s,o)=>{
      if (o.status==="done"||o.status==="cancelled") return s;
      return s + (parseFloat(o.amount)||0);
    },0);
    const paid = (debts.payments||[]).reduce((s,p)=>s+(parseFloat(p.amount)||0),0);
    const manual = (debts.manualDebts||[]).filter(d=>d.active!==false).reduce((s,d)=>s+(parseFloat(d.amount)||0),0);
    return Math.max(0, totalPayable - paid + manual);
  })();
  const openDebts = (debts.manualDebts||[]).filter(d=>d.active!==false);

  // ── Active / new orders ──────────────────────────────────────────────────────
  const activeOrders = orders.filter(o=>o.status==="working"||o.status==="queue");
  const newOrders    = orders.filter(o=>o.status==="new");

  // ── Leads from localStorage ──────────────────────────────────────────────────
  const leads = (() => { try { return JSON.parse(localStorage.getItem("leads_data_v2")||"[]"); } catch { return []; }})();
  const newLeads  = leads.filter(l=>l.status==="new");
  const hotLeads  = leads.filter(l=>l.status==="callback");

  // ── Recent orders (last 5) ───────────────────────────────────────────────────
  const recentOrders = [...orders]
    .sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||""))
    .slice(0,5);

  const greetHour = new Date().getHours();
  const greet = greetHour < 12 ? "Доброе утро" : greetHour < 18 ? "Добрый день" : "Добрый вечер";
  const weekDayNames = ["Воскресенье","Понедельник","Вторник","Среда","Четверг","Пятница","Суббота"];
  const monthNames = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];

  const statusColors = { new:"#5B9AFF",queue:"#FF9500",working:"#AF52DE",done:"#34C759",cancelled:"#FF3B30" };
  const statusLabels = { new:"Новый",queue:"Очередь",working:"В работе",done:"Выполнен",cancelled:"Отменён" };

  return (
    <div style={{flex:1,overflowY:"auto",WebkitOverflowScrolling:"touch",background:"#0A0A0B"}}>

      {/* ── HEADER ── */}
      <div style={{padding:"22px 18px 4px"}}>
        <div style={{fontSize:13,color:"rgba(255,255,255,0.38)",fontWeight:500,marginBottom:4}}>
          {weekDayNames[new Date().getDay()]}, {new Date().getDate()} {monthNames[new Date().getMonth()]}
        </div>
        <div style={{fontSize:28,fontWeight:800,color:"#FFFFFF",letterSpacing:"-0.04em",lineHeight:1.1}}>
          {greet} 👋
        </div>
      </div>

      {/* ── WEEK KPI STRIP ── */}
      <div style={{padding:"20px 18px 0"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.4)",letterSpacing:"0.08em",textTransform:"uppercase"}}>
            Эта неделя
          </div>
          {deltaAmt !== null && (
            <div style={{fontSize:12,fontWeight:600,color:deltaAmt>=0?"#34D368":"#F05050"}}>
              {deltaAmt>=0?"+":""}{deltaAmt}% к прошлой
            </div>
          )}
        </div>

        {/* KPI row — 4 cards */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {/* Большая карточка — выручка */}
          <div onClick={()=>onNavigate("report")} style={{
            background:"#141415",borderRadius:18,padding:"18px 20px",
            border:"1px solid rgba(255,255,255,0.08)",cursor:"pointer",gridRow:"span 2",
            display:"flex",flexDirection:"column",justifyContent:"space-between",minHeight:140,
          }}>
            <div style={{fontSize:11,fontWeight:700,color:"#34D368",letterSpacing:"0.08em",textTransform:"uppercase"}}>Выручка</div>
            <div>
              <div style={{fontSize:42,fontWeight:800,color:"#FFFFFF",letterSpacing:"-0.05em",lineHeight:1}}>
                {fmt(weekAmount)}
              </div>
              <div style={{fontSize:13,color:"rgba(255,255,255,0.4)",marginTop:4}}>тонн за неделю</div>
            </div>
          </div>

          {/* Заказов */}
          <div onClick={()=>onNavigate("orders")} style={{
            background:"#141415",borderRadius:18,padding:"14px 16px",
            border:"1px solid rgba(255,255,255,0.08)",cursor:"pointer",
          }}>
            <div style={{fontSize:9,fontWeight:700,color:"#AC87F7",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:6}}>Заказов</div>
            <div style={{display:"flex",alignItems:"baseline",gap:6}}>
              <div style={{fontSize:28,fontWeight:800,color:"#FFFFFF",letterSpacing:"-0.04em"}}>{weekOrders.length}</div>
              {weekDone>0&&<div style={{fontSize:12,color:"#34D368",fontWeight:600}}>✓{weekDone}</div>}
            </div>
          </div>

          {/* Маржа */}
          <div onClick={()=>onNavigate("report")} style={{
            background:"#141415",borderRadius:18,padding:"14px 16px",
            border:"1px solid rgba(255,255,255,0.08)",cursor:"pointer",
          }}>
            <div style={{fontSize:9,fontWeight:700,color:"#F5A23A",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:6}}>Маржа</div>
            <div style={{fontSize:28,fontWeight:800,color:"#FFFFFF",letterSpacing:"-0.04em"}}>{fmt(weekMargin)}<span style={{fontSize:12,fontWeight:500,color:"rgba(255,255,255,0.4)",marginLeft:2}}>т</span></div>
          </div>
        </div>
      </div>

      {/* ── ALERT STRIP — долги и активные ── */}
      {(totalDebt > 0.01 || activeOrders.length > 0 || newOrders.length > 0) && (
        <div style={{padding:"16px 18px 0",display:"flex",flexDirection:"column",gap:8}}>
          {totalDebt > 0.01 && (
            <div onClick={()=>onNavigate("debts")} style={{
              background:"rgba(240,80,80,0.08)",border:"1px solid rgba(240,80,80,0.25)",
              borderRadius:14,padding:"12px 16px",cursor:"pointer",
              display:"flex",alignItems:"center",justifyContent:"space-between",
            }}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:"#F05050",flexShrink:0}}/>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:"#F05050"}}>Незакрытые долги</div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginTop:1}}>
                    {openDebts.length} позиц{openDebts.length===1?"ия":openDebts.length<5?"ии":"ий"} · открыть раздел
                  </div>
                </div>
              </div>
              <div style={{fontSize:20,fontWeight:800,color:"#F05050",letterSpacing:"-0.03em"}}>{fmt(totalDebt)}<span style={{fontSize:11,marginLeft:2,fontWeight:500}}>т</span></div>
            </div>
          )}

          {(activeOrders.length > 0 || newOrders.length > 0) && (
            <div onClick={()=>onNavigate("orders")} style={{
              background:"rgba(91,154,255,0.07)",border:"1px solid rgba(91,154,255,0.2)",
              borderRadius:14,padding:"12px 16px",cursor:"pointer",
              display:"flex",alignItems:"center",justifyContent:"space-between",
            }}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:"#5B9AFF",flexShrink:0}}/>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:"#5B9AFF"}}>
                    {activeOrders.length} в работе{newOrders.length>0?` · ${newOrders.length} новых`:""}
                  </div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginTop:1}}>незавершённые заказы</div>
                </div>
              </div>
              <div style={{fontSize:20,fontWeight:800,color:"#5B9AFF",letterSpacing:"-0.03em"}}>{activeOrders.length+newOrders.length}</div>
            </div>
          )}
        </div>
      )}

      {/* ── LEADS BLOCK ── */}
      {(newLeads.length > 0 || hotLeads.length > 0) && (
        <div style={{padding:"16px 18px 0"}}>
          <div style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.4)",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:10}}>
            Лиды
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {newLeads.length > 0 && (
              <div style={{background:"#141415",border:"1px solid rgba(255,255,255,0.08)",borderRadius:18,padding:"16px 18px"}}>
                <div style={{fontSize:9,fontWeight:700,color:"#5B9AFF",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:8}}>Новых</div>
                <div style={{fontSize:36,fontWeight:800,color:"#FFFFFF",letterSpacing:"-0.04em",lineHeight:1}}>{newLeads.length}</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginTop:6}}>ждут обработки</div>
              </div>
            )}
            {hotLeads.length > 0 && (
              <div style={{background:"#141415",border:"1px solid rgba(245,162,58,0.2)",borderRadius:18,padding:"16px 18px"}}>
                <div style={{fontSize:9,fontWeight:700,color:"#F5A23A",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:8}}>Перезвонить</div>
                <div style={{fontSize:36,fontWeight:800,color:"#FFFFFF",letterSpacing:"-0.04em",lineHeight:1}}>{hotLeads.length}</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginTop:6}}>ждут звонка</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TODAY'S ORDERS ── */}
      <div style={{padding:"20px 18px 0"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.4)",letterSpacing:"0.08em",textTransform:"uppercase"}}>
            Сегодня
          </div>
          <div style={{fontSize:12,color:"rgba(255,255,255,0.3)"}}>
            {new Date().getDate()} {monthNames[new Date().getMonth()]}
          </div>
        </div>

        {todayOrders.length === 0 ? (
          <div style={{
            background:"#141415",border:"1px solid rgba(255,255,255,0.07)",
            borderRadius:18,padding:"28px 20px",textAlign:"center",
          }}>
            <div style={{fontSize:13,color:"rgba(255,255,255,0.3)"}}>Заказов на сегодня нет</div>
            <button onClick={()=>onNavigate("form")} style={{
              marginTop:12,background:"#FFFFFF",color:"#000000",
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
                  background:"#141415",border:"1px solid rgba(255,255,255,0.08)",
                  borderRadius:16,padding:"14px 16px",cursor:"pointer",
                  display:"flex",alignItems:"center",gap:12,
                }}>
                  <div style={{width:4,alignSelf:"stretch",borderRadius:2,background:svc?.color||"#5B9AFF",flexShrink:0}}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:14,fontWeight:700,color:"#FFFFFF",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      {o.clientName || "Клиент"}
                    </div>
                    <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginTop:2,display:"flex",gap:8}}>
                      <span>{svc?.label}</span>
                      {o.address && <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:160}}>· {o.address}</span>}
                    </div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4,flexShrink:0}}>
                    <div style={{
                      fontSize:10,fontWeight:700,color:st.color,
                      background:st.color+"18",borderRadius:6,padding:"2px 8px",
                    }}>{st.label}</div>
                    {o.amount && <div style={{fontSize:13,fontWeight:700,color:"rgba(255,255,255,0.7)"}}>{fmt(parseFloat(o.amount))} т</div>}
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
            <div style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.4)",letterSpacing:"0.08em",textTransform:"uppercase"}}>
              Последние заказы
            </div>
            <button onClick={()=>onNavigate("orders")} style={{
              background:"transparent",border:"none",color:"#5B9AFF",
              fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",
            }}>Все →</button>
          </div>

          <div style={{background:"#141415",border:"1px solid rgba(255,255,255,0.07)",borderRadius:18,overflow:"hidden"}}>
            {recentOrders.map((o,i) => {
              const svc = SERVICES.find(s=>s.id===o.service);
              const st  = getOrderStatus(o.status);
              const d   = o.createdAt ? new Date(o.createdAt) : null;
              return (
                <div key={o.id} onClick={()=>onNavigate("orders")} style={{
                  display:"flex",alignItems:"center",gap:12,
                  padding:"12px 16px",cursor:"pointer",
                  borderBottom: i<recentOrders.length-1 ? "1px solid rgba(255,255,255,0.06)" : "none",
                }}>
                  <div style={{width:6,height:6,borderRadius:"50%",background:st.color,flexShrink:0}}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:600,color:"rgba(255,255,255,0.9)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      {o.clientName || "Клиент"} <span style={{color:"rgba(255,255,255,0.35)",fontWeight:400}}>· {svc?.label}</span>
                    </div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:2,flexShrink:0}}>
                    {o.amount && <div style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,0.6)"}}>{fmt(parseFloat(o.amount))} т</div>}
                    {d && <div style={{fontSize:10,color:"rgba(255,255,255,0.28)"}}>{d.getDate()} {monthNames[d.getMonth()]}</div>}
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
          <div style={{fontSize:15,fontWeight:700,color:"rgba(255,255,255,0.6)",marginBottom:8}}>Добро пожаловать!</div>
          <div style={{fontSize:13,color:"rgba(255,255,255,0.35)",marginBottom:20}}>Создайте первый заказ чтобы начать работу</div>
          <button onClick={()=>onNavigate("form")} style={{
            background:"#FFFFFF",color:"#000000",border:"none",borderRadius:12,
            padding:"12px 28px",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
          }}>+ Новый заказ</button>
        </div>
      )}

      <div style={{height:24}}/>
    </div>
  );
}


function DispatchApp() {
  const [activeService, setActiveService] = useState("trash");
  const [activeView, setActiveView] = useState("home"); // "home" | "form" | "orders" | ...
  const [forms, setForms] = useState({ trash:{}, sawdust:{}, offcuts:{} });
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

  // Сохраняем заказы в localStorage
  useEffect(() => {
    localStorage.setItem("dispatch_orders", JSON.stringify(orders));
  }, [orders]);

  // Сохраняем долги в localStorage
  useEffect(() => {
    localStorage.setItem("dispatch_debts_v2", JSON.stringify(debts));
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
  const [sheetsUrl, setSheetsUrl] = useState("");
  const [sheetsStatus, setSheetsStatus] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  const f = forms[activeService] || {};
  const setField = useCallback((key, val) => {
    setForms(prev => ({ ...prev, [activeService]: { ...prev[activeService], [key]: val } }));
  }, [activeService]);
  const clearForm = () => setForms(prev => ({ ...prev, [activeService]: {} }));

  const gen = GENERATORS[activeService];
  const message = gen ? gen(f) : "";

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
        if (data.orders) {
          localStorage.setItem("dispatch_orders", JSON.stringify(data.orders));
          setOrders(data.orders);
        }
        if (data.debts) {
          localStorage.setItem("dispatch_debts_v2", JSON.stringify(data.debts));
          setDebts(data.debts);
        }
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
    const order = {
      id: "ORD-" + Date.now().toString(36).toUpperCase(),
      createdAt: new Date().toISOString(),
      service: activeService,
      status: "new",
      clientName: f.clientName || "",
      phone: f.phone || "",
      address: f.address || "",
      amount: f.amount || "",
      margin: f.margin || "",
      date: f.date || "",
      hour: f.hour || "",
      message,
      summary: message.split("\n")[0] || "Заказ",
      data: { ...f },
    };
    setOrders(prev => [order, ...prev]);
    setOrderSaved(true);
    setTimeout(() => {
      setOrderSaved(false);
      setActiveView("orders"); // показать заказ в списке после сохранения
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

      // ── Address — find non-service, non-phone, non-date lines ────────
      let address = "";
      const skipPatterns = /^(\+7|8\s*\(|📆|📅|🕐|📍|Б[\.\/]н|ООО|ИП|https?:|\d{2}\.\d{2}\.|Дата:|Время:|Поставить|Откатать|Заменить|\d+м)/i;
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
    setCalStatus("loading"); setCalMsg("Создаю событие...");
    try {
      await createCalendarEvent(activeService, f, message);
      setCalStatus("ok"); setCalMsg("Событие создано ✓");
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

  const FormComponent = FORMS[activeService];
  const activeSvc = SERVICES.find(s => s.id === activeService);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0A0A0B",
      color: "rgba(255,255,255,0.85)",
      fontFamily: "'Outfit',-apple-system,sans-serif",
      display: "flex",
      flexDirection: "column",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&display=swap');
        *{box-sizing:border-box;-webkit-font-smoothing:antialiased}
        ::-webkit-scrollbar{display:none}
        select option{background:#1C1C1E}
        input[type=date]{-webkit-appearance:none;appearance:none;line-height:normal}
        input[type=date]::-webkit-calendar-picker-indicator{filter:invert(0.6);cursor:pointer}
        input[type=number]::-webkit-inner-spin-button{opacity:0.3}
        textarea{resize:none}
      `}</style>

      {/* TOP BAR */}
      <div style={{
        background: "#0A0A0B",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
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
            background: "#1A1A1B",
            border: "1px solid rgba(255,255,255,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}><LogoSvg size={16}/></div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: "-0.02em", color: "#FFFFFF" }}>Заказы</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: "0.06em", fontWeight: 600 }}>ЗАЯВКИ · CALENDAR · SHEETS</div>
          </div>
        </div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          style={{
            background: showSettings ? "rgba(0,122,255,0.12)" : "transparent",
            border: "1px solid " + (showSettings ? "rgba(0,122,255,0.6)" : "rgba(255,255,255,0.1)"),
            color: showSettings ? "#5B9AFF" : "rgba(255,255,255,0.45)",
            borderRadius: 8, padding: "5px 12px", cursor: "pointer",
            fontSize: 12, fontWeight: 600, fontFamily: "inherit",
          }}
        >Настройки</button>
      </div>

      {/* SETTINGS PANEL */}
      {showSettings && (
        <div style={{
          background: "#111112", borderBottom: "1px solid rgba(255,255,255,0.07)",
          padding: "14px 20px", display: "flex", flexDirection: "column", gap: 14,
        }}>

          {/* Google Sheets URL */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 8 }}>
              Google Sheets — URL Apps Script
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <input
                type="url"
                placeholder="https://script.google.com/macros/s/YOUR_ID/exec"
                value={sheetsUrl}
                onChange={e => setSheetsUrl(e.target.value)}
                style={{
                  flex: 1, background: "#181819", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 9, color: "rgba(255,255,255,0.85)", fontSize: 12,
                  padding: "8px 12px", outline: "none", fontFamily: "inherit",
                }}
              />
              {sheetsUrl && <span style={{ color: "#34C759", fontSize: 12, alignSelf: "center" }}>✓ Сохранён</span>}
            </div>
          </div>

          {/* Export / Import */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 8 }}>
              Резервная копия данных
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginBottom: 10 }}>
              Экспорт сохраняет все заказы и долги в JSON-файл на устройство. Импорт восстанавливает данные из файла.
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>

              {/* Export button */}
              <button onClick={handleExport} style={{
                background: "rgba(52,199,89,0.12)", border: "1.5px solid #22c55e55",
                color: "#34C759", borderRadius: 9, padding: "8px 18px",
                fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", gap: 6,
              }}>
                Экспорт данных
              </button>

              {/* Import button */}
              <label style={{
                background: "rgba(0,122,255,0.12)", border: "1.5px solid #2a5aad",
                color: "#5B9AFF", borderRadius: 9, padding: "8px 18px",
                fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", gap: 6,
              }}>
                Импорт данных
                <input type="file" accept=".json" onChange={handleImport} style={{ display: "none" }}/>
              </label>

              {/* Status */}
              {importStatus === "ok" && (
                <span style={{ fontSize: 12, color: "#34C759", fontWeight: 700 }}>✓ Данные восстановлены!</span>
              )}
              {importStatus === "err" && (
                <span style={{ fontSize: 12, color: "#FF3B30", fontWeight: 700 }}>✗ Неверный файл</span>
              )}
            </div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.18)", marginTop: 8 }}>
              Файл сохраняется как <code style={{color:"rgba(255,255,255,0.45)"}}>dispatcher_backup_ДАТА.json</code> — храни в iCloud или Google Drive.
            </div>
          </div>
        </div>
      )}

      {/* PREFILL BANNER */}
      {prefillBanner && (
        <div style={{
          background:"rgba(52,199,89,0.12)", borderBottom:"1px solid #22c55e33",
          padding:"10px 20px", display:"flex", alignItems:"center", gap:10,
          flexShrink:0,
        }}>
          
          <div>
            <span style={{fontSize:13,fontWeight:700,color:"#34C759"}}>Данные из лида подгружены: </span>
            <span style={{fontSize:13,color:"#1a6a3a"}}>{prefillBanner}</span>
          </div>
          <button onClick={()=>setPrefillBanner(null)} style={{marginLeft:"auto",background:"transparent",border:"none",color:"#1a4a2a",fontSize:16,cursor:"pointer"}}>✕</button>
        </div>
      )}

      {/* TOP NAV — Новый заказ / Заказы / Отчёт / Аналитика */}
      <div style={{
        display: "flex",
        background: "#0A0A0B",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        flexShrink: 0,
        overflowX: "auto",
      }}>
        {[
          { id: "home",      icon: "home",    label: "Главная",    color: "#FFFFFF" },
          { id: "form",      icon: "plus",    label: "Новый заказ",color: "#5B9AFF" },
          { id: "orders",    icon: "package", label: "Заказы",     color: "#AC87F7", badge: orders.length },
          { id: "debts",     icon: "wallet",  label: "Платежи",    color: "#F05050" },
          { id: "report",    icon: "chart",   label: "Отчёт",      color: "#34D368" },
          { id: "analytics", icon: "trending",label: "Аналитика",  color: "#F5A23A" },
        ].map(t => {
          const active = activeView === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveView(t.id)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "0 20px", height: 50, cursor: "pointer",
                background: active ? "#181819" : "transparent",
                border: "none",
                borderBottom: `3px solid ${active ? t.color : "transparent"}`,
                color: active ? t.color : "rgba(255,255,255,0.45)",
                fontSize: 13, fontWeight: active ? 800 : 600,
                transition: "all 0.15s", fontFamily: "inherit",
                flexShrink: 0, whiteSpace: "nowrap",
              }}
            >
              <IcNav name={t.icon} size={15}/>
              {t.label}
              {t.badge > 0 && (
                <span style={{
                  background: active ? t.color + "33" : "rgba(255,255,255,0.08)",
                  color: active ? t.color : "rgba(255,255,255,0.45)",
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
          background: "#111112",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          overflowX: "auto",
          flexShrink: 0,
          padding: "0 6px",
        }}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.35)",
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
                color: "rgba(255,255,255,0.35)", fontSize: 16, fontWeight: 700,
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
                  background: active ? "#181819" : "transparent",
                  border: "none",
                  borderBottom: `2px solid ${active ? svc.color : "transparent"}`,
                  color: active ? svc.color : "rgba(255,255,255,0.45)",
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
        <OrdersView orders={orders} setOrders={setOrders} onRepeat={handleRepeatOrder}/>
      ) : activeView === "debts" ? (
        <DebtsView orders={orders} debts={debts} setDebts={setDebts}/>
      ) : activeView === "report" ? (
        <ReportView orders={orders}/>
      ) : activeView === "analytics" ? (
        <AnalyticsView orders={orders}/>
      ) : (
      <div style={{
        flex: 1,
        display: "grid",
        gridTemplateColumns: showPreview ? "1fr 320px" : "1fr",
        gap: 0,
        minHeight: 0,
        position: "relative",
      }}>
        {/* LEFT — FORM */}
        <div style={{
          overflowY: "auto",
          padding: "16px 20px",
          borderRight: showPreview ? "1px solid rgba(255,255,255,0.07)" : "none",
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
                  background: showParser ? "#181818" : "transparent",
                  border: `1px solid ${showParser ? "#3a6a2a" : "rgba(255,255,255,0.1)"}`,
                  color: showParser ? "#6aaa4a" : "rgba(255,255,255,0.45)",
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
                  background: showPreview ? "rgba(0,122,255,0.12)" : "#111112",
                  border: `1px solid ${showPreview ? "rgba(0,122,255,0.6)" : "rgba(255,255,255,0.1)"}`,
                  color: showPreview ? "#5B9AFF" : "rgba(255,255,255,0.45)",
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
                color: "rgba(255,255,255,0.35)", cursor: "pointer", fontSize: 12,
                fontFamily: "inherit", fontWeight: 600,
              }}>✕ Очистить</button>
            </div>
          </div>

          {/* Parser panel */}
          {showParser && (
            <div style={{
              marginBottom: 16,
              background: "rgba(52,199,89,0.08)",
              border: "1.5px solid #3a6a2a",
              borderRadius: 12,
              padding: "14px 16px",
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#6aaa4a", marginBottom: 8, display: "flex", alignItems: "center", gap: 7 }}>
                📥 Вставь текст заявки из Google Chat
              </div>
              <textarea
                placeholder={"Вставь сюда текст заявки из Google Chat..."}
                value={parseText}
                onChange={e => setParseText(e.target.value)}
                rows={8}
                style={{
                  width: "100%", background: "#181819",
                  border: "1px solid rgba(255,255,255,0.1)", borderRadius: 9,
                  color: "rgba(255,255,255,0.85)", fontSize: 13, padding: "10px 12px",
                  outline: "none", fontFamily: "inherit",
                  boxSizing: "border-box", resize: "vertical",
                  lineHeight: 1.5,
                }}
              />
              {parseError && (
                <div style={{ fontSize: 11, color: "#FF3B30", marginTop: 6 }}>{parseError}</div>
              )}
              <button
                onClick={parseFromChat}
                disabled={!parseText.trim()}
                style={{
                  marginTop: 10, width: "100%", padding: "10px",
                  background: parsing ? "#111112" : "rgba(52,199,89,0.12)",
                  border: `1.5px solid ${parsing ? "rgba(255,255,255,0.08)" : "#22c55e88"}`,
                  color: parsing ? "rgba(255,255,255,0.35)" : "#34C759",
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

          {/* Action buttons inline when preview hidden */}
          {!showPreview && (
            <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                onClick={handleCopy}
                disabled={!message}
                style={{
                  background: message ? "rgba(0,122,255,0.12)" : "#111112",
                  border: `1.5px solid ${message ? "rgba(0,122,255,0.6)" : "rgba(255,255,255,0.08)"}`,
                  color: message ? "#5B9AFF" : "rgba(255,255,255,0.35)",
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
                  background: orderSaved ? "rgba(52,199,89,0.12)" : (message ? "rgba(175,82,222,0.12)" : "#111112"),
                  border: `1.5px solid ${orderSaved ? "#22c55e55" : (message ? "#8b5cf655" : "rgba(255,255,255,0.08)")}`,
                  color: orderSaved ? "#34C759" : (message ? "#D8B4FE" : "rgba(255,255,255,0.35)"),
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
          overflowY: "auto",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#2a4a70", letterSpacing: "0.07em", textTransform: "uppercase" }}>
            Предпросмотр сообщения
          </div>

          {/* Message bubble like Google Chat */}
          <div style={{
            background: "#181819",
            border: "1px solid #1e3a6a",
            borderRadius: 14,
            padding: "16px 18px",
            flex: 1,
            minHeight: 200,
            position: "relative",
          }}>
            {message ? (
              <pre style={{
                margin: 0,
                fontFamily: "'Outfit',-apple-system,sans-serif",
                fontSize: 13,
                lineHeight: 1.65,
                color: "rgba(255,255,255,0.85)",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}>{message}</pre>
            ) : (
              <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 13, fontStyle: "italic" }}>
                Заполните форму — здесь появится готовое сообщение для Google Chat
              </div>
            )}
          </div>

          {/* Action buttons */}
          <button
            onClick={handleCopy}
            disabled={!message}
            style={{
              background: message ? "rgba(0,122,255,0.12)" : "#111112",
              border: `1.5px solid ${message ? "rgba(0,122,255,0.6)" : "rgba(255,255,255,0.08)"}`,
              color: message ? "#5B9AFF" : "rgba(255,255,255,0.35)",
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
              background: orderSaved ? "rgba(52,199,89,0.12)" : (message ? "rgba(175,82,222,0.12)" : "#111112"),
              border: `1.5px solid ${orderSaved ? "#22c55e55" : (message ? "#8b5cf655" : "rgba(255,255,255,0.08)")}`,
              color: orderSaved ? "#34C759" : (message ? "#D8B4FE" : "rgba(255,255,255,0.35)"),
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
              background: calStatus === "ok" ? "rgba(52,199,89,0.12)" : calStatus === "err" ? "rgba(255,59,48,0.12)" : "#111112",
              border: `1.5px solid ${calStatus === "ok" ? "#22c55e55" : calStatus === "err" ? "#ef444455" : "rgba(255,255,255,0.08)"}`,
              color: calStatus === "ok" ? "#34C759" : calStatus === "err" ? "#FF3B30" : (f.date ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.18)"),
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
              background: sheetsStatus === "ok" ? "rgba(52,199,89,0.12)" : sheetsStatus === "err" ? "rgba(255,59,48,0.12)" : "#111112",
              border: `1.5px solid ${sheetsStatus === "ok" ? "#22c55e55" : sheetsStatus === "err" ? "#ef444455" : "rgba(255,255,255,0.08)"}`,
              color: sheetsStatus === "ok" ? "#34C759" : sheetsStatus === "err" ? "#FF3B30" : (message ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.18)"),
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
              background: "#111112",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 10,
              padding: "10px 14px",
              fontSize: 12,
              color: "rgba(255,255,255,0.45)",
              lineHeight: 1.6,
            }}>
              <div><span style={{ color: "rgba(255,255,255,0.35)", fontSize:11 }}>📅</span> {formatDate(f.date)}</div>
              <div><span style={{ color: "rgba(255,255,255,0.45)" }}>🕐</span> {formatTimeSlot(f.hour)}</div>
              {f.address && <div><span style={{ color: "rgba(255,255,255,0.35)", fontSize:11 }}>📍</span> {f.address.slice(0, 40)}{f.address.length > 40 ? "…" : ""}</div>}
            </div>
          )}
        </div>
        )}
      </div>
      )}
    </div>
  );
}



// ════════════════════════════════════════════════════════════
// ЛИДЫ
// ════════════════════════════════════════════════════════════

import { useState, useEffect } from "react";

// ── Persistence
const LS_LEADS = "leads_data_v2";
const LS_URL   = "leads_sheets_url_v2";

// ── Data
const LEAD_SERVICES = [
  { id:"trash",   label:"Вывоз мусора", icon:"trash_svc", color:"#34D368" },
  { id:"sawdust", label:"Опилки",       icon:"sawdust_svc", color:"#F5A23A" },
  { id:"offcuts", label:"Обрезки доски",icon:"offcuts_svc", color:"#F87255" },
  { id:"other",   label:"Другое",       icon:"other_svc", color:"rgba(255,255,255,0.38)" },
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
  { id:"new",      label:"Новый",       color:"#5B9AFF" },
  { id:"callback", label:"Перезвонить", color:"#FF9500" },
  { id:"working",  label:"В работе",    color:"#AF52DE" },
  { id:"done",     label:"Оформлен",    color:"#34C759" },
  { id:"lost",     label:"Отказ",       color:"#FF3B30" },
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
    width:"100%", background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.1)",
    borderRadius:12, color:"rgba(255,255,255,0.85)", fontSize:14, padding:"11px 13px",
    outline:"none", fontFamily:"inherit", boxSizing:"border-box",
  },
  label: {
    fontSize:11, fontWeight:700, color:"rgba(255,255,255,0.45)",
    letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:6, display:"block",
  },
};

function LInput({ value, onChange, placeholder, type="text", multiline, rows=3 }) {
  const s = { ...css.input };
  const ev = {
    onFocus: e => e.target.style.borderColor="rgba(255,255,255,0.3)",
    onBlur:  e => e.target.style.borderColor="rgba(255,255,255,0.1)",
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
    background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.1)",
    borderRadius:12, color:"rgba(255,255,255,0.85)", fontSize:14,
    padding:"11px 10px", outline:"none", fontFamily:"inherit",
    cursor:"pointer", width:"100%",
  };

  return (
    <div style={{display:"grid", gridTemplateColumns:"1fr 90px", gap:8}}>
      <input type="date" value={date} onChange={e=>handleDate(e.target.value)}
        style={{...sel}}
        onFocus={e=>e.target.style.borderColor="rgba(255,255,255,0.3)"}
        onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.1)"}
      />
      <select value={hour} onChange={e=>handleHour(e.target.value)}
        disabled={!date}
        style={{...sel, opacity: date?1:0.4}}
        onFocus={e=>e.target.style.borderColor="rgba(255,255,255,0.3)"}
        onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.1)"}
      >
        <option value="">—</option>
        {hours.map(h=><option key={h} value={h}>{h}:00</option>)}
      </select>
    </div>
  );
}


function Chip({ active, color="#5B9AFF", onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding:"7px 14px", borderRadius:20,
      border: `1.5px solid ${active ? color : "rgba(255,255,255,0.1)"}`,
      background: active ? color+"22" : "transparent",
      color: active ? color : "rgba(255,255,255,0.45)",
      fontSize:13, fontWeight: active?700:500,
      cursor:"pointer", fontFamily:"inherit",
      transition:"all 0.15s", whiteSpace:"nowrap",
    }}>{children}</button>
  );
}

function ActionBtn({ onClick, disabled, color="#5B9AFF", children }) {
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
    <div style={{ flex:1, overflowY:"auto", WebkitOverflowScrolling:"touch", padding:"20px 18px" }}>
      <div style={{ marginBottom:22 }}>
        <div style={{ fontSize:22, fontWeight:800, color:"#FFFFFF", letterSpacing:"-0.03em" }}>Быстрая запись</div>
        <div style={{ fontSize:13, color:"rgba(255,255,255,0.35)", marginTop:3 }}>Не потеряй контакт — запиши за 10 секунд</div>
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
                background:"rgba(0,122,255,0.12)", border:"1.5px solid #2a5aad",
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
            <Chip key={s.id} active={f.source===s.id} color="#5B9AFF"
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
            <Chip key={val} active={f.timing===val} color="#5B9AFF"
              onClick={()=>set("timing", f.timing===val?"":val)}>
              {lbl}
            </Chip>
          ))}
        </div>
      </div>

      {/* Row 7: Дата перезвона */}
      <div style={{ marginBottom:12 }}>
        <label style={css.label}>Дата перезвона</label>
        <input
          type="date"
          value={f.callDate||""}
          onChange={e=>set("callDate", e.target.value)}
          style={{
            width:"100%", background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.1)",
            borderRadius:12, color: f.callDate?"rgba(255,255,255,0.85)":"rgba(255,255,255,0.45)",
            fontSize:14, padding:"11px 13px",
            outline:"none", fontFamily:"inherit", boxSizing:"border-box",
            WebkitAppearance:"none", appearance:"none",
          }}
        />
      </div>

      {/* Row 8: Заметка */}
      <div style={{ marginBottom:18 }}>
        <label style={css.label}>Заметка</label>
        <LInput multiline rows={2} placeholder="Что хотел, нюансы..."
          value={f.note} onChange={v=>set("note",v)}/>
      </div>

      <button onClick={handleSave} disabled={saving||(!f.phone&&!f.clientName)} style={{
        width:"100%", padding:"13px",
        background: done ? "#22c55e22" : "linear-gradient(135deg,#1a4a9e,#0e2d6e)",
        border: `1.5px solid ${done?"#22c55e55":"rgba(0,122,255,0.6)"}`,
        color: done?"#34C759":"#5B9AFF",
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
    setCalSt("loading");
    try {
      const end = new Date(new Date(lead.callDate + "T10:30:00").getTime()+30*60000).toISOString();
      const calStart = lead.callDate + "T10:00:00";
      const res = await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"claude-sonnet-4-20250514",max_tokens:500,
          mcp_servers:[{type:"url",url:"https://calendarmcp.googleapis.com/mcp/v1",name:"google-calendar"}],
          messages:[{role:"user",content:`Создай напоминание в Google Calendar:\n- Название: Перезвонить ${lead.clientName||lead.phone}\n- Начало: ${calStart}\n- Конец: ${end}\n- Описание: Лид #${lead.id}. Телефон: ${lead.phone}. Услуга: ${lead.service}. ${lead.note}`}],
        }),
      });
      const d=await res.json();
      if(!res.ok||d.error) throw new Error();
      setCalSt("ok");
    } catch { setCalSt("err"); }
    setTimeout(()=>setCalSt(null),3000);
  };

  return (
    <div style={{
      background:"#111112",
      border:`1px solid ${open?"#1e3360":"rgba(255,255,255,0.04)"}`,
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
          <div style={{fontSize:14,fontWeight:700,color:"rgba(255,255,255,0.85)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
            {lead.clientName||<span style={{color:"rgba(255,255,255,0.22)"}}>Без имени</span>}
          </div>
          <div style={{fontSize:11,color:"rgba(255,255,255,0.35)",marginTop:1}}>{lead.phone||"—"}</div>
        </div>

        {/* Service */}
        {lead.service && (
          <div style={{
            fontSize:11,padding:"3px 9px",borderRadius:6,
            background: (LEAD_SERVICES.find(s=>s.id===lead.service)?.color||"#5B9AFF")+"18",
            color: LEAD_SERVICES.find(s=>s.id===lead.service)?.color||"#5B9AFF",
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
            {lead.amount && <div style={{fontSize:12,fontWeight:700,color:"#34C759",whiteSpace:"nowrap"}}>{lead.amount} т</div>}
            {lead.margin && <div style={{fontSize:10,color:"#FF9500",whiteSpace:"nowrap"}}>▲{lead.margin} т</div>}
          </div>
        )}

        {/* Source icon */}
        {lead.source && (
          <div style={{fontSize:14}} title={SOURCES.find(s=>s.id===lead.source)?.label}>
            {SOURCES.find(s=>s.id===lead.source)?.icon}
          </div>
        )}

        {/* Arrow */}
        <div style={{color:"rgba(255,255,255,0.22)",fontSize:10}}>{open?"▲":"▼"}</div>
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
                    background:"rgba(0,122,255,0.12)", border:"1.5px solid #2a5aad",
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
                  <Chip key={s.id} active={lead.source===s.id} color="#5B9AFF"
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
              background:"rgba(255,59,48,0.08)", border:"1px solid #2a1a1a", borderRadius:12,
            }}>
              <label style={{...css.label, color:"#5a2020"}}>Причина отказа</label>
              <div style={{display:"flex", gap:6, flexWrap:"wrap"}}>
                {LOST_REASONS.map(r=>(
                  <Chip key={r} active={lead.lostReason===r} color="#FF3B30"
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
                <Chip key={val} active={lead.timing===val} color="#5B9AFF"
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
                type="date"
                value={lead.callDate ? lead.callDate.slice(0,10) : ""}
                onChange={e => set("callDate", e.target.value)}
                style={{
                  flex:1, background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.1)",
                  borderRadius:12, color: lead.callDate ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.35)",
                  fontSize:14, padding:"11px 13px",
                  outline:"none", fontFamily:"inherit", boxSizing:"border-box",
                }}
                onFocus={e=>e.target.style.borderColor="rgba(255,255,255,0.3)"}
                onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.1)"}
              />
              {lead.callDate && (
                <button
                  onClick={() => set("callDate", "")}
                  title="Сбросить дату"
                  style={{
                    flexShrink:0, width:36, height:36,
                    background:"rgba(239,68,68,0.12)", border:"1px solid rgba(239,68,68,0.3)",
                    borderRadius:10, color:"#ef4444", fontSize:16,
                    cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
                    fontFamily:"inherit",
                  }}
                >✕</button>
              )}
            </div>
          </div>

          {/* Row 8: Заметка — полная ширина */}
          <div style={{marginBottom:14}}>
            <label style={css.label}>Заметка</label>
            <LInput multiline rows={2} value={lead.note} onChange={v=>set("note",v)} placeholder="Нюансы, детали, о чём договорились..."/>
          </div>

          {/* Divider */}
          <div style={{height:1, background:"rgba(255,255,255,0.06)", marginBottom:12}}/>

          {/* Make Order Banner */}
          {orderSent && (
            <div style={{
              marginBottom:10, padding:"10px 14px",
              background:"rgba(52,199,89,0.12)", border:"1px solid #22c55e44",
              borderRadius:12, display:"flex", alignItems:"center", gap:10,
            }}>
              
              <div>
                <div style={{fontSize:13,fontWeight:700,color:"#34C759"}}>Данные переданы в GVR</div>
                <div style={{fontSize:11,color:"#1a4a2a"}}>Статус лида изменён на «В работе». Открой приложение GVR — поля уже заполнены.</div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{display:"flex", gap:8, flexWrap:"wrap", alignItems:"center"}}>
            <button onClick={handleMakeOrder} style={{
              background:"#FFFFFF",
              border:"none",
              color:"#000000", borderRadius:10, padding:"8px 16px",
              fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
              display:"flex", alignItems:"center", gap:6,
            }}>🚀 Оформить заказ</button>
            <ActionBtn onClick={handleSheets} disabled={!sheetsUrl||sheetSt==="loading"}
              color={lead.savedToSheets?"#34C759":sheetSt==="ok"?"#34C759":sheetSt==="err"?"#FF3B30":"#5B9AFF"}>
              {sheetSt==="loading"?"Сохраняю...":sheetSt==="ok"?"✓ В Sheets":sheetSt==="err"?"✗ Ошибка":lead.savedToSheets?"✓ Обновить Sheets":"В Sheets"}
            </ActionBtn>

            {lead.callDate && (
              <ActionBtn onClick={handleCal} disabled={calSt==="loading"}
                color={calSt==="ok"?"#34C759":calSt==="err"?"#FF3B30":"#AF52DE"}>
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

          <div style={{fontSize:10, color:"rgba(255,255,255,0.18)", marginTop:10}}>
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
      const q=search.toLowerCase();
      if (!l.clientName?.toLowerCase().includes(q)&&!l.phone?.includes(q)&&!l.address?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div style={{display:"flex",flexDirection:"column",flex:1,minHeight:0}}>
      {/* Status filter row */}
      <div style={{padding:"10px 16px 8px",display:"flex",gap:6,flexWrap:"wrap",alignItems:"center",borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
        <span style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.22)",letterSpacing:"0.07em",textTransform:"uppercase",marginRight:2}}>Статус</span>
        <Chip active={filterSt==="all"} color="#5B9AFF" onClick={()=>setFilterSt("all")}>Все ({leads.length})</Chip>
        {STATUSES.map(s=>counts[s.id]>0&&(
          <Chip key={s.id} active={filterSt===s.id} color={s.color}
            onClick={()=>setFilterSt(filterSt===s.id?"all":s.id)}>
            {s.label} {counts[s.id]}
          </Chip>
        ))}
        <input placeholder="Поиск..." value={search} onChange={e=>setSearch(e.target.value)}
          style={{marginLeft:"auto",background:"rgba(255,255,255,0.1)",border:"1px solid #232f45",
            borderRadius:10,color:"rgba(255,255,255,0.85)",fontSize:12,padding:"6px 12px",
            outline:"none",fontFamily:"inherit",width:170}}/>
      </div>

      {/* Service filter row */}
      <div style={{padding:"8px 18px 10px",display:"flex",gap:6,flexWrap:"wrap",alignItems:"center",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
        <span style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.22)",letterSpacing:"0.07em",textTransform:"uppercase",marginRight:2}}>Услуга</span>
        <Chip active={filterSvc==="all"} color="rgba(255,255,255,0.38)" onClick={()=>setFilterSvc("all")}>Все</Chip>
        {LEAD_SERVICES.map(s=>(
          <Chip key={s.id} active={filterSvc===s.id} color={s.color}
            onClick={()=>setFilterSvc(filterSvc===s.id?"all":s.id)}>
            {s.label} {svcCounts[s.id]>0?`(${svcCounts[s.id]})` : ""}
          </Chip>
        ))}
      </div>

      <div style={{flex:1,overflowY:"auto",WebkitOverflowScrolling:"touch",padding:"10px 18px",display:"flex",flexDirection:"column",gap:6}}>
        {filtered.length===0 && (
          <div style={{textAlign:"center",padding:"50px 0",color:"rgba(255,255,255,0.18)",fontSize:14}}>
            {leads.length===0?"Лидов пока нет — добавь первый во вкладке «Новый лид»":"Ничего не найдено"}
          </div>
        )}
        {filtered.map(l=>(
          <LeadRow key={l.id} lead={l} onUpdate={onUpdate} onDelete={onDelete} sheetsUrl={sheetsUrl}/>
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
    <div style={{padding:"20px 18px",overflowY:"auto",WebkitOverflowScrolling:"touch",flex:1}}>
      <div style={{fontSize:18,fontWeight:800,color:"#FFFFFF",marginBottom:4}}>Настройки</div>
      <div style={{fontSize:13,color:"rgba(255,255,255,0.35)",marginBottom:24}}>Подключение Google Sheets</div>

      {/* Steps */}
      {[
        {n:1,t:"Откройте Apps Script",d:<>Перейдите на <span style={{color:"#5B9AFF"}}>script.google.com</span> → «Новый проект»</>},
        {n:2,t:"Вставьте код",d:"Скопируйте код ниже и замените YOUR_SHEET_ID на ID вашей таблицы (из URL таблицы)"},
        {n:3,t:"Разверните",d:'«Развернуть» → «Новое развёртывание» → тип «Веб-приложение» → доступ «Все»'},
        {n:4,t:"Вставьте URL",d:"Скопируйте URL развёртывания и вставьте в поле ниже"},
      ].map(s=>(
        <div key={s.n} style={{display:"flex",gap:14,marginBottom:18}}>
          <div style={{
            minWidth:28,height:28,borderRadius:"50%",
            background:"rgba(0,122,255,0.12)",color:"#5B9AFF",
            display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:13,fontWeight:800,border:"1px solid #2a5aad",flexShrink:0,
          }}>{s.n}</div>
          <div>
            <div style={{fontWeight:700,fontSize:14,color:"rgba(255,255,255,0.85)",marginBottom:3}}>{s.t}</div>
            <div style={{fontSize:13,color:"rgba(255,255,255,0.45)",lineHeight:1.5}}>{s.d}</div>
          </div>
        </div>
      ))}

      {/* Code block */}
      <div style={{position:"relative",marginBottom:20}}>
        <pre style={{
          background:"#111112",border:"1px solid rgba(255,255,255,0.07)",borderRadius:12,
          padding:"14px 16px",fontFamily:"'JetBrains Mono',monospace",
          fontSize:11,color:"#7dd3a8",overflowX:"auto",whiteSpace:"pre",
          lineHeight:1.6,maxHeight:260,overflowY:"auto",margin:0,
        }}>{SCRIPT}</pre>
        <button onClick={()=>{copyToClipboard(SCRIPT);setCopied(true);setTimeout(()=>setCopied(false),2000);}}
          style={{
            position:"absolute",top:10,right:10,
            background:"rgba(0,122,255,0.12)",border:"1px solid #2a5aad",
            color:"#5B9AFF",borderRadius:9,padding:"4px 12px",
            fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
          }}>{copied?"✓ Скопировано":"Копировать"}</button>
      </div>

      <div>
        <label style={css.label}>URL Apps Script Web App</label>
        <input type="url" placeholder="https://script.google.com/macros/s/YOUR_ID/exec"
          value={sheetsUrl} onChange={e=>setSheetsUrl(e.target.value)}
          style={{...css.input}}
          onFocus={e=>e.target.style.borderColor="rgba(255,255,255,0.3)"}
          onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.1)"}/>
        {sheetsUrl && (
          <div style={{marginTop:8,display:"flex",alignItems:"center",gap:6}}>
            <div style={{width:7,height:7,borderRadius:"50%",background:"#34C759",}}/>
            <span style={{fontSize:12,color:"#34C759",fontWeight:600}}>URL сохранён и активен</span>
          </div>
        )}
      </div>

      {/* Export / Import */}
      <div style={{marginTop:24}}>
        <div style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.45)",letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:8}}>
          Резервная копия данных
        </div>
        <div style={{fontSize:11,color:"rgba(255,255,255,0.35)",marginBottom:10}}>
          Экспорт сохраняет все лиды в JSON-файл. Импорт восстанавливает из файла.
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
          <button onClick={onExport} style={{
            background:"rgba(52,199,89,0.12)", border:"1.5px solid #22c55e55",
            color:"#34C759", borderRadius:11, padding:"8px 18px",
            fontSize:12, fontWeight:800, cursor:"pointer", fontFamily:"inherit",
            display:"flex", alignItems:"center", gap:6,
          }}>Экспорт лидов</button>
          <label style={{
            background:"rgba(0,122,255,0.12)", border:"1.5px solid #2a5aad",
            color:"#5B9AFF", borderRadius:11, padding:"8px 18px",
            fontSize:12, fontWeight:800, cursor:"pointer", fontFamily:"inherit",
            display:"flex", alignItems:"center", gap:6,
          }}>
            Импорт лидов
            <input type="file" accept=".json" onChange={onImport} style={{display:"none"}}/>
          </label>
          {importStatus==="ok" && <span style={{fontSize:12,color:"#34C759",fontWeight:700}}>✓ Восстановлено!</span>}
          {importStatus==="err" && <span style={{fontSize:12,color:"#FF3B30",fontWeight:700}}>✗ Неверный файл</span>}
        </div>
        <div style={{fontSize:10,color:"rgba(255,255,255,0.18)",marginTop:8}}>
          Файл сохраняется как <code style={{color:"rgba(255,255,255,0.45)"}}>leads_backup_ДАТА.json</code>
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
              border: `1.5px solid ${isOver ? col.color+"55" : "rgba(255,255,255,0.06)"}`,
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
              flex:1,overflowY:"auto",WebkitOverflowScrolling:"touch",padding:"10px 10px",
              display:"flex", flexDirection:"column", gap:7,
            }}>
              {colLeads.length === 0 && (
                <div style={{
                  textAlign:"center", padding:"30px 0",
                  color: isOver ? col.color+"88" : "rgba(255,255,255,0.06)",
                  fontSize:12,
                  border:`2px dashed ${isOver ? col.color+"44" : "rgba(255,255,255,0.06)"}`,
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
                      background: dragging?.id===lead.id ? "#1a2a44" : "#111112",
                      border:"1px solid rgba(255,255,255,0.07)",
                      borderRadius:12, padding:"11px 12px",
                      cursor:"grab", userSelect:"none",
                      opacity: dragging?.id===lead.id ? 0.5 : 1,
                      transition:"opacity 0.15s, transform 0.1s",
                      transform: dragging?.id===lead.id ? "rotate(2deg) scale(0.97)" : "none",
                    }}
                  >
                    {/* Name */}
                    <div style={{fontSize:13,fontWeight:700,color:"rgba(255,255,255,0.85)",marginBottom:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      {lead.clientName || <span style={{color:"rgba(255,255,255,0.22)"}}>Без имени</span>}
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
                          background:"rgba(255,255,255,0.18)",color:"#3a5a80",fontWeight:600,
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
  const [tab, setTab] = useState("new");
  const [importLeadsStatus, setImportLeadsStatus] = useState(null);
  const [sheetsUrl, setSheetsUrl] = useState(()=>localStorage.getItem(LS_URL)||"");

  const { data: leads, save: saveLeads, syncing, lastSync } = useDriveSync(
    auth?.token,
    "leads",
    () => { try { return JSON.parse(localStorage.getItem(LS_LEADS)||"[]"); } catch { return []; } }
  );

  const setLeads = (updater) => {
    const next = typeof updater === "function" ? updater(leads) : updater;
    localStorage.setItem(LS_LEADS, JSON.stringify(next));
    saveLeads(next);
  };

  useEffect(()=>localStorage.setItem(LS_URL,sheetsUrl),[sheetsUrl]);

  const addLead   = l  => setLeads(p=>[l,...p]);
  const updateLead= u  => setLeads(p=>p.map(l=>l.id===u.id?u:l));
  const deleteLead= id => setLeads(p=>p.filter(l=>l.id!==id));

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
      height:"100dvh", minHeight:"100dvh", background:"#0A0A0B",
      color:"rgba(255,255,255,0.85)", fontFamily:"'Outfit',-apple-system,sans-serif",
      display:"flex", flexDirection:"column", overflow:"hidden",
    }}>
      <style>{`*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#0A0A0B}::-webkit-scrollbar-thumb{background:#222;border-radius:4px}select option{background:#181819}input[type=date]::-webkit-calendar-picker-indicator{filter:invert(0.5)}`}</style>

      {/* HEADER */}
      <div style={{
        background:"#0A0A0B", borderBottom:"1px solid rgba(255,255,255,0.08)",
        padding:"12px 16px 0",
      }}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{
              width:36,height:36,borderRadius:12,
              background:"linear-gradient(135deg,#1F1F20,#151516)",
              border:"1px solid rgba(255,255,255,0.25)",
              display:"flex",alignItems:"center",justifyContent:"center",
            }}><IcTab name="leads" size={18}/></div>
            <div>
              <div style={{fontSize:16,fontWeight:800,color:"#FFFFFF",letterSpacing:"-0.02em"}}>Лиды</div>
              <div style={{fontSize:10,color:"rgba(255,255,255,0.22)",fontWeight:600,letterSpacing:"0.06em"}}>
                {leads.length} контакт{leads.length===1?"":leads.length<5&&leads.length>1?"а":"ов"} сохранено
              </div>
            </div>
          </div>

          {/* Mini stats + sync */}
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            {newCount>0&&<div style={{background:"#3b82f618",border:"1px solid #3b82f644",color:"#5B9AFF",borderRadius:10,padding:"4px 10px",fontSize:11,fontWeight:700}}>● {newCount} новых</div>}
            {cbCount>0&&<div style={{background:"#f59e0b18",border:"1px solid #f59e0b44",color:"#FF9500",borderRadius:10,padding:"4px 10px",fontSize:11,fontWeight:700}}>{cbCount} перезвонить</div>}
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
                borderBottom:`2px solid ${active?"#FFFFFF":"transparent"}`,
                color:active?"#FFFFFF":"rgba(255,255,255,0.4)",
                fontSize:13,fontWeight:active?700:500,
                cursor:"pointer",fontFamily:"inherit",
                transition:"all 0.15s",position:"relative",
              }}>
                {t.label}
                {t.badge&&<span style={{
                  background:"rgba(255,255,255,0.1)",color:"#5B9AFF",
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
const GVR_LOGO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAPAAAADwCAIAAACxN37FAACqh0lEQVR42r29eZxlVXU/utY591Z1V1XP3cxDKyoREVEURBCQySggKmoUUEAgagxqiDgP+b2YGEWi+HMCERBUxAERFTDghHFWUFGIzKjMTc/dNdx7znp/7LP3+q619+3m9977vA5Jeqi6de85++y91nd9B26bVoiYKPxfIiImESIWDn8tLNT9G1P3dUJEIkwcv4dI4vcSkRB3vxeW7oX8LxEiDj+LOb5A95oiwhR+bPcbFhKS8KokJBy+J/zU+KNJqHut+D71nwjeenpj4Qfgd1F4dWJ4XYnfyumdMwu+tBCHD0JELN1PlvSq6YspXQsRofBR4/UVEuZ05czbIaH4eUniB8CPG96yxLfM5qp23x6/Jr4TYrhMeiHTdYWrIvG9cPrr+BnjjQgXVL+aiYQpvk19M2FtdR9H7EXvLqq5FenGMsNbFXNdmdP7ZeqRXmkiYbh8jB88fk/8X2bmdOvDgusWc3oPEr+dRYSZRDgtSFgKpK8Tb3C4/vEHh3uTbkZcWmm1hWXOeH30oeu+Mb6h+GzC52S8Z/qm9YPEBxzuVrzR3S0Lt4fZPDPdZRGh7l6l7YGJ0wNJDAswXicJF1jSvefuASB8+GHhh69gjp9VJD1R6flOt1PwUbGrQbcNgtsO/5d10wur2Tx14eV1oYc70L1j6d5G+hbRixD+UXRNw/d2V7y7mOFKdvuc4DWIm0jTNMRpV4Btxe2n5m4XvwSenPhsMLyoUL4i0k7N6ZaN+Pn49foS3fMOr8/mcaK0fabfElxHfTxxMxC4HviQxG1SYNWn1xbzsiPfObM5C81rx3UMtzi+Md0ozP7d3WCzMoR06YWTDnYxeO6Z9IqTLnouvWfYV8w9oK18ZLHbbzzBugUS33a2sru3IQRrmu2e7Q4gvTzMbdumf+juEKc3TOl65TfBrDDcb+AexR0rnNF2XdgPzqnkGHGNzMe2WweR3UzwReCT+HeYXgpWElYoAoej2YWYYccWvErFd5uvPPfKeJPMOva1B+WreSvPT9wS2V3q7p8oLh1dyuaoStdNtJTR9RH/yRwm+qPhdMgfufydC2FRlNaxu+/kymO7ComFm7bl7NoUn558m8RPItk60IWercX8RdxP2erPTX9gPdXgNLCPjT4AZhckd6vcvddCv9uhzCdNK8PfyNJ1y+9iPJQFKhXyf3TvcPSlwA2ouFGyL8Z4VI2ef0vhj/ndEXNKu1Nc4LzM32T3BrouwrRAxftonjp/mErFcBCKPWWLd0X39q5wjL/J3y53xVzYeNKbcB9P4BEfWWDANoxbHLFWoyKSqjo2PSMxVqv5qQjbuf9n7kp8bXPT18RnAy+RW17db4Tcotc/ptWfFZh4/8V+r1vKW7h0+q/xG7m0u+WXhUf/ccsnQ/GfOP4q31/BToBIoGGw7wzXIucXioiJqniFhB9T/belBef2CYattPtv1H3Fp1y6AysuUPalM9Y/8WXd1dR3ArcWi6hiUW7+KTyCkspQ0/SaT539prw3i76N4o4lIl0L6V4hPwrgYEzbSvEumGXUXUxAS8IVTp1I8bI8hl0mq3MYnz38TfmBhx09LBQ2u8jIPZ47aCI+q0JEVFlMyyyCfO/Z8sdzbzffztNeFV483YzUZun3cvd2y4dpVrQVDrLsEqSL61525PnAlB6hBMJ0vykVJzxqo2KLSIz4iYwFtNsn3L1wxUBWnRerDncCB6iFRtR7W9ja8r2221C58GHdC4aiwjUSTPaPo5soGX0mxCKDKl09rryG3a64DRefubzXEV8u0KjvSg+3u9/5rsawQA1cV2pB0rcXG7Itl7kIvXe7BptVlde+6Y0Wf1D3trP3pmvF/mbk+Y5VnP1KfHT1I8A9x46T8XwovtXHvHl3P0tYWMsIPCX82sUKosMyRR87Jr/uEZkVLediSSVCLN2CpmztioXhRhzTrox2BzG+KMHlL6zmuP+lZcLmLozeLRI+ACWj3/jtR8C/F1uq2voB/8mUerikttA5uTXhH3h7trijeetnfbd6hO1VKn5Mgxw7uF62XvtutVD2fzTwty8w9MlhM+OwRVu5vwIoBhBxPUiJiSsHA5nVKeUdHne74t5suhA4r0mI5DFgzOTP6OI+0d0RZslqyvyuYJFT3D499pI2FCGdtLlH0WJbHAr6tJNsoXOKW6MDvPKza2TFDz3uSCDMLnRza8KNY0ofULuxx1Au4+3AQk4LDy0SuoK4u5pielnBIw3Xd15OSAG1ENtChQ2p51Ek6mbVXZso5E9RJnxnhcfIrb8OHxfc/UwdKaXtkKFSHlFRdCCrdC83ah2M2rEKGGUCgyVeAYmYnSmd2Ix8SWDuznAlSUrbJ9u2r7CmuwtsOAPmgQTg3zwDrLtjqt9cNdKdfq5QY/0g+bDGd9sjinWxgDRMMLp2TbIPq0N7FtOOj+hDFGEUoD9EbKubjDZNizNGZRqk3lwRdFGw0ILe7sP4P1qgcauo86ixjoG6C2N0Xz2Xq0Mh34CWgGSH+fkvTh8fUGp9nxGsdD/bYc80+s0Xz9+t/MI7Ykd0xfkFbh/Ysud9Tg5RUzaF0B8nMBkpTcRwGuXfGCtCUqwY8z00n29w07acj5cQcYPJp06AZCsXGn+kmxulFcmjmrk4HSH7TsSi6FuYmRVGNjLiBv+f/MLn3BR/Wdn3WIZT5KbQ7oGBmRjOdEYt8lHDDvzIeTdm6lF+rGO1kZ10aVW4UW4Z1ZaR15BGgKFuJJ7+oTKTDuCuiQgBnJYTNrZcDeNVY2ZXj6eW1XcMDu2Hj9WBqFC/bmE8VgBo2aCdo0CbrXb0uP9RsYN0N0BiAZFB15FdaNaNh2DZFBss5XEBtPxbOrhHrk6oqcod89YgPO24SoU4w4oqXqVQDW+5dvd/I9AAQItbseV9MILvZrdIgIbB4EZ+cj2FZQtMA0XfmHVXdoADgr4jENOtDhqxx80LYhzm6Y4e28HCfTLcVdMwYAcj+tIW/LY9pV9nkVdkXjB7BgotrN2YESfNMBb/s/L2MZ9SuRmkP41LN1rsmHYUyNzV3NkWng+kPa6AHEghYq48GN4Nq+ys30KAJI/pgDaVmUHXR4F3OrBIT7Nk480c4CzuqUIZXs6e7GKOXdx6xQPnrlLMMUf/Twz3I0ElxG6iln6oAQpwDqycOAMvFpYd3rT8SfMAHhla9oidOx9D+vYUTv/EczIwRRq/5ydwdswzkBHKTbyU5+DEundUlmmlM3LFEJQLHRfYiONpVOfrn2w7CzVXp4jXphp6qyVBXDeGIWBviC5cUS468AIVzzK9KZmiPDS4WBiUG8q4xPFI7aa7sVcuT8sZtljW5yTfNdPTq5s6+ydN/2nE8LK47xYIIbB8E+yGiyf9UJj4crdPJWQTXxZoEd3hk99iqNn8sSPdT8UynZumyfp6cSiADmmEH2PfvWUu6GNhjPyfMIwLXbyHjUfQyTxHWWy9pMsowWJJKWBoZYh4FNoyR9krtmUlsmVhT9ti6+ZQjoTH5WBUmfqy1QvumHGyJU5Tzgd0b6NA1Bnd71rkLSHLnDjs4QuqHAg25O0opSLhCEzLVhcZ1sePBaJ/jF+whY2k2I+6fUKyHwdbPpuWxZUBKFgRHM1qVZeamwj2C+EWvkWQwS1T8vC/X0/dVpUfyjoEFhzVufok575tgQ3n92kBMpFAN8lbaxlHTxYJtnAq3Vzf29jrJnZqW5Fjr7KYfsVM/R8bJspKDNkqQc8eaqwd1RabkiKjfAtjW3YzDolUAUcchc7G3N84EMmLru4wJFPixELBDzgoo7UAZczUYMLiBwpuCMditltxPBPOi+nHslNs+WJyd8nYbYEyor8ayfsz90Ls9NRyqSTnb3XTx/CfUFelcHos2rbN+f0qNBmtOygsJlTSZAMw95B5IC/dCMm6lsdwFG65Diliw7aqFiSvjcBD7BxEOWumFEbigRkxWJmNqTjJTqDY946mgo8Ct3TmGrA/e7v5GGULO6U8FsVQNrXJW2Q3W9lCCeEmcXm95M8ui8Z3A40o9SBmbpom5xKY0WKJIMpFpnyqm8WJOR1bImrBEQQVFBPzFoZkWxY7jfwyolGHhV/QhQIXXsGNtQ37rhO5IvMOGVd+Moc9FpUnlIVDFg8oYhy7uKtdvpv/hwMmtxO5VTHqRsho7ns+53fvzTUb+QQDGRhmY4glB7saSywvKcciRhFuEgdNuNRWAzTLOQvTIWAlkFseA9Vr1KnKFo0RI++WdMoxFrWsQnej6VfiMsNBD8TMJGImgE45QzNF8QdfljClWllY641Un1haFSOn3IAD2SpMeOJjPO7MfWfagjyn0MXKFvHcxLIELophjVOp4o9r2XQzcAurUY/j/4MRsVba6VYxDh8NcIZ1JxAO2SrtlaGkgyGLIm2hQSw3H6ZZ0YqYM2MPM2ay+6WHgTmtYGUqpYJPtMYSpLqbspgVh0rPBXfuDZxUPHqRJJs6cjZo5sIq3NLDL7TlBn3URR4lrPTPcP4YsBns62YqvubEJU627WPt5oVIqvzNbRUvS9y08se2qD5Dl5nIhGYRK10tfSV32G1ESxwththO40e3xoXuEwFOBkaAYkYMAiWB9RxbEUH7giTVhbUTOUqcJu66uxoKF86A0gPgiQ1kzzQZcRxD+y5U0mRAm1UE7/VY2Np2lusS/DxL7GDosRU2umrZ1FeuDBCBYRNrtR5WRkU84mwQKkro9F+gtPfPt60IwxVLu2HXwjNSCHCNqFzMU65wcTuJruWL4lTSEHaxknbCVG9JIroW7aAfd3ZwWeK4jKCOSVNz1tWU88hwv+9aQ95iRZueES4j32YzgxIk/WeUB0xGzzeCZ5trf7a0IuFli6rHrTww1o4jn/O7E0+g3M0GK+zhaD8spZE2MziP0B6cyk5givlTPLWF1SCMt/g0jzBdGDXf2VK1LeaQiNs/CVJIogg5onIdp1YLcdvgKkYLcu7OZ0UK+v4ttFa+kZLCIMZ+BHbtB5TXW7I4cKw37z9muZOPZQojo8XLxc87qvvc8pgJWThhYVRqsWW2WWTjl2cp4elAWWs6aAxBNpykbOaWWiaiVRUbBwUHayIuyfavtrD809yVs/WdjkgBfYlkyIKOT9kaiilLQHc+EelKXm2+u5GvkJM5FPqqoi46BzGUwYsACFO+L/ueIW/XgAVhVRZb0b9stRdn+OXUcbkZQ07+0dI0Y2656tzZZlTqeobaGPCTSLaGhU/otkYuUF6w3PF/ZCs+jfMONLdjOz1iqxLf+rDAHinJJKQwXMQP6bxGuKsyRKDUhrVi9ORk10fEKMIm8liEUm4eUdyTxK8+1sZftEPwBVtOokp7EBW0OWSl0I9xPL4FNq9DHYqizyLPpDDBKU/cufO2Y/UVKkgRdf93HlxJmvFYhh0W9i/7coxmio9k8ZcO2dKhWrIjzfGmnPxgLewcO9yQOuBEUvWUZF8lHgY2cx+gi5hdAO860whH1y19yNxJzI1C/ARn9NjlsThdjYQ+HssLSsHwC+vYfAkl+X0V565kFFOME3s/LeNsePZYkPkitm0HjQX9qVBhCGfBFhnFv1PnwmyjkoxHZpoqr+eNDjB4cNmdHpe1gZ/tP+vUfdQOzQDFWdjBwLc8EnMoasz8Du243ax+u6MYtjRKcru1XXkUEYpGqOKRRO6XPls2WOTmKjGBqerwbCBQe2KrvX5A+hDK5DRb7wyYnOnHVi+ZkDrMmhWUTXzy5gNNMDifaGaSFqSsOFvLjkGQ9mwzr7euHUpaFFPEgBC1SGghso+xWBbUFklajGNX8tKEopsK4ki4YkZZsmwBv3uMk4HiXKxcWY0WCunJLPk8OdgYsGRQn7AD78Qz9HUoOOK9Fp0D8DXL+7SvKAov7fy1nAofX5MjH9cY05SEzZ6akxTUXvTBMEYxADN8maStWBTkFNSt5IhnJGYBaseSa5MKBTf6YuY1GOt8MRfmPMbFV9SnbcHW7P90QOPaRL8qJKtB2Ty9YN4pFaGI0FFMUCtR4L2QDtxGbx7YYLrXHOV05l6LqCxa8acSgFmjxA54L7c+P2P0VDD+Ct1itVoSj/6KuEXvzmJryp9mv2hixep/U3LPcIQ1hfDUHV1HVAGwYhiqQ0NMRWdogyc4cxXxs+vyms4pDFIm5RXrnASAKnUC+rrigqmwC1RSb5qZG3KiKTzM4ZIpzEyrEfkbWITmUosc0xEA2vKS17WwWGGlVItYscQlJVsZFmSUpoLZSMIrC5ucNaEWIlPoCOXFLsNJ75oHNQsdXQ75zcwIkxwu0w12UHDEyDkoFbje+ojz3Y3L966kOtF9jZVevSVj0mzPSkQD9rb50m0GTdNGg397U6UwB9FPXt4lR4AL5GcuZBmGRQ3FFsiHZLmUCB2oUUvyY1DcgDCpI/fT3hJEk77xsfg3KMPOcvJEkWi2IAajr25y/EFLcopEEzGMQJvVYi+svkhOEnSXgdVmZMRvMmrhSIadB22MZFOUTclbutH4E0GZYr1Hcg8Zlir8gDIiCL2OJL9S20E5joQh3wAVwS9BZ8Lp+/aRpZgH5tgvsvTJAU+UrsTUYB/dbLS3GK3CzwunLYE7bMeUtm1gtDdi0d4bQyd0V00zr0QMEaTX62EoQDJwwCuXhwiAYylzzSFRBEQrP751bEUB0l9uIEMMM+rUhAACMUqf4SAEJ820pIbwc6vYvXiT2UIagtXdCYwqiJkziWvZb84qX7pVLqpRK9TcJb8sv6zxU4mqffWEjI+VjLDtMcNLqDK1mSM/UXOOZx5/FCay60DzopI7bAx+4lhwi50+JhYGC/4RuoskzMKZKGDManvAlLNZBPOn1Hc5Jp+x0t8c7QweKoR3cN6rrQIXvFksmWdr83Nkh8WdMe+FONbQI6wBWZ8hr2h6zPRC3bBlhKEgoouIgolIKb9j63tkovJlfCNjeZE99Pm7wuKPiYsiNE+VzJjNCH0A+Ahm3ZZLkvsOkyU/23ZRJY6pKM32PPY4JPtyv9wlM+xuHKfG2Kgx4RFhcEx3rAloMMV0w+jgSEKu4csXpA17A2SWSAIfGu14PNZdkhKmlAOxWwkTjeoDHJYkxeocHVKkkHEx8rNJaUAaK07RRzZj0wtgc6NttnRpYxFRlPeK31d0KMgc3L4Rb86bm/JOkOoNMP3BlR9oqZz0fg7iYmWrOO8oyW+WTnW4kBaCmAPQSAq0M+g4O2a8ZAEv4qcK6GGC6IK5HmwKRTu/oQpBaMMgsUYter5gIWH7WePjbanr6J2KaRJ6eiujOD0pWmC50hx5Z4ZGKKZwT+TOiEeL1ZiY7t4Us+wpE0i36+gZxK6HTmYdOJuwktL0QSJK1C1nFsujMPBqopnoSCdafbhFKEgpi5BGRxbkGICXrhE8WtbOXWMjrZFsGblHxwzxm6v3lYXOVBXBlvDtkCV/c0Er6UGz8O9t22I9XBCK5Ro7JzgdxbsokRYS04/tOIAIeiOGI5gzqCFng0ghe7VgRQ6Nvzs1Rn+W+JbRq9K26gYTsBlwKP6LvrHdRMbLSMW6dvCokCslkIDPZ3f4sCkxBIkn7C7CFuV9I60Qt1ZWFpvjrQSCWeGxtlIkOZA1KuUO1W9V2nO3XAG7RWCq2+KEqbia0UeZuvKeYwMPH4xtgViq78UQa+K8MHliAL8+bYF288Ni2mou8DfkanEBwx0najCOTRH2dscd46aQqt7cx9tG78CtM6lZ+HCzjxrDq4TYeNrVBCtX7WSyi/z/YPJHox1XCqizFY+NslmjHEZjD1iwcCeSlRHTzvTUMmxsqKTKrVuctdyo4R/DCJ1GDAuL5EmbVi0ABeUhfxxRq7TlcFYGmG2Dk0UOaXJuXHliIqXQHpykPCuO18rOxllfkHCSpXYTaXkZZBPHsmpqGZuZnFqDv+HMNUI4s8IXYK0ZKKPInpPSTU4OadqM8RZXORNapXWfkXWfLlCUsmxVk4TWNC2zce7yVAdrG1T2fx9hM+Wg9TLJEOQGFpEdIX9XO6o8ccNmVApmCxtGkTg/K+MiYz3xxWh4QF1j6GlboQsLpg9BtLANGSmoe9gl2IJLRJIaECQukLPFMWkB8Pdq7uEHW44HttVxUp59O9pYY0vG8lTySBhlzJAzjuPzkazAJEtOYK8YYeOZsoU92Ef+MBXM5uxWreYYuR9FJvRPWeKOJqGSdrPlQ8/KoINgYeY8udE89MlFwLIP2JLNsRkvMunSyS6aw6IqW2zeTV8IKrUkBRJrymtfRMNOY3GdqmmJUchprBOTIDR8LAVXW6sdKZBRC+UHZ/yhDIMqc/ESIOhm+NYDVj++GIapoqHh+G2aJhfxYVdHzlaMsw4GB0LeK6ib9hZlgvLY3Bz9+WKtfQutA0HacYHBw/4Prlzj0tHmE+5N12KYPuKzA90mZEhFbIofpxR0G7Y/HkuboljyCDyx/tagBtFw5/GWuY02a+Bw+wMgxjPl/fks/lTfujggn1MWtSDSGZ6zkFCmbFMc37ooiGrY2Il7FayILinEYsVdZT1ZkfRXMhAjMlo+NtMHlOunJHArAod2n034Bkv4T8AgRvs8tjJ928dwGtLhVuF8o3Fsm3nZ+4/g7Hj0Z0CdWmRUOiobKF/SNp+pOe2cV9gEUjEVJ4LknHPZtfXa7QiPkMDIyCSnksscYHMWp3PnRaU7S9acCTT62n07qYwYuDGCtEJmEuBd5gtPZISlsZB2anvxhykXWGD26RIzP05GCVqJasZPWsScolxtLgTyJ3FoovCq6ANgxb2Gxp5JVjGiSnIXKbbXOFY4FqC1WZfp4qQ1bFeGfTLR1cY8unlXV5rHgs45j+glQ0D3Z52MpBybQDcqjOe8E2fshapUEbKm8uAYQt37vReg2qgkVop0hBt2y2rrrtLCdqaiZAcm5xxFAKSUSpmMlIJDIGvEAkW8mDVTINC56GmGcLBYOWTjGHEqLYmDBPGlD5U4nFySx3vdmxjdlz03UolsHOXZFDOSQk7wAWOYajtnIxxCCZaCXADUMuMyLWDYs8O3ENaIUzTD2MmUBz0CjlHeYKdGAZtCK0ukFERnff6BmkhUBF8c18DpbT3wQkRGTjCa5oEjrvQw2emDv2T4brHAli34U5qPxGp+VtLli8cfdIRss8zIJuoSWwMTYxqROgZhrC6ogDbEMSEzTBNzWovfs8iocQ2ZU2se9Oa0eTgI5wj5tKuSweyI+DwlMeAWg4EeCdPs2QfNz9a8dZrFkgUCmNOoFKYP4uv3hMVYCfIWzjSTd4+tLat100ixgy4FEocKIHALhpaJNpH3H17AB9lzHt6xXZQAJZxLTA3vMJQ5u8F8MCE54npfipbUINF32ju/uaNy132lEfwTFxBbgZYlQaGGcEL24zhwtMyHLt5QJr1TeVvlTukqlaXGoh1nB/kBWtgYfcJp8vJSxmxu4iE2zQ3qfZNpqUqXFB/hD2tv34aFlw4+xBo7aPsqtqwVWD6pc0jbJyNjCwZfkXsDqd0UvfbBIUvPWyydjU4nZRd3I1NBtYC10/PJWhCYlwY0uXkuu40yozsrxYLZdKjAOhTtXsSydMXpD+KgVvJko6JlMx6wpg13UzybihR+VqXzM8eaRw8Ddue4geNV92TougZILgbspWOUxUAHBtaNO2z63AlFTZirpyuZvAJJlDqBgaLkujbRcANHkdFiNHk8sIK7AslqnvGXEU4Fx/Ij/KgK5z70szrGZyaIDe+akCRQJLTvSQ2ZcFba5fglopDm2GE8KIAKF5UT+d7HURsy6rQvqraw+oKCilwEb2Ja417eg+5Eknih2GekBz13PdQPEMH7bDTlb5jlgto2zvrZeJ0uMtJy23cyJ52HyRlUq9ZWXVrBvIpyY+fE6nbgl4spFbLDXlwMz75gJoR2utZkI3xi7uTg/pAiBma7YR+kPG1CujRzqTHF2xKFF8nfzHZNlm4+wrmrWwLmUBexuk/sOLMNW5sfTLuBQogwJ7uKi8n6VGB0yP+JzXDurSYRahBEZ82jz+QsWgq7FwtwgB33DPmEDhxNrEi1KXG3Le7sXLEQYbYB8ljUF9RQNdIuoghYakJj2aDoh7b8wrnjQk4fUFGo+EeKdf7qCy+xoGdal8CUgo5Cn2K947rI2MEp1ruWIWmJtX/MtgDh5BKf4HjWW56TggwNWsxq4MyNQ9Dbjqgi656B3agzpxvhjeL9N0aB5DjZdtMQydjPqY4EjJ9NDwKEIYKpbj48L5pvGHhfRFrcqQxqBuR073+QS0SFMO4nydMoxjobe8siOwohWLE+HWDSzmJALNOKMBR+QPlPdgX2YnKsFSIri0u3T0gVXKSbu+l7pSQ6RuSE2eKCIg4tsGg9YQdmpSqc7gsn3CZe1aog+JORHeiWl2xx8OP2niC2TaSqeMBzrss39Qwe7+QDhoGXQ4ZqwgW43me2MkKLRtOBM8Jcpl+g86KsVel48dG0ExMmLtnIiplQErkGhn3aauoNyIW0CfzCU9dXz6JR2DqksUkDjnlnKHraS7O7y9hcmue3g4bC3aEiHc9ppuCGMZh+xdOG8Zynyhh2SNl7Yct02JxrNpKdkyozoL0XeIkWUXe2YDDPcDNeD5/lXk2IlkU1hKvKKf99kVWDzt7cLbURCRjEeZ9HmStXYppSTgOV8nBHvcWKs1UL/JudhSFGVeFLWz/n3hKUPqbo12T6phJTjT2PRhhTYBxaZ3yOLFGS7fOWp8BVODvAGtTbxJc2ZkO+EfC2KVnpQNSdpSBzwSc/9xBTZCnxdmH6CcPFwl6o0JUYUZ0tUTgDsQF1ySyX0sDMev3CBgxZxQLDf2U/m10fWeYmegafB45wBm5+8WuIoffivBh1HQmbgYIYNQBWqqz1gPHUQMSdyV6fwpoRzgTLdoqUgWMm7ItKiS3itzMfjZxn0ZWpZyVenud8jR7jbTmXbVQiWO5/heBXDghk06aSlw05OYmnbjvHXkf7ypL2TCBd4W2UaIn4OKAENkq/9GGQghEAZz+ro6IYDKLoyWuERZQRtWG0aZYESNGMNbCQsQcpdC/OvGYk3TKzKELUy3MY/d9koUHFQY4b3hRKyccsPtOFYm3a0H9bx0tCzn5Bq0PDTSCtV0cQAJy2XjXG1qHGYfVdkcqCwKclqTk2uhTOH/J1ttuZmE2cpEDWsnIVyXr0JIdzb58giZOUoCo89Ip7h6QIOR3Is2T+Pl0JLmY2Ew+irURL5hfNb1tbiIeDs7d8H6FK6BGagFkHOrVc4AJFQU/wdCOZnYffqJgsrdhANF9oRkcN3nGnMREh3g07ZyqX12JGRzS7o3CZIy5eF83EWxqXMBWlX4ZVrlBmqiHFsOLI7JrYvaVJfKJ1oVBGcg1H3Fni5wJEzoZbFtJ1cyMOKZM/mbngLCc20aFoutLBPDb5YJT/SRp9uxA+UzAJMrkLNymxruygT00zcK814r8EphJv+bEWsoOGYrUjXPx6T5kYvW2kpzd/FJEanqeGeoIHEzoZ+D5BTKfoWcUpErE7hfzxawx9UdssSFmMwyzFNDmPr0XYBLYSKTvQ2pZDhckkTtDkcHpn45ugQmHBFcLClOf12MjHQtyOTQlMv3ruLKPHEK9tHEBEr0akwMH8BvR8XoerYiS/JacZElJk/GowQJJRASYmjRgZbha9g4w8tsUoXC9XTBs7CBbXzHA+ViSjl0eJtXnzotRC1VARxmF4ak0A7ISRJuh19eTMz0s22Hi8CPD1HeaTlmZZxDTCLlrgs+jUX6lO5vtV/CIwwHHOjpmIE7zzOBjNFKIe8mpBSnoWV+yIRUPBCUVP1nilRFeAsNtFE1A9CgJHJjSTRW3Fk5LNnD4Nba3Pn+sHnOGLIznBTDsOQcm4+znbIp0yIrOnGDitTs72oeCIF5s2j1g3CmFBo9ICnWbU3lSQbFqOBHplZO+0QAH1xBVWfZDzO43UbCGLH3YzHBGfG6aGlWzmaPBOqlGbsVOXlMUmOIfM0uqBQc+47Bj3dRu0Y/c/jwcb2CGjIlkXe6iBhNAwgEfG1GUWowT2igWTDTzNfAWYqGp+O0SOYWZbL7m0R6mzHn/Q8YquHvclZVMLJ4gyEncrltN1Y1A9Numa+QAOXpdRnBLRRWedBWdMGGaKd3y0kgXCYGmGtpqEiSuWsqA399caRVkOmWgYDcZgfWKyPzgx053Bn93/xJA2jQSLtbsXNC3gxMWL8Wmcc9bgtGLP1sj0e4wMEjuttMIEUfPpkrTMr3TyjrvkGAR2K9TYTHxodYpeek/sOGvQluVhamZNix0GQaAObg/umYQpJrj3imTwstoAkcG51Qml0JoQBKHnQQJmYycKVmAF8a2MbNTyrzGiayJPEgfrb8l4nqwuWVmZa6thr382CG6y9VaCQIZmjgy9zHNPPO9v9FONZ2h+mFiRgY128yGCBUsdBdHRo1AcK3+E+Xx2fdxFyFIMrV2OR5QpSsHBGEjRa8fcAI4xmoQwoMpisAw2jioCghj2ChfzsVVLlXxdqjSQ93ohIeOBkBN9EjhIyU3QCDYZAcQkbyGYwOf+AiVg25RuLChGQiKLU30repGlnLgWftRBXNyV/dka6YQeSBHMDHW+jzHRIrodO3jRbPAZS8S9gdz9VQy7KvMpLoa3bm2MII5nT84xAm+TOJkVsu4EGAup+gQMPp3F1mNZLFzF5jdkarAQGmR7xtyC0r+u1S8lG4Quk4ZMT6tyQcj2JIVxJE/1U6oFkngs/Cl22eRQPPrlIc6lWhkqT/ISZDnK7gyVx8l/lclIoFNznruvuGIThwBIbEp1AtYtOFBKGIFAWSt+tGz6YbQvK+KaGhdmvbmMUhk7/Cy8R5yKEoJBQpsEzYy+IY5NGKObQgGZtiisFV+Hy1GZ8ZuMONllROnMrpwsdSVp13QxSMDCMuExpvg2aWoI+bHjJKkvlpcDdGzv3OdaPKyBdmzujhY58Cj4EyMqURI7Fj+eOCKI1SD+zQb1I6zQiPIKWC2PUcJsGHPpNHBUeixLRo0qUjQra2Ck3kIWdfyHGlcPYiHryZoz3hVhZMmdT0ryahRSdOshpqlHbzvxvsvOnG4UFohL2mbOFgZj9nFKSGShcoVDie0ddYVx6pSykpEpP8ZBBCOuGpStVZaG/JAZGhX2e0laL9uy5S7i9orBpTbNk7ONsRgvFegrAN7nCC7nglMuY3yFd8tWMNL11mRcfa1rXCa5haLDUWi85MdcZGQ0KMsD1MpVB/eZaDybDwkc80g+jIcsnKJWhEe5lYgKAbHqktHlKWWOul0SCWzGImbYqx6EaLJoBmqSgQxbIL4CccLlyxiDC9NOpak7l2DQUuxiPidCX2BESKNnruO9mpdSVowUrLRGAfzQMYmbj+YzbRi5O8lMLISYERDB7ARzlHB0ek85bCb2SopsC2VERaNkjpAAM1fd7DELHkY9vVH8hlPGKGEEBZuK9UNSTb6VMKRV+bBkhnwYJKZB5YTDfUagrauFsv4PvHFA6K9z6fSI4reLITcxqVeNHc5nMReW204J0mIchuA/mbG5j04FIXC6FLh3wGpmjURxMQDl1jZbwdkkn4qtJBgtRS9WsQ4G0p1Feg6Ke4glUhSF7b4PhDBsIQm9t1MucOTDdvtR5XcCytAgm8tkLXvZ2lOA/Ic9jGHEVrrUAXsum+3CtheLQEmmwjGCOxpOad+jpp120CIle21rgtCSsaNVFXXnwK+vX4ZicqRPYkNswCgGzyLgdYkyp9OK8Qp+QjeRrCbM1abhb1ppYWnqGC+3BE3OgIyX1E0GsrkoAvpqGyliKN2UVPSmmyBwwTVHd0ZLMoGlpqeJTaG4eBRsyJ2wVLwHYVfaIXDDBeRWmLBCEUe3ESQiApV0KzmcbOcqsbkw4iVdm2K33qR+jT5k8ZDhqlR1gCaLmasqNv+UU9hGEAN1fsRsPS6AmJ9aD7GuoWICWkBKh+UiEvwRmACdXlZqJUsShCwT1MNigZrCCrExoIQGBpiIwZSTe837y32pDBQr6ejGmit6ncCwrGlasoQrLtC6C/x91MhYjylj55PqEYgTNY60OnPJ+siiPSkbVYHAfp+T6yxp3nL9Tdeb8+bAPcoA/yKGqTJCh4vm5JKPP3zr6Ryy/aDHCITZ+hgVqahqkEjJPVll6pFmQKg2LXT0JMmoDGwu0KdYAKiJa0YwgFmBLqvLBFGIkA2mcZMymNWguRgcM2wax7SgR0HqJVt5RLvE3A/JGiATTsxgZgoWSGwHS35eaOls+vyAFEpaSf53pkAkfXJc1CIBxhL768x7rcTc8hb3NhaowIvymYGc59oRg4V7tDtwQpQs44daEWlbA4FweZ4J1OoM1Bg5GhZC0ychw2Ug34v7zSDZg6fcHIItwA5FPAzCuCd5+55yvER8/LhtWmFz4lApqgjmk6QZ2iRorI2FQ4xTw6xnwghrN4PtlqgZVLvsEn2WhYRaaqUlEa6quq7pMf9qmqZtW2buvksKQAqPmB4X5uel+4FnkR8Xp7gXYQCeGI3KR9Gn0oabflNVFf3/8EukaZtwT6u6EjgkCyc5mZkH1FeCT4l19WSchificUEapzFiUKjigEWoJzRaDJJ1PKhTVJGIY5MKpEKoS7kC8nr8GfawGPFYAhhZnVrCzwnkk16vV0Vz6/vuu++ee+6+989/vu+v9z3wwAPr16+fm5trmqbf709MTMyfmNhxhx0e97jH7brrrrvsssvy5cvDUm6aRkSqqnLZ5khT91eAqUintv8UK43k1xr7cTFsI8lAwAjiwopWNEYKpLl777331lv/Z3x8bDgcElGlxCCc4rK0rXO08a5uMBpu2zb9oIULFq7YZsW222w7OTUZ/qZt26ZtqqoOsIZuRtkMukS5scd+t4UlDyuoCnETsWbKJCph5By4ZEmDFd/L5ZF7JKbnMysSSmFP0GEVRuLpTLkHjVFDcqqd0tGLO+vGTRt/8fNffP/73//d739/9113PvzwI4PBIHxDVVVp6xISadu2lX6/P2/e+JIlS5/ylD0OPviQgw466Ml77BF+/HA4DPglOSEqZ8Iwsv9sSgtFK8SKTLXB5UI8D7a/LiEZC2WTrhQv1Ete8pJrr7128eIlaVoYLhFUJnFgR5Uyt9KcAWpxncC30kpbVZW0bVXXixYv2nabbZ/whCfsv//+BxxwwJ577hneTNM0YS+AKEfHZ2KUfkUqn9IGnWQftLpZ4CxloUpuoKYyXeK2aQsRVTa/FqY4btlpyYe7uCAAYXNm7bBNbGSTTvgYKbjMaVcmoptu+u1Xv/qVH/3oR3ffddfm6c39/ti8efPCP0VeNZFnbwsJtSKDwdz09IyILF6yeM89nnLMMce8+MUvWbHNirCs67ou527lJjVdu+RJYXbRe08ccehMKsaFcsINu+MCHoNh0/T7/e9//3vHH3/81OTUsGmqquoepfiaOnzeSpANG1sSS4QMe0Er7dzc3GAwmJycfMYznvHqV7/6xS95Sb/XGw6H3ZoGWz2fWs5CbZaHYmPPsirXGgNqKyyeYkGGZ9dtDU3TOO9Fr6kUy9Yj6D/EMQw9A4MLvAlzqJgvTk8bOMyJSNO0/X6PiH7wgx985rzP/PS/f7Jp86b58+bPmz+fmYfDYcnhr8BtDzt32BvaVqY3b56Zmdl15crXvva1J5988uLFi0MRUtd14s6Y1C8RoxjlMqeULTKKqXGSzY3xYC3Q+rqfiKFETAFPlvalxx33q1/+cnJiYtg0lPpUVjDVOOGCUyvZmB+z8YN5TTjlsJNuhs30zPRwONxnn33e8573HHLIIaFy44rTImV/SklBykTQEAkKMRB41ucDCps08i/JNcIFSAs6c5ngzA8BSJwwiJdk6immNMQYE3Jm4WAamR4Pm2fNJNS0Tdh6b7755nPOOeeaa66Zm51dsHBh3aulbW06HLCLbNo24YndVbStMPWqXlXXszMz09PTj3vc417/+tefcsopdV3nW7VS9bkwNvMYhpklWcGhQTgl37n9EJvxGOguaNu2vV7vyiu/+ZrXvHr5iuVt08YYJyEKlROjxBZcOraEZiHLMSV5wAeMjpa9uq6qTZs2VVV10kknvefd75mcmjRXLBsEOSINGU8zzK+Rsscw5FK7DVEs5NTNwJumTVW5NwGxpipqdSCKErnYcQfuOkzYoPmkJZ2XizKJUNs0vX5v8+bNH/3oRz93wQUbNm5cuGBBKxIaIG9iNDqbgoDGEyvX7s1XzFRxxdX09PT05s2HHnbYBz7wgT322KM7TJEvqR4Jkuz4jKOAFTp4vaq+AfN0M8aaMxVVBHnX3zTNC4866qYbb5xaMCWtuKtccaVmeglsSiOxhK7YDDkN8TRPbIcN4qleVVVYvqtWrXrmPvt89oLP7bbb44fDYV1XWhQI+z2MjbudAhNaVCBEYsFRwPK19EUJNhCNKs5ousojZULDF3JerWQM0l2KbTRKLNLH42gqcXAimSiNadu26fV7N9/8hxce9cIPfvCDTdsuWDA1bJq2abt9NpmNoxiumwaG0s6GboWZbWs0gEIkrQyHg7HxsRUrVvz0pz895uijP/vZz4Zjoe02BrPbC1GBC2YDodOwF6YQCoGM5NNn/5S8GNNFDK3Yt7/97Rt/85sFCxY0wwZk5N2j27YtOp51ltKgEUdTm3j4sE5amCuukqO7CfmMc+/hcDgcDlcsX/77m29+6UtfcvPNN/d6vWbYcBy8Cso5vBLAOQii2Y1FwNOzlkjZWrIZ81I1FRHitmlwYi6jQkOyBjEXKZUMu3TAQ3ZakUie2MOlW9Lr9b7+9a+//e1vX79+3dTU1CDuyomuBds+VxH6aNu2adu2aaLFN1fMYUcJnWUzbLgiUjtaglE013U9GMytXbP2lFNe+5FzPjI2Nha2ajf/L0q5jPMBxpFYccIIpZYfcJgGupPdda8xOzP3wqNeeOutt84bH2+kTfhJuDJVXXE3m6+klbzDEaLcuSTZPkmRfxdEelUVNrWOEEJMTL1eb8PGDcuWLL3yym/u/je7B1s5I7gSITFRQlISVRhVAnRQWC8TMF7SyDCPpOoGKyWffZjbFQr8kgbOuWZhf4nqsXR8Y8Mkyvup6/ojH/nIBz7wgQULpvr9sa7tC8dmlVQkLRHXvVpamZmdmZsbkEi/3+/3++Pj45OTk1xVc7Mzs7Nzc3Nz09PT0ra9fn/+vHn9sbE2/orOAIa2WlXV6tWrDz/iiPPPP3/p0qXD4bCuamD8xTxCR7KL2XhxoiYIU9o6hOGQRaxD3NMODD8horZpe/3eF774hTP+8YwlS5aE0guVWnVdr1+3YW5uhpjruq64aqUF1pdngZe5/GkC1TbSytjY2NTkVH+s37Qtta1k4E9d12vWrnnqU/a8+pprJicnbWqrTkDLY2CDtQjO/9XGSZTpA/Q/NZC3YGiMRs64Ymw7Gy85Lag5StnlhqZsJ8MJn44VIodrX9f1v/zL//rYxz66ePHiVlppBdIx9Vmp6mpubm7zps39fn+nnXbae++999133yc96Unbbrvt4sWLJyYm2rYdzA2mZ6YfffTRu+666/e///3vfve7P/3pT48++uhYf2xiYn7Ttq20VaAiwUUUkn6vv2b16qft/bQvX3b5tttt2zRNFTq5EQo/7+xIuSqWcijDILXuKnK6yGb1Tc/MHHnEEbffccf8efPadEVEhKTiatgMX/vaU3fdZZfB3ICZ615tj1zu6InZ2ZKoP8nwaTgcDgaDBx988I9/+OOt/3Pr2rVr58+f3+/1mm7sYrx8+/2xRx999HWvf92HP/Rh2yDqzAnpD0AcS2NTMhFhoAJKZRsanxitkM4sRDiiHA4UtGNmuwqpxAHO4dsRtUoG4GkIXag03vve95577rkrVqwYDofd1MpwWaXu9YZNs3HjxsWLFz3/yOe//OUv23ff/RYuXPhYhrh33HHHd7/73csuu+yPf/jjvPnzJiYmmuGwK4vblpS8K/2xsdWrHt3nmc/8+te/vnDhwrZtK/X2TjoxQRlBYZpoXUbzBZ3B2yLW7DQd7k3T9Hq988//7Jln/tPy5cubUCjGF6mqasOGDc94xjOuv/76/88n33feeecVV1xx4YUXPvjgg0uXLm2aJnJI9Kmo63rdunVf/epXDzvssK5Oc0iAwd1zzM5CuwxaF7fUHILpZopC3DStCZ41CKq4qte/LDtnBmNJlt8bOEa6KMb0T2E1/+9PfOJd73zniuXLA3kg40ZzXfHq1WuWLVt28sknn/jqE3d7/G4Up31Os43nftu24UkIF3p68/S3v/Pt884778Ybb5ycmOz3w8Zj3JeYeHxs7JFVq444/IgvfvGLda9GH4+i7YGCbSQ+FD4zOyyKvpw8LOEfLbVMvGHDhkMPO+y++/46PjYe6+MO6O71e2tWr7nkkkuOOeaYubm5bo+UHDN7LMwNsxLrug4X7d57733v+973rauuWrRoEY7HO5C0qtavW7vffs/+zne+w2bihxy9ZJGeDwIFJ3T+JM/EnG4yjbUZN23L5Ms7y5jjjPCZV8+FUSWXbAJNMmw8XJth0+v3rr766te85tVTUwsUD02yPKG6rmfnZqenp1/6kpe84x3vfNKTnkREw8GQmHKOTryGjkjKIm3btL1ejyuemZn5zGc+c84558zMzC5cuLAZDkO70729iiviutd74IEHXvf3r/voxz46GAx6dU2jE1ucZXIxIjJnjdpjDM5amKQGXsqnP/3pd7z97UuXLUvVc4ej1fXmTZsOOuigr3zlK6g1zlxQmN1OGDcVyUwGtWZglrZtmmZsbIyI3vGOd376059aumxpM2xhDC9C3KuqTZs3f/WrXz3kkEMGg2GvV2ldQTDxHsHiKtarBV8OQPEcyBgWdP0v73u/881npAFbQhmKZFQB4EPefGR81nAYcnfYm++4444TTjhBROqqNtPyiomo1+tt3rx5anLqo+f857vf855ly5YNBgMiqqs694uP1mx2BhmRn7quwgk+1u8/e//9Dz/88N/f/Ps777xzanKylQYLhQCMLFiw4L//+8crd1259957N82QuSIqB8l1yDRlAj7rzOn86ou+ysyMhuVVXa1eveaMM86YGwxyr3gmmp2b/djHzl25cmWbeEg2253ROiyCmDreY2+XyHaEVNVV27TSypFHHnH//ff/+je/mZg/vw3HWoTXq6qamZlp2uaYY46Rtu2wP/v85luvd79mmx7I4BoVx0zKPWVwE49D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fYipi0u0lcDK+MEPfvCLn/9815Urd9lll6qqmuGwjbognKnmdXz3bLbStE3SXNxwww2nn376l7982YKpBVVdt22bjsk2NsPD4fCuu+868cQT582f10qLs4DkhtQ07ZOf/ORf/fJXd9199/j4uKS1TyTSjo/PW7XqkeFweP111916663z5s3rMuDiu6vrejgYnnPOObvvvjuAG5w71GRolzPQ1HvCKWiLnZEF6R5EVHE1HA6f9KQnPeUpT/nOd74TYoEiUqnBzK20k5NTN9/8+xt/c+NRRx01f/78tmm5YsjzVJWTtXi1ylKrbiZgSrHt6hkWk+E/dvujjd/GAU3bNlh6qvaJyUrtDckVmHv2amMGsibPSgbOMCFNSnjYDPv9/uc+97mzzjorMPTRXKtLjaiqXq+3ccMGrqqjjz769NNP33fffZOQs3MRqLALROCOawhr+8lPfnLxxRdfffXVg8FganJyqPzppDGTqqqCGvHSS79w+BFHYB4wobKPqG3aXr/385//7LjjXtbvjzXNMAVah2tbVdXc3BxXVb/XU2BbQspOvWHDhkMPPfSrX/2qtJLcv30MkssJd1oYjcXANyimghVC3xWU+gQi63XXXf/a154SpuVhRqgCPhIS6vd7jz66+tBDDw0getM0HA0VCp4tlq7ow+/w/fgPk/0Rxzn28zpfQKaQ9R09NVyKNaTB5pxXDHECAhNaezG2zYzRJzjai/7UHPymzvnP//y//tf/CiHpaPCTeGRVxW3Trl+3bnJy8pBDDjn6mGP233//lStXbtUzRUTuueeen/70p1/72td+8t//PWiGixYuYuZOOKOHYLDCqEO020UXXXTUUUdrJaBODuz8fOu6/vu///vLL7986dIlw2FDJB0NI+wtFav9awSyAmNk44YNV37jyoMPOaQZDquq9qJJ8pZwJrkGUx6AkJ40GaiKwGAqtAcg5mY47Pf711x77amvfW3gwXapLgCZMdHY2NiaNWsOOujgiy++eOGihSrzjvGsxvQjJmHAWIXFuVdBlhh1/tyQwwRZ4VHfJbh74vHQVSY6X/Xp6oZnDRFgZrMoJMi5DEwyLEFzS+K7T7YBoa794H/8xwf//d+XLl2ajGAQ7wm3o1f3SGTT5s1hCrDHHnvstddeT3jCE3bcccfly5fPmzevrutmONy4adOqR1fdf9/9//M/t/7u9zffcfvta9asqapqcmKCmINDHPqNhmqh1+sNZudmZmfPP+/841523NzcXFQZIe8vHZ0kxCH36ZZbbj3iiMMDDTrNbIB/yGDtLkLSq3tr16752+f/7WVf/nIzHHLn2ClukwYthZjXAVe0PEdd0BTOBmYbjnK8X2Gfvubaa197yilVXfV7fen8aQQjgvu93iOrVj33wOd+8UtfXLRoUXjUVcCR+8hZySAYt1nSvFhivSHnd1/NZZDD7I+cIE9kZotxrfR2BbpbgLtFAqf17EuZXNnKdh+vA9ejgUuv1/v0pz/9vve9P3CTu6x2TuFf0Tk/lhCDwXB2dmYwGBK14+Pz5s0bD1r7pmnnBnNzs3Nt04Tc2Hnj471+P+AbIujPoShsr643bdo8OTnxyU986oVHvXAwHGBiCHDQybnSNMOm1++9453v/OQnPrFixYqgQCFk1lgbobCpz83Nfetb39pnn31SNiuGoDkSiC82WA3vjXVE6QB3pzdaT6WNIqzp7373u6eddloQ4MSLn6zIqZW23+uvXr36kEMOufTSSxcsWNA0TRW1RcYIjpElZrbXBDqJ2ARAcOEyzyeDWxKcTrhWO/uOpmmYTB4YF2KlSo84Fmfkw9kzeblGiKV8SDLxgXqVpZW6V1911VX/dOaZ69auXbRokaYqZSzbsEwqFZBK0zZdV8YUNZ8BFW6DpSGC8wJpREENuurRVXs8eY/zzjt/772fNgiqmY6ZYFLSdbYMimBmfvihh454/vPXrllTV3XIKnCtQ6xcparrNWvW/t0rXnH++ed3+5xIrj/nTDwtuE3Ye6wWLlCQIOkTicc2OqX7h9DMXH/99aeeemrgkQanEbZzt7GxsTVr1z73wAMvueSScIM6PzuwmHGhkpgyb+RW6uRd0Br6Ab5jQ0OaQthVKwf/MZjfCjBK2XAnmMgHp7FPVrE28WD8RBltT3SuLsRcVdVwMHzRi150zdVXP/vZz3744YcD87gYFB22gLZth81wMBw0zVCDNYiDTfdw2AybYdsFKEhm8kZM3O/3m6ZZ9egjL37Rsd/5znf23vtpg8GgF+Z5nKb+aoXBaHgQn7S2abfbfvvXv+51mzZtiiNl8bZg8bBqm3ZqavItb3kzeVG+UmI05lBM/I1VaTAKhfA5E/V+VwcDQVjWIcEsda8OvLzPfe5zIjQYDGvrvBheeW4wt3jRoh/+8AfHH3/82rVre71eyClNuotUhIjj6PoqQK+q0RODOQmk2DufZhPmFT5a5XSIVnDAWnAzAvfG7teNNIFeICBVpyIVEL28lCjEVPfq4WD4pCc96Rvf+Mb73v++fr+/Zs0a4iqJ8o2VCbG700DITR45aBVjWIvhNVetWrVo4cKPf/x/X/qFL4TYViVYgleRjecFkk3If6urtm1f85rXPPGJT9y4YQO75gLcXqq6Wrdu3QnHn7DHHk8ZDocVY5y9BWZzrx3yVhWZrSZ4mIABCBurbuwTjXQ6zMYPP/zwiy++iCseDge9YHbK6s3MRIPBYPny5T//+c9f/epXr169OqxpoMognV7AJMMZf2LZJiqAYdVq2QR1IJEAeUl3T2wKfXIttCJkQ6qNRtfumb4jdOnfMSocKd7uHEkwQjJE/NOf/vTBD37w6quvbtt2amqqqmqRtm1alJeLOpsw1gDoJY623uG5GzbDTRs3TUxOHveSl77t7W/baaedkoloytCgLJ61gPiwykj7/f6ll176hte/YcWKFcGklKxhIZG0bTs2Pv797/1g1113adu2w798L2igpy3QL40CL5Z23gyFKK/LmU2qAYEvaPggP/zhD0855ZTZ2dkur0w6s9tQrUkr4+Pja9as2ecZ+1z25cuWLVvWDJswE1XJEpY6Kc2HGLNlbWMGeIh2CUyZLhF6MNHYirAscCciyPwx1mOMH91o9M20vJN+aTIgFvhpt2P8KRDw6nrKhPIG8PiCCy647rrrNm3aNG983vj4eFVVeOgbUm5MQE3PZRVHDhVXRDQzM7Np06aFCxccc8yLXve61++999OIKEi1PYcGx1Y52CsWEBMKjhYvetGLbvrtbycnJtqm6dKSYotY1fWqVY+87W1ve8973jscDKu6srUmadySWKKzXfTOtNulBQtS0lvMtzSBAYqTEAT2MIWrMTY29uMf//iEE04cDgfB+xSFduHVenXvkUce2X///b/yla8sWbJE7avVGtN3Ypj3RZgJQsYRlDUIyWffqFMzLD0W7mwMwJoDoY0OV9OgT45JDp2DhRSQxbRA3RwRoRxD4gapmLE2Tf0TB7leWGo333zzN77xjauvvvq2224PPhJjY2Nh8he2PgEFDTpvBHBjemZmZvPmefPnP3mPPY488sjjXvrSPfbYI+yszJXx4TaZTVQ0RjHe//GD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+U/h9YJfba/Xm5mZCQVS0LqtXbu21+/VVdh6m+TEVXElQm0rYZWEpfChD33oU5/+dMhlI6J58ycWL1k8MzMTKG/OZpiI67qu617dq2M5Ia1I+BEnHP+qO++889e//nVV1UR08UUXPec5+2+77bYhpPKRVavquu44wURVVfX7/YRmgSE8M1eBjiIi6zds6PV6wWWd0xBOqKqqXr8XPr4i6/EePfLIw7vussv3vv/9H/7wh5s3b37/+98fyKj9fn96enrd+nXBxKwZhiC2OryfEKIQ1Doism79uvQx27atKq579erVq0PgpmgBEyRtXfgGRWJjkGDVdR2RN0a6HjapCP9h+pFJV+nI3FyS6ZiWrJseJDOjsA2EoJ1g1JLyytuYsOP+JoWcaxKP+a/7mraBr47fHv4n/B/zE4eNiKxfv3758uXfvPKb+BRt3rwp5E/+5sbfHHXUUS956Uuff+TzB4OBiFx22WX77bff3ns/7VWvOn7VqlUi8tnPfvbUU08Vkdtvv/0Zz9jnhht+HPybP/zhD4vIpz/96YULF+64447vete7guT7+X/7/Oc973kHHHDAk/d48g033CAiw+EQ3/PNN9987IuPfclLXvKn//mTtBJioIJCUUSOPvroU089TUQeeOCB7bbb7oc/+KGI3HTTbw888Ln77rfv3z7/+bffdnv4QQceeOAnPvEJEbnrrruOPPLI++67T0Te+tazzjvvvPAxr7766mc+81nPfOYzTz/99I0bNzYhZL7Ri3/uuR8/8MADP/ShDw2Hw6Zt26YdDptwHT7wb/926KGHhtc56aSTjj322PD7T3zik8985jP32uup//qvH2jbdnp684tf/OJrr722aZrbb7v9iCOOuPfee0Xkqqu+tc8++zzjGc846aSTNmzYKCJ333P3sccee+pppz31qU894ogj//rX+0Rk3bp1L33pS2+55RYR+dcPfODtb397+Ck/+9nPnvOc5+y///6vfOXfPfzQw+FuNmm1xDveZoFNadV1f9/APzctLDnzy6yoNi25Bl+B4h91oaWrqa/e2DfTxheKCxsfiO7FG/Nm8GXx/bVtG4zy//SnP+2888633377cDi86abfvvvd7/73f/u3c88997bbbxeRX//610T05re8+be//W34404773zttdfefffdBxxwwCmnnCIiP//5zxcvXrxx46ZPf+bTRPTud717MBzuuuuuP/rRj0TkvvvuO/pFRx//quPvvefesBQOfO6BRx555F133XXyKaccfPDBgYUXrDiHg6GIvOjYY/v9/li//3d/93dhuQ+HwyaupCuuuGLbbbdt2/b8889/8pOfPDc317btBRdc8M53vHP16tXHHXfc8a86Ptz15z3veWFB3/LHP65YseKuu+4SkaOPPuodb39H8L7ZbbfdLrvsy3/5y1+e9rS93/++9we/9LZtww/65S9/OTExsXDhwl6vHx68wdwgWNEF98ftttvulFNOeeWrXvn43Xb7yU9+IiJXX3P1DjvueOONN/7xD3/Ybrvtvv3t74jIGW9609/+7QtE5L3vfe9BBx0kInfdffeKbba56KKL/vKXvzzrWc8Ky/Suu+4cHx//j//4j7vvvvvxj3/8+9//LyLyyKpHdtlll/Dip59++ite8XdhlT/xiU/84Ac/+PDDDx977LGveuUrwzuPNzdtf7pMcffUVW6WRBv/H34Lfldj11r4x+4patq2YgI7H0/Ikq7DMhMgVZIka8BUurMiF4IekPojMIUIavRly5bNzEz/+c9/rut63bq1d91116OPrnrb28763e9+F87BXXfZ9f/6l//1tKc9jYi++1/fffZ++z3/+c9fuXLlhz78oZ/99Gezs3P77bff4x73+G9+85v//eOfnH322bfcess3rrhi2bJlz33uc4fD4Q477LDNim1WbLPNLrvu0rQtEU1PT7/sZS9/3OMe96JjjgnlbwKWAqdsanJyMBgMm+G8+fO6JqzrxisRecELXjAxMXnFN75x1VXfOvHVr+73+9LKC17wgnXr173xjW+85957p2emE/gQCKt1r7dkyZIQyzI+b15wUv3Vr361cePGa665+h/POGPx4kXT05sd9aLf73PFM7Mzk1OTXdMJcTtt2y5cuHDPPfe84utX/Oc5//mc5zyHiG644ce9Xu/ss89+37/8y+Me97hVj64ioje/6U233377fffdd+13v/umM95ERL/8xS/mZmevv/76M888c2rB1Jo1a0N1t80227zyla9auXLlIYccsmbN6mA5Mj4+HizCFi1aFC7IH2/548OPPHLjjTf+4z+eMTc3Nxg2iLpEk06AJEuLQQcIBvZhYaTo4ACIiQxIGClxHV7UEy6pAw0FEdgwqkyJ6UNiSamGXEqOl+gBu5ieFtyPjjrq6Le85S0/+tGPDj744IMPPvjb37n661dcud+++4bbNjk5GY6guq533mmXCz930WAw7Pd7P/vpz5YtX9br1UR03HEvfc973r1y5eM++9nzfvrTn5511lknnXQSMwel4Mz09NTkAiJqBkMaGxsfHw9tT1hD6c0EcqeIfOhDH5qaWjA21n/3u98tIlxVnaxIZDgYzps37/jjX/WWN795amrqU5/6JBFVdXXqqaduv93255133lvf+tb777s/yggGw3Cz62r16jWhnX3wgQefsfcziGjFim2GTXPW29628847/+iHP9ph++3TvQ3N1t57733BBRd8/Wtfe9nLXr7PPvskc/9wMWdnZ3feeeczzzzzgQceOPfcc4899kVEtP32282fP//cc8+t6/r7P/jBs571rLZtd9ttt/322/dVrzp+rN8/8vnPJ6Kdd9653x8788wzd99995/85KcLFkwl7G9mZjocWSEpmYlWr1k9OzNT1/U99947f3weES1fvnx8bOy000474IADfv7znycoM6BJSU7odZD57EbXpGDyfHGWCeFwiOSEKl9ImHxNkwrovG7A8jp9DVY2TYv1d/7K5sSBUMzhsGmaZv36Dcce+6Jdd931JS95yb777rt06bKvfvWr4dT++c9/vuOOOz766KPh6N+0afORRx65zz77nHDiibvuuvJ73/te+LJbbrmFiMLR+ZGPfCQIEEUkJLOfe+7HFi1a9LGPfSwUOfvut+/5550nIp+94LO77757uH8Quml+YZnXRbqL3Hb7bUT0yle+UkRmZmZF5IwzznjWs571vve/f9ddd03l7NOf/vSPfOQjIrJ58+bnPvegPffc87Wnnjp//vwPfvCD4Yx+9atfvf/++7/xjW/cZdddv3XVt0KxEUNEW/c20lk8OzsrIu9///uf/vSnD4fD1atX77DDDpdccomIPPLII/vtt+/RRx19yimn7Lnnnrfddlt4teuuv46I/vM/PyoioUY6+eSTn/70Z7z+DW9YuXLlFVdcEWq/7bff7rbbbhORl7/iFW984xvDNT/2xcfuuONOJ5100tSCBaedelp4P+985zv3fMpTXv/616983OM+9alPichgbq6BqgDfcGENYLmrdWlTKLtxaZl/8lV1VKxk0iPjrIegc6YHMlHjOYBdmksXKc7hW77//e/feOONCxcu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";

// ─── SPLASH SCREEN ───────────────────────────────────────────────────────────
function SplashScreen() {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "#FFFFFF",
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
        src={GVR_LOGO}
        alt="GVR"
        style={{
          width: 180, height: 180,
          animation: "gvrLogoIn 0.38s cubic-bezier(0.34,1.56,0.64,1) 0.05s both",
        }}
      />
    </div>
  );
}

export default function App(){
  const [showSplash, setShowSplash] = useState(true);
  // Hide splash after animation completes (1.2s delay + 0.5s fade = 1.7s)
  useEffect(() => {
    const t = setTimeout(() => setShowSplash(false), 1750);
    return () => clearTimeout(t);
  }, []);

  const auth = useGoogleAuth();
  const [app,setApp]=useState(()=>localStorage.getItem("active_app")||"dispatch");
  const [skipped,setSkipped]=useState(()=>localStorage.getItem("auth_skipped")==="1");
  const switchTo=(a)=>{setApp(a);localStorage.setItem("active_app",a);};

  const handleSkip = () => { setSkipped(true); localStorage.setItem("auth_skipped","1"); };

  // Show login if not authenticated and not skipped
  if (!auth.user && !skipped) {
    return <LoginScreen auth={auth} onSkip={handleSkip}/>;
  }

  return(
    <AuthCtx.Provider value={auth}>
      {showSplash && <SplashScreen />}
      <div style={{height:"100dvh",background:"#0A0A0B",display:"flex",flexDirection:"column",fontFamily:"'Outfit',-apple-system,sans-serif",overflow:"hidden"}}>
        {/* CONTENT */}
        <div style={{flex:1,display:"flex",flexDirection:"column",minHeight:0,overflow:"hidden"}}>
          {app==="dispatch"?<DispatchApp/>:<LeadsApp/>}
        </div>
        {/* BOTTOM TAB BAR */}
        <div style={{
          background:"rgba(10,10,11,0.97)",
          borderTop:"1px solid rgba(255,255,255,0.08)",
          display:"flex",alignItems:"center",
          padding:"8px 0 12px",
          flexShrink:0,
        }}>
          {[
            {id:"dispatch",icon:"dispatch",label:"Заказы"},
            {id:"leads",icon:"leads",label:"Лиды"},
          ].map(t=>{
            const active=app===t.id;
            return(
              <button key={t.id} onClick={()=>switchTo(t.id)} style={{
                flex:1,display:"flex",flexDirection:"column",
                alignItems:"center",gap:3,
                background:"transparent",border:"none",
                cursor:"pointer",fontFamily:"inherit",padding:"4px 0",
              }}>
                <span style={{display:"flex",alignItems:"center",opacity:active?1:0.38}}><IcTab name={t.icon} size={22}/></span>
                <span style={{fontSize:10,fontWeight:active?700:400,color:active?"#FFFFFF":"rgba(255,255,255,0.45)",letterSpacing:"0.01em"}}>{t.label}</span>
                {active&&<div style={{width:4,height:4,borderRadius:"50%",background:"#5B9AFF",marginTop:1}}/>}
              </button>
            );
          })}
        </div>
      </div>
    </AuthCtx.Provider>
  );
}
