import React, { useMemo, useCallback } from 'react';
import { Box, Typography } from '@mui/material';
import { GridCell, FACTION_COLORS } from '../types/game';

interface GameTileProps {
  cell: GridCell;
  x: number;
  y: number;
  size: number;
  isSelected: boolean;
  isOwnedByPlayer: boolean;
  onClick: () => void;
}

const GameTile = React.memo(function GameTile({
  cell,
  x,
  y,
  size,
  isSelected,
  isOwnedByPlayer,
  onClick,
}: GameTileProps) {
  // Calculate tile color based on faction
  const backgroundColor = useMemo(() => {
    if (cell.ownerFaction) {
      return FACTION_COLORS[cell.ownerFaction] || FACTION_COLORS.neutral;
    }
    return '#4a4a4a'; // Neutral/empty tile color
  }, [cell.ownerFaction]);

  // Calculate border color and style
  const borderStyle = useMemo(() => {
    if (isSelected) {
      return '3px solid #ffffff';
    }
    if (isOwnedByPlayer) {
      return '2px solid #ffeb3b'; // Gold border for player's tiles
    }
    return '1px solid #666666';
  }, [isSelected, isOwnedByPlayer]);

  // Calculate text color for contrast
  const textColor = useMemo(() => {
    // Use white text for darker backgrounds, black for lighter ones
    const isDark = cell.ownerFaction === 'red' || cell.ownerFaction === 'blue' || !cell.ownerFaction;
    return isDark ? '#ffffff' : '#000000';
  }, [cell.ownerFaction]);

  // Memoize position calculations
  const position = useMemo(() => ({
    left: x * size,
    top: y * size,
  }), [x, y, size]);

  // Memoize fortification indicator size
  const fortificationSize = useMemo(() => 
    Math.min(size * 0.2, 12), [size]
  );

  // Memoize font sizes
  const fontSizes = useMemo(() => ({
    fortification: Math.min(size * 0.15, 10),
    faction: Math.min(size * 0.25, 14),
    coordinate: Math.min(size * 0.1, 8),
  }), [size]);

  // Memoize styles to prevent recreation
  const tileStyles = useMemo(() => ({
    backgroundColor,
    border: borderStyle,
    cursor: 'pointer',
    transition: 'all 0.2s ease-in-out',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    userSelect: 'none',
    '&:hover': {
      brightness: 1.1,
      transform: 'scale(1.02)',
    },
  }), [backgroundColor, borderStyle]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Throttle rapid clicks
    const target = e.currentTarget as HTMLElement;
    if (target.dataset.clicked === 'true') return;
    target.dataset.clicked = 'true';
    setTimeout(() => {
      if (target) {
        target.dataset.clicked = 'false';
      }
    }, 100);
    onClick();
  }, [onClick]);

  return (
    <Box
      position="absolute"
      left={position.left}
      top={position.top}
      width={size}
      height={size}
      sx={tileStyles}
      onClick={handleClick}
    >
      {/* Fortification level indicator */}
      {cell.fortificationLevel > 0 && (
        <Box
          position="absolute"
          top={2}
          right={2}
          sx={{
            width: fortificationSize,
            height: fortificationSize,
            backgroundColor: '#ffc107',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography
            variant="caption"
            sx={{
              fontSize: fontSizes.fortification,
              fontWeight: 'bold',
              color: '#000',
              lineHeight: 1,
            }}
          >
            {cell.fortificationLevel}
          </Typography>
        </Box>
      )}

      {/* Faction indicator */}
      {cell.ownerFaction && (
        <Typography
          variant="caption"
          sx={{
            fontSize: fontSizes.faction,
            fontWeight: 'bold',
            color: textColor,
            textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
            textTransform: 'uppercase',
          }}
        >
          {cell.ownerFaction.charAt(0)}
        </Typography>
      )}

      {/* Coordinate display for debugging (only when zoomed in) */}
      {size > 60 && (
        <Box
          position="absolute"
          bottom={2}
          left={2}
          sx={{
            fontSize: fontSizes.coordinate,
            color: textColor,
            opacity: 0.6,
          }}
        >
          {x},{y}
        </Box>
      )}

      {/* Selection highlight effect */}
      {isSelected && (
        <Box
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          sx={{
            backgroundColor: 'rgba(255,255,255,0.2)',
            pointerEvents: 'none',
            animation: 'selectedPulse 1.5s infinite',
            '@keyframes selectedPulse': {
              '0%': { opacity: 0.2 },
              '50%': { opacity: 0.4 },
              '100%': { opacity: 0.2 },
            },
          }}
        />
      )}

      {/* Ownership highlight for player's tiles */}
      {isOwnedByPlayer && !isSelected && (
        <Box
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          sx={{
            backgroundColor: 'rgba(255,235,59,0.1)',
            pointerEvents: 'none',
          }}
        />
      )}
    </Box>
  );
});

export default GameTile; 