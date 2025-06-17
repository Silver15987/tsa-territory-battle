import { GridCell, PlayerAction } from '../utils/types';

export class Grid {
  cells: GridCell[][];

  constructor(width: number, height: number) {
    this.cells = Array.from({ length: height }, (_, y) =>
      Array.from({ length: width }, (_, x) => ({
        x,
        y,
        ownerFaction: null,
        fortificationLevel: 0,
      }))
    );
  }

  getCell(x: number, y: number): GridCell | null {
    if (y < 0 || y >= this.cells.length || x < 0 || x >= this.cells[0].length) return null;
    return this.cells[y][x];
  }

  attackCell(x: number, y: number, playerId: string, faction: string): boolean {
    const cell = this.getCell(x, y);
    if (!cell) return false;
    // Example: reduce fortification or capture
    if (cell.fortificationLevel > 0) {
      cell.fortificationLevel--;
      cell.lastAttackedBy = playerId;
      return true;
    } else {
      cell.ownerFaction = faction;
      cell.lastCapturedBy = playerId;
      return true;
    }
  }

  fortifyCell(x: number, y: number, playerId: string): boolean {
    const cell = this.getCell(x, y);
    if (!cell) return false;
    cell.fortificationLevel++;
    cell.lastFortifiedBy = playerId;
    return true;
  }
} 