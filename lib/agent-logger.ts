import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface AgentRunParams {
  run_date: string
  agent_name: string
  input_rows: number
  status: 'success' | 'failed'
  duration_ms: number
  error_msg?: string
}

export async function logAgentRun(params: AgentRunParams): Promise<void> {
  const { error } = await supabase.from('agent_logs').insert(params)
  if (error) {
    console.error('[agent-logger] INSERT 실패', error.message)
  }
}
