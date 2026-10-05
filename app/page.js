"use client";
import { useEffect, useRef, useState } from "react";
import Print from "./Print";
import { D, X_MIN, X_MAX, Y_MIN, inkAt } from "@/lib/config";

const OK = /^[A-Za-z0-9_]{1,15}$/;
const tf = (x, y, w) => `translate3d(${((x * w) / 100).toFixed(2)}px,${((y * w) / 100).toFixed(2)}px,0) translate(-50%,-50%)`;
const sizeFor = (w) => Math.max(30, Math.min(88, (w * D) / 100 / 1.1));
const same = (a, b) => a.toLowerCase() === b.toLowerCase();

// Push a point out of every neighbour so prints can never overlap. Returns null if no free spot.
function resolve(x, y, others, yMax = 5000) {
  const clampPt = () => { x = Math.min(X_MAX, Math.max(X_MIN, x)); y = Math.min(yMax, Math.max(Y_MIN, y)); };
  clampPt();
  for (let i = 0; i < 6; i++) {
    let hit = false;
    for (const p of others) {
      const dx = x - p.x, dy = y - p.y, d = Math.hypot(dx, dy);
      if (d < D) {
        x = p.x + (d ? dx / d : 1) * D; y = p.y + (d ? dy / d : 0) * D;
        clampPt(); hit = true;
      }
    }
    if (!hit) break;
  }
  return others.every((p) => Math.hypot(x - p.x, y - p.y) >= D * 0.98) ? { x, y } : null;
}

function Live({ p, w }) {
  const [ink, setInk] = useState(p.ink ?? 0.3);
  useEffect(() => {
    if (p.ink !== undefined) { setInk(p.ink); return; }
    let r;
    const f = () => { setInk(inkAt(p.t0)); r = requestAnimationFrame(f); };
    f();
    return () => cancelAnimationFrame(r);
  }, [p]);
  return (
    <div className="mark live" style={{ transform: tf(p.x, p.y, w) }}>
      <div className="pin"><Print seed={p.seed} ink={ink} rot={p.rot} size={sizeFor(w)} /></div>
    </div>
  );
}

