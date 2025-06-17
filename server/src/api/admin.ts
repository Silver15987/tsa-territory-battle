import { Router, Request, Response } from 'express';
import { redisClient } from '../redisClient';

export function registerAdminEndpoints(app: any) {
  const router = Router();

  // Reset test data endpoint
  router.post('/admin/reset', async (_req: Request, res: Response) => {
    // Clear all test keys
    await redisClient.del('player:test', 'faction:red', 'grid', 'player:test:actions');
    // Seed test player
    await redisClient.hmset('player:test', {
      id: 'test',
      faction: 'red',
      ap: '100',
      actionQueue: JSON.stringify([]),
    });
    // Seed test faction
    await redisClient.hmset('faction:red', {
      name: 'red',
      apPool: '500',
      upgrades: JSON.stringify({ factory: 1, castle: 0 }),
    });
    // Seed a simple 3x3 grid
    const grid = [
      [
        { x: 0, y: 0, ownerFaction: null, fortificationLevel: 0 },
        { x: 1, y: 0, ownerFaction: 'red', fortificationLevel: 1 },
        { x: 2, y: 0, ownerFaction: null, fortificationLevel: 0 },
      ],
      [
        { x: 0, y: 1, ownerFaction: null, fortificationLevel: 0 },
        { x: 1, y: 1, ownerFaction: null, fortificationLevel: 0 },
        { x: 2, y: 1, ownerFaction: null, fortificationLevel: 0 },
      ],
      [
        { x: 0, y: 2, ownerFaction: null, fortificationLevel: 0 },
        { x: 1, y: 2, ownerFaction: null, fortificationLevel: 0 },
        { x: 2, y: 2, ownerFaction: null, fortificationLevel: 0 },
      ],
    ];
    await redisClient.set('grid', JSON.stringify(grid));
    res.json({ ok: true });
  });

  // Get player state
  router.get('/admin/player/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const player = await redisClient.hgetall(`player:${id}`);
    if (!player || Object.keys(player).length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }
    // Parse numeric fields and actionQueue
    const parsedPlayer = {
      ...player,
      ap: parseInt(player.ap, 10) || 0,
      actionQueue: player.actionQueue ? JSON.parse(player.actionQueue) : []
    };
    res.json(parsedPlayer);
  });

  // Get faction state
  router.get('/admin/faction/:name', async (req: Request, res: Response) => {
    const { name } = req.params;
    const faction = await redisClient.hgetall(`faction:${name}`);
    if (!faction || Object.keys(faction).length === 0) {
      return res.status(404).json({ error: 'Faction not found' });
    }
    // Parse numeric fields and upgrades
    const parsedFaction = {
      ...faction,
      apPool: parseInt(faction.apPool, 10) || 0,
      upgrades: faction.upgrades ? JSON.parse(faction.upgrades) : {}
    };
    res.json(parsedFaction);
  });

  // Get grid state
  router.get('/admin/grid', async (_req: Request, res: Response) => {
    const grid = await redisClient.get('grid');
    if (!grid) {
      return res.status(404).json({ error: 'Grid not found' });
    }
    try {
      const parsed = JSON.parse(grid);
      res.json(parsed);
    } catch {
      res.status(500).json({ error: 'Failed to parse grid' });
    }
  });

  app.use(router);
} 