import crypto from "crypto";
import { add, list, find, move, near } from "@/lib/store";
import { D, X_MIN, X_MAX, Y_MIN, Y_MAX } from "@/lib/config";

export const dynamic = "force-dynamic";

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, Number(n) || 0));
const hash = (t) => crypto.createHash("sha256").update(String(t)).digest("hex");
const cleanName = (s) => String(s || "").replace(/^@/, "").trim();
const validName = (s) => /^[A-Za-z0-9_]{1,15}$/.test(s);
const TOO_CLOSE = "Too close to another print. Pick a free spot.";

export async function GET() {
  return Response.json(await list());
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const u = cleanName(body.u);
  if (!validName(u)) return Response.json({ error: "That is not a valid X username." }, { status: 400 });

  const x = clamp(body.x, X_MIN, X_MAX), y = clamp(body.y, Y_MIN, Y_MAX);
  if (await near(u.toLowerCase(), x, y, D)) return Response.json({ error: TOO_CLOSE }, { status: 422 });

  // The token proves later that you own this print. Only its hash is stored.
  const token = crypto.randomBytes(16).toString("hex");
  const print = {
    u, x, y,
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

  const x = clamp(body.x, X_MIN, X_MAX), y = clamp(body.y, Y_MIN, Y_MAX);
  if (await near(k, x, y, D)) return Response.json({ error: TOO_CLOSE }, { status: 422 });
  await move(k, x, y);
  return Response.json({ ok: true, x, y });
}