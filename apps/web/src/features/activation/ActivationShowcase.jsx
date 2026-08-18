import { Box, Button, Chip, Container, Grid, Paper, Stack, Typography } from '@mui/material';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import LanguageRoundedIcon from '@mui/icons-material/LanguageRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import PropTypes from 'prop-types';
import { alpha, useTheme } from '@mui/material/styles';

const tasks = [
  ['Create a blog post', 'Brand-ready article + SEO brief'],
  ['Create a LinkedIn post', 'Hook options + polished draft'],
  ['Create a Reddit post', 'Community-native, risk-checked draft'],
  ['Find Reddit conversations', 'High-intent opportunities + replies'],
];

export default function ActivationShowcase({ onPreview }) {
  const theme = useTheme();

  return (
    <Box id="how-it-works" sx={{ py: { xs: 7, md: 12 }, borderTop: `1px solid ${theme.palette.divider}`, borderBottom: `1px solid ${theme.palette.divider}` }}>
      <Container maxWidth="xl">
        <Grid container spacing={{ xs: 5, md: 8 }} alignItems="center">
          <Grid item xs={12} md={5}>
            <Chip icon={<AutoAwesomeRoundedIcon />} label="New goal-first experience" sx={{ color: 'primary.main', bgcolor: alpha(theme.palette.primary.main, 0.09), border: `1px solid ${alpha(theme.palette.primary.main, 0.16)}`, fontWeight: 900 }} />
            <Typography component="h2" sx={{ mt: 2.5, fontSize: { xs: '2.35rem', md: '4.4rem' }, lineHeight: 0.98, letterSpacing: '-0.055em', fontWeight: 950 }}>
              From “what now?” to work in motion.
            </Typography>
            <Typography sx={{ mt: 2.5, maxWidth: 590, color: 'text.secondary', lineHeight: 1.8, fontSize: { xs: 16, md: 18 } }}>
              Promarkia now learns your brand, asks only what the task needs, connects the right tools, and shows you the plan before a squad starts.
            </Typography>
            <Stack spacing={1.4} sx={{ mt: 3 }}>
              {[
                [<LanguageRoundedIcon key="website" />, 'Add your website once — reuse the brand brief everywhere'],
                [<AutoAwesomeRoundedIcon key="intake" />, 'AI-assisted questions adapt to the outcome you choose'],
                [<LockRoundedIcon key="approval" />, 'Approve the plan before anything can be published'],
              ].map(([icon, copy]) => <Stack direction="row" spacing={1.3} alignItems="center" key={copy}><Box sx={{ color: 'primary.main', display: 'grid' }}>{icon}</Box><Typography sx={{ fontWeight: 750 }}>{copy}</Typography></Stack>)}
            </Stack>
            {onPreview ? <Button onClick={onPreview} variant="contained" endIcon={<ArrowForwardRoundedIcon />} sx={{ mt: 4, px: 3, py: 1.4, borderRadius: 999, fontWeight: 900 }}>Try the local experience</Button> : null}
          </Grid>

          <Grid item xs={12} md={7}>
            <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, borderRadius: 2, color: 'text.primary', bgcolor: 'background.paper', border: `1px solid ${theme.palette.divider}`, boxShadow: '0 30px 80px rgba(0,0,0,0.25)' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 1, pb: 2.2 }}><Box><Typography sx={{ color: 'primary.main', fontWeight: 900, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase' }}>Your Launchpad</Typography><Typography component="h3" variant="h4" sx={{ color: 'text.primary', fontWeight: 950, letterSpacing: '-0.045em', mt: 0.5 }}>What do you want to do today?</Typography></Box><Chip size="small" label="Brand ready" variant="outlined" sx={{ color: '#c8f7d0', borderColor: '#66bb6a', fontWeight: 700 }} /></Stack>
              <Grid container spacing={1.5}>
                {tasks.map(([title, outcome], index) => (
                  <Grid item xs={12} sm={6} key={title}>
                    <Paper elevation={0} sx={{ p: 2, minHeight: 128, borderRadius: 1.5, border: `1px solid ${theme.palette.divider}`, bgcolor: alpha(theme.palette.primary.main, 0.035), color: 'text.primary' }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start"><Box sx={{ width: 34, height: 34, display: 'grid', placeItems: 'center', borderRadius: 1.2, color: 'primary.main', bgcolor: alpha(theme.palette.primary.main, 0.1), border: `1px solid ${alpha(theme.palette.primary.main, 0.15)}`, fontWeight: 950 }}>{index + 1}</Box><ArrowForwardRoundedIcon sx={{ color: 'text.secondary' }} /></Stack>
                      <Typography sx={{ mt: 2, fontWeight: 900, color: 'text.primary' }}>{title}</Typography>
                      <Typography sx={{ mt: 0.7, color: 'text.secondary', fontSize: 12.5, lineHeight: 1.5 }}>{outcome}</Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} sx={{ mt: 2 }}>
                {['Website understood', 'Tools ready', 'Approval protected'].map((label) => <Chip key={label} icon={<CheckCircleRoundedIcon />} label={label} size="small" sx={{ bgcolor: alpha(theme.palette.primary.main, 0.07), color: 'text.primary' }} />)}
              </Stack>
            </Paper>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}

ActivationShowcase.propTypes = { onPreview: PropTypes.func };
