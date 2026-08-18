import { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import { Outlet, useNavigate } from 'react-router-dom';

const LinkTab = (props) => {
    const navigate = useNavigate();
    return (
      <Tab
        component="a"
        onClick={(event) => {
          event.preventDefault();
          navigate(props.href);
        }}
        {...props}
      />
    );
};

const HeaderSection = ({ tabs, darkMode, handleDarkModeToggle }) => {
    const [value, setValue] = useState(0);
    const handleChange = useCallback((event, newValue) => {
      setValue(newValue);
    }, []);
    
    return (
        <>
        <AppBar
            component="div"
            color="primary"
            position="static"
            elevation={0}
            sx={{ zIndex: 0 }}
        >
            <Toolbar>
            <Grid container alignItems="center" spacing={1}>
                <Grid item xs>
                    <Typography color="inherit" variant="h5" component="h1">
                        {tabs.sectionName}
                    </Typography>
                </Grid>
                <Grid item sx={{ display: 'flex', alignItems: 'center' }}>
                    <FormControlLabel
                        control={<Switch checked={darkMode} onChange={handleDarkModeToggle} color="secondary" />}
                        label="Dark Mode"
                    />
                </Grid>
            </Grid>
            </Toolbar>
        </AppBar>
        <AppBar component="div" position="static" elevation={0} sx={{ zIndex: 0 }}>
            <Tabs value={value} onChange={handleChange} textColor="inherit">
            {tabs.sectionTabs.map(({ id, name, path }) => (
                <LinkTab key={id} label={name} href={path} />
            ))}
            </Tabs>
        </AppBar>
        <Box component="main" sx={{ 
            flex: 1, 
            py: 3, 
            px: 3,
            display: 'flex',            // added for vertical centering
            flexDirection: 'column',     // added for vertical centering
            justifyContent: 'center',    // added for vertical centering
            bgcolor: darkMode ? '#000' : '#171717' // reflects dark mode 
        }}>
            <Outlet />
        </Box>
        </>
    );
};

export default HeaderSection;

LinkTab.propTypes = {
  href: PropTypes.string,
  label: PropTypes.string,
};

HeaderSection.propTypes = {
  tabs: PropTypes.shape({
    sectionName: PropTypes.string,
    sectionTabs: PropTypes.arrayOf(PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      name: PropTypes.string,
      path: PropTypes.string,
    })),
  }).isRequired,
  darkMode: PropTypes.bool,
  handleDarkModeToggle: PropTypes.func,
};
