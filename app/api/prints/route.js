import crypto from "crypto";
import { add, list, find, move } from "@/lib/store";
import { legacyWorld, LIMIT } from "@/lib/position";

export const dynamic = "force-dynamic";

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, Number(n) || 0));
const hash = (t) => crypto.createHash("sha256").update(String(t)).digest("hex");
const cleanName = (s) => String(s || "").replace(/^@/, "").trim();
const validName = (s) => /^[A-Za-z0-9_]{1,15}$/.test(s);

// Accepts wx/wy (new) or the older fx/fy and x/y (a stale tab running old JS).
const pos = (b) => {
  const wx = Number(b.wx), wy = Number(b.wy);
  if (Number.isFinite(wx) && Number.isFinite(wy))
    return { wx: clamp(wx, -LIMIT, LIMIT), wy: clamp(wy, -LIMIT, LIMIT) };
  const w = legacyWorld({ x: b.x, y: b.y, fx: b.fx, fy: b.fy });
  return { wx: w.wx, wy: w.wy };
};

export async function GET() {
  return Response.json(await list());
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const u = cleanName(body.u);
  if (!validName(u)) return Response.json({ error: "That is not a valid X username." }, { status: 400 });

  // Spacing is now handled on each screen, so the server no longer rejects "too close".
  const token = crypto.randomBytes(16).toString("hex");
  const print = {
    u, ...pos(body),
    seed: Math.floor(clamp(body.seed, 0, 2147483647)),
    rot: clamp(body.rot, -35, 35),
    ink: clamp(body.ink, 0.3, 1),
    t: Date.now(),
  };
  const ok = await add({ ...print, h: hash(token) });
  if (!ok) return Response.json({ error: `@${u} has already left a print.` }, { status: 409 });
  return Response.json({ print, token });
}

export async function PATCH(req) {
  const body = await req.json().catch(() => ({}));
  const u = cleanName(body.u);
  if (!validName(u)) return Response.json({ error: "Bad username." }, { status: 400 });
  const k = u.toLowerCase();
  const doc = await find(k);
  if (!doc || doc.h !== hash(body.token)) return Response.json({ error: "This print is not yours to move." }, { status: 403 });

  const { wx, wy } = pos(body);
  await move(k, wx, wy);
  return Response.json({ ok: true, wx, wy });
}