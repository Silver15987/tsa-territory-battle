import { redisClient } from './redisClient';
// import { io } from './index'; // Placeholder for Socket.IO server
import { log } from './utils/logger';
import { PlayerAction, GridCell, PlayerState, FactionState } from './utils/types';
import { Server as SocketIOServer } from 'socket.io';

const TICK_INTERVAL = 1000; // 1 second
const AP_COSTS = {
  attack: 10,
  fortify: 5,
  donate_ap: 0, // handled by amount
  upgrade_request: 100,
};

let io: SocketIOServer | null = null;
export function setSocketIO(server: SocketIOServer) {
  io = server;
}

async function getPlayer(playerId: string): Promise<PlayerState | null> {
  const data = await redisClient.hgetall(`player:${playerId}`);
  if (!data || Object.keys(data).length === 0) return null;
  return {
    id: data.id,
    faction: data.faction,
    ap: parseInt(data.ap, 10) || 0,
    actionQueue: data.actionQueue ? JSON.parse(data.actionQueue) : [],
  };
}

async function setPlayer(player: PlayerState) {
  await redisClient.hmset(`player:${player.id}`,
    'id', player.id,
    'faction', player.faction,
    'ap', player.ap.toString(),
    'actionQueue', JSON.stringify(player.actionQueue)
  );
}

async function getFaction(factionName: string): Promise<FactionState | null> {
  const data = await redisClient.hgetall(`faction:${factionName}`);
  if (!data || Object.keys(data).length === 0) return null;
  return {
    name: data.name,
    apPool: parseInt(data.apPool, 10) || 0,
    upgrades: data.upgrades ? JSON.parse(data.upgrades) : {},
  };
}

async function setFaction(faction: FactionState) {
  await redisClient.hmset(`faction:${faction.name}`,
    'name', faction.name,
    'apPool', faction.apPool.toString(),
    'upgrades', JSON.stringify(faction.upgrades)
  );
}

async function getGrid(): Promise<GridCell[][]> {
  const gridStr = await redisClient.get('grid');
  return gridStr ? JSON.parse(gridStr) : [];
}

async function setGrid(grid: GridCell[][]) {
  await redisClient.set('grid', JSON.stringify(grid));
}

function getCell(grid: GridCell[][], x: number, y: number): GridCell | null {
  if (y < 0 || y >= grid.length || x < 0 || x >= grid[0].length) return null;
  return grid[y][x];
}

function isAdjacentToOwnedCell(grid: GridCell[][], x: number, y: number, faction: string): boolean {
  const directions = [
    [0, 1], [1, 0], [0, -1], [-1, 0],
  ];
  for (const [dx, dy] of directions) {
    const nx = x + dx;
    const ny = y + dy;
    const neighbor = getCell(grid, nx, ny);
    if (neighbor && neighbor.ownerFaction === faction) {
      return true;
    }
  }
  return false;
}

function findFactionRoots(grid: GridCell[][], faction: string): [number, number][] {
  const roots: [number, number][] = [];
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[0].length; x++) {
      const cell = grid[y][x];
      if (cell.ownerFaction === faction && (cell.structure === 'castle' || cell.structure === 'spawn')) {
        roots.push([x, y]);
      }
    }
  }
  return roots;
}

function getConnectedCells(grid: GridCell[][], faction: string, roots: [number, number][]): Set<string> {
  const visited = new Set<string>();
  const queue: [number, number][] = [...roots];
  const directions = [
    [0, 1], [1, 0], [0, -1], [-1, 0],
  ];
  while (queue.length > 0) {
    const [x, y] = queue.shift()!;
    const key = `${x},${y}`;
    if (visited.has(key)) continue;
    visited.add(key);
    for (const [dx, dy] of directions) {
      const nx = x + dx;
      const ny = y + dy;
      const neighbor = getCell(grid, nx, ny);
      if (neighbor && neighbor.ownerFaction === faction) {
        const nkey = `${nx},${ny}`;
        if (!visited.has(nkey)) {
          queue.push([nx, ny]);
        }
      }
    }
  }
  return visited;
}

