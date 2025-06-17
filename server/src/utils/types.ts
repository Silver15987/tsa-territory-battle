export interface GridCell {
  x: number;
  y: number;
  ownerFaction: string | null;
  fortificationLevel: number;
  lastFortifiedBy?: string;
  lastAttackedBy?: string;
  lastCapturedBy?: string;
  structure?: 'factory' | 'castle' | null;
}

export interface PlayerState {
  id: string;
  faction: string;
  ap: number;
  actionQueue: PlayerAction[];
}

export interface FactionState {
  name: string;
  apPool: number;
  upgrades: Record<string, any>;
}

export interface PlayerAction {
  type: 'attack' | 'fortify' | 'donate_ap' | 'upgrade_request';
  payload: any;
  timestamp: number;
} 