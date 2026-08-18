import { createTheme } from '@mui/material/styles';

const lightBackgroundDefault = '#251137'; // Branded landing "light mode" background
const darkBackgroundDefault = '#121212'; // Store dark theme background color

// Light Theme
const lightTheme = createTheme({
  components: {
    MuiAppBar: {
      styleOverrides: {
        dense: {
          height: 73,
          minHeight: 73,
        },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        thumb: {
          backgroundColor: '#ffffff !important',
        },
        track: {
          backgroundColor: 'rgba(219,184,255,0.45) !important',
        },
      },
    },
    MuiLink: {
      styleOverrides: {
        root: {
          color: '#dbb8ff',
          textDecoration: 'underline',
          '&:hover': {
            textDecoration: 'underline',
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: ({ theme }) => ({
          border: `1px solid ${theme.palette.divider}`,
        }),
      },
    },
  },
  palette: {
    mode: 'light',
    primary: {
      light: '#e7c9ff',
      main: '#dbb8ff',
      dark: '#c48cff',
      contrastText: '#2b0053',
    },
    secondary: {
      light: '#c48cff',
      main: '#b06cff',
      dark: '#9933ff',
      contrastText: '#ffffff',
    },
    background: {
      default: lightBackgroundDefault,
      paper: '#2c153f',
    },
    text: {
      primary: '#f0dbff',
      secondary: '#cfc2d8',
    },
    divider: 'rgba(255,255,255,0.08)',
  },
  typography: {
    h2: {
      fontWeight: 700,
      fontSize: 32,
      letterSpacing: 0.5,
    },
    h4: {
      fontWeight: 700,
      fontSize: 22,
      letterSpacing: 0.5,
    },
    h5: {
      fontWeight: 700,
      fontSize: 26,
      letterSpacing: 0.5,
    },
    h6: {
      fontSize: '1.25rem',
    },
    subtitle1: {
      fontSize: '1rem',
    },
    body1: {
      fontSize: '0.90rem',
      fontWeight: 500,
    },
    body3: {
      fontSize: '0.75rem',
      fontWeight: 700,
    },
    body2: {
      fontSize: '0.60rem',
    },
  },
  shape: {
    borderRadius: 8,
  },
  mixins: {
    toolbar: {
      minHeight: 48,
    },
  },
});

// Dark Theme
const darkTheme = createTheme({
  components: {
    MuiAppBar: {
      styleOverrides: {
        dense: {
          height: 73,
          minHeight: 73,
        },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        thumb: {
          backgroundColor: '#fff !important',
        },
        track: {
          backgroundColor: '#eee !important',
        },
      },
    },
    MuiLink: {
      styleOverrides: {
        root: {
          color: '#ffffff',
          textDecoration: 'underline',
          '&:hover': {
            textDecoration: 'underline',
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: ({ theme }) => ({
          border: `1px solid ${theme.palette.divider}`,
        }),
      },
    },
  },
  palette: {
    mode: 'dark',
    primary: {
      light: '#63a4ff',
      main: '#fff',
      dark: '#fff',
    },
    secondary: {
      light: '#ff8a65',
      main: '#ff5722',
      dark: '#e64a19',
    },
    background: {
      default: darkBackgroundDefault,
      paper: '#1e1e1e',
    },
    text: {
      primary: '#ffffff',
      secondary: '#bdbdbd',
    },
    divider: '#444', // table borders in dark mode
  },
  typography: {
    h2: {
      fontWeight: 700,
      fontSize: 32,
      letterSpacing: 0.5,
    },
    h4: {
      fontWeight: 700,
      fontSize: 22,
      letterSpacing: 0.5,
    },
    h5: {
      fontWeight: 700,
      fontSize: 26,
      letterSpacing: 0.5,
    },
    h6: {
      fontSize: '1.25rem',
    },
    subtitle1: {
      fontSize: '1rem',
    },
    body1: {
      fontSize: '0.90rem',
      fontWeight: 500,
    },
    body3: {
      fontSize: '0.75rem',
      fontWeight: 700,
    },
    body2: {
      fontSize: '0.60rem',
    },
  },
  shape: {
    borderRadius: 8,
  },
  mixins: {
    toolbar: {
      minHeight: 48,
    },
  },
});

export { lightTheme, darkTheme };
