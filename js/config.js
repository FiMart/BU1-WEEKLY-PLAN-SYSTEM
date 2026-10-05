'use strict';
/* BU1 Weekly Plan · deployment settings (loads first)
   Connection to the central Supabase project (shared with Weekly Plan BU2 and Safety Training Record).
   Leave the URL and key EMPTY in the repository: the system owner fills them in when connecting (see supabase/HANDOFF.md).
   Use the anon public key only — never the service_role key (it bypasses row level security).
   On the claude.ai link these values are ignored (claude.ai pages cannot call other sites) and the claude.ai database is used. */
const BU1_CONFIG={
  supabaseUrl:'https://myvwibwbwktskmfqjoez.supabase.co',        // Project URL of the central project, filled in by the system owner
  supabaseAnonKey:'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15dndpYndid2t0c2ttZnFqb2V6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2MjAyMzAsImV4cCI6MjEwMzE5NjIzMH0.QbczXa4gsO21MRSKm6JgQVF9T6Rt231FP5nXLtwsiH4',    // anon public key, filled in by the system owner (protected by row level security)
  deptId:'BU1',          // dept_id written on every row and used in every select / delete
  schema:'bu1wp',        // this app's own schema (must be listed in Supabase → API → Exposed schemas)
  allowSignup:true,     // the central project has sign-ups disabled (checked 2026-10-05); true shows "สมัครสมาชิก" (creates a central Supabase Auth account; BU1 access is still granted by the owner)
  allowedEmailDomain:'', // e.g. 'flowlabservice.co.th' to accept only company e-mails at sign-up; '' accepts any e-mail
};
