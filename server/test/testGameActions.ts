import { io } from 'socket.io-client';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';

const SERVER_URL = 'http://localhost:4000';
const PLAYER_ID = 'test';
const FACTION = 'red';
const LOG_DIR = path.join(__dirname, 'logs');

async function resetTestData() {
  await axios.post(`${SERVER_URL}/admin/reset`);
  console.log('Test data reset.');
}

const socket = io(SERVER_URL, { auth: { playerId: PLAYER_ID } });

socket.on('connect', () => {
  console.log('Connected as', PLAYER_ID);
});

socket.on('map_diff', (data) => {
  // Optionally log map diffs
});

async function fetchState() {
  const [player, faction, grid] = await Promise.all([
    axios.get(`${SERVER_URL}/admin/player/${PLAYER_ID}`).then(r => r.data).catch(() => null),
    axios.get(`${SERVER_URL}/admin/faction/${FACTION}`).then(r => r.data).catch(() => null),
    axios.get(`${SERVER_URL}/admin/grid`).then(r => r.data).catch(() => null),
  ]);
  return { player, faction, grid };
}

async function delay(ms: number) {
  return new Promise(res => setTimeout(res, ms));
}

function deepClone(obj: any) {
  return JSON.parse(JSON.stringify(obj));
}

async function getNextLogNumber() {
  try {
    await fs.mkdir(LOG_DIR, { recursive: true });
    const files = await fs.readdir(LOG_DIR);
    const nums = files.map(f => parseInt(f)).filter(n => !isNaN(n));
    return nums.length ? Math.max(...nums) + 1 : 0;
  } catch {
    return 0;
  }
}

function compareState({ before, after, step }: { before: any, after: any, step: number }) {
  let pass = true;
  let reason = '';
  switch (step) {
    case 1: // Attack non-adjacent (2,2) - should fail
      pass = after.player.ap === before.player.ap && JSON.stringify(after.grid) === JSON.stringify(before.grid);
      reason = pass ? 'No AP lost, no capture' : 'AP lost or grid changed';
      break;
    case 2: // Attack adjacent (0,0) - should succeed
      pass = after.player.ap === before.player.ap - 10 && after.grid[0][0].ownerFaction === 'red';
      reason = pass ? 'AP lost, cell captured' : 'AP not lost or cell not captured';
      break;
    case 3: // Fortify owned (0,0) - should succeed
      pass = after.player.ap === before.player.ap - 5 && after.grid[0][0].fortificationLevel === before.grid[0][0].fortificationLevel + 1;
      reason = pass ? 'AP lost, fortification up' : 'AP not lost or fortification not up';
      break;
    case 4: // Fortify unowned (2,2) - should fail
      pass = after.player.ap === before.player.ap && JSON.stringify(after.grid) === JSON.stringify(before.grid);
      reason = pass ? 'No AP lost, no change' : 'AP lost or grid changed';
      break;
    case 5: // Donate AP
      pass = after.player.ap === before.player.ap - 10 && after.faction.apPool === before.faction.apPool + 10;
      reason = pass ? 'AP moved to faction' : 'AP not moved correctly';
      break;
    case 6: // Upgrade request
      pass = after.faction.apPool === before.faction.apPool - 100 && after.faction.upgrades.factory === (before.faction.upgrades.factory || 0) + 1;
      reason = pass ? 'Upgrade processed' : 'Upgrade not processed';
      break;
    default:
      pass = false;
      reason = 'Unknown step';
  }
  return { pass, reason };
}

async function runTests() {
  await resetTestData();
  await delay(2000); // Increased delay to ensure clean state after reset

  const steps = [
    {
      name: 'Attack non-adjacent cell (should fail)',
      action: () => socket.emit('attack', { x: 2, y: 2 }),
    },
    {
      name: 'Attack adjacent cell (should succeed)',
      action: () => socket.emit('attack', { x: 0, y: 0 }),
    },
    {
      name: 'Fortify owned cell (should succeed)',
      action: () => socket.emit('fortify', { x: 0, y: 0 }),
    },
    {
      name: 'Fortify unowned cell (should fail)',
      action: () => socket.emit('fortify', { x: 2, y: 2 }),
    },
    {
      name: 'Donate AP to faction',
      action: () => socket.emit('donate_ap', { amount: 10 }),
    },
    {
      name: 'Request upgrade',
      action: () => socket.emit('upgrade_request', { upgrade: 'factory' }),
    },
  ];

  const logLines: string[] = [];
  const summary: { step: number, name: string, result: string, reason: string }[] = [];
  let before = await fetchState();

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    logLines.push(`\n${i + 1}. ${step.name}`);
    step.action();
    await delay(2500); // Increased delay to ensure actions are fully processed and persisted
    const after = await fetchState();
    const { pass, reason } = compareState({ before, after, step: i + 1 });
    const result = pass ? 'PASS' : 'FAIL';
    logLines.push(`Result: ${result} - ${reason}`);
    logLines.push(`Player: ${JSON.stringify(after.player)}`);
    logLines.push(`Faction: ${JSON.stringify(after.faction)}`);
    logLines.push(`Grid: ${JSON.stringify(after.grid, null, 2)}`);
    summary.push({ step: i + 1, name: step.name, result, reason });
    before = after;
  }

  // Print summary table
  console.log('\nTest Summary:');
  console.table(summary);

  // Write log file
  const logNum = await getNextLogNumber();
  const logPath = path.join(LOG_DIR, `${logNum}.log`);
  await fs.writeFile(logPath, logLines.join('\n'));
  console.log(`\nTest log saved to ${logPath}`);

  socket.disconnect();
}

runTests(); 