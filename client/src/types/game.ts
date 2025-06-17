// Game Types for Generals TSA Client

export interface Position {
  x: number;
  y: number;
}

export interface GridCell {
  x: number;
  y: number;
  ownerFaction: string | null;
  fortificationLevel: number;
  lastCapturedBy?: string;
}

export interface PlayerState {
  id: string;
  username?: string;
  avatar?: string;
  faction: string;
  ap: number;
  actionQueue: any[];
}

export interface FactionState {
  name: string;
  apPool: number;
  upgrades: Record<string, number>;
}

export interface GameState {
  grid: GridCell[][];
  players: Record<string, PlayerState>;
  factions: Record<string, FactionState>;
}

export interface SelectedTile {
  x: number;
  y: number;
  cell: GridCell | null;
}

export type ActionType = 'attack' | 'fortify' | 'donate_ap' | 'upgrade_request';

export interface GameAction {
  type: ActionType;
  data: any;
}

// Faction colors matching our server setup
export const FACTION_COLORS: Record<string, string> = {
  red: '#d32f2f',
  blue: '#1976d2', 
  green: '#388e3c',
  neutral: '#757575'
};

// Action costs matching server
export const ACTION_COSTS = {
  attack: 10,
  fortify: 5,
  donate_ap: 0, // Variable cost
  upgrade_request: 100
};

export interface GameSettings {
  serverUrl: string;
  playerId: string;
  faction: string;
} 