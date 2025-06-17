import { Router, Request, Response } from 'express';
import { redisClient } from '../redisClient';

export function registerAdminEndpoints(app: any) {
  const router = Router();

  // Get player state
  router.get('/admin/player/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const player = await redisClient.hgetall(`player:${id}`);
    if (!player || Object.keys(player).length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }
    // Parse actionQueue if present
    if (player.actionQueue) {
      try {
        player.actionQueue = JSON.parse(player.actionQueue);
      } catch {}
    }
    res.json(player);
  });

  // Get faction state
  router.get('/admin/faction/:name', async (req: Request, res: Response) => {
    const { name } = req.params;
    const faction = await redisClient.hgetall(`faction:${name}`);
    if (!faction || Object.keys(faction).length === 0) {
      return res.status(404).json({ error: 'Faction not found' });
    }
    // Parse upgrades if present
    if (faction.upgrades) {
      try {
        faction.upgrades = JSON.parse(faction.upgrades);
      } catch {}
    }
    res.json(faction);
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