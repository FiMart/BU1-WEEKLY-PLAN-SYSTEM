# BU1 Lab Weekly Plan — ข้อมูลสำหรับต่อ DB เข้ากับ Supabase กลาง

ถึงผู้ดูแลระบบกลาง · ตอบตามคู่มือ "ต่อ DB เข้ากับ Supabase กลาง" (1 ต.ค. 2026)
แอป: BU1 Lab Weekly Plan (วางแผนงานรายสัปดาห์ แผนก Laboratory) · `dept_id = 'BU1'`

## สิ่งที่ทำไว้ในโค้ดแล้ว (6 ข้อ)

1. **อ่าน/เขียนผ่าน data layer ไฟล์เดียว:** ไฟล์ `js/data/backend.js` มีฟังก์ชัน `list(entity)` · `upsert(entity, rows)` · `remove(entity, ids)` ส่วนหน้าจอเรียกผ่าน `Store` (`js/data/store.js`) เท่านั้น
2. **id สร้างฝั่ง client เป็น string** (`newId()` ใน `js/core/utils.js`) และเขียนทุกครั้งด้วย upsert
3. **ทุกแถวมี `dept_id`:**
   - PK `(id, dept_id)`
   - ทุก select / delete กรอง `.eq('dept_id', DEPT)`
   - ทุก upsert ใส่ `dept_id` และใช้ `onConflict: 'id,dept_id'`
4. **ผู้ใช้ระบุด้วยอีเมลตัวพิมพ์เล็ก** ใช้กับ `updated_by` และ `updatedBy` ในข้อมูล ส่วนสิทธิ์อ่านจาก `core.my_depts()`
5. **วันที่ `YYYY-MM-DD` ตามเวลาท้องถิ่น** (`ymd()`) ไม่มีจุดไหนใช้ `toISOString().slice(0,10)`
6. **ไม่มี URL หรือคีย์ในโค้ด:** `js/config.js` เว้นว่างไว้ให้เจ้าของระบบใส่

กับดักในคู่มือที่จัดการแล้ว:
- `list()` วนดึงทีละ 1,000 แถวด้วย `.order('id').range()` + `count: 'exact'`
- `remove()` ส่ง id ทีละ 200
- error ถูก throw ไม่กลืน แอปแจ้งผู้ใช้ และถ้าถูก RLS ปฏิเสธจะปิดโหมดแก้ไข
- realtime กรอง `dept_id` ฝั่ง client
- ไฟล์แนบไม่ใช้ Storage (ดูข้อ 7)

ทดสอบด้วย Supabase client จำลองในเครื่องแล้ว (ข้อมูล BU1 และ BU2 ที่ใช้ id ซ้ำกัน):
- เห็นเฉพาะ BU1 และไม่เขียนทับแถวของ BU2
- ดึง 2,500 แถวครบใน 3 หน้า
- ลบเป็นชุด 200 / 200 / 50 id
- ทุก select / delete มีตัวกรอง `dept_id`

ยังไม่ได้ทดสอบกับโปรเจกต์ Supabase จริง

## สิ่งที่ขอให้เจ้าของระบบทำ

- ตรวจและรัน `supabase/schema.sql`:
  - สร้าง schema `bu1wp` และตาราง 7 ตาราง (รูปแบบเดียวกับ `public.bookings`: `id text, dept_id text, data jsonb, updated_at, updated_by`)
  - RLS จาก `core.my_depts()`
  - เพิ่มตารางเข้า realtime
  - policy ใช้ `dept_id in (select core.my_depts())` เพราะ `core.my_depts()` คืน `setof text` (ฟังก์ชันที่คืนหลายแถวต้องห่อด้วย sub-select ใน policy)
