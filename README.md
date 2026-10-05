# The Thumbprint Ledger

```bash
npm install
npm run dev        # http://localhost:3000 (no env set = saves to .data.json)
```

## With MongoDB
1. Create a free cluster on MongoDB Atlas, add a database user.
2. Atlas > Network Access > allow `0.0.0.0/0` (Vercel uses changing IPs).
3. Copy `.env.example` to `.env.local` and paste your connection string.

## Deploy (Vercel)
Push to GitHub, import on vercel.com, add `MONGODB_URI` (and optionally `MONGODB_DB`) under Environment Variables, deploy.