export function startGameLoop() {
  setInterval(async () => {
    // Get only player keys, not action queue keys
    const allKeys = await redisClient.keys('player:*');
    const playerKeys = allKeys.filter(key => !key.endsWith(':actions'));
    
    let grid = await getGrid();
    let gridChanged = false;
    
    for (const playerKey of playerKeys) {
      const playerId = playerKey.split(':')[1];
      const actionQueueKey = `player:${playerId}:actions`;
      let player = await getPlayer(playerId);
      if (!player) continue;
      
      let actionStr;
      while ((actionStr = await redisClient.lpop(actionQueueKey))) {
        try {
          const action: PlayerAction = JSON.parse(actionStr);
          let valid = false;
          const apBefore = player.ap;
          
          // Reload faction state for each action to ensure consistency
          let faction = await getFaction(player.faction);
          if (!faction) continue;
          
          switch (action.type) {
            case 'attack': {
              const { x, y } = action.payload;
              const cell = getCell(grid, x, y);
              if (!cell) {
                log(`Rejected attack for ${playerId}: invalid cell (${x}, ${y})`, action);
                break;
              }
              if (cell.ownerFaction === player.faction) {
                log(`Rejected attack for ${playerId}: cell already owned by faction`, action);
                break;
              }
              if (!isAdjacentToOwnedCell(grid, x, y, player.faction)) {
                log(`Rejected attack for ${playerId}: not adjacent to owned cell`, action);
                break;
              }
              if (player.ap < AP_COSTS.attack) {
                log(`Rejected attack for ${playerId}: not enough AP (have ${player.ap}, need ${AP_COSTS.attack})`, action);
                break;
              }
              
              // Process attack
              log(`Processing attack for ${playerId}: attacking (${x}, ${y}) with ${player.ap} AP`);
              if (cell.fortificationLevel > 0) {
                cell.fortificationLevel--;
                cell.lastAttackedBy = player.id;
                log(`Attack reduced fortification at (${x}, ${y}) to ${cell.fortificationLevel}`);
              } else {
                cell.ownerFaction = player.faction;
                cell.lastCapturedBy = player.id;
                log(`Attack captured cell at (${x}, ${y}) for faction ${player.faction}`);
              }
              player.ap -= AP_COSTS.attack;
              gridChanged = true;
              valid = true;
              break;
            }
            case 'fortify': {
              const { x, y } = action.payload;
              const cell = getCell(grid, x, y);
              if (!cell) {
                log(`Rejected fortify for ${playerId}: invalid cell (${x}, ${y})`, action);
                break;
              }
              if (cell.ownerFaction !== player.faction) {
                log(`Rejected fortify for ${playerId}: cell not owned by player faction (owned by: ${cell.ownerFaction})`, action);
                break;
              }
              if (player.ap < AP_COSTS.fortify) {
                log(`Rejected fortify for ${playerId}: not enough AP (have ${player.ap}, need ${AP_COSTS.fortify})`, action);
                break;
              }
              
              // Process fortify
              log(`Processing fortify for ${playerId}: fortifying (${x}, ${y}) with ${player.ap} AP`);
              cell.fortificationLevel++;
              cell.lastFortifiedBy = player.id;
              player.ap -= AP_COSTS.fortify;
              gridChanged = true;
              valid = true;
              log(`Fortify increased fortification at (${x}, ${y}) to ${cell.fortificationLevel}`);
              break;
            }
            case 'donate_ap': {
              const { amount } = action.payload;
              if (typeof amount !== 'number' || amount <= 0) {
                log(`Rejected donate_ap for ${playerId}: amount must be positive`, action);
                break;
              }
              if (player.ap < amount) {
                log(`Rejected donate_ap for ${playerId}: not enough AP (have ${player.ap}, need ${amount})`, action);
                break;
              }
              
              // Process donation
              player.ap -= amount;
              faction.apPool += amount;
              valid = true;
              break;
            }
            case 'upgrade_request': {
              const { upgrade } = action.payload;
              if (faction.apPool < AP_COSTS.upgrade_request) {
                log(`Rejected upgrade_request for ${playerId}: not enough faction AP (have ${faction.apPool}, need ${AP_COSTS.upgrade_request})`, action);
                break;
              }
              
              // Process upgrade
              faction.apPool -= AP_COSTS.upgrade_request;
              faction.upgrades[upgrade] = (faction.upgrades[upgrade] || 0) + 1;
              valid = true;
              break;
            }
          }
          
          if (valid) {
            log(`Processed action for ${playerId}:`, action, `AP before: ${apBefore}, AP after: ${player.ap}`);
            // Save faction state immediately after each valid action
            await setFaction(faction);
            // Save player state immediately after each valid action
            await setPlayer(player);
          }
        } catch (e) {
          log('Failed to parse action:', actionStr, e);
        }
      }
      
      // Player state is now saved after each action, no need to save again here
      // await setPlayer(player);
    }
    
    // Handle connectivity checks
    const factionKeys = await redisClient.keys('faction:*');
    for (const factionKey of factionKeys) {
      const factionName = factionKey.split(':')[1];
      const roots = findFactionRoots(grid, factionName);
      if (roots.length === 0) continue;
      
      const connected = getConnectedCells(grid, factionName, roots);
      for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < grid[0].length; x++) {
          const cell = grid[y][x];
          if (cell.ownerFaction === factionName && !connected.has(`${x},${y}`)) {
            cell.ownerFaction = null;
            cell.fortificationLevel = 0;
            gridChanged = true;
          }
        }
      }
    }
    
    if (gridChanged) {
      await setGrid(grid);
      if (io) {
        io.emit('map_diff', { grid });
      }
    }
  }, TICK_INTERVAL);
} 