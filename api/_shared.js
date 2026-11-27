/* BU1 Weekly Plan · shared by the AI functions (api/ai-extract.js, api/ai-ask.js). A file starting with "_" is not a function on Vercel.
   The Anthropic key lives ONLY in the server env var ANTHROPIC_API_KEY. Never in the browser. */
export const SUPABASE_URL = process.env.SUPABASE_URL || 'https://myvwibwbwktskmfqjoez.supabase.co';
/* the public anon key (the same one the web page carries; it is protected by row level security) */
export const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15dndpYndid2t0c2ttZnFqb2V6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2MjAyMzAsImV4cCI6MjEwMzE5NjIzMH0.QbczXa4gsO21MRSKm6JgQVF9T6Rt231FP5nXLtwsiH4';
export const DEPT = 'BU1';

/* model (user, 27 Nov 2026: "ใช้วิธี Claude รุ่นอื่น"): Sonnet 5.5 by default. AI_MODEL in Vercel switches it:
   claude-haiku-5-5 (cheapest) · claude-opus-5-5 (strongest). */
export const MODEL = process.env.AI_MODEL || 'claude-sonnet-5-5';
export const effortOf = (v, def) => (['low', 'medium', 'high'].includes(v) ? v : def);
/* Haiku 5.5 has no server-side refusal fallback: the fallbacks parameter must not be sent with it */
export const FALLBACK = !/haiku/i.test(MODEL);

export const send = (res, code, body) => {
  res.status(code).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
};

/* the person must be signed in to the central project and hold a BU1 row in public.user_roles (read with THEIR token, so RLS decides).
   Returns {email, level} or null. */
export async function checkUser(token) {
  const h = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` };
  const u = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: h });
  if (!u.ok) return null;
  const user = await u.json();
  const email = String((user && user.email) || '').trim().toLowerCase();
  if (!email) return null;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/user_roles?select=id,data&dept_id=eq.${DEPT}&id=eq.${encodeURIComponent(email)}&limit=1`, { headers: h });
  if (!r.ok) return null;
  const rows = await r.json();
  if (!Array.isArray(rows) || !rows.length) return null;
  return { email, level: String((rows[0].data && rows[0].data.level) || 'viewer') };
}

/* common start of a POST handler: method, key, token, BU1 account. Returns the user or null (the answer is already sent). */
export async function gate(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); send(res, 405, { ok: false, error: 'ใช้ POST เท่านั้น' }); return null; }
  if (!process.env.ANTHROPIC_API_KEY) { send(res, 503, { ok: false, error: 'ยังไม่ได้ตั้งค่า ANTHROPIC_API_KEY บนเซิร์ฟเวอร์ (ทีมผู้ดูแลตั้งใน Vercel)' }); return null; }
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) { send(res, 401, { ok: false, error: 'ต้องเข้าสู่ระบบด้วยบัญชีกลางก่อน' }); return null; }
  let who;
  try { who = await checkUser(token); } catch { send(res, 502, { ok: false, error: 'ตรวจสอบบัญชีไม่สำเร็จ ลองใหม่อีกครั้ง' }); return null; }
  if (!who) { send(res, 403, { ok: false, error: 'บัญชีนี้ไม่มีสิทธิ์แผนก BU1' }); return null; }
  return who;
}

export const bodyOf = req => {
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = null; } }
  return b && typeof b === 'object' ? b : null;
};

/* typed Anthropic errors → a Thai message (most specific first) */
export function apiError(Anthropic, err, res) {
  if (err instanceof Anthropic.RateLimitError) return send(res, 429, { ok: false, error: 'ใช้ AI ถี่เกินไป รอสักครู่แล้วลองใหม่' });
  if (err instanceof Anthropic.AuthenticationError) return send(res, 503, { ok: false, error: 'ANTHROPIC_API_KEY บนเซิร์ฟเวอร์ไม่ถูกต้อง' });
  if (err instanceof Anthropic.BadRequestError) return send(res, 400, { ok: false, error: 'AI รับคำขอนี้ไม่ได้: ' + String(err.message || '').slice(0, 200) });
  if (err instanceof Anthropic.APIError) return send(res, 502, { ok: false, error: `AI ตอบผิดพลาด (${err.status || '?'}) ลองใหม่อีกครั้ง` });
  return send(res, 500, { ok: false, error: 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง' });
}
