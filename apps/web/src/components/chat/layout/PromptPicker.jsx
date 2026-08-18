import PropTypes from 'prop-types';
import { useState, useRef, useEffect, useCallback } from 'react';
import Popper from '@mui/material/Popper';
import Paper from '@mui/material/Paper';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import TextField from '@mui/material/TextField';
import ClickAwayListener from '@mui/material/ClickAwayListener';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useTheme } from '@mui/material';

export default function PromptPicker({
  options = [],
  value = '',
  onChange,
  onSelect,
  placeholder,
  inputRef: parentInputRef,
  onKeyDown,
  waitingForInput = false,
  onInputFocus,
  onDeletePrompt
}) {
  const theme = useTheme();
  const localInputRef = useRef(null);
  // if parent provided a ref (from ChatDialog) use it so focus() works from parent
  const anchorRef = parentInputRef || localInputRef;
  const popperRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value || '');
  const [highlightIndex, setHighlightIndex] = useState(0);

  useEffect(() => setQuery(value || ''), [value]);

  const filtered = query
    ? options.filter(o => {
        const text = typeof o === 'string' ? o : (o.prompt_text || '');
        return text.toLowerCase().includes(query.toLowerCase());
      })
    : options;

  const handleKeyDown = useCallback((e) => {
    if (!open) return;

    if (e.key === 'ArrowDown' && filtered.length > 0) {
      e.preventDefault();
      setHighlightIndex(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp' && filtered.length > 0) {
      e.preventDefault();
      setHighlightIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      if (e.shiftKey) return;

      e.preventDefault();
      if (filtered.length > 0) {
        const safeIndex = Math.min(highlightIndex, filtered.length - 1);
        const item = filtered[safeIndex];
        if (item !== undefined) {
          const text = typeof item === 'string' ? item : (item.prompt_text || '');
          onSelect && onSelect(item);
          onChange && onChange(text);
        }
      }
      setOpen(false);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }, [open, filtered, highlightIndex, onSelect, onChange]);

  const handleBlur = useCallback((e) => {
    if (!open) return;
    const next = e.relatedTarget;
    if (next && (anchorRef.current?.contains(next) || popperRef.current?.contains(next))) return;
    setOpen(false);
  }, [open, anchorRef, popperRef]);

  // --- CHANGED: wrap both input + popper in ClickAwayListener so clicks on the textarea do NOT count as away ---
  return (
    <ClickAwayListener onClickAway={(event) => {
        // ignore clickaway if the click was on the anchor/input itself
        if (anchorRef.current && event && event.target && anchorRef.current.contains(event.target)) return;
        setOpen(false);
      }}>
      <Box sx={{ width: '100%', height: '100%' }}>
        <TextField
         inputRef={anchorRef}
         value={query}
         onChange={(e) => { setQuery(e.target.value); onChange && onChange(e.target.value); setOpen(true); setHighlightIndex(0); }}
         onFocus={(e) => { setOpen(true); onInputFocus && onInputFocus(e); }}
         onClick={(e) => { setOpen(true); onInputFocus && onInputFocus(e); }}
         onKeyDown={(e) => { handleKeyDown(e); onKeyDown && onKeyDown(e); }}
         onBlur={handleBlur}
         placeholder={placeholder}
         variant="standard"
         fullWidth
         multiline
         sx={{
           height: '100%', // Fill the container height (175px from parent)
           '& .MuiInputBase-root': { 
             height: '100%',
             alignItems: 'flex-start' // Ensure text starts at the top
           }, 
           '& .MuiInputBase-inputMultiline': {
             height: '100% !important', // Force textarea to fill the container
             maxHeight: '100% !important',
             boxSizing: 'border-box',
             padding: '10px', 
             overflowY: 'auto !important', // Force vertical scrollbar
             fontSize: '0.8rem',
             paddingLeft: '15px',
             whiteSpace: 'pre-wrap', 
             wordBreak: 'break-word',
             resize: 'none', // Prevent manual resizing
             // Scrollbar styling
             '&::-webkit-scrollbar': {
               width: '6px',
               backgroundColor: 'transparent',
             },
             '&::-webkit-scrollbar-thumb': {
               backgroundColor: theme.palette.divider,
               borderRadius: '10px',
             },
           }
         }}
         InputProps={{
           disableUnderline: true,
           sx: {
             height: '100%', // Ensure the border container fills the height
             padding: 0, 
             borderRadius: 1,
             // IMPORTANT: use a 5px red border on the input box when waitingForInput is true
             border: waitingForInput ? `5px solid ${theme.palette.error.main}` : `1px solid ${theme.palette.divider}`,
             backgroundColor: theme.palette.background.paper,
             boxSizing: 'border-box'
           }
         }}
         inputProps={{ style: { fontSize: '0.8rem', boxSizing: 'border-box' } }} // padding handled via sx above
        />

        <Popper
          ref={popperRef}
          open={open && filtered.length > 0}
          anchorEl={anchorRef.current}
          placement="top-start"
          style={{ zIndex: 13000 }}
          modifiers={[
            { name: 'offset', options: { offset: [0, 2] } }, // lowered ~10px vs previous 12px offset
            { name: 'preventOverflow', options: { padding: 8 } }
          ]}
        >
          <Paper
            elevation={4}
            sx={{
              mb: '8px',
              width: anchorRef.current ? anchorRef.current.clientWidth : 360,
              maxHeight: 320,
              overflow: 'auto',
              bgcolor: theme.palette.background.paper
            }}
          >
            <List dense>
              {filtered.map((opt, idx) => {
                const text = typeof opt === 'string' ? opt : (opt.prompt_text || '');
                const isUserPrompt = typeof opt === 'object' && opt.source === 'user';
                return (
                  <ListItemButton
                    key={idx}
                    selected={idx === highlightIndex}
                    onMouseEnter={() => setHighlightIndex(idx)}
                    onClick={() => {
                      onSelect && onSelect(opt);
                      onChange && onChange(text);
                      setOpen(false);
                      try {
                        if (anchorRef.current) anchorRef.current.focus();
                      } catch (error) {
                        console.debug('PromptPicker focus failed', error);
                      }
                    }}
                    sx={{ display: 'flex', alignItems: 'flex-start' }}
                  >
                    <ListItemText
                      primary={text}
                      secondary={opt.description || ''}
                      primaryTypographyProps={{ noWrap: true, style: { fontSize: '0.8rem' } }}
                      secondaryTypographyProps={{ style: { fontSize: '0.75rem' } }}
                    />
                    {onDeletePrompt && isUserPrompt && (
                      <IconButton
                        edge="end"
                        size="small"
                        onClick={(e) => { e.stopPropagation(); onDeletePrompt(opt); }}
                        sx={{ ml: 1 }}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    )}
                  </ListItemButton>
                );
              })}
            </List>
          </Paper>
        </Popper>
      </Box>
    </ClickAwayListener>
  );
}

PromptPicker.propTypes = {
  placeholder: PropTypes.string,
  inputRef: PropTypes.oneOfType([PropTypes.func, PropTypes.shape({ current: PropTypes.any })]),
  onKeyDown: PropTypes.func,
  waitingForInput: PropTypes.bool,
  onInputFocus: PropTypes.func,
  onDeletePrompt: PropTypes.func,
};

PromptPicker.propTypes = {
  options: PropTypes.array,
  value: PropTypes.string,
  onChange: PropTypes.func,
  onSelect: PropTypes.func,
  placeholder: PropTypes.string,
  inputRef: PropTypes.oneOfType([PropTypes.func, PropTypes.shape({ current: PropTypes.any })]),
  onKeyDown: PropTypes.func,
  waitingForInput: PropTypes.bool,
  onInputFocus: PropTypes.func,
  onDeletePrompt: PropTypes.func,
};
