import React from 'react';
import { Box, Paper, Typography, Button } from '@mui/material';

export default function LoginForm() {
  const handleDiscordLogin = () => {
    window.location.href = process.env.REACT_APP_BACKEND_URL + '/auth/discord';
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
        }}
      >
        <Typography variant="h3" component="h1" textAlign="center" mb={4} color="primary">
          ⚔️ Generals TSA
        </Typography>
        <Typography variant="h6" textAlign="center" mb={4} color="text.secondary">
          Strategic Territory Acquisition
        </Typography>
        <Button
          fullWidth
          variant="contained"
          size="large"
          sx={{
            height: 56,
            fontSize: '1.1rem',
            bgcolor: '#5865F2',
            color: 'white',
            '&:hover': { bgcolor: '#404eed' },
          }}
          onClick={handleDiscordLogin}
        >
          <span role="img" aria-label="discord" style={{ marginRight: 8 }}>💬</span>
          Login with Discord
        </Button>
      </Paper>
    </Box>
  );
} 