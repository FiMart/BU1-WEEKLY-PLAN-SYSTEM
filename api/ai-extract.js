/* BU1 Weekly Plan · AI reads a photo of a paper Check Sheet (Vercel serverless function, Node).
   POST /api/ai-extract  {form:'data', images:[{media_type:'image/jpeg', data:'<base64>'}]}  (1–2 pictures)
   Header Authorization: Bearer <Supabase access token of the signed-in person>.
   - The Anthropic key lives ONLY here, as the server env var ANTHROPIC_API_KEY (set by the team in Vercel). Never in the browser.
   - Only people who are signed in to the central Supabase project AND have a BU1 row in public.user_roles may call it.
   - Nothing is stored: the picture goes to Claude, the values come back, the person checks them in the app before saving.
   Answer: {ok:true, form, h:{…header fields}, rows:[{d,b,p,a,c}], unsure:[keys], note} or {ok:false, error}. */
import Anthropic from '@anthropic-ai/sdk';
import { MODEL, FALLBACK, effortOf, send, gate, bodyOf, apiError } from './_shared.js';

/* AI_EFFORT = low | medium | high (how long the model thinks; higher reads harder writing better, slower and dearer). Model: api/_shared.js */
const EFFORT = effortOf(process.env.AI_EFFORT, 'medium');
const MAX_IMAGES = 2;
const MAX_B64 = 4_000_000; /* all pictures together; Vercel takes 4.5 MB a request (the page resizes to ~2000 px JPEG first) */
const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/* FLS-F-122 Data Flow Meter Check Sheet: the keys are the app's own (js/features/checksheets.js CS_FORMS.data) */
const DF_HEAD = {
  customer: 'CUSTOMER (top line)',
  highPressure: 'High Pressure Flowmeter: "yes" / "no" (which box is ticked), "" if neither',
  type: 'Meter Information · Type',
  tag: 'Meter Information · Tag',
  size: 'Meter Information · Connection size',
  receiveDate: 'Meter Information · Receive Date, as YYYY-MM-DD (the paper writes d/m/yyyy; a Buddhist year 25xx minus 543)',
  calDate: 'Meter Information · Cal. Date, as YYYY-MM-DD (same rule)',
  cfgStatus: 'Configuration Status: "yes" / "no" (ticked box), "" if neither',
  cfgLocation: 'Configuration Status · Location',
  saveName: 'Configuration Status · Save Name',
  sensorMake: 'Senser (Sensor) Data · Make',
  sensorModel: 'Senser (Sensor) Data · Model',
  sensorSerial: 'Senser (Sensor) Data · Serial No.',
  txMake: 'Transmitter Data · Make',
  txModel: 'Transmitter Data · Model',
  txSerial: 'Transmitter Data · Serial No.',
  referJob: 'Data History · Refer Job No.',
  hpBefore: 'In the CONFIGURATION table, "Config Before ถูก set ตาม High Pressure Cert. ใช่หรือไม่": "yes" (ใช่) / "no" (ไม่ใช่) / ""',
  hpAfter: 'Under the CONFIGURATION table, "Config After ถูก set ตาม High Pressure Cert. ใช่หรือไม่": "yes" (ใช่) / "no" (ไม่ใช่) / ""'
};
const str = { type: 'string' };
const DF_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['h', 'rows', 'unsure', 'note'],
  properties: {
    h: { type: 'object', additionalProperties: false, required: Object.keys(DF_HEAD), properties: Object.fromEntries(Object.keys(DF_HEAD).map(k => [k, str])) },
    rows: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['d', 'b', 'p', 'a', 'c'],
        properties: { d: str, b: str, p: str, a: str, c: { type: 'string', enum: ['', 'Yes', 'No', 'แก้ไขแล้ว'] } }
      }
    },
    unsure: { type: 'array', items: str },
    note: str
  }
};
const DF_SYSTEM = `You read photos of a filled-in paper form "Data Flow Meter Check Sheet" (FLS-F-122) of a flow meter calibration laboratory in Thailand.
The writing is by hand (Thai or English) on a printed form. Copy exactly what is written; never guess, never invent, never fill a value from another field.
Return:
- h: one string per header field (empty string when the field is blank or cannot be read):
${Object.entries(DF_HEAD).map(([k, v]) => `  ${k}: ${v}`).join('\n')}
- rows: the CONFIGURATION table, one object per written row, top to bottom, skipping fully blank rows:
  d = Description, b = BEFORE CALIBRATION, p = PROCESS CALIBRATION, a = AFTER CALIBRATION,
  c = which check box at the end of the row is ticked: "Yes", "No", "แก้ไขแล้ว", or "" when none.
  Keep numbers, units and signs exactly as written (e.g. "4.2510", "kg/m3", "-0.03"). A ditto mark or arrow meaning "same as left" = copy that value.
- unsure: the keys you could not read with confidence (header keys like "tag", or "row3.b" for row 3 column b, rows counted from 1).
- note: one short sentence in Thai about anything the person should check (crossed-out values, two pictures disagreeing, a part of the form cut off); "" when nothing.
When there are two pictures they show the same sheet (e.g. top and bottom half): merge them into one answer.`;

