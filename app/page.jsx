app/pimport { useState, useEffect, useRef } from "react";

// ── constants ──────────────────────────────────────────────
const BANK_KEY   = "tl-bank-v1";
const SCHED_KEY  = "tl-sched-v1";
const HOUR_PX    = 64; // px per hour
const START_HOUR = 6;
const END_HOUR   = 24;
const TOTAL_HOURS = END_HOUR - START_HOUR;

const COLORS = ["#60A5FA","#34D399","#FBBF24","#F87171","#A78BFA","#F472B6","#22D3EE","#A3E635"];

const DEFAULT_BANK = [
  { id: 1, name: "過去問演習",   color: "#60A5FA" },
  { id: 2, name: "論文読む",     color: "#60A5FA" },
  { id: 3, name: "英語単語",     color: "#34D399" },
  { id: 4, name: "ジム",         color: "#FBBF24" },
  { id: 5, name: "買い物",       color: "#FBBF24" },
  { id: 6, name: "部屋片付け",   color: "#A78BFA" },
];

// dummy Google Calendar events (will be replaced by real API later)
const GCAL_DUMMY = [
  { id: "g1", name: "輪講",         startH: 10, startM: 0,  dur: 90,  color: "#94A3B8" },
  { id: "g2", name: "指導教員MTG",  startH: 13, startM: 30, dur: 60,  color: "#94A3B8" },
  { id: "g3", name: "バイト",       startH: 17, startM: 0,  dur: 180, color: "#94A3B8" },
];

const pad = n => String(n).padStart(2, "0");
const toKey = d => d.toISOString().slice(0, 10);
const todayKey = () => toKey(new Date());

const DAYS_JA = ["日","月","火","水","木","金","土"];
function getWeek(base) {
  const d = new Date(base);
  d.setDate(d.getDate() - d.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(d);
    day.setDate(d.getDate() + i);
    return day;
  });
}

// ── helpers ────────────────────────────────────────────────
function timeToY(h, m = 0) {
  return (h - START_HOUR + m / 60) * HOUR_PX;
}
function durToH(minutes) {
  return (minutes / 60) * HOUR_PX;
}

