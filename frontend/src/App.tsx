import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import DashboardLayout from './components/Layout/DashboardLayout';
import Dashboard from './pages/Dashboard';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
    success: {
      main: '#2e7d32',
    },
    warning: {
      main: '#ed6c02',
    },
    error: {
      main: '#d32f2f',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 600,
    },
    h5: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 8,
  },
});

// Temporary placeholder component for other pages
const Placeholder: React.FC<{ title: string }> = ({ title }) => (
  <div style={{ padding: '20px', textAlign: 'center' }}>
    <h1>{title}</h1>
    <p>Coming soon in M14-M16: {title} Dashboard Development</p>
  </div>
);

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <DashboardLayout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/sales" element={<Placeholder title="Sales" />} />
            <Route path="/inventory" element={<Placeholder title="Inventory" />} />
            <Route path="/analytics" element={<Placeholder title="Analytics" />} />
            <Route path="/reports" element={<Placeholder title="Reports" />} />
            <Route path="/settings" element={<Placeholder title="Settings" />} />
          </Routes>
        </DashboardLayout>
      </Router>
    </ThemeProvider>
  );
}

export default App;
