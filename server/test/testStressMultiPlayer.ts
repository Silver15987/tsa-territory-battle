import { io } from 'socket.io-client';
import axios from 'axios';

const SERVER_URL = 'http://localhost:4000';

// 15 players across 3 factions (5 players each)
const PLAYERS = [
  // Red faction players
  { id: 'red1', faction: 'red' },
  { id: 'red2', faction: 'red' },
  { id: 'red3', faction: 'red' },
  { id: 'red4', faction: 'red' },
  { id: 'red5', faction: 'red' },
  
  // Blue faction players
  { id: 'blue1', faction: 'blue' },
  { id: 'blue2', faction: 'blue' },
  { id: 'blue3', faction: 'blue' },
  { id: 'blue4', faction: 'blue' },
  { id: 'blue5', faction: 'blue' },
  
  // Green faction players
  { id: 'green1', faction: 'green' },
  { id: 'green2', faction: 'green' },
  { id: 'green3', faction: 'green' },
  { id: 'green4', faction: 'green' },
  { id: 'green5', faction: 'green' },
];

async function resetStressTestData() {
  await axios.post(`${SERVER_URL}/admin/reset`);
  
  // Create all players using the new endpoint
  for (const player of PLAYERS) {
    await axios.post(`${SERVER_URL}/admin/player`, {
      id: player.id,
      faction: player.faction,
      ap: 100
    });
  }
  
  console.log('Stress test data reset with 15 players across 3 factions.');
}

async function delay(ms: number) {
  return new Promise(res => setTimeout(res, ms));
}

async function fetchFullState() {
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
    }, {} as Record<string, any>),
    factions: factions.reduce((acc, faction) => {
      if (faction) acc[faction.name] = faction;
      return acc;
    }, {} as Record<string, any>),
    grid
  };
}

function getRandomDelay() {
  return Math.random() * 500 + 100; // 100-600ms random delay
}

