import { useState, useEffect, useRef } from "react";

const STORAGE_KEY = "xauusd_trades_v1";
const TF = ["M1","M5","M15","M30","H1","H4","D1"];
const SESSIONS = ["Asie","Londres","New York","Overlap"];
const SETUPS = ["Cassure S/R","Rebond zone","Continuation tendance","Reversal","Breakout consolidation","Autre"];
const WIN = "#1D9E75"; const LOSS = "#E24B4A"; const NEUT = "#378ADD"; const AMB = "#BA7517";

const initTrade = () => ({
  id: Date.now(),
  date: new Date().toISOString().slice(0,16),
  direction: "Long",
  tf: "M15",
  zone: "",
  sl: "",
  tp: "",
  rr: "",
  pnl: "",
  session: "Londres",
  setup: "Rebond zone",
  notes: "",
  screenshot: "",
  status: "open",
  entry: "",
});

function calcRR(sl: string, tp: string, dir: string, entry: string) {
  const s = parseFloat(sl), t = parseFloat(tp), e = parseFloat(entry);
  if (!s || !t || !e) return "";
  if (dir === "Long") return t > e && e > s ? ((t - e) / (e - s)).toFixed(2) : "";
  return s > e && e > t ? ((e - t) / (s - e)).toFixed(2) : "";
}

type Trade = ReturnType<typeof initTrade> & { id: number };