- เพิ่ม `bu1wp` ใน **Settings → API → Exposed schemas**
- ใส่แถวสิทธิ์คนแรกของ BU1 ใน `public.user_roles`
- **หน้าสมัครสมาชิก:** แอปมีปุ่มสมัครที่เรียก `supabase.auth.signUp` เพื่อสร้างบัญชีกลาง (ไม่มีตารางสมาชิกของแอปเอง)
  - metadata ที่ส่งไป: `full_name`, `employee_code`, `requested_dept: 'BU1'`, `requested_app: 'bu1-weekly-plan'`
  - สมัครแล้วยังเห็นข้อมูลไม่ได้ จนกว่าจะเพิ่มแถวใน `public.user_roles`
  - ถ้าระบบกลางปิดการสมัครเอง (Auth → Sign In / Providers) ให้ตั้ง `allowSignup: false` ใน `js/config.js` ปุ่มสมัครจะถูกซ่อน
  - ถ้าต้องการรับเฉพาะอีเมลบริษัท ตั้ง `allowedEmailDomain`
  - ตั้ง Site URL และ Redirect URLs ให้ตรงกับเว็บของแอป เพื่อให้ลิงก์ยืนยันอีเมลและลิงก์ตั้งรหัสผ่านใหม่กลับมาที่แอป
- ใส่ค่าใน `js/config.js`: `supabaseUrl`, `supabaseAnonKey` (anon เท่านั้น) และตรวจ `deptId: 'BU1'`, `schema: 'bu1wp'`
- นำแอปไปวางบนเว็บที่เรียก Supabase ได้ (บนลิงก์ claude.ai เรียกเว็บภายนอกไม่ได้ จึงใช้ฐานข้อมูลของ claude.ai ต่อไป)
- ทดสอบด้วยบัญชี 2 แผนก ว่าต่างคนเห็นเฉพาะข้อมูลแผนกตัวเอง

## ข้อมูล 7 ข้อ

### 1. รายการ entity พร้อม field และตัวอย่าง JSON

เก็บ object ทั้งก้อนในคอลัมน์ `data` ยกเว้น `id` และ `dept_id` ที่เป็นคอลัมน์จริง

**tasks:** แผนงาน 1 แผนต่อ 1 วัน (วันละไม่เกิน 20 แผน)
```json
{"id":"tlq3x9k2a1","dept_id":"BU1","jobType":"disconnect","jobTypeName":"Disconnect","jobTypeOther":"",
 "planNo":"PN-26-10001","sale":"คุณสมชาย","customer":"บริษัท ตัวอย่าง จำกัด","location":"ชลบุรี",
 "date":"2026-10-05","period":"full","timeNote":"ถึงหน้างาน 08.30 น.","detail":"Work Order: WO-001\nTag No. FT-101",
 "request":"Work Permit, PPE","transport":"1กข-1234","needGA":false,"contact":"คุณวิชัย","contactTel":"081-xxx-xxxx",
 "staffIds":["slq1a2b3c4"],"guests":[],"status":"planned","statusNote":"","photoIds":[],"fileIds":[],
 "files":[],"createdAt":"2026-10-05T01:20:00.000Z","updatedAt":"2026-10-05T01:20:00.000Z","updatedBy":"name@company.co.th"}
```
- `period` = `am` | `pm` | `full`
- `status` = `planned` | `done` | `notdone` | `postponed` | `cancelled`
- `ncrId` = id ของ NCR เมื่องานไม่เสร็จ (มีเฉพาะแผนที่มี NCR)
- `files` = `[{id, name, size, type}]`

**staff:** รายชื่อผู้ปฏิบัติงาน
```json
{"id":"slq1a2b3c4","dept_id":"BU1","name":"สมชาย ใจดี","role":"Engineer","order":1,"active":true}
```

**resources:** รถ
```json
{"id":"rlq5d6e7f8","dept_id":"BU1","kind":"vehicle","name":"รถ Hiab เช่า 1","code":"HIAB · 70-1234","group":"HIAB เช่าเพิ่ม","order":2,"active":true}
```

**projects:** แผนกำลังคนโปรเจกต์ยาว
```json
{"id":"plq9g0h1i2","dept_id":"BU1","name":"Shutdown โรงงาน ระยอง","headcount":3,"from":"2026-10-05","to":"2026-10-23","note":"","workSun":false}
```

**config:** แถวเดียว `id = "main"`
```json
{"id":"main","dept_id":"BU1","jobTypes":[{"id":"disconnect","name":"Disconnect","color":"#eb6834","active":true}],
 "positions":["Admin","Engineer","Technician","Special Contract","Assistant Technician"],
 "sales":[{"name":"คุณสมชาย","tel":"08x-xxx-0001"}],"rolesV2":true}
```