export default function Page() {
  const [prints, setPrints] = useState([]);
  const [total, setTotal] = useState(0);
  const [step, setStep] = useState("idle"); // idle | naming | armed
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");
  const [live, setLive] = useState(null);
  const [me, setMe] = useState(null);
  const [w, setW] = useState(0);
  const paper = useRef(null), wRef = useRef(0), cur = useRef(null), drag = useRef(null), printsRef = useRef([]), first = useRef(true);
  printsRef.current = prints;

  const load = () =>
    fetch("/api/prints").then((r) => r.json()).then((d) => {
      const list = (d.prints || []).map((p) => (first.current ? { ...p, intro: true } : p));
      first.current = false;
      setPrints(list); setTotal(d.total || 0);
    }).catch(() => {});

  useEffect(() => {
    load();
    try { setMe(JSON.parse(localStorage.getItem("ledger-me") || "null")); } catch {}
    const el = paper.current;
    const ro = new ResizeObserver(() => { wRef.current = el.clientWidth; setW(el.clientWidth); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const mine = me && prints.find((p) => same(p.u, me.u));
  const user = name.replace(/^@/, "").trim();
  const size = sizeFor(w);

  const next = (e) => {
    e.preventDefault();
    if (!OK.test(user)) { setMsg("Use your X username: letters, numbers, underscore."); return; }
    setMsg(""); setStep("armed");
  };

  // ---- place a new print: press and hold anywhere on the page
  const down = (e) => {
    if (step !== "armed" || cur.current) return;
    const r = paper.current.getBoundingClientRect();
    const pos = resolve(((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.width) * 100, printsRef.current);
    if (!pos) { setMsg("No free space here. Try another spot."); return; }
    e.currentTarget.setPointerCapture(e.pointerId);
    setMsg("");
    cur.current = { ...pos, seed: Math.floor(Math.random() * 2147483646) + 1, rot: Math.random() * 60 - 30, t0: performance.now() };
    setLive({ ...cur.current });
  };

  const up = async () => {
    const c = cur.current;
    if (!c) return;
    cur.current = null;
    const ink = inkAt(c.t0);
    setLive({ ...c, ink });
    const res = await fetch("/api/prints", { method: "POST", body: JSON.stringify({ u: user, x: c.x, y: c.y, seed: c.seed, rot: c.rot, ink }) });
    const data = await res.json();
    setLive(null);
    if (!res.ok) { setMsg(data.error || "Something smudged. Try again."); if (res.status === 409) setStep("naming"); return; }
    const who = { u: data.print.u, token: data.token };
    try { localStorage.setItem("ledger-me", JSON.stringify(who)); } catch {}
    setMe(who); setMsg(""); setStep("idle");
    setPrints((ps) => [...ps.filter((p) => !same(p.u, data.print.u)), data.print]);
    setTotal((t) => t + 1);
    load();
  };

  // ---- drag your own print: eased, never overlapping
  const loop = (t) => {
    const d = drag.current;
    if (!d) return;
    const dt = Math.min(0.05, (t - d.last) / 1000 || 0.016);
    d.last = t;
    const k = 1 - Math.exp(-dt * 20);
    d.dx += (d.x - d.dx) * k; d.dy += (d.y - d.dy) * k;
    d.el.style.transform = tf(d.dx, d.dy, wRef.current);
    d.raf = requestAnimationFrame(loop);
  };

  const grab = (e) => {
    if (step === "armed") return;
    e.preventDefault(); e.stopPropagation();
    const el = e.currentTarget, w0 = wRef.current, r = paper.current.getBoundingClientRect();
    el.setPointerCapture(e.pointerId);
    el.classList.add("dragging");
    drag.current = {
      el, offX: e.clientX - (r.left + (mine.x * w0) / 100), offY: e.clientY - (r.top + (mine.y * w0) / 100),
      x: mine.x, y: mine.y, dx: mine.x, dy: mine.y, start: { x: mine.x, y: mine.y }, last: performance.now(),
    };
    drag.current.raf = requestAnimationFrame(loop);
  };

  const dragMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const r = paper.current.getBoundingClientRect();
    const others = printsRef.current.filter((p) => !same(p.u, me.u));
    const pos = resolve(((e.clientX - d.offX - r.left) / r.width) * 100, ((e.clientY - d.offY - r.top) / r.width) * 100, others, (r.height / r.width) * 100 - 2);
    if (pos) { d.x = pos.x; d.y = pos.y; }
  };

  const drop = async () => {
    const d = drag.current;
    if (!d) return;
    cancelAnimationFrame(d.raf);
    drag.current = null;
    d.el.classList.remove("dragging");
    d.el.style.transform = tf(d.x, d.y, wRef.current); // CSS transition glides it into place
    const setPos = (pos) => setPrints((ps) => ps.map((p) => (same(p.u, me.u) ? { ...p, ...pos } : p)));
    setPos({ x: d.x, y: d.y });
    const res = await fetch("/api/prints", { method: "PATCH", body: JSON.stringify({ u: me.u, token: me.token, x: d.x, y: d.y }) });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setPos(d.start); d.el.style.transform = tf(d.start.x, d.start.y, wRef.current);
      setMsg(data.error || "Could not move your print."); setTimeout(() => setMsg(""), 3000);
    }
  };

  const share = () => {
    const text = "I left my thumbprint on the page. Add yours:";
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(location.origin)}`, "_blank");
  };

  const height = Math.max(0, ...prints.map((p) => p.y || 0)) + 14;

  return (
    <>
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <filter id="rough"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="1.3" /></filter>
      </svg>

      <header className="top">
        <h1>Leave your Thumbprint</h1>
        <p>{total} {total === 1 ? "print" : "prints"}</p>
      </header>

      <main ref={paper} className={`paper ${step === "armed" ? "armed" : ""}`} style={{ height: w ? `${(height * w) / 100}px` : undefined }}
        onPointerDown={down} onPointerUp={up} onPointerCancel={up} onContextMenu={(e) => e.preventDefault()}>
        {w > 0 && !total && !live && <p className="empty">Nobody has left a print yet.</p>}
        {w > 0 && prints.map((p) => {
          const pos = { transform: tf(p.x ?? 50, p.y ?? 20, w) };
          const art = <div className="pin"><Print seed={p.seed} ink={p.ink} rot={p.rot} size={size} /></div>;
          return mine && same(p.u, mine.u) ? (
            <div key={p.u} className="mark mine" style={pos} title="Drag to move"
              onPointerDown={grab} onPointerMove={dragMove} onPointerUp={drop} onPointerCancel={drop}>
              {art}<span>@{p.u}</span>
            </div>
          ) : (
            <a key={p.u} className={`mark ${p.intro ? "intro" : ""}`} style={pos} href={`https://x.com/${p.u}`} target="_blank" rel="noreferrer" draggable={false}>
              {art}<span>@{p.u}</span>
            </a>
          );
        })}
        {w > 0 && live && <Live p={live} w={w} />}
      </main>

      <div className="bar">
        {msg && <p className="msg" role="alert">{msg}</p>}
        {mine ? (
          <div className="row"><p>Drag your print to move it.</p><button onClick={share}>Share on X</button></div>
        ) : step === "idle" ? (
          <button className="main" onClick={() => setStep("naming")}>Add your thumbprint</button>
        ) : step === "naming" ? (
          <form onSubmit={next}>
            <span>@</span>
            <input autoFocus value={name.replace(/^@/, "")} maxLength={15} placeholder="your X username" autoComplete="off"
              autoCapitalize="none" spellCheck="false" onChange={(e) => setName(e.target.value)} />
            <button type="submit">Next</button>
          </form>
        ) : (
          <div className="row">
            <p>Press and hold anywhere on the page.</p>
            <button className="ghost" onClick={() => { setStep("idle"); setMsg(""); }}>Cancel</button>
          </div>
        )}
      </div>
    </>
  );
}