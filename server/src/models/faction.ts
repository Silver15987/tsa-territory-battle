import { FactionState } from '../utils/types';

export class Faction implements FactionState {
  name: string;
  apPool: number;
  upgrades: Record<string, any>;

  constructor(name: string, apPool: number = 0) {
    this.name = name;
    this.apPool = apPool;
    this.upgrades = {};
  }

  donateAP(amount: number): void {
    this.apPool += amount;
  }

  spendAP(amount: number): boolean {
    if (this.apPool < amount) return false;
    this.apPool -= amount;
    return true;
  }

  upgrade(key: string, value: any): void {
    this.upgrades[key] = value;
  }
} 