**photos:** รูปที่แนบในแผน ย่อแล้วเก็บเป็น data URL
```json
{"id":"phlqab12cd3","dept_id":"BU1","data":"data:image/jpeg;base64,/9j/…","w":1280,"h":960,"name":"site.jpg","createdAt":"2026-10-05T02:00:00.000Z","by":"name@company.co.th"}
```

**filechunks:** ไฟล์แนบ (PDF, Excel ฯลฯ) แบ่งเป็นชิ้นละไม่เกิน 180 KB โดย `id = <fileId>_<ลำดับ>`
```json
{"id":"flqef45gh6_0","dept_id":"BU1","fileId":"flqef45gh6","i":0,"n":3,"name":"report.pdf","data":"JVBERi0xLjQK…","createdAt":"2026-10-05T02:05:00.000Z","by":"name@company.co.th"}
```

**ncr:** รายงานงานที่ไม่สำเร็จ (Non-Conformance Report) เปิดเมื่อแผนงานเป็น "ไม่เสร็จ" แล้วติดตามจนปิด (v3.7.0)
```json
{"id":"ncrlqk7m8n9","dept_id":"BU1","ncrNo":"NCR-26-10001","taskId":"tlq3x9k2a1","planNo":"PN-26-10001","date":"2026-10-05",
 "jobTypeName":"Disconnect","customer":"บริษัท ตัวอย่าง จำกัด","location":"ชลบุรี","staffIds":["slq1a2b3c4"],
 "category":"หน้างานลูกค้าไม่พร้อม","issue":"ลูกค้าไม่หยุดไลน์ ถอดได้ 2 จาก 4 ตัว","cause":"ลูกค้าเลื่อนหยุดไลน์","correction":"นัดเข้าทำต่อ 7 ต.ค.",
 "action":"ยืนยันวันหยุดไลน์กับลูกค้าก่อนออกงาน 1 วัน","owner":"สมชาย ใจดี","due":"2026-10-07","state":"open","result":"",
 "createdAt":"2026-10-05T09:00:00.000Z","createdBy":"name@company.co.th","updatedAt":"2026-10-05T09:00:00.000Z","updatedBy":"name@company.co.th","closedAt":"","closedBy":""}
```
- `state` = `open` | `progress` | `closed`
- `ncrNo` ออกโดยแอป รูปแบบ `NCR-YY-MMNNN` (นับต่อเดือน)

### 2. ไฟล์ data layer

| ไฟล์ | หน้าที่ |
|---|---|
| `js/data/backend.js` | `supabaseBackend(client, {schema, dept, who})` มีฟังก์ชัน `list(entity, filters?)` · `upsert(entity, rows)` · `remove(entity, ids)` · `watch(entity, cb)` (realtime) |
| `js/data/supabase.js` | ตัวแปลงให้ Store และหน้าจอเดิมใช้ backend นี้ได้ และหน้าเข้าสู่ระบบ (Supabase Auth อีเมล + รหัสผ่าน) |
| `js/data/store.js` | `Store.set / update / del / where / range / all / get` เป็นทางเดียวที่หน้าจอใช้อ่าน/เขียน |
| `js/config.js` | URL, anon key, `deptId`, `schema` |

`list()` รับตัวกรองเสริมที่ทำฝั่ง server ได้:
- `{id}`
- `{from, to}` กับ `data->>date`
- `{eq:[[field, value]]}`
- `{contains:[[field, value]]}` สำหรับ array

ทุกตัวกรองยังมี `dept_id` เสมอ

### 3. ใครใช้แอป

สิทธิ์อ่านจาก `public.user_roles` ของแผนก BU1 (`id` = อีเมลตัวพิมพ์เล็ก, `data.level`) ใช้ level ชุดเดียวกับ Weekly Plan BU2 และ RLS ใน `schema.sql` บังคับสิทธิ์ผ่าน `bu1wp.my_level(dept_id)`

| level | ในแอป BU1 | เขียนได้ (RLS) |
|---|---|---|
| admin | ทำได้ทุกอย่าง และจัดการผู้ใช้ BU1 (จัดการข้อมูล › ผู้ใช้งานระบบ) | ทุกตาราง |
| engineer | เพิ่ม/แก้แผน เปลี่ยนสถานะ แนบไฟล์ แผนกำลังคน · ไม่แก้ข้อมูลหลัก ไม่ลบแผน | tasks (insert/update), projects, photos, filechunks, ncr (insert/update) |
| ga | ระบุรถ/ทะเบียนในแผนที่ขอรถส่วนกลาง | tasks (update) |
| sale, viewer | ดูอย่างเดียว | — |

