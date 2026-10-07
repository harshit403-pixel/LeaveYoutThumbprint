"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Print from "./Print";
import { inkAt } from "@/lib/config";
import { SIZE, RX, RY, hasWorld, legacyWorld } from "@/lib/position";
import html2canvas from "html2canvas";

const OK = /^[A-Za-z0-9_]{1,15}$/;
const same = (a, b) => a.toLowerCase() === b.toLowerCase();
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const MIN_S = 0.1, MAX_S = 3;

const tf = (x, y) =>
  `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) translate(-50%,-50%)`;

const clear = (x, y, others) =>
  others.every((p) => Math.hypot((x - p.x) / RX, (y - p.y) / RY) >= 0.98);

// Push a point out of every neighbour. Returns null if it cannot find room.
function resolve(x, y, others) {
  for (let i = 0; i < 8; i++) {
    let hit = false;
    for (const p of others) {
      const dx = (x - p.x) / RX, dy = (y - p.y) / RY, d = Math.hypot(dx, dy);
      if (d < 1) {
        x = p.x + (d ? dx / d : 1) * RX;
        y = p.y + (d ? dy / d : 0) * RY;
        hit = true;
      }
    }
    if (!hit) break;
  }
  return clear(x, y, others) ? { x, y } : null;
}

// Like resolve, but spirals outward until it finds a free spot (canvas has no edge).
function freeSpot(x, y, others) {
  const r = resolve(x, y, others);
  if (r) return r;
  for (let k = 1; k < 80; k++)
    for (let a = 0; a < 12; a++) {
      const t = (a / 12) * 2 * Math.PI;
      const px = x + Math.cos(t) * k * RX * 0.5;
      const py = y + Math.sin(t) * k * RY * 0.5;
      if (clear(px, py, others)) return { x: px, y: py };
    }
  return { x, y };
}

function Live({ p }) {
  const [ink, setInk] = useState(p.ink ?? 0.3);

  useEffect(() => {
    if (p.ink !== undefined) {
      setInk(p.ink);
      return;
    }
    let r;
    const f = () => {
      setInk(inkAt(p.t0));
      r = requestAnimationFrame(f);
    };
    f();
    return () => cancelAnimationFrame(r);
  }, [p]);

  return (
    <div className="mark live" style={{ transform: tf(p.x, p.y) }}>
      <div className="pin">
        <Print seed={p.seed} ink={ink} rot={p.rot} size={SIZE} />
      </div>
    </div>
  );
}

