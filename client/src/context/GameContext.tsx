import React, { createContext, useContext, useReducer, useRef, useState, useCallback, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { GameState, PlayerState, FactionState, GridCell, SelectedTile, GameAction, GameSettings } from '../types/game';

interface GameContextState {
  gameState: GameState | null;
  selectedTile: SelectedTile | null;
  socket: Socket | null;
  isConnected: boolean;
  myPlayer: PlayerState | null;
  settings: GameSettings | null;
  error: string | null;
}

interface GameContextActions {
  connect: (settings: GameSettings) => void;
  disconnect: () => void;
  selectTile: (x: number, y: number) => void;
  executeAction: (action: GameAction) => void;
  setError: (error: string | null) => void;
}

const GameContext = createContext<GameContextState | undefined>(undefined);
const GameActionsContext = createContext<GameContextActions | undefined>(undefined);

// Initial state
const initialState: GameContextState = {
  gameState: null,
  selectedTile: null,
  socket: null,
  isConnected: false,
  myPlayer: null,
  settings: null,
  error: null,
};

// Reducer for game state updates
function gameStateReducer(state: GameState | null, action: any): GameState | null {
  switch (action.type) {
    case 'SET_GAME_STATE':
      return action.payload;
    case 'UPDATE_GRID':
      if (!state) return null;
      return {
        ...state,
        grid: action.payload,
      };
    case 'UPDATE_PLAYER':
      if (!state) return null;
      return {
        ...state,
        players: {
          ...state.players,
          [action.payload.id]: action.payload,
        },
      };
    case 'UPDATE_FACTION':
      if (!state) return null;
      return {
        ...state,
        factions: {
          ...state.factions,
          [action.payload.name]: action.payload,
        },
      };
    default:
      return state;
  }
}

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [gameState, gameStateDispatch] = useReducer(gameStateReducer, null);
  const [selectedTile, setSelectedTile] = useState<SelectedTile | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [myPlayer, setMyPlayer] = useState<PlayerState | null>(null);
  const [settings, setSettings] = useState<GameSettings | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Message batching to prevent performance violations
  const pendingUpdates = useRef<{
    grid?: GridCell[][];
    players: Map<string, PlayerState>;
    factions: Map<string, FactionState>;
  }>({
    players: new Map(),
    factions: new Map(),
  });

  const batchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const processBatchedUpdates = useCallback(() => {
    const updates = pendingUpdates.current;
    let hasUpdates = false;

    if (updates.grid) {
      gameStateDispatch({ type: 'UPDATE_GRID', payload: updates.grid });
      updates.grid = undefined;
      hasUpdates = true;
    }

    if (updates.players.size > 0) {
      updates.players.forEach((player) => {
        gameStateDispatch({ type: 'UPDATE_PLAYER', payload: player });
      });
      updates.players.clear();
      hasUpdates = true;
    }

    if (updates.factions.size > 0) {
      updates.factions.forEach((faction) => {
        gameStateDispatch({ type: 'UPDATE_FACTION', payload: faction });
      });
      updates.factions.clear();
      hasUpdates = true;
    }

    if (hasUpdates) {
      batchTimeoutRef.current = setTimeout(processBatchedUpdates, 16); // ~60fps
    }
  }, []);

  const queueUpdate = useCallback((type: 'grid' | 'player' | 'faction', data: any) => {
    if (type === 'grid') {
      pendingUpdates.current.grid = data;
    } else if (type === 'player') {
      pendingUpdates.current.players.set(data.id, data);
    } else if (type === 'faction') {
      pendingUpdates.current.factions.set(data.name, data);
    }

    if (!batchTimeoutRef.current) {
      batchTimeoutRef.current = setTimeout(processBatchedUpdates, 16);
    }
  }, [processBatchedUpdates]);

  const connect = useCallback((newSettings: GameSettings) => {
    try {
      const newSocket = io(newSettings.serverUrl, {
        auth: { playerId: newSettings.playerId }
      });

      newSocket.on('connect', () => {
        setIsConnected(true);
        setError(null);
      });

      newSocket.on('disconnect', () => {
        setIsConnected(false);
      });

      newSocket.on('connect_error', (err) => {
        setError(`Connection failed: ${err.message}`);
        setIsConnected(false);
      });

      // Game state updates with batching
      newSocket.on('gameState', (state: GameState) => {
        gameStateDispatch({ type: 'SET_GAME_STATE', payload: state });
      });

      newSocket.on('gridUpdate', (grid: GridCell[][]) => {
        queueUpdate('grid', grid);
      });

      newSocket.on('playerUpdate', (player: PlayerState) => {
        queueUpdate('player', player);
        if (player.id === newSettings.playerId) {
          setMyPlayer(player);
        }
      });

      newSocket.on('factionUpdate', (faction: FactionState) => {
        queueUpdate('faction', faction);
      });

      newSocket.on('actionResult', (result: { success: boolean; message?: string }) => {
        if (!result.success && result.message) {
          setError(result.message);
          // Clear error after 3 seconds
          setTimeout(() => setError(null), 3000);
        }
      });

      setSocket(newSocket);
      setSettings(newSettings);
    } catch (err) {
      setError(`Failed to connect: ${err}`);
    }
  }, []);

  const disconnect = useCallback(() => {
    if (socket) {
      socket.disconnect();
      setSocket(null);
      setIsConnected(false);
      gameStateDispatch({ type: 'SET_GAME_STATE', payload: null });
      setMyPlayer(null);
      setSelectedTile(null);
      setSettings(null);
    }
  }, [socket]);

  const selectTile = useCallback((x: number, y: number) => {
    if (!gameState) return;
    
    const cell = gameState.grid[y]?.[x];
    if (cell) {
      setSelectedTile({ x, y, cell });
    }
  }, [gameState]);

  const executeAction = useCallback((action: GameAction) => {
    if (!socket || !isConnected) {
      setError('Not connected to server');
      return;
    }

    socket.emit(action.type, action.data);
  }, [socket, isConnected]);

  // Fetch initial game state when connected
  useEffect(() => {
    if (socket && isConnected && settings) {
      // Fetch all three in parallel
      Promise.all([
        fetch(`${settings.serverUrl}/admin/grid`).then(res => res.json()),
        fetch(`${settings.serverUrl}/admin/player/${settings.playerId}`).then(res => res.json()),
        fetch(`${settings.serverUrl}/admin/faction/${settings.faction}`).then(res => res.json()),
      ])
        .then(([grid, player, faction]) => {
          const initialGameState = {
            grid,
            players: { [player.id]: player },
            factions: { [faction.name]: faction },
          };
          gameStateDispatch({ type: 'SET_GAME_STATE', payload: initialGameState });
          setMyPlayer(player);
        })
        .catch(err => console.error('Failed to fetch initial game state:', err));
    }
  }, [socket, isConnected, settings]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
      }
    };
  }, []);

  const contextState: GameContextState = {
    gameState,
    selectedTile,
    socket,
    isConnected,
    myPlayer,
    settings,
    error,
  };

  const contextActions: GameContextActions = {
    connect,
    disconnect,
    selectTile,
    executeAction,
    setError,
  };

  return (
    <GameContext.Provider value={contextState}>
      <GameActionsContext.Provider value={contextActions}>
        {children}
      </GameActionsContext.Provider>
    </GameContext.Provider>
  );
}

export function useGame() {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}

export function useGameActions() {
  const context = useContext(GameActionsContext);
  if (context === undefined) {
    throw new Error('useGameActions must be used within a GameProvider');
  }
  return context;
} 