const FORMS = { data: { schema: DF_SCHEMA, system: DF_SYSTEM } };

export default async function handler(req, res) {
  const who = await gate(req, res);
  if (!who) return;

  const body = bodyOf(req);
  const form = body && FORMS[body.form] ? body.form : '';
  if (!form) return send(res, 400, { ok: false, error: 'ยังอ่านได้เฉพาะแบบฟอร์ม FLS-F-122' });
  const imgs = Array.isArray(body.images) ? body.images.slice(0, MAX_IMAGES) : [];
  if (!imgs.length || imgs.some(i => !i || !TYPES.includes(i.media_type) || typeof i.data !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(i.data))) return send(res, 400, { ok: false, error: 'รูปไม่ถูกต้อง (JPEG / PNG / WebP)' });
  if (imgs.reduce((n, i) => n + i.data.length, 0) > MAX_B64) return send(res, 413, { ok: false, error: 'รูปใหญ่เกินไป' });

  const F = FORMS[form];
  const client = new Anthropic();
  try {
    const params = {
      model: MODEL,
      max_tokens: 16000,
      output_config: { effort: EFFORT, format: { type: 'json_schema', schema: F.schema } },
      system: F.system,
      messages: [{
        role: 'user',
        content: [
          ...imgs.map(i => ({ type: 'image', source: { type: 'base64', media_type: i.media_type, data: i.data } })),
          { type: 'text', text: imgs.length > 1 ? 'Read this sheet (two pictures of the same sheet).' : 'Read this sheet.' }
        ]
      }]
    };
    /* server-side fallbacks (Sonnet / Opus): if the model declines (policy refusal) the API re-runs the same request on its default fallback model inside this call */
    const msg = FALLBACK
      ? await client.beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' })
      : await client.messages.create(params);
    if (msg.stop_reason === 'refusal') return send(res, 422, { ok: false, error: 'AI ไม่อ่านรูปนี้ ลองถ่ายใหม่ให้เห็นแบบฟอร์มชัด ๆ' });
    if (msg.stop_reason === 'max_tokens') return send(res, 422, { ok: false, error: 'ข้อมูลในรูปยาวเกินไป ลองแบ่งถ่ายเป็นสองรูป' });
    const text = (msg.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    let out;
    try { out = JSON.parse(text); } catch { return send(res, 502, { ok: false, error: 'อ่านคำตอบของ AI ไม่ได้ ลองใหม่อีกครั้ง' }); }
    return send(res, 200, { ok: true, form, model: msg.model, h: out.h || {}, rows: Array.isArray(out.rows) ? out.rows : [], unsure: Array.isArray(out.unsure) ? out.unsure : [], note: String(out.note || '') });
  } catch (err) {
    return apiError(Anthropic, err, res);
  }
}