ไม่มีแถวใน `user_roles` = ดูอย่างเดียว (ถ้า `core.my_depts()` ยังให้เข้า BU1)

หน้าผู้ใช้งานระบบเขียนลง `public.user_roles` โดยตรง (upsert `onConflict: 'id,dept_id'`, ลบด้วย `.eq('dept_id','BU1')`) ใช้ได้เมื่อ RLS ของตารางนี้อนุญาตให้ admin ของแผนกเขียน ถ้าไม่อนุญาต แอปจะแจ้ง error และผู้ดูแลระบบกลางต้องจัดการสิทธิ์แทน

### 3.1 ผู้ใช้และการเห็นข้อมูล

- แผนก **BU1 Lab** เท่านั้น ไม่ต้องเห็นข้อมูลข้ามแผนก
- ผู้ใช้หลักคือหัวหน้างานและผู้วางแผน (เพิ่ม แก้ ลบแผน และข้อมูลหลัก) ส่วนทีมช่างและวิศวกรส่วนใหญ่เปิดดูแผน
- แอปไม่มีระบบสมาชิกของตัวเองแล้ว ใช้บัญชีกลาง:
  - เข้าได้เมื่อ `core.my_depts()` มี `BU1`
  - ถ้าต้องการแยกคนดูอย่างเดียวกับคนแก้ไข ให้กำหนดใน RLS ได้เลย แอปจะปิดโหมดแก้ไขเองเมื่อการเขียนถูกปฏิเสธ (42501)

### 4. อ่านข้อมูลของระบบเดิมไหม

ตอนนี้ไม่อ่าน ทะเบียนพนักงานของแอปจัดการเองในตาราง `staff`

ถ้าอนาคตอยากใช้ `core.employees` แทน (อ่านอย่างเดียว) ขอทราบชื่อคอลัมน์ก่อน

### 5. ปริมาณข้อมูลโดยประมาณ

| ตาราง | ปริมาณ |
|---|---|
| tasks | วันละไม่เกิน 20 แผน ประมาณ 300–500 แถวต่อเดือน (~5,000 แถวต่อปี) |
| staff / resources | 20–60 แถว เปลี่ยนนาน ๆ ครั้ง |
| projects | ไม่กี่แถวต่อเดือน |
| photos | ไม่เกิน 8 รูปต่อแผน คาดว่า 50–300 แถวต่อเดือน (แถวละ ~100–300 KB) |
| filechunks | ไม่เกิน 5 ไฟล์ต่อแผน ไฟล์ละไม่เกิน 4 MB (สูงสุด 23 ชิ้น) |
| ncr | ไม่กี่แถวต่อเดือน (เฉพาะงานที่ไม่เสร็จ) |

หน้าจอหลักดึงแผนทีละสัปดาห์หรือเดือนตาม `data->>date` และ `schema.sql` สร้าง index ไว้แล้ว ส่วนหน้าค้นหาย้อนหลังดึงแผนทั้งหมดแบบแบ่งหน้า

### 6. Realtime

**ต้องการ** เพราะทีมเปิดดูแผนพร้อมกันระหว่างวัน ตารางที่ใช้คือ `tasks, staff, resources, projects, config, ncr`

ถ้ายังไม่เปิด realtime แอปยังใช้งานได้ โดยโหลดใหม่หลังบันทึกของตัวเองและเมื่อกลับมาที่หน้าต่าง

### 7. อัปโหลดรูป / ไฟล์

**ไม่ใช้ Storage bucket:** รูปเก็บเป็น data URL ในตาราง `photos` และไฟล์แบ่งชิ้นเป็น base64 ในตาราง `filechunks` จึงไม่ติดปัญหาชื่อไฟล์ภาษาไทย

ถ้าเจ้าของระบบอยากย้ายไปใช้ Storage เพื่อลดขนาด DB แจ้งได้ จะปรับ data layer ให้ ซึ่งต้องตั้ง bucket และ policy เพิ่ม
