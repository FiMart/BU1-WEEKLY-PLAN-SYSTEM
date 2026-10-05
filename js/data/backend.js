'use strict';
/* BU1 Weekly Plan · data layer for the shared (central) Supabase project
   Built to "ต่อ DB เข้ากับ Supabase กลาง — คู่มือสำหรับผู้พัฒนาแอปใหม่" (1 Oct 2026):
   1. One backend with list(entity) · upsert(entity, rows) · remove(entity, ids). Views never call storage directly:
      they go through Store (js/data/store.js), and on Supabase the db adapter in js/data/supabase.js sits on this backend.
   2. ids are made on the client as strings (newId in utils.js); every write is an upsert, so sending a row twice is safe.
   3. Every row carries dept_id. The primary key is (id, dept_id); every select / delete filters dept_id = DEPT and every
      upsert sets it, with onConflict 'id,dept_id'.
   4. Users are identified by e-mail in lower case (updated_by, updatedBy).
   5. Dates are YYYY-MM-DD in local time (ymd in utils.js), never toISOString().slice(0,10).
   6. No Supabase URL or key in the code: js/config.js stays empty until the system owner connects it.
   Traps from the guide that are handled here: list() pages through 1,000-row windows with order + count; remove() sends
   ids 200 at a time (HTTP 414); errors are thrown, never swallowed; realtime is filtered by dept_id on the client
   (a DELETE payload carries only the primary key, so a server-side filter would drop delete events). */
const DB_ENTITIES=['tasks','staff','resources','projects','config','photos','filechunks'];
const DB_PAGE=1000,DB_IDS=200,DB_UPSERT=500;

/* table per entity in the app's own schema (default "bu1wp"): id text, dept_id text, data jsonb, updated_at, updated_by */
function supabaseBackend(client,{schema,dept,who}){
  const tbl=e=>{if(!DB_ENTITIES.includes(e))throw new Error('unknown entity: '+e);return client.schema(schema).from(e)};
  const toRow=r=>{const {id,dept_id,...data}=r;return {id:String(id),dept_id:dept,data,updated_by:who()}};
  const fromRow=r=>Object.assign({},r.data||{},{id:r.id,dept_id:r.dept_id});
  return {
    dept,schema,
    /* every row of this department; optional server-side narrowing:
       {id} · {from,to} on data->>date · {eq:[[field,value]]} on data->>field · {contains:[[field,value]]} for an array field */
    async list(entity,f={}){
      const out=[];let from=0,total=Infinity;
      while(from<total){
        let q=tbl(entity).select('id,dept_id,data',{count:'exact'}).eq('dept_id',dept);
        if(f.id!=null)q=q.eq('id',String(f.id));
        if(f.from)q=q.gte('data->>date',f.from);
        if(f.to)q=q.lte('data->>date',f.to);
        (f.eq||[]).forEach(([k,v])=>{q=q.eq(`data->>${k}`,String(v))});
        (f.contains||[]).forEach(([k,v])=>{q=q.filter(`data->${k}`,'cs',JSON.stringify([v]))});
        const {data,error,count}=await q.order('id').range(from,from+DB_PAGE-1);
        if(error)throw error;
        const rows=data||[];out.push(...rows.map(fromRow));
        total=count??out.length;
        if(!rows.length)break;/* stop if count is off */
        from+=rows.length;
      }
      return out;
    },
    async upsert(entity,rows){
      for(let i=0;i<rows.length;i+=DB_UPSERT){
        const {error}=await tbl(entity).upsert(rows.slice(i,i+DB_UPSERT).map(toRow),{onConflict:'id,dept_id'});
        if(error)throw error;
      }
    },
    async remove(entity,ids){
      for(let i=0;i<ids.length;i+=DB_IDS){
        const {error}=await tbl(entity).delete().eq('dept_id',dept).in('id',ids.slice(i,i+DB_IDS).map(String));
        if(error)throw error;
      }
    },
    /* live changes of one entity; returns an unsubscribe function */
    watch(entity,cb){
      const ch=client.channel(`${schema}:${entity}:${Math.random().toString(36).slice(2,8)}`)
        .on('postgres_changes',{event:'*',schema,table:entity},p=>{const r=(p.new&&p.new.dept_id)?p.new:(p.old||{});if(r.dept_id===dept)cb(p)})
        .subscribe();
      return ()=>client.removeChannel(ch);
    },
  };
}
