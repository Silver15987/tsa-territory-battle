import { io } from 'socket.io-client';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';

const SERVER_URL = 'http://localhost:4000';
const LOG_DIR = path.join(__dirname, 'logs');

// Test players
const PLAYERS = [
  { id: 'test1', faction: 'red' },
  { id: 'test2', faction: 'blue' },
  { id: 'test3', faction: 'red' }, // Second red player
];

async function resetTestData() {
  await axios.post(`${SERVER_URL}/admin/reset`);
  console.log('Multi-player test data reset.');
}

async function delay(ms: number) {
  return new Promise(res => setTimeout(res, ms));
}

async function fetchState() {
  const [players, factions, grid] = await Promise.all([
    Promise.all(PLAYERS.map(p => 
      axios.get(`${SERVER_URL}/admin/player/${p.id}`).then(r => r.data).catch(() => null)
    )),
    Promise.all(['red', 'blue', 'green'].map(f => 
      axios.get(`${SERVER_URL}/admin/faction/${f}`).then(r => r.data).catch(() => null)
    )),
    axios.get(`${SERVER_URL}/admin/grid`).then(r => r.data).catch(() => null),
  ]);
  
  return {
    players: players.reduce((acc, player, i) => {
      if (player) acc[PLAYERS[i].id] = player;
      return acc;
    }, {} as any),
    factions: factions.reduce((acc, faction) => {
      if (faction) acc[faction.name] = faction;
      return acc;
    }, {} as any),
    grid
  };
}

async function getNextLogNumber() {
  try {
    await fs.mkdir(LOG_DIR, { recursive: true });
    const files = await fs.readdir(LOG_DIR);
    const nums = files.map(f => parseInt(f.split('.')[0])).filter(n => !isNaN(n));
    return nums.length ? Math.max(...nums) + 1 : 0;
  } catch {
    return 0;
  }
}

