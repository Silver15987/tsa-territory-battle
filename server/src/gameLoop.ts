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

export function startGameLoop() {
  setInterval(async () => {
    const playerKeys = await redisClient.keys('player:*');
    let grid = await getGrid();
    let gridChanged = false;
    for (const playerKey of playerKeys) {
      if (!playerKey.endsWith(':actions')) {
        const playerId = playerKey.split(':')[1];
        const actionQueueKey = `player:${playerId}:actions`;
        let player = await getPlayer(playerId);
        if (!player) continue;
        let faction = await getFaction(player.faction);
        if (!faction) continue;
        let actionStr;
        while ((actionStr = await redisClient.lpop(actionQueueKey))) {
          try {
            const action: PlayerAction = JSON.parse(actionStr);
            switch (action.type) {
              case 'attack': {
                const { x, y } = action.payload;
                const cell = getCell(grid, x, y);
                if (cell && player.ap >= AP_COSTS.attack) {
                  player.ap -= AP_COSTS.attack;
                  if (cell.fortificationLevel > 0) {
                    cell.fortificationLevel--;
                    cell.lastAttackedBy = player.id;
                  } else {
                    cell.ownerFaction = player.faction;
                    cell.lastCapturedBy = player.id;
                  }
                  gridChanged = true;
                }
                break;
              }
              case 'fortify': {
                const { x, y } = action.payload;
                const cell = getCell(grid, x, y);
                if (cell && cell.ownerFaction === player.faction && player.ap >= AP_COSTS.fortify) {
                  player.ap -= AP_COSTS.fortify;
                  cell.fortificationLevel++;
                  cell.lastFortifiedBy = player.id;
                  gridChanged = true;
                }
                break;
              }
              case 'donate_ap': {
                const { amount } = action.payload;
                if (player.ap >= amount && amount > 0) {
                  player.ap -= amount;
                  faction.apPool += amount;
                  // Optionally track donations
                }
                break;
              }
              case 'upgrade_request': {
                const { upgrade } = action.payload;
                if (faction.apPool >= AP_COSTS.upgrade_request) {
                  faction.apPool -= AP_COSTS.upgrade_request;
                  faction.upgrades[upgrade] = (faction.upgrades[upgrade] || 0) + 1;
                  // Optionally: apply upgrade effects
                }
                break;
              }
            }
            log(`Processed action for ${playerId}:`, action);
          } catch (e) {
            log('Failed to parse action:', actionStr);
          }
        }
        await setPlayer(player);
        await setFaction(faction);
      }
    }
    if (gridChanged) {
      await setGrid(grid);
      if (io) {
        io.emit('map_diff', { grid });
      }
    }
    log('Tick: processed actions and updated state');
  }, TICK_INTERVAL);
} 