// ── main component ─────────────────────────────────────────
export default function TimelineScheduler() {
  const [bank, setBank]         = useState([]);
  const [sched, setSched]       = useState({});
  const [selDate, setSelDate]   = useState(todayKey());
  const [weekBase, setWeekBase] = useState(new Date());
  const [tab, setTab]           = useState("day");   // "day" | "bank"
  const [modal, setModal]       = useState(null);    // { bankItem } | null
  const [timeH, setTimeH]       = useState(9);
  const [timeM, setTimeM]       = useState(0);
  const [dur, setDur]           = useState(60);
  const [newName, setNewName]   = useState("");
  const [newColor, setNewColor] = useState(COLORS[0]);
  const timelineRef             = useRef(null);

  // current time indicator
  const [nowY, setNowY] = useState(null);
  useEffect(() => {
    const update = () => {
      const now = new Date();
      const h = now.getHours() + now.getMinutes() / 60;
      if (h >= START_HOUR && h < END_HOUR) setNowY(timeToY(h));
      else setNowY(null);
    };
    update();
    const t = setInterval(update, 60000);
    return () => clearInterval(t);
  }, []);

  // scroll to current time on mount
  useEffect(() => {
    if (timelineRef.current && nowY !== null) {
      timelineRef.current.scrollTop = nowY - 120;
    }
  }, [nowY]);

  useEffect(() => {
    try {
      const b = localStorage.getItem(BANK_KEY);
      setBank(b ? JSON.parse(b) : DEFAULT_BANK);
      const s = localStorage.getItem(SCHED_KEY);
      setSched(s ? JSON.parse(s) : {});
    } catch { setBank(DEFAULT_BANK); }
  }, []);

  const saveBank  = b => { setBank(b);  try { localStorage.setItem(BANK_KEY,  JSON.stringify(b)); } catch {} };
  const saveSched = s => { setSched(s); try { localStorage.setItem(SCHED_KEY, JSON.stringify(s)); } catch {} };

  const addToBank = () => {
    if (!newName.trim()) return;
    saveBank([...bank, { id: Date.now(), name: newName.trim(), color: newColor }]);
    setNewName("");
  };

  const openModal = item => {
    setModal(item);
    const now = new Date();
    setTimeH(now.getHours());
    setTimeM(Math.round(now.getMinutes() / 15) * 15 % 60);
    setDur(60);
  };

  const confirmAdd = () => {
    if (!modal) return;
    const entry = {
      id: Date.now(),
      name: modal.name,
      color: modal.color,
      startH: timeH,
      startM: timeM,
      dur,
      done: false,
      source: "manual",
    };
    const existing = sched[selDate] || [];
    saveSched({ ...sched, [selDate]: [...existing, entry].sort((a, b) => a.startH * 60 + a.startM - (b.startH * 60 + b.startM)) });
    setModal(null);
  };

  const toggleDone = id => {
    const entries = (sched[selDate] || []).map(e => e.id === id ? { ...e, done: !e.done } : e);
    saveSched({ ...sched, [selDate]: entries });
  };

  const removeEntry = id => {
    saveSched({ ...sched, [selDate]: (sched[selDate] || []).filter(e => e.id !== id) });
  };

  const manualEntries = sched[selDate] || [];
  const allEntries    = [
    ...GCAL_DUMMY.map(e => ({ ...e, source: "gcal" })),
    ...manualEntries,
  ].sort((a, b) => a.startH * 60 + a.startM - (b.startH * 60 + b.startM));

  const week   = getWeek(weekBase);
  const todKey = todayKey();

  return (
    <div style={{
      height: "100vh", display: "flex", flexDirection: "column",
      background: "#111214", color: "#E8E4DC",
      fontFamily: "'Hiragino Kaku Gothic ProN','Noto Sans JP',sans-serif",
      overflow: "hidden",
    }}>

      {/* ── top bar ── */}
      <div style={{ padding: "14px 18px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: "0.25em", color: "#444", fontWeight: 700, textTransform: "uppercase" }}>Timeline</div>
            <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1.1 }}>
              {selDate === todKey ? "Today" : selDate.slice(5).replace("-", "/")}
            </div>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {["day","bank"].map(v => (
              <button key={v} onClick={() => setTab(v)} style={{
                padding: "6px 14px",
                background: tab === v ? "#E8E4DC" : "transparent",
                color: tab === v ? "#111214" : "#555",
                border: "1px solid #2a2a2a",
                borderRadius: 6, fontSize: 11, fontWeight: 700,
                cursor: "pointer", letterSpacing: "0.08em", textTransform: "uppercase",
              }}>{v === "day" ? "Day" : "Bank"}</button>
            ))}
          </div>
        </div>

        {/* week strip */}
        {tab === "day" && (
          <div style={{ display: "flex", alignItems: "center", marginBottom: 2 }}>
            <button onClick={() => setWeekBase(d => { const n = new Date(d); n.setDate(n.getDate()-7); return n; })}
              style={{ background:"none", border:"none", color:"#444", fontSize:18, cursor:"pointer", padding:"0 6px 6px" }}>‹</button>
            <div style={{ flex:1, display:"flex", justifyContent:"space-around" }}>
              {week.map(day => {
                const key  = toKey(day);
< truncated lines 188-267 >
                  display:"flex", flexDirection:"column", justifyContent:"center",
                  opacity: e.done ? 0.4 : 1,
                  transition:"opacity 0.2s",
                  cursor: isGcal ? "default" : "pointer",
                  userSelect:"none",
                }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    {!isGcal && (
                      <div onClick={() => toggleDone(e.id)} style={{
                        width:16, height:16, borderRadius:8, flexShrink:0,
                        border:`1.5px solid ${e.done ? "#444" : e.color}`,
                        background: e.done ? "#444":"transparent",
                        display:"flex", alignItems:"center", justifyContent:"center",
                      }}>
                        {e.done && <span style={{ fontSize:9, color:"#888", fontWeight:900 }}>✓</span>}
                      </div>
                    )}
                    {isGcal && (
                      <div style={{ width:6, height:6, borderRadius:3, background:"#94A3B8", flexShrink:0, marginLeft:2 }} />
                    )}
                    <span style={{
                      fontSize: h > 36 ? 13 : 11,
                      fontWeight:700,
                      color: e.done ? "#333" : isGcal ? "#94A3B8" : "#E8E4DC",
                      textDecoration: e.done ? "line-through":"none",
                      flex:1, overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis",
                    }}>{e.name}</span>
                    {!isGcal && (
                      <div onClick={() => removeEntry(e.id)} style={{
                        background:"none", border:"none", color:"#2a2a2a", cursor:"pointer",
                        fontSize:14, lineHeight:1, padding:"0 2px", flexShrink:0,
                      }}>×</div>
                    )}
                  </div>
                  {h > 36 && (
                    <div style={{ fontSize:10, color:"#444", marginTop:3, marginLeft: isGcal ? 14 : 22 }}>
                      {pad(e.startH)}:{pad(e.startM)} – {pad(endH)}:{pad(endM)}
                      {isGcal && <span style={{ marginLeft:6, fontSize:9, color:"#333" }}>GCal</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── bank view ── */}
      {tab === "bank" && (
        <div style={{ flex:1, overflowY:"auto", padding:"16px 18px" }}>
          <div style={{ fontSize:11, color:"#444", letterSpacing:"0.15em", fontWeight:700, marginBottom:10, textTransform:"uppercase" }}>
            タスクをタップ → 今日の {selDate.slice(5).replace("-","/")} に追加
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:20 }}>
            {bank.map(t => (
              <div key={t.id} onClick={() => openModal(t)} style={{
                display:"flex", alignItems:"center", gap:10,
                padding:"13px 16px",
                background:"#191919",
                borderRadius:10,
                borderLeft:`3px solid ${t.color}`,
                cursor:"pointer",
                transition:"background 0.15s",
              }}
                onMouseEnter={e => e.currentTarget.style.background="#202020"}
                onMouseLeave={e => e.currentTarget.style.background="#191919"}
              >
                <span style={{ flex:1, fontSize:14, fontWeight:700, color:"#E8E4DC" }}>{t.name}</span>
                <span style={{ fontSize:11, color:"#333" }}>＋</span>
                <button onClick={ev => { ev.stopPropagation(); saveBank(bank.filter(b => b.id !== t.id)); }}
                  style={{ background:"none", border:"none", color:"#2a2a2a", cursor:"pointer", fontSize:16, padding:"0 2px" }}>×</button>
              </div>
            ))}
          </div>

          {/* add to bank */}
          <div style={{ borderTop:"1px solid #1a1a1a", paddingTop:16 }}>
            <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginBottom:10 }}>
              {COLORS.map(c => (
                <div key={c} onClick={() => setNewColor(c)} style={{
                  width:22, height:22, borderRadius:11, background:c, cursor:"pointer",
                  border: newColor===c ? "2px solid #E8E4DC":"2px solid transparent",
                  transition:"border 0.1s",
                }} />
              ))}
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <input value={newName} onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key==="Enter" && addToBank()}
                placeholder="新しいタスク..."
                style={{
                  flex:1, padding:"10px 14px", fontSize:14,
                  background:"#191919", border:"1px solid #222",
                  borderRadius:8, color:"#E8E4DC", outline:"none", fontFamily:"inherit",
                }} />
              <button onClick={addToBank} style={{
                padding:"10px 16px", background:"#E8E4DC", color:"#111214",
                border:"none", borderRadius:8, fontSize:18, cursor:"pointer",
              }}>+</button>
            </div>
          </div>
        </div>
      )}

      {/* ── FAB: add task (day view) ── */}
      {tab === "day" && (
        <button onClick={() => setTab("bank")} style={{
          position:"fixed", bottom:28, right:22,
          width:52, height:52, borderRadius:26,
          background:"#E8E4DC", color:"#111214",
          border:"none", fontSize:24, fontWeight:300,
          cursor:"pointer", boxShadow:"0 4px 20px rgba(0,0,0,0.5)",
          display:"flex", alignItems:"center", justifyContent:"center",
          lineHeight:1,
        }}>+</button>
      )}

      {/* ── modal: pick time & duration ── */}
      {modal && (
        <div style={{
          position:"fixed", inset:0, background:"rgba(0,0,0,0.8)",
          display:"flex", flexDirection:"column", justifyContent:"flex-end",
          zIndex:200,
        }} onClick={e => { if(e.target===e.currentTarget) setModal(null); }}>
          <div style={{
            background:"#161618", borderRadius:"20px 20px 0 0",
            padding:"24px 20px 44px",
          }}>
            {/* task label */}
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:20 }}>
              <div style={{ width:10, height:10, borderRadius:5, background:modal.color }} />
              <span style={{ fontSize:16, fontWeight:800, color:"#E8E4DC" }}>{modal.name}</span>
              <span style={{ fontSize:11, color:"#444", marginLeft:"auto" }}>
                {selDate === todKey ? "今日" : selDate.slice(5).replace("-","/")} に追加
              </span>
            </div>

            {/* time */}
            <div style={{ fontSize:10, letterSpacing:"0.2em", color:"#444", fontWeight:700, marginBottom:8, textTransform:"uppercase" }}>開始時間</div>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:20 }}>
              <select value={timeH} onChange={e => setTimeH(+e.target.value)} style={selectStyle}>
                {Array.from({length:18},(_,i)=>START_HOUR+i).map(h=><option key={h} value={h}>{pad(h)}</option>)}
              </select>
              <span style={{ color:"#444", fontSize:22, fontWeight:900 }}>:</span>
              <select value={timeM} onChange={e => setTimeM(+e.target.value)} style={selectStyle}>
                {[0,15,30,45].map(m=><option key={m} value={m}>{pad(m)}</option>)}
              </select>
            </div>

            {/* duration */}
            <div style={{ fontSize:10, letterSpacing:"0.2em", color:"#444", fontWeight:700, marginBottom:8, textTransform:"uppercase" }}>所要時間</div>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:24 }}>
              {[15,30,45,60,90,120].map(d => (
                <button key={d} onClick={() => setDur(d)} style={{
                  padding:"8px 14px",
                  background: dur===d ? modal.color : "#1e1e1e",
                  color: dur===d ? "#fff" : "#555",
                  border:"none", borderRadius:8,
                  fontSize:12, fontWeight:700, cursor:"pointer",
                  transition:"all 0.15s",
                }}>{d < 60 ? `${d}分` : `${d/60}時間`}</button>
              ))}
            </div>

            <button onClick={confirmAdd} style={{
              width:"100%", padding:"14px",
              background: modal.color, color:"#fff",
              border:"none", borderRadius:10,
              fontSize:14, fontWeight:800, cursor:"pointer",
              letterSpacing:"0.05em",
            }}>
              {pad(timeH)}:{pad(timeM)} に追加（{dur < 60 ? `${dur}分` : `${dur/60}時間`}）
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const selectStyle = {
  background:"#1e1e1e", color:"#E8E4DC",
  border:"1px solid #2a2a2a", borderRadius:8,
  padding:"10px 12px", fontSize:20, fontWeight:700,
  fontFamily:"inherit", flex:1, outline:"none",
};
