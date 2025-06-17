import dotenv from 'dotenv';
dotenv.config();
import { redisClient } from '../redisClient';

async function seed() {
  // Seed a test player
  await redisClient.hmset('player:test', {
    id: 'test',
    faction: 'red',
    ap: '100',
    actionQueue: JSON.stringify([]),
  });

  // Seed a test faction
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

  console.log('Seeded test data.');
  process.exit(0);
}

seed(); 