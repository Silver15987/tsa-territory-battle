import React, { useState, useEffect } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Box, Paper, Typography, Button } from '@mui/material';
import { GameProvider, useGame, useGameActions } from './context/GameContext';
import GameBoard from './components/GameBoard';
import LoginForm from './components/LoginForm';
import { GameSettings } from './types/game';

// Dark theme for the game
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: '#1a1a1a',
      paper: '#2d2d2d',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
});

// Beta Testing Screen Component
function BetaTestingScreen() {
  const handleLogout = () => {
    // Clear any stored session data
    window.location.href = 'http://localhost:4000/auth/logout';
  };

  return (
    <Box
      display="flex"
      alignItems="center"
      justifyContent="center"
      minHeight="100vh"
      bgcolor="#1a1a1a"
      p={2}
    >
      <Paper
        elevation={8}
        sx={{
          p: 4,
          maxWidth: 500,
          width: '100%',
          bgcolor: '#2d2d2d',
          color: 'white',
          textAlign: 'center',
        }}
      >
        <Typography variant="h3" component="h1" mb={4} color="primary">
          ⚔️ Generals TSA
        </Typography>
        <Typography variant="h5" mb={3} color="text.secondary">
          🚧 Under Beta Testing
        </Typography>
        <Typography variant="body1" mb={4} color="text.secondary">
          Thank you for your interest! This game is currently in beta testing.
          <br />
          Please keep tuned in for the official release!
        </Typography>
        <Typography variant="body2" mb={4} color="text.secondary">
          If you believe you should have access, please contact the game administrators
          or check your Discord server roles.
        </Typography>
        <Button
          variant="outlined"
          onClick={handleLogout}
          sx={{
            color: 'white',
            borderColor: 'rgba(255,255,255,0.3)',
            '&:hover': {
              borderColor: 'white',
            },
          }}
        >
          Try Different Account
        </Button>
      </Paper>
    </Box>
  );
}

function GameApp() {
  const { isConnected, error } = useGame();
  const { connect } = useGameActions();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [user, setUser] = useState<any>(null);
  const [isBetaTesting, setIsBetaTesting] = useState<boolean>(false);

  // Check authentication status on app load
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('http://localhost:4000/auth/me', {
          credentials: 'include', // Important: include cookies
        });
        
        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
          setIsAuthenticated(true);
          setIsBetaTesting(false);
        } else {
          setIsAuthenticated(false);
          setIsBetaTesting(false);
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        setIsAuthenticated(false);
        setIsBetaTesting(false);
      }
    };

    checkAuth();
  }, []);

  // Auto-connect to game server when authenticated
  useEffect(() => {
    if (isAuthenticated && user && !isConnected) {
      const gameSettings: GameSettings = {
        serverUrl: 'http://localhost:4000',
        playerId: user.discordId,
        faction: user.faction
      };
      
      console.log('Auto-connecting with settings:', gameSettings);
      connect(gameSettings);
    }
  }, [isAuthenticated, user, isConnected, connect]);

  const handleConnect = (settings: GameSettings) => {
    connect(settings);
  };

  // Show loading while checking auth
  if (isAuthenticated === null) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        color: 'white',
        fontSize: '1.2rem'
      }}>
        Loading...
      </div>
    );
  }

  // Show beta testing screen if user doesn't have access
  if (isBetaTesting) {
    return <BetaTestingScreen />;
  }

  // Show login if not authenticated
  if (!isAuthenticated) {
    return <LoginForm />;
  }

  // Show game if authenticated but not connected to game server
  if (!isConnected) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        color: 'white',
        fontSize: '1.2rem'
      }}>
        <div>
          <p>Welcome, {user?.username}!</p>
          <p>Connecting to game server...</p>
        </div>
      </div>
    );
  }

  return <GameBoard />;
}

function App() {
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <GameProvider>
        <GameApp />
      </GameProvider>
    </ThemeProvider>
  );
}

export default App;
