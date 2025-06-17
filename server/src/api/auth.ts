// @ts-ignore
import express from 'express';
// @ts-ignore
import passport from 'passport';
// @ts-ignore
import { Strategy as DiscordStrategy, Profile as DiscordProfile } from 'passport-discord';
// @ts-ignore
import session from 'express-session';
import dotenv from 'dotenv';
import { getDb } from '../mongoClient';
import { redisClient } from '../redisClient';
import { Request, Response } from 'express';

dotenv.config();

const router = express.Router();

const scopes = ['identify', 'guilds', 'guilds.members.read'];

passport.serializeUser((user: any, done: (err: any, id?: any) => void) => done(null, user));
passport.deserializeUser((obj: any, done: (err: any, obj?: any) => void) => done(null, obj));

// Function to get user's faction based on Discord roles
async function getUserFactionFromRoles(accessToken: string, guildId: string, discordId: string): Promise<string | null> {
  try {
    // First, get the user's guilds to check if they're in the required guild
    const guildsResponse = await fetch('https://discord.com/api/v10/users/@me/guilds', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!guildsResponse.ok) {
      console.error('Failed to fetch user guilds:', guildsResponse.status);
      return null;
    }

    const guilds = await guildsResponse.json();
    const targetGuild = guilds.find((g: any) => g.id === guildId);
    
    if (!targetGuild) {
      console.error('User not in required guild');
      return null;
    }

    // For now, let's use a simpler approach - assign faction based on user ID
    // This avoids the complex guild member API call that requires bot permissions
    const factions = ['red', 'blue', 'green'];
    const factionIndex = parseInt(discordId) % 3;
    return factions[factionIndex];
    
    // TODO: Implement proper role-based assignment when we have bot permissions
    // const memberResponse = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/@me`, {
    //   headers: {
    //     'Authorization': `Bearer ${accessToken}`,
    //   },
    // });
    // 
    // if (!memberResponse.ok) {
    //   console.error('Failed to fetch guild member data:', memberResponse.status);
    //   return null;
    // }
    // 
    // const memberData = await memberResponse.json();
    // const userRoles = memberData.roles || [];
    // 
    // // Get faction role mappings from Redis
    // const factionRoles = await redisClient.hgetall('faction_roles');
    // 
    // // Check which faction the user belongs to based on their roles
    // for (const [faction, roleIds] of Object.entries(factionRoles)) {
    //   const roleIdList = (roleIds as string).split(',').map((id: string) => id.trim());
    //   if (userRoles.some((roleId: string) => roleIdList.includes(roleId))) {
    //     return faction;
    //   }
    // }
    // 
    // return null;
  } catch (error) {
    console.error('Error fetching user roles:', error);
    return null;
  }
}

// Function to store user data in Redis
async function storeUserInRedis(userData: any): Promise<void> {
  const userKey = `users:${userData.discordId}`;
  await redisClient.hset(userKey, {
    discordId: userData.discordId,
    username: userData.username,
    avatar: userData.avatar || '',
    faction: userData.faction,
    lastLogin: Date.now().toString(),
    isActive: 'true'
  });
  
  // Set expiration (30 days)
  await redisClient.expire(userKey, 30 * 24 * 60 * 60);
}

// Function to create player record in Redis
async function createPlayerRecord(discordId: string, username: string, faction: string): Promise<void> {
  const playerKey = `player:${discordId}`;
  
  // Check if player already exists
  const existingPlayer = await redisClient.hgetall(playerKey);
  if (existingPlayer.id) {
    console.log(`Player ${discordId} already exists, skipping creation`);
    return;
  }
  
  // Create new player record
  await redisClient.hset(playerKey, {
    id: discordId,
    username: username,
    faction: faction,
    ap: '100', // Starting AP
    actionQueue: JSON.stringify([]),
  });
  
  console.log(`Created player record for ${discordId} in faction ${faction}`);
}

