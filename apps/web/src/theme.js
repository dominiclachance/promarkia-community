import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  typography: {
    h6: {
      fontSize: '1.25rem', // Header text size
    },
    subtitle1: {
      fontSize: '1rem', // Section header text
    },
    body1: {
      fontSize: '0.875rem', // Squad list items
    },
    body2: {
      fontSize: '0.75rem', // For credits and smaller text
    },
  },
  palette: {
    primary: {
      main: '#1976d2', // Adjust your primary color here
    },
    // ...other palette settings...
  },
  // ...other theme customizations...
});

export default theme;
