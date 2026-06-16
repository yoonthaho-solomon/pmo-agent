const fs = require('fs');
const p = 'app/api/meter-excel/route.ts';
let s = fs.readFileSync(p, 'utf8');
const old = `  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!  // service role key 사용 (RLS 우회)
  )

  try {`;
const next = `  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Supabase 환경변수가 설정되지 않았습니다.' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)`;
if (!s.includes(old)) throw new Error('target block not found');
s = s.replace(old, next);
fs.writeFileSync(p, s, 'utf8');