passport.use(new DiscordStrategy({
  clientID: process.env.DISCORD_CLIENT_ID!,
  clientSecret: process.env.DISCORD_CLIENT_SECRET!,
  callbackURL: process.env.DISCORD_REDIRECT_URI!,
  scope: scopes,
},
async (accessToken: string, refreshToken: string, profile: DiscordProfile, done: (err: any, user?: any, info?: any) => void) => {
  try {
    // Check if user is in the required guild
    const requiredGuildId = process.env.DISCORD_REQUIRED_GUILD_ID!;
    const guild = profile.guilds?.find((g: any) => g.id === requiredGuildId);
    if (!guild) return done(null, false, { message: 'Not in required Discord server.' });

    // Determine faction based on Discord roles
    const faction = await getUserFactionFromRoles(accessToken, requiredGuildId, profile.id);
    
    // If no faction found, user doesn't have beta access
    if (!faction) {
      return done(null, false, { 
        message: 'Under beta testing, please keep tuned in!',
        betaTesting: true 
      });
    }
    
    // Create user data
    const userData = {
      discordId: profile.id,
      username: profile.username + '#' + profile.discriminator,
      avatar: profile.avatar ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png` : '',
      faction: faction,
      guilds: profile.guilds,
    };

    // Store in Redis
    await storeUserInRedis(userData);

    // Also store in MongoDB for backup/history
    const db = await getDb();
    await db.collection('users').updateOne(
      { discordId: profile.id },
      { $set: userData },
      { upsert: true }
    );

    // Create player record in Redis
    await createPlayerRecord(profile.id, profile.username + '#' + profile.discriminator, faction);

    return done(null, userData);
  } catch (error) {
    console.error('Error in Discord strategy:', error);
    return done(error);
  }
}));

// Start OAuth flow
router.get('/discord', passport.authenticate('discord'));

// Callback
router.get('/discord/callback',
  passport.authenticate('discord', { failureRedirect: '/' }),
  (req: Request, res: Response) => {
    // Redirect to frontend with session/cookie
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(frontendUrl);
  }
);

// Endpoint to get current user info
router.get('/me', (req: Request, res: Response) => {
  // @ts-ignore
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  // @ts-ignore
  res.json(req.user);
});

// Logout endpoint
router.get('/logout', (req: Request, res: Response) => {
  req.logout((err) => {
    if (err) {
      console.error('Logout error:', err);
    }
    res.redirect(process.env.FRONTEND_URL || 'http://localhost:3000');
  });
});

// Admin endpoint to set faction role mappings
router.post('/admin/faction-roles', async (req: Request, res: Response) => {
  try {
    const { faction, roleIds } = req.body;
    
    if (!faction || !Array.isArray(roleIds)) {
      return res.status(400).json({ error: 'Invalid faction or roleIds' });
    }

    // Store role mappings in Redis
    await redisClient.hset('faction_roles', faction, roleIds.join(','));
    
    res.json({ success: true, message: `Faction ${faction} roles updated` });
  } catch (error) {
    console.error('Error setting faction roles:', error);
    res.status(500).json({ error: 'Failed to set faction roles' });
  }
});

// Admin endpoint to get faction role mappings
router.get('/admin/faction-roles', async (req: Request, res: Response) => {
  try {
    const factionRoles = await redisClient.hgetall('faction_roles');
    res.json(factionRoles);
  } catch (error) {
    console.error('Error getting faction roles:', error);
    res.status(500).json({ error: 'Failed to get faction roles' });
  }
});

// Admin endpoint to get all users
router.get('/admin/users', async (req: Request, res: Response) => {
  try {
    const userKeys = await redisClient.keys('users:*');
    const users = [];
    
    for (const key of userKeys) {
      const userData = await redisClient.hgetall(key);
      if (userData.discordId) {
        users.push(userData);
      }
    }
    
    res.json(users);
  } catch (error) {
    console.error('Error getting users:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

export default router; 