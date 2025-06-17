import { PlayerState, PlayerAction } from '../utils/types';

export class Player implements PlayerState {
  id: string;
  faction: string;
  ap: number;
  actionQueue: PlayerAction[];

  constructor(id: string, faction: string, ap: number = 0) {
    this.id = id;
    this.faction = faction;
    this.ap = ap;
    this.actionQueue = [];
  }

  enqueueAction(action: PlayerAction) {
    this.actionQueue.push(action);
  }

  consumeAP(amount: number): boolean {
    if (this.ap < amount) return false;
    this.ap -= amount;
    return true;
  }
} 