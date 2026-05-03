export type GameState = 'playing' | 'solved' | 'not-started' | 'paused'

export interface SaveGameOptions {
  keepalive?: boolean
}
