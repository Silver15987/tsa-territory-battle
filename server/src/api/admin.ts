import { Router, Request, Response } from 'express';
import { redisClient } from '../redisClient';

export function registerAdminEndpoints(app: any) {
  const router = Router();

  // Reset test data endpoint
  router.post('/admin/reset', async (_req: Request, res: Response) => {
    // Clear all test keys
    await redisClient.del(
      'player:test1', 'player:test2', 'player:test3', 
      'faction:red', 'faction:blue', 'faction:green', 
      'grid',
      'player:test1:actions', 'player:test2:actions', 'player:test3:actions'
    );
    
    // Seed test players for different factions
    await redisClient.hmset('player:test1', {
      id: 'test1',
      faction: 'red',
      ap: '100',
      actionQueue: JSON.stringify([]),
    });
    
    await redisClient.hmset('player:test2', {
      id: 'test2',
      faction: 'blue',
      ap: '100',
      actionQueue: JSON.stringify([]),
    });
    
    await redisClient.hmset('player:test3', {
      id: 'test3',
      faction: 'green', // Changed to green
      ap: '100',
      actionQueue: JSON.stringify([]),
    });
    
    // Seed test factions
    await redisClient.hmset('faction:red', {
      name: 'red',
      apPool: '500',
      upgrades: JSON.stringify({ factory: 1, castle: 0 }),
    });
    
    await redisClient.hmset('faction:blue', {
      name: 'blue',
      apPool: '500',
      upgrades: JSON.stringify({ factory: 1, castle: 0 }),
    });
    
    await redisClient.hmset('faction:green', {
      name: 'green',
      apPool: '500',
      upgrades: JSON.stringify({ factory: 1, castle: 0 }),
    });
    
    // Create 64x64 grid with corner-based starting positions
    const grid = Array.from({ length: 64 }, (_, y) =>
      Array.from({ length: 64 }, (_, x) => {
        let ownerFaction = null;
        let fortificationLevel = 0;
        
        // Red Faction: Top-left corner (0,0 to 15,15)
        if (x <= 15 && y <= 15) {
          ownerFaction = 'red';
          fortificationLevel = 1;
        }
        // Blue Faction: Top-right corner (48,0 to 63,15)
        else if (x >= 48 && y <= 15) {
          ownerFaction = 'blue';
          fortificationLevel = 1;
        }
        // Green Faction: Bottom-left corner (0,48 to 15,63)
        else if (x <= 15 && y >= 48) {
          ownerFaction = 'green';
          fortificationLevel = 1;
        }
        // Neutral territory: everything else
        
        return {
          x,
          y,
          ownerFaction,
          fortificationLevel,
        };
      })
    );
    
    await redisClient.set('grid', JSON.stringify(grid));
    res.json({ ok: true, message: '64x64 grid created with corner-based starting positions' });
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

  // Initialize grid with configurable size and corner-based starting positions
  router.post('/admin/grid/init', async (req: Request, res: Response) => {
    try {
      const { size = 32 } = req.body; // Default to 32x32
      
      if (![16, 32, 64].includes(size)) {
        return res.status(400).json({ 
          error: 'Invalid grid size. Supported sizes: 16, 32, 64' 
        });
      }
      
      // Calculate starting area size based on grid size
      const startingAreaSize = Math.floor(size / 4); // 1/4 of the grid for each corner
      
      // Create grid with corner-based starting positions
      const grid = Array.from({ length: size }, (_, y) =>
        Array.from({ length: size }, (_, x) => {
          let ownerFaction = null;
          let fortificationLevel = 0;
          
          // Red Faction: Top-left corner
          if (x <= startingAreaSize - 1 && y <= startingAreaSize - 1) {
            ownerFaction = 'red';
            fortificationLevel = 1;
          }
          // Blue Faction: Top-right corner
          else if (x >= size - startingAreaSize && y <= startingAreaSize - 1) {
            ownerFaction = 'blue';
            fortificationLevel = 1;
          }
          // Green Faction: Bottom-left corner
          else if (x <= startingAreaSize - 1 && y >= size - startingAreaSize) {
            ownerFaction = 'green';
            fortificationLevel = 1;
          }
          // Neutral territory: everything else
          
          return {
            x,
            y,
            ownerFaction,
            fortificationLevel,
          };
        })
      );
      
      await redisClient.set('grid', JSON.stringify(grid));
      
      // Calculate starting areas for response
      const startingAreas = {
        red: { 
          x: [0, startingAreaSize - 1], 
          y: [0, startingAreaSize - 1],
          tiles: startingAreaSize * startingAreaSize
        },
        blue: { 
          x: [size - startingAreaSize, size - 1], 
          y: [0, startingAreaSize - 1],
          tiles: startingAreaSize * startingAreaSize
        },
        green: { 
          x: [0, startingAreaSize - 1], 
          y: [size - startingAreaSize, size - 1],
          tiles: startingAreaSize * startingAreaSize
        }
      };
      
      res.json({ 
        ok: true, 
        message: `${size}x${size} grid initialized with corner-based starting positions`,
        dimensions: { width: size, height: size, totalTiles: size * size },
        startingAreas,
        neutralTiles: size * size - (startingAreaSize * startingAreaSize * 3)
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to initialize grid' });
    }
  });

  // Initialize 16x16 grid (convenience endpoint)
  router.post('/admin/grid/init-16x16', async (_req: Request, res: Response) => {
    try {
      const size = 16;
      const startingAreaSize = 4; // 4x4 starting areas
      
      const grid = Array.from({ length: size }, (_, y) =>
        Array.from({ length: size }, (_, x) => {
          let ownerFaction = null;
          let fortificationLevel = 0;
          
          // Red Faction: Top-left corner (0,0 to 3,3)
          if (x <= 3 && y <= 3) {
            ownerFaction = 'red';
            fortificationLevel = 1;
          }
          // Blue Faction: Top-right corner (12,0 to 15,3)
          else if (x >= 12 && y <= 3) {
            ownerFaction = 'blue';
            fortificationLevel = 1;
          }
          // Green Faction: Bottom-left corner (0,12 to 3,15)
          else if (x <= 3 && y >= 12) {
            ownerFaction = 'green';
            fortificationLevel = 1;
          }
          
          return { x, y, ownerFaction, fortificationLevel };
        })
      );
      
      await redisClient.set('grid', JSON.stringify(grid));
      res.json({ 
        ok: true, 
        message: '16x16 grid initialized',
        dimensions: { width: 16, height: 16, totalTiles: 256 },
        startingAreas: {
          red: { x: [0, 3], y: [0, 3], tiles: 16 },
          blue: { x: [12, 15], y: [0, 3], tiles: 16 },
          green: { x: [0, 3], y: [12, 15], tiles: 16 }
        },
        neutralTiles: 256 - 48 // 208 neutral tiles
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to initialize 16x16 grid' });
    }
  });

  // Initialize 32x32 grid (convenience endpoint)
  router.post('/admin/grid/init-32x32', async (_req: Request, res: Response) => {
    try {
      const size = 32;
      const startingAreaSize = 8; // 8x8 starting areas
      
      const grid = Array.from({ length: size }, (_, y) =>
        Array.from({ length: size }, (_, x) => {
          let ownerFaction = null;
          let fortificationLevel = 0;
          
          // Red Faction: Top-left corner (0,0 to 7,7)
          if (x <= 7 && y <= 7) {
            ownerFaction = 'red';
            fortificationLevel = 1;
          }
          // Blue Faction: Top-right corner (24,0 to 31,7)
          else if (x >= 24 && y <= 7) {
            ownerFaction = 'blue';
            fortificationLevel = 1;
          }
          // Green Faction: Bottom-left corner (0,24 to 7,31)
          else if (x <= 7 && y >= 24) {
            ownerFaction = 'green';
            fortificationLevel = 1;
          }
          
          return { x, y, ownerFaction, fortificationLevel };
        })
      );
      
      await redisClient.set('grid', JSON.stringify(grid));
      res.json({ 
        ok: true, 
        message: '32x32 grid initialized',
        dimensions: { width: 32, height: 32, totalTiles: 1024 },
        startingAreas: {
          red: { x: [0, 7], y: [0, 7], tiles: 64 },
          blue: { x: [24, 31], y: [0, 7], tiles: 64 },
          green: { x: [0, 7], y: [24, 31], tiles: 64 }
        },
        neutralTiles: 1024 - 192 // 832 neutral tiles
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to initialize 32x32 grid' });
    }
  });

  // Initialize 64x64 grid (convenience endpoint)
  router.post('/admin/grid/init-64x64', async (_req: Request, res: Response) => {
    try {
      const size = 64;
      const startingAreaSize = 16; // 16x16 starting areas
      
      const grid = Array.from({ length: size }, (_, y) =>
        Array.from({ length: size }, (_, x) => {
          let ownerFaction = null;
          let fortificationLevel = 0;
          
          // Red Faction: Top-left corner (0,0 to 15,15)
          if (x <= 15 && y <= 15) {
            ownerFaction = 'red';
            fortificationLevel = 1;
          }
          // Blue Faction: Top-right corner (48,0 to 63,15)
          else if (x >= 48 && y <= 15) {
            ownerFaction = 'blue';
            fortificationLevel = 1;
          }
          // Green Faction: Bottom-left corner (0,48 to 15,63)
          else if (x <= 15 && y >= 48) {
            ownerFaction = 'green';
            fortificationLevel = 1;
          }
          
          return { x, y, ownerFaction, fortificationLevel };
        })
      );
      
      await redisClient.set('grid', JSON.stringify(grid));
      res.json({ 
        ok: true, 
        message: '64x64 grid initialized',
        dimensions: { width: 64, height: 64, totalTiles: 4096 },
        startingAreas: {
          red: { x: [0, 15], y: [0, 15], tiles: 256 },
          blue: { x: [48, 63], y: [0, 15], tiles: 256 },
          green: { x: [0, 15], y: [48, 63], tiles: 256 }
        },
        neutralTiles: 4096 - 768 // 3328 neutral tiles
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to initialize 64x64 grid' });
    }
  });

  // Get grid dimensions
  router.get('/admin/grid/dimensions', async (_req: Request, res: Response) => {
    const grid = await redisClient.get('grid');
    if (!grid) {
      return res.status(404).json({ error: 'Grid not found' });
    }
    try {
      const parsed = JSON.parse(grid);
      const height = parsed.length;
      const width = parsed[0]?.length || 0;
      res.json({ width, height, totalTiles: width * height });
    } catch {
      res.status(500).json({ error: 'Failed to parse grid dimensions' });
    }
  });

  // Create individual player endpoint
  router.post('/admin/player', async (req: Request, res: Response) => {
    const { id, faction, ap } = req.body;
    
    if (!id || !faction || typeof ap !== 'number') {
      return res.status(400).json({ error: 'Missing required fields: id, faction, ap' });
    }
    
    try {
      await redisClient.hmset(`player:${id}`, {
        id,
        faction,
        ap: ap.toString(),
        actionQueue: JSON.stringify([]),
      });
      
      res.json({ ok: true, player: { id, faction, ap } });
    } catch (error) {
      res.status(500).json({ error: 'Failed to create player' });
    }
  });

  // Test AP generation endpoint - generates 2 AP per tick for all users
  router.post('/admin/test-ap', async (_req: Request, res: Response) => {
    try {
      // Get all player keys
      const playerKeys = await redisClient.keys('player:*');
      
      if (playerKeys.length === 0) {
        return res.status(404).json({ error: 'No players found' });
      }

      // Update each player's AP
      const updates = [];
      for (const key of playerKeys) {
        const player = await redisClient.hgetall(key);
        if (player && player.ap) {
          const currentAp = parseInt(player.ap, 10) || 0;
          const newAp = currentAp + 2;
          
          await redisClient.hset(key, 'ap', newAp.toString());
          updates.push({
            id: player.id,
            oldAp: currentAp,
            newAp: newAp,
            gain: 2
          });
        }
      }

      // Also update faction AP pools
      const factionKeys = await redisClient.keys('faction:*');
      const factionUpdates = [];
      
      for (const key of factionKeys) {
        const faction = await redisClient.hgetall(key);
        if (faction && faction.apPool) {
          const currentApPool = parseInt(faction.apPool, 10) || 0;
          const newApPool = currentApPool + 2;
          
          await redisClient.hset(key, 'apPool', newApPool.toString());
          factionUpdates.push({
            name: faction.name,
            oldApPool: currentApPool,
            newApPool: newApPool,
            gain: 2
          });
        }
      }

      res.json({ 
        ok: true, 
        message: `Generated 2 AP for ${updates.length} players and ${factionUpdates.length} factions`,
        playerUpdates: updates,
        factionUpdates: factionUpdates,
        totalApGenerated: (updates.length + factionUpdates.length) * 2
      });
    } catch (error) {
      console.error('Error in test-ap endpoint:', error);
      res.status(500).json({ error: 'Failed to generate test AP' });
    }
  });

  // Test AP generation with custom amount
  router.post('/admin/test-ap/:amount', async (req: Request, res: Response) => {
    try {
      const amount = parseInt(req.params.amount, 10);
      
      if (isNaN(amount) || amount < 0) {
        return res.status(400).json({ error: 'Invalid AP amount. Must be a positive number.' });
      }

      // Get all player keys
      const playerKeys = await redisClient.keys('player:*');
      
      if (playerKeys.length === 0) {
        return res.status(404).json({ error: 'No players found' });
      }

      // Update each player's AP
      const updates = [];
      for (const key of playerKeys) {
        const player = await redisClient.hgetall(key);
        if (player && player.ap) {
          const currentAp = parseInt(player.ap, 10) || 0;
          const newAp = currentAp + amount;
          
          await redisClient.hset(key, 'ap', newAp.toString());
          updates.push({
            id: player.id,
            oldAp: currentAp,
            newAp: newAp,
            gain: amount
          });
        }
      }

      // Also update faction AP pools
      const factionKeys = await redisClient.keys('faction:*');
      const factionUpdates = [];
      
      for (const key of factionKeys) {
        const faction = await redisClient.hgetall(key);
        if (faction && faction.apPool) {
          const currentApPool = parseInt(faction.apPool, 10) || 0;
          const newApPool = currentApPool + amount;
          
          await redisClient.hset(key, 'apPool', newApPool.toString());
          factionUpdates.push({
            name: faction.name,
            oldApPool: currentApPool,
            newApPool: newApPool,
            gain: amount
          });
        }
      }

      res.json({ 
        ok: true, 
        message: `Generated ${amount} AP for ${updates.length} players and ${factionUpdates.length} factions`,
        playerUpdates: updates,
        factionUpdates: factionUpdates,
        totalApGenerated: (updates.length + factionUpdates.length) * amount
      });
    } catch (error) {
      console.error('Error in test-ap endpoint:', error);
      res.status(500).json({ error: 'Failed to generate test AP' });
    }
  });

  app.use(router);
} 