export default function Page() {
  const [prints, setPrints] = useState([]);
  const [total, setTotal] = useState(0);
  const [step, setStep] = useState("idle");
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");
  const [live, setLive] = useState(null);
  const [me, setMe] = useState(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  const paper = useRef(null);
  const worldRef = useRef(null);
  const captureRef = useRef(null);
  const viewRef = useRef({ tx: 0, ty: 0, s: 1 });
  const ptrs = useRef(new Map());
  const gest = useRef(null);
  const moved = useRef(false);
  const didFit = useRef(false);
  const raf = useRef(0);
  const idle = useRef(0);
  const cur = useRef(null);
  const drag = useRef(null);
  const first = useRef(true);
  const laidRef = useRef({});

  // Position of every print in world units. Saved positions are fixed;
  // old prints are laid out once around them, oldest first, never overlapping.
  const laid = useMemo(() => {
    const out = {};
    const placed = [];
    for (const p of prints)
      if (hasWorld(p)) {
        out[p.u] = { x: p.wx, y: p.wy };
        placed.push(out[p.u]);
      }
    const old = prints.filter((p) => !hasWorld(p)).sort((a, b) => (a.t || 0) - (b.t || 0));
    for (const p of old) {
      const w = legacyWorld(p);
      const pos = freeSpot(w.wx, w.wy, placed);
      out[p.u] = pos;
      placed.push(pos);
    }
    return out;
  }, [prints]);
  laidRef.current = laid;

  // ---- view (pan / zoom), applied straight to the DOM for smoothness ----
  // While moving, the canvas is promoted to its own layer (class "moving") so the
  // browser just slides a picture instead of redrawing every print. It is redrawn
  // sharp ~160ms after you stop. Writes are batched to one per frame.
  function setView(v) {
    viewRef.current = v;
    const w = worldRef.current;
    if (!w) return;
    w.classList.add("moving");
    clearTimeout(idle.current);
    idle.current = setTimeout(() => w.classList.remove("moving"), 160);
    if (!raf.current)
      raf.current = requestAnimationFrame(() => {
        raf.current = 0;
        const c = viewRef.current;
        w.style.transform = `translate(${c.tx}px,${c.ty}px) scale(${c.s})`;
      });
  }

  function zoomAt(cx, cy, factor) {
    const v = viewRef.current;
    const s = clamp(v.s * factor, MIN_S, MAX_S);
    const k = s / v.s;
    setView({ s, tx: cx - (cx - v.tx) * k, ty: cy - (cy - v.ty) * k });
  }

  const toWorld = (cx, cy) => {
    const r = paper.current.getBoundingClientRect();
    const v = viewRef.current;
    return { x: (cx - r.left - v.tx) / v.s, y: (cy - r.top - v.ty) / v.s };
  };

  function fitAll(initial = false) {
  const pts = Object.values(laidRef.current);

  if (!pts.length || !box.w) return;

  /*
   * Use the main cluster of prints instead of extreme outliers.
   *
   * We find the median X/Y and only use prints reasonably close
   * to that center when calculating the camera.
   */
  const xs = pts.map((p) => p.x).sort((a, b) => a - b);
  const ys = pts.map((p) => p.y).sort((a, b) => a - b);

  const median = (arr) => {
    const mid = Math.floor(arr.length / 2);
    return arr.length % 2
      ? arr[mid]
      : (arr[mid - 1] + arr[mid]) / 2;
  };

  const centerX = median(xs);
  const centerY = median(ys);

  // Ignore prints that are extremely far away from the main cluster.
  const MAX_CLUSTER_DISTANCE = 3500;

  const cluster = pts.filter(
    (p) =>
      Math.hypot(
        (p.x - centerX),
        (p.y - centerY)
      ) <= MAX_CLUSTER_DISTANCE
  );

  const visiblePts = cluster.length ? cluster : pts;

  const clusterXs = visiblePts.map((p) => p.x);
  const clusterYs = visiblePts.map((p) => p.y);

  const minX = Math.min(...clusterXs);
  const maxX = Math.max(...clusterXs);
  const minY = Math.min(...clusterYs);
  const maxY = Math.max(...clusterYs);

  let s = Math.min(
    box.w / (maxX - minX + 2 * RX),
    (box.h - 160) / (maxY - minY + 2 * RY)
  );

  /*
   * Don't zoom out too far.
   * This keeps the canvas readable even when there are
   * a few prints far away.
   */
  s = clamp(s, 0.5, 1);

  let cx = (minX + maxX) / 2;
  let cy = (minY + maxY) / 2;

  /*
   * On initial load, prefer a comfortable view rather than
   * trying to show the entire cluster.
   */
  if (initial) {
    s = Math.max(s, 0.65);

    const m = me && laidRef.current[me.u];

    if (m) {
      cx = m.x;
      cy = m.y;
    }
  }

  setView({
    s,
    tx: box.w / 2 - cx * s,
    ty: box.h / 2 + 10 - cy * s,
  });
}

  const load = () =>
    fetch("/api/prints")
      .then((r) => r.json())
      .then((d) => {
        const list = (d.prints || []).map((p) =>
          first.current ? { ...p, intro: true } : p
        );
        first.current = false;
        setPrints(list);
        setTotal(d.total || 0);
      })
      .catch(() => {});

  useEffect(() => {
    load();
    try {
      setMe(JSON.parse(localStorage.getItem("ledger-me") || "null"));
    } catch {}

    const el = paper.current;
    if (!el) return;
    const ro = new ResizeObserver(() =>
      setBox({ w: el.clientWidth, h: el.clientHeight })
    );
    ro.observe(el);

    // Ctrl/Cmd + scroll (or trackpad pinch) zooms, plain scroll pans.
    const wheel = (e) => {
      e.preventDefault();
      const v = viewRef.current;
      if (e.ctrlKey || e.metaKey) {
        const r = el.getBoundingClientRect();
        zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-clamp(e.deltaY, -50, 50) * 0.01));
      } else setView({ ...v, tx: v.tx - e.deltaX, ty: v.ty - e.deltaY });
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => {
      ro.disconnect();
      el.removeEventListener("wheel", wheel);
    };
  }, []);

  // Show everything once, the first time prints and screen size are known.
  useEffect(() => {
    if (didFit.current || !box.w || !prints.length) return;
    didFit.current = true;
    fitAll(true);
  }, [box.w, prints.length]);

  const mine = me && prints.find((p) => same(p.u, me.u));
  const user = name.replace(/^@/, "").trim();

  const others = (skipUser) =>
    prints
      .filter((p) => !skipUser || !same(p.u, skipUser))
      .map((p) => laidRef.current[p.u])
      .filter(Boolean);

  const next = (e) => {
    e.preventDefault();
    if (!OK.test(user)) {
      setMsg("Use your X username: letters, numbers, underscore.");
      return;
    }
    setMsg("");
    setStep("armed");
  };

  // Place a new thumbprint (hold to ink).
  const place = (e) => {
    if (cur.current) return;
    const w0 = toWorld(e.clientX, e.clientY);
    const pos = resolve(w0.x, w0.y, others());
    if (!pos) {
      setMsg("No free space here. Try another spot or pan to an empty area.");
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    setMsg("");
    cur.current = {
      ...pos,
      seed: Math.floor(Math.random() * 2147483646) + 1,
      rot: Math.random() * 60 - 30,
      t0: performance.now(),
    };
    setLive({ ...cur.current });
  };

  const up = async () => {
    const c = cur.current;
    if (!c) return;
    cur.current = null;

    const ink = inkAt(c.t0);
    setLive({ ...c, ink });

    const res = await fetch("/api/prints", {
      method: "POST",
      body: JSON.stringify({ u: user, wx: c.x, wy: c.y, seed: c.seed, rot: c.rot, ink }),
    });
    const data = await res.json();
    setLive(null);

    if (!res.ok) {
      setMsg(data.error || "Something smudged. Try again.");
      if (res.status === 409) setStep("naming");
      return;
    }

    const who = { u: data.print.u, token: data.token };
    try {
      localStorage.setItem("ledger-me", JSON.stringify(who));
    } catch {}

    setMe(who);
    setMsg("");
    setStep("idle");
    setPrints((ps) => [...ps.filter((p) => !same(p.u, data.print.u)), data.print]);
    setTotal((t) => t + 1);
    load();
  };

  // ---- background gestures: drag to pan, two fingers to pinch ----
  const pDown = (e) => {
    if (step === "armed") return place(e);
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const v = viewRef.current;
    if (ptrs.current.size === 1)
      gest.current = { type: "pan", x: e.clientX, y: e.clientY, tx: v.tx, ty: v.ty, moved: false };
    else if (ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()];
      gest.current = {
        type: "pinch",
        d: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2,
        s: v.s, tx: v.tx, ty: v.ty,
      };
    }
  };

  const pMove = (e) => {
    if (!ptrs.current.has(e.pointerId)) return;
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gest.current;
    if (!g) return;

    if (g.type === "pan" && ptrs.current.size === 1) {
      const dx = e.clientX - g.x, dy = e.clientY - g.y;
      if (!g.moved) {
        if (Math.hypot(dx, dy) < 5) return;
        g.moved = true;
        moved.current = true;
        paper.current.setPointerCapture(e.pointerId);
        paper.current.classList.add("panning");
      }
      setView({ ...viewRef.current, tx: g.tx + dx, ty: g.ty + dy });
    } else if (g.type === "pinch" && ptrs.current.size >= 2) {
      const [a, b] = [...ptrs.current.values()];
      const r = paper.current.getBoundingClientRect();
      const s = clamp(g.s * (Math.hypot(a.x - b.x, a.y - b.y) / g.d), MIN_S, MAX_S);
      const wx = (g.cx - r.left - g.tx) / g.s, wy = (g.cy - r.top - g.ty) / g.s;
      setView({
        s,
        tx: (a.x + b.x) / 2 - r.left - wx * s,
        ty: (a.y + b.y) / 2 - r.top - wy * s,
      });
    }
  };

  const pUp = (e) => {
    if (cur.current) return up();
    ptrs.current.delete(e.pointerId);
    const left = [...ptrs.current.values()];
    const v = viewRef.current;
    if (!left.length) {
      gest.current = null;
      paper.current.classList.remove("panning");
      setTimeout(() => (moved.current = false), 0);
    } else if (left.length === 1)
      gest.current = { type: "pan", x: left[0].x, y: left[0].y, tx: v.tx, ty: v.ty, moved: true };
  };

  // ---- dragging your own print ----
  const loop = (t) => {
    const d = drag.current;
    if (!d) return;
    const dt = Math.min(0.05, (t - d.last) / 1000 || 0.016);
    d.last = t;
    const k = 1 - Math.exp(-dt * 20);
    d.dx += (d.x - d.dx) * k;
    d.dy += (d.y - d.dy) * k;
    d.el.style.transform = tf(d.dx, d.dy);
    d.raf = requestAnimationFrame(loop);
  };

  const grab = (e) => {
    if (step === "armed") return;
    e.preventDefault();
    e.stopPropagation();
    const m = mine && laidRef.current[mine.u];
    if (!m) return;

    const el = e.currentTarget;
    const w0 = toWorld(e.clientX, e.clientY);
    el.setPointerCapture(e.pointerId);
    el.classList.add("dragging");

    drag.current = {
      el,
      offX: w0.x - m.x,
      offY: w0.y - m.y,
      x: m.x, y: m.y, dx: m.x, dy: m.y,
      start: { x: m.x, y: m.y, wx: mine.wx, wy: mine.wy },
      last: performance.now(),
    };
    drag.current.raf = requestAnimationFrame(loop);
  };

  const dragMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const w0 = toWorld(e.clientX, e.clientY);
    const pos = resolve(w0.x - d.offX, w0.y - d.offY, others(me.u));
    if (pos) {
      d.x = pos.x;
      d.y = pos.y;
    }
  };

  const drop = async () => {
    const d = drag.current;
    if (!d) return;
    cancelAnimationFrame(d.raf);
    drag.current = null;
    d.el.classList.remove("dragging");
    d.el.style.transform = tf(d.x, d.y);

    const setPos = (pos) =>
      setPrints((ps) => ps.map((p) => (same(p.u, me.u) ? { ...p, ...pos } : p)));

    setPos({ wx: d.x, wy: d.y });

    const res = await fetch("/api/prints", {
      method: "PATCH",
      body: JSON.stringify({ u: me.u, token: me.token, wx: d.x, wy: d.y }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setPos({ wx: d.start.wx, wy: d.start.wy });
      d.el.style.transform = tf(d.start.x, d.start.y);
      setMsg(data.error || "Could not move your print.");
      setTimeout(() => setMsg(""), 3000);
    }
  };

  // Share: screenshot what you see, download it, open X.
  const share = async () => {
    const text = "I left my thumbprint on the page. Add yours:";
    try {
      if (!captureRef.current) return;
      const canvas = await html2canvas(captureRef.current, {
        backgroundColor: "#ffffff",
        scale: Math.min(window.devicePixelRatio || 1, 2),
        useCORS: true,
        logging: false,
        width: captureRef.current.clientWidth,
        height: captureRef.current.clientHeight,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
      });
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("Failed to create PNG");

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "thumbprint-ledger.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      window.open(
        `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
        "_blank",
        "noopener,noreferrer"
      );
    } catch (error) {
      console.error("Share failed:", error);
      setMsg("Could not create the image. Please try again.");
      setTimeout(() => setMsg(""), 3000);
    }
  };

  return (
    <div ref={captureRef} className="capture-area">
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <filter id="rough">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="1.3" />
        </filter>
      </svg>

      <header className="top">
        <h1>Leave your Thumbprint</h1>
        <p>
          {total} {total === 1 ? "print" : "prints"}
        </p>
      </header>

      <main
        ref={paper}
        className={`paper ${step === "armed" ? "armed" : ""}`}
        onPointerDown={pDown}
        onPointerMove={pMove}
        onPointerUp={pUp}
        onPointerCancel={pUp}
        onClickCapture={(e) => {
          if (moved.current) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {box.w > 0 && !total && !live && (
          <p className="empty">Nobody has left a print yet.</p>
        )}

        <div ref={worldRef} className="world">
          {prints.map((p) => {
            const at = laid[p.u];
            if (!at) return null;
            const pos = { transform: tf(at.x, at.y) };
            const art = (
              <div className="pin">
                <Print seed={p.seed} ink={p.ink} rot={p.rot} size={SIZE} />
              </div>
            );

            return mine && same(p.u, mine.u) ? (
              <div
                key={p.u}
                className="mark mine"
                style={pos}
                title="Drag to move"
                onPointerDown={grab}
                onPointerMove={dragMove}
                onPointerUp={drop}
                onPointerCancel={drop}
              >
                {art}
                <span>@{p.u}</span>
              </div>
            ) : (
              <a
                key={p.u}
                className={`mark ${p.intro ? "intro" : ""}`}
                style={pos}
                href={`https://x.com/${p.u}`}
                target="_blank"
                rel="noreferrer"
                draggable={false}
              >
                {art}
                <span>@{p.u}</span>
              </a>
            );
          })}

          {live && <Live p={live} />}
        </div>
      </main>

      <div className="zoom" data-html2canvas-ignore="true">
        <button aria-label="Zoom out" onClick={() => zoomAt(box.w / 2, box.h / 2, 1 / 1.3)}>−</button>
        <button aria-label="Zoom in" onClick={() => zoomAt(box.w / 2, box.h / 2, 1.3)}>+</button>
        <button className="fit" aria-label="Show all prints" onClick={() => fitAll(false)}>Fit</button>
      </div>

      <div className="bar">
        {msg && (
          <p className="msg" role="alert">
            {msg}
          </p>
        )}

        {mine ? (
          <div className="row">
            <p>Drag your print to move it.</p>
            <button onClick={share}>Share on X</button>
          </div>
        ) : step === "idle" ? (
          <button className="main" onClick={() => setStep("naming")}>
            Add your thumbprint
          </button>
        ) : step === "naming" ? (
          <form onSubmit={next}>
            <span>@</span>
            <input
              autoFocus
              value={name.replace(/^@/, "")}
              maxLength={15}
              placeholder="your X username"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck="false"
              onChange={(e) => setName(e.target.value)}
            />
            <button type="submit">Next</button>
          </form>
        ) : (
          <div className="row">
            <p>Press and hold anywhere on the page.</p>
            <button
              className="ghost"
              onClick={() => {
                setStep("idle");
                setMsg("");
              }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}