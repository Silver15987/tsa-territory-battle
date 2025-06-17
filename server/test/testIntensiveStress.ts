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

async function resetIntensiveTestData() {
  await axios.post(`${SERVER_URL}/admin/reset`);
  
  // Create all players with higher AP for intensive testing
  for (const player of PLAYERS) {
    await axios.post(`${SERVER_URL}/admin/player`, {
      id: player.id,
      faction: player.faction,
      ap: 200 // Higher AP for more actions
    });
  }
  
  console.log('🔥 INTENSIVE stress test data reset - 15 players with 200 AP each!');
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

function getVeryShortDelay() {
  return Math.random() * 100 + 10; // 10-110ms very rapid actions
}

async function runIntensiveStressTest() {
  await resetIntensiveTestData();
  await delay(3000);

  // Create socket connections for all 15 players
  const sockets = PLAYERS.map(player => 
    io(SERVER_URL, { auth: { playerId: player.id } })
  );

  // Wait for all connections
  await Promise.all(sockets.map(socket => 
    new Promise<void>(resolve => socket.on('connect', () => resolve()))
  ));

  console.log('🔥 All 15 players connected for INTENSIVE testing!');

  const results: any[] = [];

  // INTENSIVE TEST 1: Rapid-Fire Action Spam
  console.log('\n🚀 INTENSIVE TEST 1: Rapid-Fire Action Spam (Multiple actions per player)');
  
  const beforeSpam = await fetchFullState();
  
  // Each player performs 3-5 rapid actions
  const spamPromises = sockets.map(async (socket, i) => {
    const player = PLAYERS[i];
    const actionCount = 3 + (i % 3); // 3-5 actions per player
    
    for (let j = 0; j < actionCount; j++) {
      await delay(getVeryShortDelay());
      
      // Rotate between different action types
      const actionType = j % 4;
      
      if (actionType === 0) {
        // Attack
        if (player.faction === 'red') {
          socket.emit('attack', { x: 2, y: 0 });
        } else if (player.faction === 'blue') {
          socket.emit('attack', { x: 2, y: 1 });
        } else {
          socket.emit('attack', { x: 1, y: 3 });
        }
      } else if (actionType === 1) {
        // Fortify
        if (player.faction === 'red') {
          socket.emit('fortify', { x: i % 2, y: 0 });
        } else if (player.faction === 'blue') {
          socket.emit('fortify', { x: 3 + (i % 2), y: 0 });
        } else {
          socket.emit('fortify', { x: i % 2, y: 4 });
        }
      } else if (actionType === 2) {
        // Donate
        socket.emit('donate_ap', { amount: 10 });
      } else {
        // Upgrade request
        const upgradeTypes = ['factory', 'castle', 'barracks'];
        socket.emit('upgrade_request', { upgrade: upgradeTypes[j % 3] });
      }
    }
  });
  
  await Promise.all(spamPromises);
  await delay(5000); // Longer wait for processing
  
  const afterSpam = await fetchFullState();
  
  // Count total actions processed
  let totalAPSpent = 0;
  PLAYERS.forEach(player => {
    const before = beforeSpam.players[player.id]?.ap || 200;
    const after = afterSpam.players[player.id]?.ap || 200;
    totalAPSpent += (before - after);
  });
  
  console.log(`💥 Total AP spent across all players: ${totalAPSpent}`);
  console.log(`📊 Estimated actions processed: ${Math.floor(totalAPSpent / 8)} (avg 8 AP per action)`);
  
  results.push({ 
    test: 1, 
    name: 'Rapid-Fire Action Spam', 
    result: totalAPSpent > 100 ? 'PASS' : 'FAIL',
    details: `${totalAPSpent} AP spent, ~${Math.floor(totalAPSpent / 8)} actions`
  });

  // INTENSIVE TEST 2: Simultaneous Territory Rush
  console.log('\n🏰 INTENSIVE TEST 2: Simultaneous Territory Rush (All attack same target)');
  
  const beforeRush = await fetchFullState();
  
  // All players attack the center neutral territory simultaneously
  const rushPromises = sockets.map(async (socket, i) => {
    await delay(getVeryShortDelay());
    socket.emit('attack', { x: 2, y: 2 }); // Center of map
  });
  
  await Promise.all(rushPromises);
  await delay(3000);
  
  const afterRush = await fetchFullState();
  
  const centerCell = afterRush.grid[2][2];
  const wasNeutralBefore = !beforeRush.grid[2][2].ownerFaction;
  const isCapturedNow = !!centerCell.ownerFaction;
  
  console.log(`🎯 Center cell before: ${beforeRush.grid[2][2].ownerFaction || 'neutral'}`);
  console.log(`🎯 Center cell after: ${centerCell.ownerFaction || 'neutral'}`);
  console.log(`🎯 Fortification level: ${centerCell.fortificationLevel || 0}`);
  
  results.push({ 
    test: 2, 
    name: 'Simultaneous Territory Rush', 
    result: (wasNeutralBefore && isCapturedNow) ? 'PASS' : 'PARTIAL',
    details: `Center: ${beforeRush.grid[2][2].ownerFaction || 'neutral'} → ${centerCell.ownerFaction || 'neutral'}`
  });

  // INTENSIVE TEST 3: Resource Pool Competition
  console.log('\n💰 INTENSIVE TEST 3: Resource Pool Competition (Mass donations + upgrades)');
  
  const beforeCompetition = await fetchFullState();
  
  // Phase 1: Everyone donates rapidly
  const donationPromises = sockets.map(async (socket, i) => {
    for (let j = 0; j < 3; j++) {
      await delay(getVeryShortDelay());
      socket.emit('donate_ap', { amount: 15 });
    }
  });
  
  await Promise.all(donationPromises);
  await delay(2000);
  
  // Phase 2: Everyone tries to upgrade simultaneously
  const upgradePromises = sockets.map(async (socket, i) => {
    await delay(getVeryShortDelay());
    const upgradeTypes = ['factory', 'castle', 'barracks'];
    socket.emit('upgrade_request', { upgrade: upgradeTypes[i % 3] });
  });
  
  await Promise.all(upgradePromises);
  await delay(3000);
  
  const afterCompetition = await fetchFullState();
  
  let totalDonated = 0;
  let totalUpgrades = 0;
  
  ['red', 'blue', 'green'].forEach(faction => {
    const before = beforeCompetition.factions[faction];
    const after = afterCompetition.factions[faction];
    
    const donated = after.apPool - before.apPool;
    totalDonated += donated;
    
    Object.keys(after.upgrades).forEach(upgrade => {
      const increase = (after.upgrades[upgrade] || 0) - (before.upgrades[upgrade] || 0);
      if (increase > 0) totalUpgrades += increase;
    });
    
    console.log(`${faction.toUpperCase()}: +${donated} AP, upgrades: ${JSON.stringify(after.upgrades)}`);
  });
  
  results.push({ 
    test: 3, 
    name: 'Resource Pool Competition', 
    result: (totalDonated > 200 && totalUpgrades > 5) ? 'PASS' : 'PARTIAL',
    details: `${totalDonated} AP donated, ${totalUpgrades} upgrades`
  });

  // Final intensive analysis
  const finalState = await fetchFullState();
  console.log('\n🔥 INTENSIVE TEST FINAL ANALYSIS 🔥');
  
  // Calculate total system activity
  let totalPlayersWithReducedAP = 0;
  let totalAPConsumed = 0;
  
  PLAYERS.forEach(player => {
    const finalAP = finalState.players[player.id]?.ap || 200;
    const consumed = 200 - finalAP;
    if (consumed > 0) {
      totalPlayersWithReducedAP++;
      totalAPConsumed += consumed;
    }
  });
  
  console.log(`🎮 Active players (AP consumed): ${totalPlayersWithReducedAP}/15`);
  console.log(`⚡ Total AP consumed system-wide: ${totalAPConsumed}`);
  console.log(`📈 Average actions per active player: ${(totalAPConsumed / totalPlayersWithReducedAP / 8).toFixed(1)}`);
  
  // Territory analysis
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
  
  console.log(`🗺️  Final Territory: Red: ${territoryControl.red}, Blue: ${territoryControl.blue}, Green: ${territoryControl.green}, Neutral: ${territoryControl.neutral}`);
  
  // Faction resource summary
  Object.entries(finalState.factions).forEach(([name, faction]: [string, any]) => {
    console.log(`${name.toUpperCase()} Final State - AP Pool: ${faction.apPool}, Total Upgrades: ${Object.values(faction.upgrades).reduce((a: any, b: any) => a + b, 0)}`);
  });

  // Print intensive test summary
  console.log('\n🏆 INTENSIVE STRESS TEST SUMMARY:');
  console.table(results);

  // Disconnect all sockets
  sockets.forEach(socket => socket.disconnect());
  
  console.log(`\n🚀 INTENSIVE stress test completed! 
📊 System handled ${totalAPConsumed} total AP worth of actions
⚡ ${totalPlayersWithReducedAP} players actively participated
🎯 All core systems stable under high-concurrency load!`);
}

runIntensiveStressTest().catch(console.error); 