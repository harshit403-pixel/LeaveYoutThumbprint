import fs from "fs/promises";
import path from "path";
import { MongoClient } from "mongodb";

const URI = process.env.MONGODB_URI;
const FILE = path.join(process.cwd(), ".data.json");

function collection() {
  if (!globalThis._thumbs) {
    globalThis._thumbs = new MongoClient(URI).connect().then(async (client) => {
      const col = client.db(process.env.MONGODB_DB || "thumbprints").collection("prints");
      await col.createIndex({ k: 1 }, { unique: true }); // one print per username
      await col.createIndex({ t: -1 });
      return col;
    });
  }
  return globalThis._thumbs;
}

const readFile = async () => { try { return JSON.parse(await fs.readFile(FILE, "utf8")); } catch { return {}; } };
const writeFile = (all) => fs.writeFile(FILE, JSON.stringify(all));
const strip = ({ h, k, _id, ...p }) => p; // never expose the token hash

// Returns false if that username already left a print.
export async function add(print) {
  const k = print.u.toLowerCase();
  if (URI) {
    try { await (await collection()).insertOne({ ...print, k }); return true; }
    catch (e) { if (e.code === 11000) return false; throw e; }
  }
  const all = await readFile();
  if (all[k]) return false;
  all[k] = { ...print, k };
  await writeFile(all);
  return true;
}

export async function find(k) {
  if (URI) return (await collection()).findOne({ k });
  return (await readFile())[k] || null;
}

export async function move(k, x, y) {
  if (URI) { await (await collection()).updateOne({ k }, { $set: { x, y } }); return; }
  const all = await readFile();
  if (all[k]) { all[k].x = x; all[k].y = y; await writeFile(all); }
}

// True if any other print sits closer than the allowed distance.
export async function near(k, x, y, d) {
  let c;
  if (URI) c = await (await collection()).find({ k: { $ne: k }, x: { $gt: x - d, $lt: x + d }, y: { $gt: y - d, $lt: y + d } }).toArray();
  else c = Object.entries(await readFile()).filter(([kk]) => kk !== k).map(([, v]) => v);
  return c.some((p) => Math.hypot(p.x - x, p.y - y) < d * 0.97);
}

export async function list() {
  if (URI) {
    const col = await collection();
    const prints = await col.find({}, { projection: { _id: 0, k: 0, h: 0 } }).sort({ t: -1 }).limit(300).toArray();
    return { prints, total: await col.countDocuments() };
  }
  const all = Object.values(await readFile()).sort((a, b) => b.t - a.t);
  return { prints: all.slice(0, 300).map(strip), total: all.length };
}