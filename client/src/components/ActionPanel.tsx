import React, { useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Divider,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Chip,
  LinearProgress,
} from '@mui/material';
import {
  Gavel as Attack,
  Shield,
  Favorite,
  Upgrade,
  Info,
  Person,
  Group,
} from '@mui/icons-material';
import { useGame, useGameActions } from '../context/GameContext';
import { ACTION_COSTS, FACTION_COLORS } from '../types/game';

const ActionPanel = React.memo(function ActionPanel() {
  const { gameState, selectedTile, myPlayer, isConnected, error } = useGame();
  const { executeAction } = useGameActions();
  
  const [donationAmount, setDonationAmount] = useState(10);
  const [upgradeType, setUpgradeType] = useState('factory');

  // Get current player's faction data
  const myFaction = gameState?.factions?.[myPlayer?.faction || ''];

  // Check if selected tile is adjacent to player's territory
  const isAdjacentToPlayerTerritory = useCallback(() => {
    if (!selectedTile || !gameState?.grid || !myPlayer) return false;
    
    const { x, y } = selectedTile;
    const grid = gameState.grid;
    
    // Check all 4 adjacent tiles
    const adjacentPositions = [
      { x: x - 1, y },
      { x: x + 1, y },
      { x, y: y - 1 },
      { x, y: y + 1 },
    ];
    
    return adjacentPositions.some(pos => {
      if (pos.x < 0 || pos.y < 0 || pos.y >= grid.length || pos.x >= grid[0].length) {
        return false;
      }
      return grid[pos.y][pos.x].ownerFaction === myPlayer.faction;
    });
  }, [selectedTile, gameState?.grid, myPlayer]);

  // Action handlers
  const handleAttack = useCallback(() => {
    if (!selectedTile) return;
    executeAction({
      type: 'attack',
      data: { x: selectedTile.x, y: selectedTile.y }
    });
  }, [selectedTile, executeAction]);

  const handleFortify = useCallback(() => {
    if (!selectedTile) return;
    executeAction({
      type: 'fortify',
      data: { x: selectedTile.x, y: selectedTile.y }
    });
  }, [selectedTile, executeAction]);

  const handleDonateAP = useCallback(() => {
    executeAction({
      type: 'donate_ap',
      data: { amount: donationAmount }
    });
  }, [donationAmount, executeAction]);

  const handleUpgrade = useCallback(() => {
    executeAction({
      type: 'upgrade_request',
      data: { upgrade: upgradeType }
    });
  }, [upgradeType, executeAction]);

  // Validation functions
  const canAttack = selectedTile && 
    selectedTile.cell?.ownerFaction !== myPlayer?.faction &&
    isAdjacentToPlayerTerritory() &&
    (myPlayer?.ap || 0) >= ACTION_COSTS.attack;

  const canFortify = selectedTile &&
    selectedTile.cell?.ownerFaction === myPlayer?.faction &&
    (myPlayer?.ap || 0) >= ACTION_COSTS.fortify;

  const canDonate = (myPlayer?.ap || 0) >= donationAmount;

  const canUpgrade = (myFaction?.apPool || 0) >= ACTION_COSTS.upgrade_request;

  return (
    <Box width={320} height="100vh" bgcolor="#1e1e1e" overflow="auto">
      <Paper elevation={3} sx={{ m: 1, p: 2, bgcolor: '#2d2d2d', color: 'white' }}>
        {/* Connection Status */}
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <Box
            width={12}
            height={12}
            borderRadius="50%"
            bgcolor={isConnected ? '#4caf50' : '#f44336'}
          />
          <Typography variant="body2">
            {isConnected ? 'Connected' : 'Disconnected'}
          </Typography>
        </Box>

        {/* Error Display */}
        {error && (
          <Alert severity="error" sx={{ mb: 2, bgcolor: '#5d1a1a' }}>
            {error}
          </Alert>
        )}

        {/* Player Info */}
        {myPlayer && myPlayer.faction && (
          <Box mb={2}>
            <Typography variant="h6" display="flex" alignItems="center" gap={1}>
              <Person />
              {myPlayer.username || myPlayer.id}
            </Typography>
            {myPlayer.avatar && (
              <Box display="flex" alignItems="center" gap={1} mt={1}>
                <img 
                  src={myPlayer.avatar} 
                  alt="Avatar" 
                  style={{ 
                    width: 32, 
                    height: 32, 
                    borderRadius: '50%',
                    border: '2px solid rgba(255,255,255,0.2)'
                  }} 
                />
              </Box>
            )}
            <Box display="flex" alignItems="center" gap={1} mt={1}>
              <Chip
                label={myPlayer.faction.toUpperCase()}
                sx={{
                  bgcolor: FACTION_COLORS[myPlayer.faction],
                  color: 'white',
                  fontWeight: 'bold',
                }}
              />
              <Typography variant="body2">
                AP: {myPlayer.ap || 0}
              </Typography>
            </Box>
            
            {/* AP Bar */}
            <Box mt={1}>
              <Typography variant="caption" color="text.secondary">
                Action Points
              </Typography>
              <LinearProgress
                variant="determinate"
                value={Math.min(((myPlayer.ap || 0) / 200) * 100, 100)}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  bgcolor: 'rgba(255,255,255,0.1)',
                  '& .MuiLinearProgress-bar': {
                    bgcolor: '#4caf50',
                  },
                }}
              />
            </Box>
          </Box>
        )}

        <Divider sx={{ bgcolor: 'rgba(255,255,255,0.1)', my: 2 }} />

        {/* Faction Info */}
        {myFaction && myFaction.name && (
          <Box mb={2}>
            <Typography variant="h6" display="flex" alignItems="center" gap={1}>
              <Group />
              {myFaction.name.toUpperCase()} Faction
            </Typography>
            <Typography variant="body2" color="text.secondary" mt={1}>
              Faction AP Pool: {myFaction.apPool || 0}
            </Typography>
            <Box mt={1}>
              <Typography variant="caption" color="text.secondary">
                Upgrades:
              </Typography>
              <Box display="flex" gap={1} flexWrap="wrap" mt={0.5}>
                {Object.entries(myFaction.upgrades || {}).map(([upgrade, count]) => (
                  <Chip
                    key={upgrade}
                    label={`${upgrade}: ${count}`}
                    size="small"
                    variant="outlined"
                    sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.3)' }}
                  />
                ))}
              </Box>
            </Box>
          </Box>
        )}

        <Divider sx={{ bgcolor: 'rgba(255,255,255,0.1)', my: 2 }} />

        {/* Selected Tile Info */}
        <Box mb={2}>
          <Typography variant="h6" display="flex" alignItems="center" gap={1}>
            <Info />
            Selected Tile
          </Typography>
          {selectedTile ? (
            <Box mt={1}>
              <Typography variant="body2">
                Position: ({selectedTile.x}, {selectedTile.y})
              </Typography>
              <Typography variant="body2">
                Owner: {selectedTile.cell?.ownerFaction || 'None'}
              </Typography>
              <Typography variant="body2">
                Fortification: {selectedTile.cell?.fortificationLevel || 0}
              </Typography>
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary" mt={1}>
              Click a tile to select it
            </Typography>
          )}
        </Box>

        <Divider sx={{ bgcolor: 'rgba(255,255,255,0.1)', my: 2 }} />

        {/* Actions */}
        <Typography variant="h6" mb={2}>Actions</Typography>
        
        {/* Attack */}
        <Button
          fullWidth
          variant="contained"
          startIcon={<Attack />}
          disabled={!canAttack}
          onClick={handleAttack}
          sx={{
            mb: 1,
            bgcolor: '#d32f2f',
            '&:hover': { bgcolor: '#b71c1c' },
            '&:disabled': { bgcolor: 'rgba(255,255,255,0.1)' },
          }}
        >
          Attack (Cost: {ACTION_COSTS.attack} AP)
        </Button>

        {/* Fortify */}
        <Button
          fullWidth
          variant="contained"
          startIcon={<Shield />}
          disabled={!canFortify}
          onClick={handleFortify}
          sx={{
            mb: 2,
            bgcolor: '#1976d2',
            '&:hover': { bgcolor: '#0d47a1' },
            '&:disabled': { bgcolor: 'rgba(255,255,255,0.1)' },
          }}
        >
          Fortify (Cost: {ACTION_COSTS.fortify} AP)
        </Button>

        {/* Donate AP */}
        <Box mb={2}>
          <TextField
            fullWidth
            type="number"
            label="Donation Amount"
            value={donationAmount}
            onChange={(e) => setDonationAmount(Number(e.target.value))}
            inputProps={{ min: 1, max: myPlayer?.ap || 0 }}
            sx={{
              mb: 1,
              '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' },
              '& .MuiOutlinedInput-root': {
                color: 'white',
                '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.5)' },
              },
            }}
          />
          <Button
            fullWidth
            variant="contained"
            startIcon={<Favorite />}
            disabled={!canDonate}
            onClick={handleDonateAP}
            sx={{
              bgcolor: '#388e3c',
              '&:hover': { bgcolor: '#2e7d32' },
              '&:disabled': { bgcolor: 'rgba(255,255,255,0.1)' },
            }}
          >
            Donate to Faction
          </Button>
        </Box>

        {/* Upgrade Request */}
        <Box>
          <FormControl fullWidth sx={{ mb: 1 }}>
            <InputLabel sx={{ color: 'rgba(255,255,255,0.7)' }}>
              Upgrade Type
            </InputLabel>
            <Select
              value={upgradeType}
              onChange={(e) => setUpgradeType(e.target.value)}
              sx={{
                color: 'white',
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'rgba(255,255,255,0.3)',
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'rgba(255,255,255,0.5)',
                },
                '& .MuiSvgIcon-root': { color: 'white' },
              }}
            >
              <MenuItem value="factory">Factory</MenuItem>
              <MenuItem value="castle">Castle</MenuItem>
              <MenuItem value="barracks">Barracks</MenuItem>
            </Select>
          </FormControl>
          <Button
            fullWidth
            variant="contained"
            startIcon={<Upgrade />}
            disabled={!canUpgrade}
            onClick={handleUpgrade}
            sx={{
              bgcolor: '#9c27b0',
              '&:hover': { bgcolor: '#7b1fa2' },
              '&:disabled': { bgcolor: 'rgba(255,255,255,0.1)' },
            }}
          >
            Request Upgrade (Cost: {ACTION_COSTS.upgrade_request} Faction AP)
          </Button>
        </Box>

        {/* Controls Help */}
        <Box mt={3} p={2} bgcolor="rgba(255,255,255,0.05)" borderRadius={1}>
          <Typography variant="caption" color="text.secondary">
            <strong>Controls:</strong><br />
            • WASD/Arrow Keys: Move selection<br />
            • 1/2/3: Zoom levels<br />
            • C: Center view<br />
            • Click & Drag: Pan map
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
});

export default ActionPanel; 