async function runMultiPlayerTests() {
  await resetTestData();
  await delay(2000);

  // Create socket connections for each player
  const sockets = PLAYERS.map(player => 
    io(SERVER_URL, { auth: { playerId: player.id } })
  );

  // Wait for all connections
  await Promise.all(sockets.map(socket => 
    new Promise<void>(resolve => socket.on('connect', () => resolve()))
  ));

  console.log('All players connected');

  const logLines: string[] = [];
  const results: any[] = [];

  // Test 1: Multiple players from same faction (red) attack different targets
  logLines.push('\n=== TEST 1: Same Faction Multi-Attack ===');
  
  const beforeTest1 = await fetchState();
  
  // test1 (red) attacks (2,0) - adjacent to red territory at (1,0)
  sockets[0].emit('attack', { x: 2, y: 0 });
  // test3 (red) attacks (1,1) - adjacent to red territory at (0,1)  
  sockets[2].emit('attack', { x: 1, y: 1 });
  
  await delay(3000);
  const afterTest1 = await fetchState();
  
  const test1Success = 
    afterTest1.grid[0][2].ownerFaction === 'red' && 
    afterTest1.grid[1][1].ownerFaction === 'red' &&
    afterTest1.players.test1.ap === 90 &&
    afterTest1.players.test3.ap === 90;
  
  logLines.push(`Result: ${test1Success ? 'PASS' : 'FAIL'} - Same faction multi-attack`);
  logLines.push(`Red captured (2,0): ${afterTest1.grid[0][2].ownerFaction === 'red'}`);
  logLines.push(`Red captured (1,1): ${afterTest1.grid[1][1].ownerFaction === 'red'}`);
  logLines.push(`Test1 AP: ${beforeTest1.players.test1.ap} → ${afterTest1.players.test1.ap}`);
  logLines.push(`Test3 AP: ${beforeTest1.players.test3.ap} → ${afterTest1.players.test3.ap}`);
  results.push({ test: 1, name: 'Same Faction Multi-Attack', result: test1Success ? 'PASS' : 'FAIL' });

  // Test 2: Cross-faction combat
  logLines.push('\n=== TEST 2: Cross-Faction Combat ===');
  
  const beforeTest2 = await fetchState();
  
  // test2 (blue) attacks red territory at (2,1) - should be adjacent to blue territory at (3,1)
  sockets[1].emit('attack', { x: 2, y: 1 });
  // test1 (red) attacks blue territory at (3,1) - should be adjacent to red territory at (2,0)  
  sockets[0].emit('attack', { x: 3, y: 1 });
  
  await delay(3000);
  const afterTest2 = await fetchState();
  
  const test2Success = 
    afterTest2.grid[1][2].ownerFaction === 'blue' &&
    afterTest2.grid[1][3].ownerFaction === 'red';
  
  logLines.push(`Result: ${test2Success ? 'PASS' : 'FAIL'} - Cross-faction combat`);
  logLines.push(`Blue captured (2,1): ${afterTest2.grid[1][2].ownerFaction === 'blue'}`);
  logLines.push(`Red captured (3,1): ${afterTest2.grid[1][3].ownerFaction === 'red'}`);
  results.push({ test: 2, name: 'Cross-Faction Combat', result: test2Success ? 'PASS' : 'FAIL' });

  // Test 3: Faction cooperation (multiple players donate to same faction)
  logLines.push('\n=== TEST 3: Faction Cooperation ===');
  
  const beforeTest3 = await fetchState();
  
  // Both red players donate AP to faction
  sockets[0].emit('donate_ap', { amount: 20 }); // test1
  sockets[2].emit('donate_ap', { amount: 15 }); // test3
  
  await delay(3000);
  const afterTest3 = await fetchState();
  
  const expectedRedAP = beforeTest3.factions.red.apPool + 35;
  const test3Success = 
    afterTest3.factions.red.apPool === expectedRedAP &&
    afterTest3.players.test1.ap === beforeTest3.players.test1.ap - 20 &&
    afterTest3.players.test3.ap === beforeTest3.players.test3.ap - 15;
  
  logLines.push(`Result: ${test3Success ? 'PASS' : 'FAIL'} - Faction cooperation`);
  logLines.push(`Red faction AP: ${beforeTest3.factions.red.apPool} → ${afterTest3.factions.red.apPool} (expected ${expectedRedAP})`);
  results.push({ test: 3, name: 'Faction Cooperation', result: test3Success ? 'PASS' : 'FAIL' });

  // Test 4: Simultaneous faction upgrades
  logLines.push('\n=== TEST 4: Faction Upgrades ===');
  
  const beforeTest4 = await fetchState();
  
  // Different factions request upgrades simultaneously
  sockets[0].emit('upgrade_request', { upgrade: 'factory' }); // red
  sockets[1].emit('upgrade_request', { upgrade: 'castle' }); // blue
  
  await delay(3000);
  const afterTest4 = await fetchState();
  
  const test4Success = 
    afterTest4.factions.red.upgrades.factory === beforeTest4.factions.red.upgrades.factory + 1 &&
    afterTest4.factions.blue.upgrades.castle === (beforeTest4.factions.blue.upgrades.castle || 0) + 1;
  
  logLines.push(`Result: ${test4Success ? 'PASS' : 'FAIL'} - Faction upgrades`);
  logLines.push(`Red factory upgrades: ${beforeTest4.factions.red.upgrades.factory} → ${afterTest4.factions.red.upgrades.factory}`);
  logLines.push(`Blue castle upgrades: ${beforeTest4.factions.blue.upgrades.castle || 0} → ${afterTest4.factions.blue.upgrades.castle || 0}`);
  results.push({ test: 4, name: 'Faction Upgrades', result: test4Success ? 'PASS' : 'FAIL' });

  // Final state logging
  const finalState = await fetchState();
  logLines.push('\n=== FINAL STATE ===');
  logLines.push(`Players: ${JSON.stringify(finalState.players, null, 2)}`);
  logLines.push(`Factions: ${JSON.stringify(finalState.factions, null, 2)}`);
  logLines.push(`Grid: ${JSON.stringify(finalState.grid, null, 2)}`);

  // Print summary
  console.log('\nMulti-Player Test Summary:');
  console.table(results);

  // Save log
  const logNum = await getNextLogNumber();
  const logPath = path.join(LOG_DIR, `${logNum}-multiplayer.log`);
  await fs.writeFile(logPath, logLines.join('\n'));
  console.log(`\nMulti-player test log saved to ${logPath}`);

  // Disconnect all sockets
  sockets.forEach(socket => socket.disconnect());
}

runMultiPlayerTests().catch(console.error); 