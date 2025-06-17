import React, { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { Box, Paper, Typography, IconButton, Tooltip } from '@mui/material';
import { ZoomIn, ZoomOut, CenterFocusStrong } from '@mui/icons-material';
import { useGame, useGameActions } from '../context/GameContext';
import { FACTION_COLORS } from '../types/game';
import GameTile from './GameTile';
import ActionPanel from './ActionPanel';

interface GameBoardProps {
  width?: number;
  height?: number;
}

const GameBoard = React.memo(function GameBoard({ width = 800, height = 600 }: GameBoardProps) {
  const { gameState, selectedTile, myPlayer } = useGame();
  const { selectTile } = useGameActions();
  
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const boardRef = useRef<HTMLDivElement>(null);
  
  const tileSize = 40; // Base tile size in pixels
  const scaledTileSize = tileSize * zoom;

  // Calculate board dimensions
  const boardWidth = useMemo(() => {
    return gameState?.grid[0]?.length ? gameState.grid[0].length * scaledTileSize : 0;
  }, [gameState?.grid, scaledTileSize]);

  const boardHeight = useMemo(() => {
    return gameState?.grid?.length ? gameState.grid.length * scaledTileSize : 0;
  }, [gameState?.grid, scaledTileSize]);

  // Memoize the grid data to prevent unnecessary re-renders
  const gridData = useMemo(() => {
    if (!gameState?.grid) return [];
    return gameState.grid.flatMap((row, y) =>
      row.map((cell, x) => ({
        cell,
        x,
        y,
        key: `${x}-${y}`,
        isSelected: selectedTile?.x === x && selectedTile?.y === y,
        isOwnedByPlayer: myPlayer?.faction === cell.ownerFaction,
      }))
    );
  }, [gameState?.grid, selectedTile, myPlayer?.faction]);

  // Handle tile click
  const handleTileClick = useCallback((x: number, y: number) => {
    selectTile(x, y);
  }, [selectTile]);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(prev * 1.2, 3.0));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(prev => Math.max(prev / 1.2, 0.3));
  }, []);

  const handleZoomReset = useCallback(() => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  }, []);

  // Pan controls with debouncing
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) { // Left mouse button
      e.preventDefault(); // Prevent text selection
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      e.preventDefault(); // Prevent text selection
      // Use requestAnimationFrame for smooth panning
      requestAnimationFrame(() => {
        setPan({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        });
      });
    }
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    e.preventDefault(); // Prevent text selection
    setIsDragging(false);
  }, []);

  // Memoize keyboard event handler
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    switch (e.key) {
      case '1':
        setZoom(0.5);
        break;
      case '2':
        setZoom(1.0);
        break;
      case '3':
        setZoom(1.5);
        break;
      case 'c':
        setPan({ x: 0, y: 0 });
        break;
      // Add WASD movement for selected tile
      case 'w':
      case 'ArrowUp':
        if (selectedTile && selectedTile.y > 0) {
          selectTile(selectedTile.x, selectedTile.y - 1);
        }
        break;
      case 's':
      case 'ArrowDown':
        if (selectedTile && gameState?.grid && selectedTile.y < gameState.grid.length - 1) {
          selectTile(selectedTile.x, selectedTile.y + 1);
        }
        break;
      case 'a':
      case 'ArrowLeft':
        if (selectedTile && selectedTile.x > 0) {
          selectTile(selectedTile.x - 1, selectedTile.y);
        }
        break;
      case 'd':
      case 'ArrowRight':
        if (selectedTile && gameState?.grid[0] && selectedTile.x < gameState.grid[0].length - 1) {
          selectTile(selectedTile.x + 1, selectedTile.y);
        }
        break;
    }
  }, [selectedTile, gameState?.grid, selectTile]);

  // Keyboard controls
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Memoize control styles
  const controlStyles = useMemo(() => ({
    paper: { p: 1, bgcolor: 'rgba(0,0,0,0.8)' },
    button: { color: 'white' },
  }), []);

  // Memoize board styles
  const boardStyles = useMemo(() => ({
    cursor: isDragging ? 'grabbing' : 'grab',
    bgcolor: '#2d2d2d',
  }), [isDragging]);

  // Memoize transform styles
  const transformStyles = useMemo(() => ({
    transform: `translate(${pan.x}px, ${pan.y}px)`,
    transition: isDragging ? 'none' : 'transform 0.1s ease-out',
  }), [pan.x, pan.y, isDragging]);

  if (!gameState?.grid) {
    return (
      <Box 
        display="flex" 
        alignItems="center" 
        justifyContent="center" 
        height={height}
        bgcolor="background.paper"
      >
        <Typography variant="h6" color="text.secondary">
          Loading game board...
        </Typography>
      </Box>
    );
  }

  return (
    <Box display="flex" height="100vh" bgcolor="#1a1a1a">
      {/* Game Board */}
      <Box flex={1} position="relative" overflow="hidden">
        {/* Controls */}
        <Box 
          position="absolute" 
          top={16} 
          right={16} 
          zIndex={10}
          display="flex"
          flexDirection="column"
          gap={1}
        >
          <Paper elevation={3} sx={controlStyles.paper}>
            <Tooltip title="Zoom In (Key: 3)">
              <IconButton size="small" onClick={handleZoomIn} sx={controlStyles.button}>
                <ZoomIn />
              </IconButton>
            </Tooltip>
            <Tooltip title="Reset View (Key: 2)">
              <IconButton size="small" onClick={handleZoomReset} sx={controlStyles.button}>
                <CenterFocusStrong />
              </IconButton>
            </Tooltip>
            <Tooltip title="Zoom Out (Key: 1)">
              <IconButton size="small" onClick={handleZoomOut} sx={controlStyles.button}>
                <ZoomOut />
              </IconButton>
            </Tooltip>
          </Paper>
          
          {/* Zoom indicator */}
          <Paper elevation={2} sx={controlStyles.paper}>
            <Typography variant="caption" color="white" textAlign="center">
              {Math.round(zoom * 100)}%
            </Typography>
          </Paper>
        </Box>

        {/* Game Grid */}
        <Box
          ref={boardRef}
          width="100%"
          height="100%"
          position="relative"
          overflow="hidden"
          sx={boardStyles}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <Box
            position="absolute"
            sx={transformStyles}
          >
            {gridData.map(({ cell, x, y, key, isSelected, isOwnedByPlayer }) => (
              <GameTile
                key={key}
                cell={cell}
                x={x}
                y={y}
                size={scaledTileSize}
                isSelected={isSelected}
                isOwnedByPlayer={isOwnedByPlayer}
                onClick={() => handleTileClick(x, y)}
              />
            ))}
          </Box>

          {/* Grid lines for better visibility */}
          <svg
            width={boardWidth}
            height={boardHeight}
            style={{
              position: 'absolute',
              top: pan.y,
              left: pan.x,
              pointerEvents: 'none',
              opacity: zoom > 0.8 ? 0.1 : 0,
            }}
          >
            {/* Vertical lines */}
            {gameState.grid[0]?.map((_, x) => (
              <line
                key={`v-${x}`}
                x1={x * scaledTileSize}
                y1={0}
                x2={x * scaledTileSize}
                y2={boardHeight}
                stroke="white"
                strokeWidth={1}
              />
            ))}
            {/* Horizontal lines */}
            {gameState.grid.map((_, y) => (
              <line
                key={`h-${y}`}
                x1={0}
                y1={y * scaledTileSize}
                x2={boardWidth}
                y2={y * scaledTileSize}
                stroke="white"
                strokeWidth={1}
              />
            ))}
          </svg>
        </Box>

        {/* Selected tile indicator */}
        {selectedTile && (
          <Box
            position="absolute"
            left={pan.x + selectedTile.x * scaledTileSize}
            top={pan.y + selectedTile.y * scaledTileSize}
            width={scaledTileSize}
            height={scaledTileSize}
            border="3px solid #fff"
            borderRadius="4px"
            boxShadow="0 0 10px rgba(255,255,255,0.5)"
            sx={{
              pointerEvents: 'none',
              animation: 'pulse 2s infinite',
              '@keyframes pulse': {
                '0%': { opacity: 1 },
                '50%': { opacity: 0.5 },
                '100%': { opacity: 1 },
              },
            }}
          />
        )}
      </Box>

      {/* Action Panel */}
      <ActionPanel />
    </Box>
  );
});

export default GameBoard; 