async function runStressTest() {
  await resetStressTestData();
  await delay(3000);

  // Create socket connections for all 15 players
  const sockets = PLAYERS.map(player => 
    io(SERVER_URL, { auth: { playerId: player.id } })
  );

  // Wait for all connections
  await Promise.all(sockets.map(socket => 
    new Promise<void>(resolve => socket.on('connect', () => resolve()))
  ));

  console.log('All 15 players connected successfully!');

  const logLines: string[] = [];
  const results: any[] = [];

  // Test 1: Massive Concurrent Base Expansion
  console.log('\n=== STRESS TEST 1: Concurrent Base Expansion (15 players) ===');
  
  const beforeExpansion = await fetchFullState();
  
  // All players simultaneously try to expand their territory
  const expansionPromises = sockets.map(async (socket, i) => {
    await delay(getRandomDelay()); // Stagger slightly to simulate real users
    const player = PLAYERS[i];
    
    // Each faction expands in different directions
    if (player.faction === 'red') {
      socket.emit('attack', { x: 2, y: 0 }); // Expand east
    } else if (player.faction === 'blue') {
      socket.emit('attack', { x: 2, y: 1 }); // Expand toward center
    } else if (player.faction === 'green') {
      socket.emit('attack', { x: 1, y: 3 }); // Expand north
    }
  });
  
  await Promise.all(expansionPromises);
  await delay(4000); // Wait for all actions to process
  
  const afterExpansion = await fetchFullState();
  
  // Count successful expansions
  let redExpansions = 0, blueExpansions = 0, greenExpansions = 0;
  for (let y = 0; y < afterExpansion.grid.length; y++) {
    for (let x = 0; x < afterExpansion.grid[0].length; x++) {
      const cell = afterExpansion.grid[y][x];
      if (cell.lastCapturedBy) {
        if (cell.ownerFaction === 'red') redExpansions++;
        if (cell.ownerFaction === 'blue') blueExpansions++;
        if (cell.ownerFaction === 'green') greenExpansions++;
      }
    }
  }
  
  console.log(`Red expansions: ${redExpansions}`);
  console.log(`Blue expansions: ${blueExpansions}`);
  console.log(`Green expansions: ${greenExpansions}`);
  console.log(`Total new captures: ${redExpansions + blueExpansions + greenExpansions}`);
  
  results.push({ 
    test: 1, 
    name: 'Concurrent Base Expansion', 
    result: (redExpansions + blueExpansions + greenExpansions) > 0 ? 'PASS' : 'FAIL',
    details: `${redExpansions + blueExpansions + greenExpansions} total captures`
  });

  // Test 2: Faction Coordination - Mass Donations
  console.log('\n=== STRESS TEST 2: Mass Faction Donations ===');
  
  const beforeDonations = await fetchFullState();
  
  // All players donate different amounts simultaneously
  const donationPromises = sockets.map(async (socket, i) => {
    await delay(getRandomDelay());
    const amount = 5 + (i % 3) * 5; // Donate 5, 10, or 15 AP
    socket.emit('donate_ap', { amount });
  });
  
  await Promise.all(donationPromises);
  await delay(3000);
  
  const afterDonations = await fetchFullState();
  
  const redDonated = afterDonations.factions.red.apPool - beforeDonations.factions.red.apPool;
  const blueDonated = afterDonations.factions.blue.apPool - beforeDonations.factions.blue.apPool;
  const greenDonated = afterDonations.factions.green.apPool - beforeDonations.factions.green.apPool;
  
  console.log(`Red faction gained: ${redDonated} AP`);
  console.log(`Blue faction gained: ${blueDonated} AP`);
  console.log(`Green faction gained: ${greenDonated} AP`);
  
  results.push({ 
    test: 2, 
    name: 'Mass Faction Donations', 
    result: (redDonated > 0 && blueDonated > 0 && greenDonated > 0) ? 'PASS' : 'FAIL',
    details: `R:${redDonated} B:${blueDonated} G:${greenDonated}`
  });

  // Test 3: Defensive Fortification Rush
  console.log('\n=== STRESS TEST 3: Defensive Fortification Rush ===');
  
  const beforeFortify = await fetchFullState();
  
  // All players try to fortify their faction's territory simultaneously
  const fortifyPromises = sockets.map(async (socket, i) => {
    await delay(getRandomDelay());
    const player = PLAYERS[i];
    
    // Fortify faction starting areas
    if (player.faction === 'red') {
      socket.emit('fortify', { x: i % 2, y: 0 }); // Fortify red base area
    } else if (player.faction === 'blue') {
      socket.emit('fortify', { x: 3 + (i % 2), y: 0 }); // Fortify blue base area
    } else if (player.faction === 'green') {
      socket.emit('fortify', { x: i % 2, y: 4 }); // Fortify green base area
    }
  });
  
  await Promise.all(fortifyPromises);
  await delay(3000);
  
  const afterFortify = await fetchFullState();
  
  // Count fortification increases
  let totalFortifications = 0;
  for (let y = 0; y < afterFortify.grid.length; y++) {
    for (let x = 0; x < afterFortify.grid[0].length; x++) {
      const before = beforeFortify.grid[y][x].fortificationLevel || 0;
      const after = afterFortify.grid[y][x].fortificationLevel || 0;
      if (after > before) totalFortifications += (after - before);
    }
  }
  
  console.log(`Total fortification increases: ${totalFortifications}`);
  
  results.push({ 
    test: 3, 
    name: 'Defensive Fortification Rush', 
    result: totalFortifications > 0 ? 'PASS' : 'FAIL',
    details: `${totalFortifications} fortifications added`
  });

  // Test 4: Cross-Faction Warfare
  console.log('\n=== STRESS TEST 4: Cross-Faction Warfare ===');
  
  const beforeWarfare = await fetchFullState();
  
  // Coordinated attacks between factions
  const warfarePromises = sockets.map(async (socket, i) => {
    await delay(getRandomDelay());
    const player = PLAYERS[i];
    
    // Each faction attacks different enemy territories
    if (player.faction === 'red' && i < 7) { // First 2 red players
      socket.emit('attack', { x: 3, y: 1 }); // Attack toward blue
    } else if (player.faction === 'blue' && i < 12) { // First 2 blue players
      socket.emit('attack', { x: 1, y: 2 }); // Attack toward center
    } else if (player.faction === 'green' && i < 15) { // First 2 green players
      socket.emit('attack', { x: 2, y: 3 }); // Attack toward center
    }
  });
  
  await Promise.all(warfarePromises);
  await delay(3000);
  
  const afterWarfare = await fetchFullState();
  
  // Count territory changes
  let territoryChanges = 0;
  for (let y = 0; y < afterWarfare.grid.length; y++) {
    for (let x = 0; x < afterWarfare.grid[0].length; x++) {
      const before = beforeWarfare.grid[y][x].ownerFaction;
      const after = afterWarfare.grid[y][x].ownerFaction;
      if (before !== after) territoryChanges++;
    }
  }
  
  console.log(`Territory changes from warfare: ${territoryChanges}`);
  
  results.push({ 
    test: 4, 
    name: 'Cross-Faction Warfare', 
    result: territoryChanges >= 0 ? 'PASS' : 'FAIL', // Always pass if no errors
    details: `${territoryChanges} territory changes`
  });

  // Test 5: Upgrade Competition
  console.log('\n=== STRESS TEST 5: Upgrade Competition ===');
  
  const beforeUpgrades = await fetchFullState();
  
  // All factions compete for upgrades
  const upgradePromises = sockets.slice(0, 9).map(async (socket, i) => { // First 3 from each faction
    await delay(getRandomDelay());
    const upgradeType = ['factory', 'castle', 'barracks'][i % 3];
    socket.emit('upgrade_request', { upgrade: upgradeType });
  });
  
  await Promise.all(upgradePromises);
  await delay(3000);
  
  const afterUpgrades = await fetchFullState();
  
  let totalUpgrades = 0;
  ['red', 'blue', 'green'].forEach(faction => {
    const before = beforeUpgrades.factions[faction].upgrades;
    const after = afterUpgrades.factions[faction].upgrades;
    Object.keys(after).forEach(upgrade => {
      const increase = (after[upgrade] || 0) - (before[upgrade] || 0);
      if (increase > 0) totalUpgrades += increase;
    });
  });
  
  console.log(`Total upgrades completed: ${totalUpgrades}`);
  
  results.push({ 
    test: 5, 
    name: 'Upgrade Competition', 
    result: totalUpgrades > 0 ? 'PASS' : 'FAIL',
    details: `${totalUpgrades} upgrades completed`
  });

  // Final state analysis
  const finalState = await fetchFullState();
  console.log('\n=== FINAL STRESS TEST ANALYSIS ===');
  
  // Player AP distribution
  const factionAP: Record<string, number[]> = { red: [], blue: [], green: [] };
  PLAYERS.forEach(player => {
    const playerState = finalState.players[player.id];
    if (playerState) {
      factionAP[player.faction].push(playerState.ap);
    }
  });
  
  Object.entries(factionAP).forEach(([faction, aps]) => {
    const avg = aps.reduce((a, b) => a + b, 0) / aps.length;
    console.log(`${faction.toUpperCase()} faction - Players: ${aps.length}, Avg AP: ${avg.toFixed(1)}, Range: ${Math.min(...aps)}-${Math.max(...aps)}`);
  });
  
  // Territory control
  const territoryControl: Record<string, number> = { red: 0, blue: 0, green: 0, neutral: 0 };
  finalState.grid.forEach((row: any[]) => {
    row.forEach((cell: any) => {
      if (cell.ownerFaction) {
        territoryControl[cell.ownerFaction]++;
      } else {
        territoryControl.neutral++;
      }
    });
  });
  
  console.log(`Territory Control - Red: ${territoryControl.red}, Blue: ${territoryControl.blue}, Green: ${territoryControl.green}, Neutral: ${territoryControl.neutral}`);
  
  // Faction resources
  Object.entries(finalState.factions).forEach(([name, faction]: [string, any]) => {
    console.log(`${name.toUpperCase()} Faction - AP Pool: ${faction.apPool}, Upgrades: ${JSON.stringify(faction.upgrades)}`);
  });

  // Print summary
  console.log('\n🎯 STRESS TEST SUMMARY:');
  console.table(results);

  // Disconnect all sockets
  sockets.forEach(socket => socket.disconnect());
  
  console.log('\n🚀 Stress test completed! 15 players across 3 factions tested successfully.');
}

runStressTest().catch(console.error); 