export default function App() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [view, setView] = useState("dashboard");
  const [form, setForm] = useState<any>(initTrade());
  const [editId, setEditId] = useState<number|null>(null);
  const [filter, setFilter] = useState({ dir: "all", session: "all", setup: "all" });
  const [period, setPeriod] = useState("all");
  const fileRef = useRef<HTMLInputElement>(null);
  const chart1Ref = useRef<HTMLCanvasElement>(null);
  const chart2Ref = useRef<HTMLCanvasElement>(null);
  const chart3Ref = useRef<HTMLCanvasElement>(null);
  const chart4Ref = useRef<HTMLCanvasElement>(null);
  const charts = useRef<any>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setTrades(JSON.parse(raw));
    } catch {}
  }, []);

  const save = (t: Trade[]) => {
    setTrades(t);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(t)); } catch {}
  };

  const handleForm = (k: string, v: string) => {
    const updated = { ...form, [k]: v };
    if (["sl","tp","direction","entry"].includes(k)) {
      updated.rr = calcRR(updated.sl, updated.tp, updated.direction, updated.entry);
    }
    setForm(updated);
  };

  const submitTrade = () => {
    if (!form.date) return;
    if (editId) {
      save(trades.map((x: Trade) => x.id === editId ? { ...form, id: editId } : x));
      setEditId(null);
    } else {
      save([...trades, { ...form, id: Date.now() }]);
    }
    setForm(initTrade());
    setView("list");
  };

  const deleteTrade = (id: number) => save(trades.filter((x: Trade) => x.id !== id));
  const editTrade = (t: Trade) => { setForm(t); setEditId(t.id); setView("form"); };
  const closeOpen = (id: number) => save(trades.map((x: Trade) => x.id === id ? { ...x, status: "closed" } : x));

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = (ev) => handleForm("screenshot", ev.target?.result as string);
    r.readAsDataURL(file);
  };

  const filterByPeriod = (t: Trade) => {
    if (period === "all") return true;
    const d = new Date(t.date), now = new Date();
    if (period === "week") { const s = new Date(now); s.setDate(s.getDate()-7); return d >= s; }
    if (period === "month") { const s = new Date(now); s.setMonth(s.getMonth()-1); return d >= s; }
    if (period === "3months") { const s = new Date(now); s.setMonth(s.getMonth()-3); return d >= s; }
    return true;
  };

  const closed = trades.filter((t: Trade) => t.status === "closed" && t.pnl !== "").filter(filterByPeriod);
  const sorted = [...closed].sort((a,b) => new Date(a.date).getTime()-new Date(b.date).getTime());
  const wins = closed.filter((t: Trade) => parseFloat(t.pnl) > 0);
  const losses = closed.filter((t: Trade) => parseFloat(t.pnl) <= 0);
  const winRate = closed.length ? wins.length/closed.length*100 : 0;
  const totalPnl = closed.reduce((s: number,t: Trade) => s+(parseFloat(t.pnl)||0), 0);
  const rrs = closed.filter((t: Trade) => t.rr && !isNaN(parseFloat(t.rr))).map((t: Trade) => parseFloat(t.rr));
  const avgRR = rrs.length ? rrs.reduce((a: number,b: number)=>a+b,0)/rrs.length : 0;
  const pnls = closed.map((t: Trade) => parseFloat(t.pnl)).filter((v: number) => !isNaN(v));
  const bestTrade = pnls.length ? Math.max(...pnls) : 0;
  const worstTrade = pnls.length ? Math.min(...pnls) : 0;
  const avgWin = wins.length ? wins.reduce((s: number,t: Trade)=>s+(parseFloat(t.pnl)||0),0)/wins.length : 0;
  const avgLoss = losses.length ? losses.reduce((s: number,t: Trade)=>s+(parseFloat(t.pnl)||0),0)/losses.length : 0;
  const expectancy = closed.length ? (winRate/100)*avgWin + (1-winRate/100)*avgLoss : 0;

  const pnlCumul = sorted.map((_: Trade,i: number) => sorted.slice(0,i+1).reduce((s: number,x: Trade)=>s+(parseFloat(x.pnl)||0),0));
  const pnlLabels = sorted.map((t: Trade) => t.date.slice(5,10));

  const setupData = SETUPS.map(s => {
    const ts = closed.filter((t: Trade)=>t.setup===s);
    const w = ts.filter((t: Trade)=>parseFloat(t.pnl)>0).length;
    return { name: s, count: ts.length, wr: ts.length?(w/ts.length*100):0 };
  }).filter(s=>s.count>0);

  const sessionData = SESSIONS.map(s => {
    const ts = closed.filter((t: Trade)=>t.session===s);
    return { name: s, count: ts.length };
  }).filter(s=>s.count>0);

  const tfData = TF.map(tf => {
    const ts = closed.filter((t: Trade)=>t.tf===tf);
    return { name: tf, count: ts.length };
  }).filter(s=>s.count>0);

  const maxDD = () => {
    let peak=0, maxDd=0;
    pnlCumul.forEach((v: number) => { if(v>peak) peak=v; const dd=peak-v; if(dd>maxDd) maxDd=dd; });
    return maxDd;
  };

  const streak = () => {
    if (!sorted.length) return { cur: 0, type: "—" };
    let cur=1, type=parseFloat(sorted[sorted.length-1].pnl)>0?"win":"loss";
    for (let i=sorted.length-2;i>=0;i--) {
      const w=parseFloat(sorted[i].pnl)>0;
      if((type==="win")===w) cur++; else break;
    }
    return { cur, type };
  };
  const { cur: streakN, type: streakT } = streak();

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js";
    script.onload = () => buildCharts();
    document.body.appendChild(script);
    return () => { document.body.removeChild(script); };
  }, []);

  useEffect(() => { if ((window as any).Chart) buildCharts(); }, [trades, period, view]);

  const buildCharts = () => {
    if (view !== "dashboard") return;
    const C = (window as any).Chart;
    if (!C) return;
    Object.values(charts.current).forEach((c: any) => c?.destroy());
    charts.current = {};
    if (chart1Ref.current && pnlCumul.length) {
      charts.current.c1 = new C(chart1Ref.current, {
        type:"line", data:{ labels:pnlLabels, datasets:[{ data:pnlCumul.map((v: number)=>parseFloat(v.toFixed(2))), borderColor:totalPnl>=0?WIN:LOSS, backgroundColor:"transparent", borderWidth:2, pointRadius:3, pointBackgroundColor:pnlCumul.map((_: number,i: number)=>parseFloat(sorted[i]?.pnl||"0")>=0?WIN:LOSS), tension:0.3 }] },
        options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false} }, scales:{ x:{ticks:{font:{size:11},color:"#888",maxTicksLimit:8},grid:{color:"rgba(128,128,128,0.1)"}}, y:{ticks:{font:{size:11},color:"#888",callback:(v: number)=>(v>=0?"+":"")+v+" $"},grid:{color:"rgba(128,128,128,0.1)"}} } }
      });
    }
    if (chart2Ref.current && setupData.length) {
      charts.current.c2 = new C(chart2Ref.current, {
        type:"bar", data:{ labels:setupData.map(s=>s.name), datasets:[{ data:setupData.map(s=>parseFloat(s.wr.toFixed(1))), backgroundColor:setupData.map(s=>s.wr>=50?WIN:LOSS), borderRadius:4 }] },
        options:{ responsive:true, maintainAspectRatio:false, indexAxis:"y", plugins:{legend:{display:false}}, scales:{ x:{min:0,max:100,ticks:{font:{size:11},color:"#888",callback:(v: number)=>v+"%"},grid:{color:"rgba(128,128,128,0.1)"}}, y:{ticks:{font:{size:11},color:"#888"},grid:{display:false}} } }
      });
    }
    if (chart3Ref.current && sessionData.length) {
      charts.current.c3 = new C(chart3Ref.current, {
        type:"doughnut", data:{ labels:sessionData.map(s=>s.name), datasets:[{ data:sessionData.map(s=>s.count), backgroundColor:[WIN,NEUT,AMB,"#7F77DD"], borderWidth:0 }] },
        options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, cutout:"65%" }
      });
    }
    if (chart4Ref.current && tfData.length) {
      charts.current.c4 = new C(chart4Ref.current, {
        type:"bar", data:{ labels:tfData.map(t=>t.name), datasets:[{ data:tfData.map(t=>t.count), backgroundColor:NEUT, borderRadius:4 }] },
        options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{ x:{ticks:{font:{size:11},color:"#888"},grid:{display:false}}, y:{ticks:{font:{size:11},color:"#888",stepSize:1},grid:{color:"rgba(128,128,128,0.1)"}} } }
      });
    }
  };

  const bdr = "0.5px solid #e0e0e0";
  const card: React.CSSProperties = { background:"#fff", border:bdr, borderRadius:12, padding:16, marginBottom:12 };
  const inp: React.CSSProperties = { width:"100%", padding:"8px 10px", borderRadius:8, fontSize:14, border:bdr, boxSizing:"border-box", background:"#fff" };
  const muted: React.CSSProperties = { fontSize:12, color:"#888" };
  const metricCard = (label: string, value: string, color?: string, sub?: string) => (
    <div style={{ background:"#f5f5f5", borderRadius:8, padding:"12px 14px", minWidth:0 }}>
      <div style={{ fontSize:12, color:"#888", marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:20, fontWeight:500, color: color||"#222" }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:"#888", marginTop:2 }}>{sub}</div>}
    </div>
  );

  const navBtn = (v: string, label: string) => (
    <button onClick={()=>setView(v)} style={{ padding:"8px 18px", borderRadius:8, cursor:"pointer", fontSize:14, background:view===v?"#e8f0fe":"transparent", color:view===v?"#1a56db":"#888", border:`0.5px solid ${view===v?"#a4c2f4":"#e0e0e0"}`, fontWeight:view===v?500:400 }}>{label}</button>
  );

  const periods: [string,string][] = [["all","Tout"],["week","7 j"],["month","1 mois"],["3months","3 mois"]];

  const filtered = trades.filter((t: Trade) =>
    (filter.dir==="all"||t.direction===filter.dir) &&
    (filter.session==="all"||t.session===filter.session) &&
    (filter.setup==="all"||t.setup===filter.setup)
  );

  const Input = ({ label, children }: { label: string, children: React.ReactNode }) => (
    <div style={{ marginBottom:12 }}>
      <div style={{ fontSize:12, color:"#888", marginBottom:4 }}>{label}</div>
      {children}
    </div>
  );

  return (
    <div style={{ maxWidth:860, margin:"0 auto", padding:"24px 16px", fontFamily:"system-ui, sans-serif", color:"#222" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, flexWrap:"wrap", gap:8 }}>
        <div>
          <div style={{ fontSize:20, fontWeight:500 }}>Journal XAU/USD</div>
          <div style={muted}>{trades.length} trade{trades.length!==1?"s":""} enregistré{trades.length!==1?"s":""}</div>
        </div>
        <button onClick={()=>{ setForm(initTrade()); setEditId(null); setView("form"); }} style={{ padding:"9px 18px", borderRadius:8, cursor:"pointer", fontSize:14, fontWeight:500, background:"#e8f0fe", color:"#1a56db", border:"0.5px solid #a4c2f4" }}>+ Nouveau trade</button>
      </div>

      <div style={{ display:"flex", gap:8, marginBottom:20, flexWrap:"wrap" }}>
        {navBtn("dashboard","Tableau de bord")}
        {navBtn("list","Historique")}
        {navBtn("open",`Ouverts (${trades.filter((t: Trade)=>t.status==="open").length})`)}
        {navBtn("form", editId?"Modifier":"Nouveau trade")}
      </div>

      {view==="dashboard" && (
        <div>
          <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
            {periods.map(([k,l]) => (
              <button key={k} onClick={()=>setPeriod(k)} style={{ padding:"5px 14px", borderRadius:20, fontSize:12, cursor:"pointer", background:period===k?"#e8f0fe":"transparent", color:period===k?"#1a56db":"#888", border:`0.5px solid ${period===k?"#a4c2f4":"#e0e0e0"}` }}>{l}</button>
            ))}
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))", gap:10, marginBottom:16 }}>
            {metricCard("Win rate", closed.length?winRate.toFixed(1)+"%":"—", winRate>=50?WIN:LOSS)}
            {metricCard("P&L total", closed.length?(totalPnl>=0?"+":"")+totalPnl.toFixed(0)+" $":"—", totalPnl>=0?WIN:LOSS)}
            {metricCard("RR moyen", avgRR?"1:"+avgRR.toFixed(2):"—", NEUT)}
            {metricCard("Espérance", closed.length?(expectancy>=0?"+":"")+expectancy.toFixed(1)+" $":"—", expectancy>=0?WIN:LOSS, "par trade")}
            {metricCard("Meilleur", bestTrade?"+"+bestTrade.toFixed(0)+" $":"—", WIN)}
            {metricCard("Pire", worstTrade?worstTrade.toFixed(0)+" $":"—", LOSS)}
            {metricCard("Drawdown max", maxDD()?"-"+maxDD().toFixed(0)+" $":"—", LOSS)}
            {metricCard("Série en cours", streakN+" "+streakT+"s", streakT==="win"?WIN:streakT==="loss"?LOSS:"#222")}
          </div>
          <div style={card}>
            <div style={{ fontSize:13, fontWeight:500, marginBottom:12 }}>Courbe P&L cumulé</div>
            <div style={{ position:"relative", height:200 }}><canvas ref={chart1Ref}></canvas></div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <div style={card}>
              <div style={{ fontSize:13, fontWeight:500, marginBottom:12 }}>Win rate par setup</div>
              <div style={{ position:"relative", height:Math.max(160,setupData.length*42+40) }}><canvas ref={chart2Ref}></canvas></div>
            </div>
            <div style={card}>
              <div style={{ fontSize:13, fontWeight:500, marginBottom:12 }}>Trades par session</div>
              <div style={{ position:"relative", height:160 }}><canvas ref={chart3Ref}></canvas></div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginTop:8 }}>
                {sessionData.map((s,i) => (
                  <span key={s.name} style={{ fontSize:11, display:"flex", alignItems:"center", gap:4 }}>
                    <span style={{ width:8, height:8, borderRadius:2, background:[WIN,NEUT,AMB,"#7F77DD"][i], display:"inline-block" }}></span>
                    <span style={{ color:"#888" }}>{s.name} ({s.count})</span>
                  </span>
                ))}
              </div>
            </div>
            <div style={card}>
              <div style={{ fontSize:13, fontWeight:500, marginBottom:12 }}>Trades par timeframe</div>
              <div style={{ position:"relative", height:160 }}><canvas ref={chart4Ref}></canvas></div>
            </div>
            <div style={card}>
              <div style={{ fontSize:13, fontWeight:500, marginBottom:12 }}>Statistiques avancées</div>
              {[
                ["Trades gagnants", wins.length+" ("+winRate.toFixed(1)+"%)"],
                ["Trades perdants", losses.length+" ("+(100-winRate).toFixed(1)+"%)"],
                ["Gain moyen", wins.length?"+"+avgWin.toFixed(2)+" $":"—"],
                ["Perte moyenne", losses.length?avgLoss.toFixed(2)+" $":"—"],
                ["Ratio G/P", (wins.length&&losses.length)?Math.abs(avgWin/avgLoss).toFixed(2)+"x":"—"],
                ["P&L Long", closed.filter((t: Trade)=>t.direction==="Long").reduce((s: number,t: Trade)=>s+(parseFloat(t.pnl)||0),0).toFixed(0)+" $"],
                ["P&L Short", closed.filter((t: Trade)=>t.direction==="Short").reduce((s: number,t: Trade)=>s+(parseFloat(t.pnl)||0),0).toFixed(0)+" $"],
              ].map(([label,val],i) => (
                <div key={label} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderTop:i?bdr:"none", fontSize:13 }}>
                  <span style={{ color:"#888" }}>{label}</span>
                  <span style={{ fontWeight:500 }}>{val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {(view==="list"||view==="open") && (
        <div>
          {view==="list" && (
            <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap" }}>
              {[["dir","all","Tout"],["dir","Long","Long"],["dir","Short","Short"]].map(([k,v,l]) => (
                <button key={l} onClick={()=>setFilter(f=>({...f,[k]:v}))} style={{ padding:"5px 12px", borderRadius:20, fontSize:12, cursor:"pointer", background:filter[k as keyof typeof filter]===v?"#e8f0fe":"transparent", color:filter[k as keyof typeof filter]===v?"#1a56db":"#888", border:`0.5px solid ${filter[k as keyof typeof filter]===v?"#a4c2f4":"#e0e0e0"}` }}>{l}</button>
              ))}
              <select value={filter.session} onChange={e=>setFilter(f=>({...f,session:e.target.value}))} style={{ ...inp, width:"auto", padding:"5px 10px", fontSize:12, borderRadius:20 }}>
                <option value="all">Toutes sessions</option>
                {SESSIONS.map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
          )}
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {(view==="open"?trades.filter((t: Trade)=>t.status==="open"):filtered).length===0 && (
              <div style={{ textAlign:"center", padding:"2rem 0", color:"#888", fontSize:14 }}>Aucun trade ici.</div>
            )}
            {(view==="open"?trades.filter((t: Trade)=>t.status==="open"):filtered).sort((a: Trade,b: Trade)=>new Date(b.date).getTime()-new Date(a.date).getTime()).map((t: Trade) => (
              <div key={t.id} style={{ background:"#fff", border:bdr, borderRadius:10, padding:"12px 14px" }}>
                <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:8 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                    <span style={{ padding:"3px 10px", borderRadius:20, fontSize:12, fontWeight:500, background:t.direction==="Long"?"#e1f5ee":"#fcebeb", color:t.direction==="Long"?WIN:LOSS }}>{t.direction}</span>
                    <span style={{ fontSize:13, fontWeight:500 }}>{t.entry?t.entry+" $":"—"}</span>
                    <span style={{ fontSize:12, color:"#888" }}>{t.tf} · {t.session} · {t.date?.slice(0,16).replace("T"," ")}</span>
                    {t.status==="open" && <span style={{ fontSize:11, padding:"2px 8px", borderRadius:20, background:"#fff8e1", color:"#b45309", border:"0.5px solid #fcd34d" }}>Ouvert</span>}
                  </div>
                  <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                    {t.status==="open" && <button onClick={()=>closeOpen(t.id)} style={{ ...inp, width:"auto", padding:"4px 10px", fontSize:12, cursor:"pointer", color:"#888" }}>Clôturer</button>}
                    <button onClick={()=>editTrade(t)} style={{ ...inp, width:"auto", padding:"4px 10px", fontSize:12, cursor:"pointer" }}>Modifier</button>
                    <button onClick={()=>deleteTrade(t.id)} style={{ ...inp, width:"auto", padding:"4px 10px", fontSize:12, cursor:"pointer", color:LOSS, borderColor:LOSS }}>Suppr.</button>
                  </div>
                </div>
                <div style={{ display:"flex", gap:16, marginTop:8, flexWrap:"wrap" }}>
                  {t.sl && <span style={{ fontSize:12, color:"#888" }}>SL: <b>{t.sl}</b></span>}
                  {t.tp && <span style={{ fontSize:12, color:"#888" }}>TP: <b>{t.tp}</b></span>}
                  {t.rr && <span style={{ fontSize:12, color:"#888" }}>RR: <b>1:{t.rr}</b></span>}
                  {t.zone && <span style={{ fontSize:12, color:"#888" }}>Zone: <b>{t.zone}</b></span>}
                  {t.setup && <span style={{ fontSize:12, color:"#888" }}>Setup: <b>{t.setup}</b></span>}
                  {t.pnl!==""&&<span style={{ fontSize:13, fontWeight:500, color:parseFloat(t.pnl)>=0?WIN:LOSS }}>{parseFloat(t.pnl)>=0?"+":""}{parseFloat(t.pnl).toFixed(2)} $</span>}
                </div>
                {t.notes&&<div style={{ fontSize:12, color:"#888", marginTop:6, fontStyle:"italic" }}>{t.notes}</div>}
                {t.screenshot&&<img src={t.screenshot} alt="screenshot" style={{ marginTop:8, maxHeight:120, borderRadius:6, border:bdr, cursor:"pointer" }} onClick={()=>window.open(t.screenshot)} />}
              </div>
            ))}
          </div>
        </div>
      )}

      {view==="form" && (
        <div style={card}>
          <div style={{ fontSize:16, fontWeight:500, marginBottom:16 }}>{editId?"Modifier le trade":"Nouveau trade"}</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 16px" }}>
            <Input label="Date / Heure"><input type="datetime-local" value={form.date} onChange={e=>handleForm("date",e.target.value)} style={inp} /></Input>
            <Input label="Direction"><select value={form.direction} onChange={e=>handleForm("direction",e.target.value)} style={inp}><option>Long</option><option>Short</option></select></Input>
            <Input label="Timeframe"><select value={form.tf} onChange={e=>handleForm("tf",e.target.value)} style={inp}>{TF.map(t=><option key={t}>{t}</option>)}</select></Input>
            <Input label="Session"><select value={form.session} onChange={e=>handleForm("session",e.target.value)} style={inp}>{SESSIONS.map(s=><option key={s}>{s}</option>)}</select></Input>
            <Input label="Setup"><select value={form.setup} onChange={e=>handleForm("setup",e.target.value)} style={inp}>{SETUPS.map(s=><option key={s}>{s}</option>)}</select></Input>
            <Input label="Zone S/R"><input placeholder="ex: 2320-2325" value={form.zone} onChange={e=>handleForm("zone",e.target.value)} style={inp} /></Input>
            <Input label="Prix d'entrée ($)"><input type="number" placeholder="ex: 2321.50" value={form.entry} onChange={e=>handleForm("entry",e.target.value)} style={inp} /></Input>
            <Input label="Stop Loss ($)"><input type="number" placeholder="ex: 2315.00" value={form.sl} onChange={e=>handleForm("sl",e.target.value)} style={inp} /></Input>
            <Input label="Take Profit ($)"><input type="number" placeholder="ex: 2340.00" value={form.tp} onChange={e=>handleForm("tp",e.target.value)} style={inp} /></Input>
            <Input label="RR (calculé auto)"><div style={{ ...inp, background:"#f5f5f5", color:form.rr?NEUT:"#aaa" }}>{form.rr?"1:"+form.rr:"Renseignez entrée, SL et TP"}</div></Input>
            <Input label="P&L résultat ($)"><input type="number" placeholder="ex: +45.50 ou -22.00" value={form.pnl} onChange={e=>handleForm("pnl",e.target.value)} style={inp} /></Input>
            <Input label="Statut"><select value={form.status} onChange={e=>handleForm("status",e.target.value)} style={inp}><option value="open">Ouvert</option><option value="closed">Clôturé</option></select></Input>
          </div>
          <Input label="Notes / Raison du trade"><textarea placeholder="Contexte macro, signal technique, état d'esprit..." value={form.notes} onChange={e=>handleForm("notes",e.target.value)} style={{ ...inp, height:80, resize:"vertical" }} /></Input>
          <Input label="Screenshot"><input type="file" accept="image/*" ref={fileRef} onChange={handleImage} style={{ fontSize:13, color:"#888" }} />{form.screenshot&&<img src={form.screenshot} alt="preview" style={{ marginTop:8, maxHeight:100, borderRadius:6, border:bdr }} />}</Input>
          <div style={{ display:"flex", gap:8, marginTop:8 }}>
            <button onClick={submitTrade} style={{ flex:1, padding:10, borderRadius:8, cursor:"pointer", fontSize:14, fontWeight:500, background:"#e8f0fe", color:"#1a56db", border:"0.5px solid #a4c2f4" }}>{editId?"Enregistrer les modifications":"Ajouter le trade"}</button>
            <button onClick={()=>{ setView("list"); setEditId(null); setForm(initTrade()); }} style={{ padding:"10px 20px", borderRadius:8, cursor:"pointer", fontSize:14, border:bdr, color:"#888", background:"transparent" }}>Annuler</button>
          </div>
        </div>
      )}
    </div>
  );
}
