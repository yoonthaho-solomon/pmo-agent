const fs = require('fs');
const p = 'app/api/meter-status/route.ts';
let s = fs.readFileSync(p, 'utf8');
s = s.replace("import { createClient } from '@supabase/supabase-js'", "import { createClient, type SupabaseClient } from '@supabase/supabase-js'");
s = s.replace('  supabase: ReturnType<typeof createClient>,', '  supabase: SupabaseClient,');
fs.writeFileSync(p, s, 'utf8');
