const { redisClient } = require('./dist/redisClient');

async function checkFactions() {
  try {
    await redisClient.connect();
    
    console.log('Checking current factions in Redis...');
    
    // Check for faction keys
    const factionKeys = await redisClient.keys('faction:*');
    console.log('Faction keys found:', factionKeys);
    
    // Get data for each faction
    for (const key of factionKeys) {
      const data = await redisClient.hgetall(key);
      console.log(`${key}:`, data);
    }
    
    // Check for users
    const userKeys = await redisClient.keys('users:*');
    console.log('\nUser keys found:', userKeys);
    
    for (const key of userKeys) {
      const data = await redisClient.hgetall(key);
      console.log(`${key}:`, data);
    }
    
    await redisClient.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkFactions(); 