export type Difficulty = 'easy' | 'medium' | 'hard'

export interface AiParams {
  /** how far ahead (units) the AI can see walls/trails */
  lookahead: number
  /** ticks between decisions — effectively reaction time */
  reactionTicks: number
  /** chance per danger decision to pick the worse escape side */
  mistakeChance: number
  /** propensity to cut across the player's path */
  aggression: number
  /** fraction of max speed the AI is willing to use */
  speedFactor: number
  /** chance per decision to make a spontaneous (safe) turn */
  wanderChance: number
}

export const DIFFICULTIES: Record<Difficulty, AiParams> = {
  easy: {
    lookahead: 20,
    reactionTicks: 18,
    mistakeChance: 0.25,
    aggression: 0,
    speedFactor: 0.8,
    wanderChance: 0.06,
  },
  medium: {
    lookahead: 34,
    reactionTicks: 9,
    mistakeChance: 0.07,
    aggression: 0.35,
    speedFactor: 0.95,
    wanderChance: 0.05,
  },
  hard: {
    lookahead: 55,
    reactionTicks: 4,
    mistakeChance: 0.01,
    aggression: 0.75,
    speedFactor: 1,
    wanderChance: 0.04,
  },
}
