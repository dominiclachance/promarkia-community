import { useState } from 'react';
import PropTypes from 'prop-types';
import { Card, CardContent, Typography, Box, useTheme, Button, Dialog, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

export default function SquadCard({ icon: Icon, title, description, integrations = [], sampleUrl }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  const bgColor = theme.palette.primary.main;
  const textColor = theme.palette.background.default;

  const normalizedIntegrations = integrations.map((item) => {
    if (typeof item === 'object' && item.icon && item.name) {
      return item;
    }
    const name = item.displayName || item.name || 'Integration';
    return { icon: item, name };
  });

  const renderIntegrationIcon = (IntegrationIcon, name) => {
    if (IntegrationIcon.muiName || IntegrationIcon.displayName?.includes('Icon')) {
      return (
        <span
          style={{
            width: 40,
            height: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <IntegrationIcon sx={{ fontSize: 32, color: textColor, width: 32, height: 32 }} aria-label={name} />
        </span>
      );
    }
    return (
      <span
        style={{
          width: 40,
          height: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <IntegrationIcon size={32} color={textColor} aria-label={name} style={{ display: 'block', width: 32, height: 32 }} />
      </span>
    );
  };

  // Always use 75vw/75vh for dialog size
  const dialogWidth = '75vw';
  const dialogHeight = '75vh';

  return (
    <>
      <Card
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          p: 2,
          backgroundColor: bgColor,
          color: textColor,
        }}
      >
        <CardContent
          sx={{
            py: 2,
            flexGrow: 1,
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            backgroundColor: 'transparent',
            color: 'inherit',
          }}
        >
          <Box sx={{ width: 64, height: 64, mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon sx={{ fontSize: 48, color: textColor }} aria-hidden="true" />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1, textAlign: 'left', color: 'inherit' }}>
            {title}
          </Typography>
          <Typography variant="body1" sx={{ textAlign: 'center', color: 'inherit' }}>
            {description}
          </Typography>
          {/* Integrations section */}
          {integrations.length > 0 && (
            <Box sx={{ mt: '20px', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Typography variant="subtitle1" sx={{ mb: 1, color: textColor, fontWeight: 600 }}>
                Integrations
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-evenly',
                  alignItems: 'flex-end',
                  width: '100%',
                  mb: 1,
                  gap: 0,
                }}
              >
                {normalizedIntegrations.map(({ icon: IntegrationIcon, name }, idx) => (
                  <Box
                    key={idx}
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      minWidth: 64,
                      maxWidth: 80,
                      flex: 1,
                    }}
                  >
                    {renderIntegrationIcon(IntegrationIcon, name)}
                    <Typography variant="caption" sx={{ color: textColor, mt: 0.5, fontSize: '0.75rem', textAlign: 'center', width: '100%' }}>
                      {name}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          )}
          {/* View Sample Result button */}
          {sampleUrl && sampleUrl.trim() && (
            <Button
              variant="contained"
              sx={{
                mt: 2,
                alignSelf: 'center',
                backgroundColor: theme.palette.background.default,
                color: theme.palette.primary.main,
                '&:hover': {
                  backgroundColor: theme.palette.background.default,
                  color: theme.palette.primary.main,
                },
                borderRadius: '50px',
                fontWeight: 600,
                boxShadow: 'none'
              }}
              onClick={() => setOpen(true)}
            >
              View Sample Result
            </Button>
          )}
        </CardContent>
      </Card>
      {/* Lightbox Dialog */}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        PaperProps={{
          sx: {
            width: dialogWidth,
            height: dialogHeight,
            maxWidth: 'none',
            maxHeight: 'none',
            m: 0,
            borderRadius: 3,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
            justifyContent: 'center',
            backgroundColor: theme.palette.background.paper,
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)', // Center horizontally and vertically
            overflow: 'hidden',
          }
        }}
        scroll="body"
        hideBackdrop={false}
      >
        <IconButton
          aria-label="close"
          onClick={() => setOpen(false)}
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            color: theme.palette.grey[500],
            zIndex: 1
          }}
        >
          <CloseIcon />
        </IconButton>
        <Box
          sx={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 0,
            m: 0,
            overflow: 'hidden',
          }}
        >
          {/* If sampleUrl is an image, show image; otherwise, use iframe */}
          {/\.(jpg|jpeg|png|webp|gif)$/i.test(sampleUrl) ? (
            <img
              src={sampleUrl}
              alt="Sample Result"
              style={{
                width: 'auto',
                height: '90%',
                maxWidth: '100%',
                objectFit: 'cover',
                borderRadius: 8,
                display: 'block'
              }}
            />
          ) : (
            <iframe
              src={sampleUrl}
              title="Sample Result"
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                borderRadius: 8,
                display: 'block',
                overflow: 'hidden'
              }}
              allowFullScreen
            />
          )}
        </Box>
      </Dialog>
    </>
  );
}

SquadCard.propTypes = {
  icon: PropTypes.elementType,
  title: PropTypes.string,
  description: PropTypes.string,
  integrations: PropTypes.array,
  sampleUrl: PropTypes.string,
};
