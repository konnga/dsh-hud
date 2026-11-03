export type RunningActivityPhase =
  | 'preparing'
  | 'waiting'
  | 'thinking'
  | 'responding'
  | 'tool'
  | 'approval'
  | 'working'
  | 'error'
  | 'idle'

export interface RunningActivityView {
  key: string
  phase: RunningActivityPhase
  toolName: string | null
  attemptId: string | null
  turn: number
  step: number
}
