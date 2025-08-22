import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

// Import components (we'll create these next)
// import Dashboard from './pages/Dashboard';
// import Sales from './pages/Sales';
// import Inventory from './pages/Inventory';
// import Analytics from './pages/Analytics';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

// Temporary placeholder component
const Placeholder: React.FC<{ title: string }> = ({ title }) => (
  <div style={{ padding: '20px', textAlign: 'center' }}>
    <h1>{title}</h1>
    <p>Coming soon in Phase 4: Dashboard Development</p>
  </div>
);

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <div className="App">
          <Routes>
            <Route path="/" element={<Placeholder title="Dashboard" />} />
            <Route path="/sales" element={<Placeholder title="Sales" />} />
            <Route path="/inventory" element={<Placeholder title="Inventory" />} />
            <Route path="/analytics" element={<Placeholder title="Analytics" />} />
          </Routes>
        </div>
      </Router>
    </ThemeProvider>
  );
}

export default App;
