import fs from "fs/promises";
import path from "path";
import { MongoClient } from "mongodb";
import { withFrac } from "@/lib/position";

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

// Positions are fractions (fx, fy). Old x, y values stay in the database untouched.
export async function move(k, wx, wy) {
  if (URI) { await (await collection()).updateOne({ k }, { $set: { wx, wy } }); return; }
  const all = await readFile();
  if (all[k]) { all[k].wx = wx; all[k].wy = wy; await writeFile(all); }
}

export async function list() {
  if (URI) {
    const col = await collection();
    const prints = await col.find({}, { projection: { _id: 0, k: 0, h: 0 } }).sort({ t: -1 }).limit(2000).toArray();
    return { prints: prints.map(withFrac), total: await col.countDocuments() };
  }
  const all = Object.values(await readFile()).sort((a, b) => b.t - a.t);
  return { prints: all.slice(0, 2000).map(strip).map(withFrac), total: all.length };
}