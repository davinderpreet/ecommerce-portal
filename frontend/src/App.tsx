import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import DashboardLayout from './components/Layout/DashboardLayout';
import Dashboard from './pages/Dashboard';
import RealTimeSales from './pages/RealTimeSales';
import M15Dashboard from './pages/M15Dashboard';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
      light: '#42a5f5',
      dark: '#1565c0',
    },
    secondary: {
      main: '#dc004e',
      light: '#ff5983',
      dark: '#9a0036',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 600,
    },
    h5: {
      fontWeight: 500,
    },
    h6: {
      fontWeight: 500,
    },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 500,
        },
      },
    },
  },
});

const App: React.FC = () => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <DashboardLayout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/dashboard" element={<M15Dashboard />} />
            <Route path="/legacy" element={<Dashboard />} />
            <Route path="/sales" element={<RealTimeSales />} />
            <Route path="/inventory" element={<div>Inventory Page - Coming Soon</div>} />
            <Route path="/analytics" element={<div>Analytics Page - Coming Soon</div>} />
            <Route path="/reports" element={<div>Reports Page - Coming Soon</div>} />
            <Route path="/settings" element={<div>Settings Page - Coming Soon</div>} />
          </Routes>
        </DashboardLayout>
      </Router>
    </ThemeProvider>
  );
};

export default App;
