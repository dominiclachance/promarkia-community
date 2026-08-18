import PropTypes from 'prop-types';
import React, { useState, useEffect, useRef, Fragment, useCallback } from 'react';
// import { createRoot } from 'react-dom/client'; // removed — was only used by SweetAlert task modal
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import MicIcon from '@mui/icons-material/Mic';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import CycloneIcon from '@mui/icons-material/Cyclone';
import CircularProgress from '@mui/material/CircularProgress';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import FileUpload from './SingleFileUploader';
import CodeBlock from '../CopyCodeBlock';
import Markdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeLightHighlight from '../../../utils/rehypeLightHighlight';
import rehypeExternalLinks from 'rehype-external-links';
import remarkGfm from 'remark-gfm';
import Swal from 'sweetalert2';
import { doc, updateDoc, getDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import HelpChatbot from './HelpChatbot';
import { useSpeechSynthesis, useSpeechRecognition } from 'react-speech-kit';
import { useBoundStore } from '../../../stores';
import { squads } from '../../../data/squads';
import ScrollButton from './ScrollButton';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import CloseIcon from '@mui/icons-material/Close';
import { auth, db } from '../../../firebase/client';
import { autogenBridgeFetch, getAutogenWebSocketUrl } from '../../../services/autogenBridge';
// import CampaignIcon from '@mui/icons-material/Campaign'; // removed — was only used by SweetAlert task modal
import { Typography, useTheme } from '@mui/material';
import Divider from '@mui/material/Divider'; // Add this import
import { t } from 'i18next'; // NEW IMPORT
import { GlobalStyles } from '@mui/material'; // NEW IMPORT
import i18next from 'i18next'; // read current language to filter prompts
// Local prompt-library service
import { subscribePromptsBySquadAndLang, fetchPromptsBySquadAndLang } from '../../../services/promptsService';
import PromptPicker from './PromptPicker';
import ScheduleTaskDialog from '../../schedule/ScheduleTaskDialog';   // add near other imports
import ScheduleIcon from '@mui/icons-material/Schedule';
import BookmarkAddIcon from '@mui/icons-material/BookmarkAdd';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Alert from '@mui/material/Alert';
import ReplayIcon from '@mui/icons-material/Replay';
import EditIcon from '@mui/icons-material/Edit';
import AgentThinkingCards from './StreamingThinker';
import ArtifactsModal from './ArtifactsModal';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import { getCanonicalUid as resolveCanonicalUid } from '../../../utils/canonicalUid';

// Prompts come from the local prompt-library adapter.



// Canonical local owner identifier.
const getCanonicalUid = (u) => resolveCanonicalUid(u);

// Minimal custom renderer for markdown links.
const ThemedLink = ({ href, children }) => {
  const theme = useTheme();
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: theme.palette.primary.main }}
    >
      {children}
    </a>
  );
};

const customRenderers = {
  img: ({ src, alt }) => (
    <img
      src={src}
      alt={alt || 'Image'}
      style={{
        display: 'block',
        width: '95%', // or "90%" as needed
        maxWidth: '95%',
        alignSelf: 'flex-start',
        height: 'auto',
        borderRadius: '8px',
      }}
    />
  ),
  a: ({ href, children }) => {
    if (isMediaUrl(href, "jpeg|jpg|png|webp")) {
      return (
        <img
          src={href}
          alt={children[0] || 'Image'}
          style={{
            display: 'block',
            width: '95%',
            maxWidth: '95%',
            alignSelf: 'flex-start',
            height: 'auto',
            borderRadius: '8px',
          }}
        />
      );
    }
    if (isVideoUrl(href)) {
      return (
        <video
          controls
          style={{
            display: 'block',
            width: '95%',
            maxWidth: '95%',
            alignSelf: 'flex-start',
            borderRadius: '8px',
          }}
        >
          <source src={href} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      );
    }
    return <ThemedLink href={href}>{children}</ThemedLink>;
  }
};


// Helper to extract a URL from a string if it is wrapped in brackets or quotes.
const parseUrlFromString = (str) => {
  const match = str.match(/https?:\/\/[^\s'"\]]+/);
  return match ? match[0] : null;
};

const isMediaUrl = (url, extensions = "jpeg|jpg|gif|png|webp|mp4") => (
  typeof url === "string" &&
  new RegExp(`\\.(${extensions})(?:[?#].*)?$`, "i").test(url)
);

const isVideoUrl = (url) => isMediaUrl(url, "mp4");

// Add a helper function to centralize media src extraction.
const getMediaSrc = (content) => {
  // returns the content if it's a full URL or already a data URI.
  if (!content) return '';
  if (content.startsWith("data:image") || content.startsWith("http")) return content;
  const extMatch = content.match(/\.(jpeg|jpg|gif|png|webp|mp4)(?:[?#].*)?$/i);
  const ext = extMatch ? extMatch[0].substring(1) : "png";
  return ext === "mp4" ? content : `data:image/${ext};base64,${content}`;
};

const renderPart = (part, index) => {
  let textContent = "";
  let mediaSrc = "";
  if (typeof part === "object") {
    if (part.type === "image") {
      mediaSrc = getMediaSrc(part.content);
    } else if (part.data && typeof part.data === "string") {
      mediaSrc = getMediaSrc(part.data);
    } else if (part.content && typeof part.content === "string") {
      if (isMediaUrl(part.content)) {
        mediaSrc = getMediaSrc(part.content);
      } else {
        textContent = part.content;
      }
    }
  } else if (typeof part === "string") {
    if (part.trim().startsWith("[")) {
      const url = parseUrlFromString(part);
      mediaSrc = url && isMediaUrl(url) ? url : "";
      if (!mediaSrc) textContent = part;
    } else {
      textContent = part;
    }
  }

  if (mediaSrc && isVideoUrl(mediaSrc)) {
    return (
      <div key={index} style={{ marginBottom: "10px" }}>
        <video controls style={{ display: "block", maxWidth: "95%", alignItems: 'flex-start', borderRadius: "8px" }}>
          <source src={mediaSrc} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      </div>
    );
  }

  if (mediaSrc) {
    return (
      <div key={index} style={{ marginBottom: "10px" }}>
        <img
          src={mediaSrc}
          alt="Received content"
          style={{ display: "block", maxWidth: "95%", alignSelf: 'flex-start', height: "auto", borderRadius: "8px" }}
        />
      </div>
    );
  }
  if (textContent) {
    // Strip TERMINATE/PLAN_READY_ON_SCREEN/DOCS_DONE markers from displayed text
    textContent = textContent.replace(/\b(TERMINATE|PLAN_READY_ON_SCREEN|DOCS_DONE)\b/gi, '').trim();
    if (!textContent) return null; // nothing left after stripping
    return (
      <div key={index} style={{ marginBottom: "10px" }}>
        <CodeBlock>
          <Markdown
            components={customRenderers}
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[
              [rehypeRaw],
              [rehypeLightHighlight],
              [rehypeExternalLinks, { target: '_blank', rel: 'noopener noreferrer' }]
            ]}
          >
            {textContent}
          </Markdown>
        </CodeBlock>
      </div>
    );
  }
  return null;
};

// --- Updated FileList component with delete button ---
const FileList = React.memo(({ files, onDeleteFile }) => {
  const theme = useTheme();
  if (files.length === 0) return null;
  const displayFiles = files.slice(-3); // cap display to 3
  const truncateName = (name = "", max = 30) => {
    if (name.length <= max) return name;
    const parts = name.split('.');
    const ext = parts.length > 1 ? '.' + parts.pop() : '';
    const base = parts.join('.') || name;
    return base.slice(0, Math.max(4, max - ext.length - 1)) + '…' + ext;
  };
  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 1,
        width: '100%',
        maxWidth: '100%',
      }}
    >
      {displayFiles.map((file) => (
        <Box
          key={`${file.fileName}-${file.downloadURL}`}
          sx={{
            display: 'flex',
            alignItems: 'center',
            px: 1.5,
            py: 0.5,
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: '8px', // Changed from 20px to 8px
            backgroundColor: theme.palette.action.hover,
          }}
        >
          <InsertDriveFileIcon sx={{ mr: 0.5, fontSize: 18 }} />
          <a
            href={file.downloadURL}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: theme.palette.primary.main, textDecoration: 'none', fontSize: '0.9rem', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            title={file.fileName}
          >
            {truncateName(file.fileName)}
          </a>
          <IconButton onClick={() => onDeleteFile(file)} size="small" sx={{ ml: 0.5 }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      ))}
    </Box>
  );
});
FileList.displayName = 'FileList';

function CustomizedInputBase({ storeuid }) {
  const theme = useTheme();

  const [message, setMessage] = useState('');
  const sendChatMessageAsync = useBoundStore((state) => state.sendChatMessageAsync);
  const cancelCurrentRun = useBoundStore((state) => state.cancelCurrentRun);
  const startNewConversation = useBoundStore((state) => state.startNewConversation);
  const pendingResponse = useBoundStore((state) => state.pendingResponse);
  const cancellationPending = useBoundStore((state) => state.cancellationPending);
  const waitingForInput = useBoundStore((state) => state.waitingForInput);
  const inputPrompt     = useBoundStore((state) => state.inputPrompt);
  const interimTranscript = useBoundStore((state) => state.interimTranscript || ""); // <-- add this
  const selectedModel = useBoundStore((state) => state.selectedModel);
  const setSelectedModel = useBoundStore((state) => state.setSelectedModel);
  const lastError = useBoundStore((state) => state.lastError);
  const clearError = useBoundStore((state) => state.clearError);
  const retryLastMessage = useBoundStore((state) => state.retryLastMessage);
  const squad = sessionStorage.getItem('squad') || '1';
  // current i18next language (fallback to 'en')
  const currentLang = i18next?.language || sessionStorage.getItem('lang') || 'en';

  const [squadPrompts, setSquadPrompts] = useState([]);
  const [savedPrompts, setSavedPrompts] = useState([]);
  const [optionsList, setOptionsList] = useState([]);
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [enhancing, setEnhancing] = useState(false);          // NEW
  const [fileList, setFileList] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem('filecontent')) || [];
    } catch {
      return [];
    }
  });
  const inputRef = useRef(null);

  // Add selector for current chat messages so we can show the latest sender name in Swal
  const chatMessages = useBoundStore((s) => s.chatMessages);
  // Add selector for granular swal messages to catch intermediate agents
  const swal_messages = useBoundStore((s) => s.swal_messages);

  // --- Voice Dictation ---
  const { listen, listening, stop } = useSpeechRecognition({
    onResult: (result) => setMessage(result),
    onError: () => {},
  });

  const toggleVoice = listening ? stop : () => {
    listen({ lang: currentLang });
  };

  // Subscribe to local prompts for the current squad and language.
  useEffect(() => {
    let unsub = null;
    try {
      unsub = subscribePromptsBySquadAndLang(squad, currentLang, (prompts) => {
        const filtered = (prompts || [])
          .filter(p => p.enabled !== false)
          .sort((a, b) => (a.order || 0) - (b.order || 0));
        setSquadPrompts(filtered);
      }, async () => {
        const prompts = await fetchPromptsBySquadAndLang(squad, currentLang);
        const filtered = (prompts || []).filter(p => p.enabled !== false).sort((a,b)=> (a.order||0)-(b.order||0));
        setSquadPrompts(filtered);
      });
    } catch (e) {
      fetchPromptsBySquadAndLang(squad, currentLang)
        .then((prompts) => {
          const filtered = (prompts || []).filter(p => p.enabled !== false).sort((a,b)=> (a.order||0)-(b.order||0));
          setSquadPrompts(filtered);
        })
        .catch(() => setSquadPrompts([]));
    }
    return () => { if (typeof unsub === 'function') unsub(); };
  }, [squad, currentLang]);

  const fetchSavedPrompts = useCallback(async () => {
    if (!storeuid) return;
    try {
      const snap = await getDoc(doc(db, "users", storeuid));
      const raw = snap.exists() ? snap.data()?.savedPrompts || [] : [];
      const normalized = [...raw]
        .filter((p) => typeof p === 'string' && p.trim().length > 0)
        .reverse()
        .map((prompt_text) => ({ prompt_text, description: 'Saved prompt', source: 'user' }));
      setSavedPrompts(normalized);
    } catch (error) {
      console.error("Failed to load saved prompts", error);
    }
  }, [storeuid]);

  useEffect(() => { fetchSavedPrompts(); }, [fetchSavedPrompts]);

  useEffect(() => {
    const dedup = new Map();
    savedPrompts.forEach((item) => {
      if (!item?.prompt_text) return;
      dedup.set(item.prompt_text.trim().toLowerCase(), item);
    });
    squadPrompts.forEach((item) => {
      const normalized = typeof item === 'string'
        ? { prompt_text: item, description: '', source: 'squad' }
        : { ...item, source: 'squad' };
      const key = normalized.prompt_text?.trim().toLowerCase();
      if (!key || dedup.has(key)) return;
      dedup.set(key, normalized);
    });
    setOptionsList(Array.from(dedup.values()));
  }, [savedPrompts, squadPrompts]);

  const handleSavePrompt = useCallback(async () => {
    const trimmed = message.trim();
    if (!trimmed || !storeuid) return;
    const swalTheme = {
      background: theme.palette.background.paper,
      color: theme.palette.text.primary,
      confirmButtonColor: theme.palette.primary.main,
      cancelButtonColor: theme.palette.error.main,
    };
    if (savedPrompts.some((p) => p.prompt_text === trimmed)) {
      Swal.fire({ icon: 'info', title: t('prompt_already_saved'), timer: 1500, showConfirmButton: false, ...swalTheme });
      return;
    }
    setSavingPrompt(true);
    try {
      await updateDoc(doc(db, "users", storeuid), { savedPrompts: arrayUnion(trimmed) });
      setSavedPrompts((prev) => [{ prompt_text: trimmed, description: 'Saved prompt', source: 'user' }, ...prev]);
      Swal.fire({ icon: 'success', title: t('prompt_saved'), timer: 1500, showConfirmButton: false, ...swalTheme });
    } catch (error) {
      console.error("Error saving prompt", error);
      Swal.fire({ icon: 'error', title: t('unable_to_save_prompt'), ...swalTheme });
    } finally {
      setSavingPrompt(false);
    }
  }, [message, storeuid, savedPrompts, theme]);

  const handleDeletePrompt = useCallback(async (item) => {
    const promptText = typeof item === 'string' ? item : item?.prompt_text;
    if (!promptText || !storeuid) return;
    const swalTheme = {
      background: theme.palette.background.paper,
      color: theme.palette.text.primary,
      confirmButtonColor: theme.palette.primary.main,
      cancelButtonColor: theme.palette.error.main,
    };
    try {
      await updateDoc(doc(db, "users", storeuid), { savedPrompts: arrayRemove(promptText) });
      setSavedPrompts((prev) => prev.filter(p => p.prompt_text !== promptText));
      Swal.fire({ icon: 'success', title: t('prompt_deleted'), timer: 1200, showConfirmButton: false, ...swalTheme });
    } catch (error) {
      console.error("Error deleting prompt", error);
      Swal.fire({ icon: 'error', title: t('unable_to_delete_prompt'), ...swalTheme });
    }
  }, [storeuid, theme]);

  const handlePromptFocus = useCallback(() => {
    fetchSavedPrompts();
  }, [fetchSavedPrompts]);

  // Only depend on pendingResponse (no reference to chatMessages)
  useEffect(() => {
    if (!pendingResponse && inputRef.current) {
      inputRef.current.blur();
    }
  }, [pendingResponse]);

  useEffect(() => {
    if (!pendingResponse) {
      Swal.close();
    }
  }, [pendingResponse]);

  // Update Swal with current speaker name
  useEffect(() => {
    if (pendingResponse) {
      const speakerElem = document.getElementById('swal-speaker');
      if (!speakerElem) return;

      // 1. Try granular swal_messages first (captures intermediate "thinking" agents)
      const lastSwal = swal_messages.length > 0 ? swal_messages[swal_messages.length - 1] : null;
      if (lastSwal && lastSwal.sender && lastSwal.sender !== 'user') {
         speakerElem.innerText = t('current_speaker') + ": " + lastSwal.sender.replace(/_/g, ' ').toUpperCase();
         return;
      }

      // 2. Fallback to committed chat messages
      const lastMsg = chatMessages.length > 0 ? chatMessages[chatMessages.length - 1] : null;
      if (lastMsg && lastMsg.msg_from && lastMsg.msg_from !== 'user') {
         speakerElem.innerText = t('current_speaker') + ": " + lastMsg.msg_from.replace(/_/g, ' ').toUpperCase();
      }
    }
  }, [chatMessages, swal_messages, pendingResponse]);

  const handleFileUpload = useCallback(() => {
    try {
      const stored = JSON.parse(sessionStorage.getItem('filecontent') || '[]');
      const capped = stored.slice(-3);
      sessionStorage.setItem('filecontent', JSON.stringify(capped));
      setFileList(capped);
    } catch (e) {
      console.error("Failed to refresh file list after upload", e);
    }
  }, []);

  // helper: recursively find a string-ish content field

  const fetchTeamConfig36 = useCallback(async () => {
    const resp = await autogenBridgeFetch('/teams/36', {
      method: 'GET',
      headers: { accept: 'application/json' },
    });
    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`Fetch team 36 failed: ${resp.status} ${txt}`);
    }
    const json = await resp.json();
    return json?.data?.component ?? json?.component ?? json;
  }, []);

  // --- enhance flow ---
  const runEnhancePrompt = useCallback(async (promptText) => {
    const sessionId = Math.floor(Math.random() * 1_000_000);
    const userEmail = 'guestuser@gmail.com';
    const sessionnameEmail = sessionStorage.getItem('email');

    const sessionResp = await autogenBridgeFetch('/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: sessionId,
        user_id: userEmail,
        version: "0.0.1",
        team_id: 36,
        name: `${sessionnameEmail} - Prompt Enhancer`
      })
    });
    if (!sessionResp.ok) throw new Error(`Session create failed: ${sessionResp.status}`);

    const runResp = await autogenBridgeFetch('/runs', {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, user_id: userEmail })
    });
    if (!runResp.ok) throw new Error(`Run create failed: ${runResp.status}`);
    const runJson = await runResp.json();
    const runId = runJson?.data?.run_id;
    if (!runId) throw new Error('No run_id returned');

    const teamConfig = await fetchTeamConfig36();
    const wsUrl = await getAutogenWebSocketUrl(runId);

    return await new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      let settled = false;
      const done = (val, isErr = false) => {
        if (settled) return;
        settled = true;
        try {
          ws.close();
        } catch (error) {
          // Closing an already-closed socket is harmless.
        }
        isErr ? reject(val) : resolve(val);
      };

      ws.onopen = () => {
        ws.send(JSON.stringify({
          type: "start",
          user_id: userEmail,
          task: `Improve this prompt and respond ONLY with the improved prompt text:\n${promptText}`,
          team_config: teamConfig
        }));
      };

      ws.onerror = (e) => done(e, true);

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          try {
            useBoundStore.getState().addToSwalMessages(data);
          } catch (error) {
            // Activity telemetry must not interrupt the result flow.
          }

          const tryExtractText = () => {
            // 1. Unwrap payload if it's a stringified JSON
            let contentObj = data;
            if (data.payload) {
              if (typeof data.payload === 'string') {
                try { contentObj = JSON.parse(data.payload); } catch (e) { console.warn("Payload parse warning", e); }
              } else if (typeof data.payload === 'object') {
                contentObj = data.payload;
              }
            }

            // Helper to validate message content
            const isValidContent = (c) => c && typeof c === 'string' && c.trim().length > 0;

            // 2. Check for agent_response (streaming/intermediate)
            if (contentObj.agent_response) {
               const msg = contentObj.agent_response.chat_message;
               if (msg && msg.source !== 'user' && isValidContent(msg.content)) {
                 return msg.content;
               }
            }

            // 3. Check for direct message wrapper
            if (contentObj.message) {
               const msg = contentObj.message;
               if (msg && msg.source !== 'user' && isValidContent(msg.content)) {
                 return msg.content;
               }
            }

            // 4. Check for task_result (final)
            if (contentObj.task_result?.messages) {
               const msgs = contentObj.task_result.messages;
               const lastMsg = msgs.slice().reverse().find(m => m.type === 'TextMessage' && m.source !== 'user');
               if (lastMsg && isValidContent(lastMsg.content)) {
                 return lastMsg.content;
               }
            }

            // 5. Fallback: Deep recursive search for enhancement_agent content
            const deepSearch = (obj) => {
                if (!obj || typeof obj !== 'object') return null;
                // Check if this object looks like a message from enhancement_agent
                if ((obj.source === 'enhancement_agent' || obj.source === 'enhancement_agent_') && isValidContent(obj.content)) {
                    return obj.content;
                }
                // Recurse
                for (const key of Object.keys(obj)) {
                    const found = deepSearch(obj[key]);
                    if (found) return found;
                }
                return null;
            };
            
            return deepSearch(contentObj);
          };

          const text = tryExtractText();
          if (text) return done(String(text).trim());
        } catch (err) {
          // Ignore parse errors
        }
      };

      ws.onclose = () => {
        if (!settled) done(new Error('Enhance prompt socket closed before result'), true);
      };

      setTimeout(() => {
        if (!settled) done(new Error('Enhance prompt timed out'), true);
      }, 60000); // Increased timeout to 60s
    });
  }, [fetchTeamConfig36]);

  const enhancePromptHandler = useCallback(async () => {
    const userPrompt = message.trim();
    if (!userPrompt) return;
    setEnhancing(true);
    const swalTheme = {
      background: theme.palette.background.paper,
      color: theme.palette.text.primary,
      confirmButtonColor: theme.palette.primary.main,
      cancelButtonColor: theme.palette.error.main,
    };
    try {
      const improved = await runEnhancePrompt(userPrompt);
      if (improved && typeof improved === 'string') {
        setMessage(improved);
        Swal.fire({ 
          icon: 'success', 
          title: t('enhance_prompt'), 
          timer: 1200, 
          showConfirmButton: false, 
          ...swalTheme 
        });
      } else {
        Swal.fire({ 
          icon: 'error', 
          title: t('unable_to_enhance_prompt'), 
          text: t('no_enhanced_text'), 
          ...swalTheme,
          didOpen: () => {
             const btn = Swal.getConfirmButton();
             if (btn) btn.style.color = '#000000';
          }
        });
      }
    } catch (err) {
      console.error('Enhance prompt failed:', err);
      Swal.fire({ 
        icon: 'error', 
        title: t('unable_to_enhance_prompt'), 
        text: String(err?.message || err), 
        ...swalTheme,
        didOpen: () => {
           const btn = Swal.getConfirmButton();
           if (btn) btn.style.color = '#000000';
        }
      });
    } finally {
      setEnhancing(false);
    }
  }, [message, runEnhancePrompt, theme]);
  
  const clickHandler = useCallback(async () => {
    const trimmed = message.trim();
    if (!trimmed || pendingResponse) return;

    try {
      await sendChatMessageAsync(trimmed);
      setMessage('');
    } catch (err) {
      console.error('send message failed', err);
      Swal.fire({ 
        icon: 'error', 
        title: 'Error', 
        text: String(err),
        background: theme.palette.background.paper,
        color: theme.palette.text.primary
      });
    }
  }, [message, pendingResponse, sendChatMessageAsync, theme]);

  const stopHandler = useCallback(async () => {
    try {
      await cancelCurrentRun('User clicked Stop');
    } catch (err) {
      console.error('stop task failed', err);
    }
  }, [cancelCurrentRun]);

  const handleKeyDown = async (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      await clickHandler();
      setMessage(''); 
      if (inputRef.current) inputRef.current.blur();
    }
  };

  // --- Animated Placeholder State ---
  const [animatedPlaceholder, setAnimatedPlaceholder] = useState('');
  const placeholderText = waitingForInput
    ? inputPrompt || t('enter_your_response')
    : t('get_started_give_me_task');

  useEffect(() => {
    let i = 0;
    setAnimatedPlaceholder('');
    if (!placeholderText) return;
    const interval = setInterval(() => {
      setAnimatedPlaceholder(placeholderText.slice(0, i + 1));
      i++;
      if (i >= placeholderText.length) clearInterval(interval);
    }, 30); // Typing speed in ms
    return () => clearInterval(interval);
  }, [placeholderText]);


  // DEBUG: show what optionsList contains (helps find missing docs)
  useEffect(() => {
  }, [optionsList]);

  const [composerScheduleOpen, setComposerScheduleOpen] = useState(false);   // new dialog state

  const handleDeleteFile = useCallback((file) => {
    try {
      const stored = JSON.parse(sessionStorage.getItem('filecontent') || '[]');
      const next = stored.filter(
        (f) => !(f.fileName === file.fileName && f.downloadURL === file.downloadURL)
      );
      sessionStorage.setItem('filecontent', JSON.stringify(next));
      setFileList(next);
    } catch (e) {
      console.error("Failed to delete file", e);
    }
  }, []);

  return (
    <>
      <Paper
        sx={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'flex-end',
          alignSelf: 'flex-end',
          justifyContent: 'flex-end',
          width: "100%",
          backgroundColor: theme.palette.background.default, // using theme paper color
          backgroundImage: 'none', // Explicitly disable any gradient
          color: theme.palette.text.primary,
          boxShadow: 'none',
        }}
      >
        <Box sx={{ 
          backgroundColor: theme.palette.background.default, 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          width: '100%', // Added width 100%
          alignItems: 'stretch', // Changed from flex-end
          alignSelf: 'stretch', // Changed from flex-end
          justifyContent: 'center', // center the prompt input vertically so it lines up with right icons
          position: 'relative' // Add this
        }}>
          <Box
            sx={{
              width: '100%',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 1,
              justifyContent: 'space-between',
              pr: 0,
              mb: '10px',
            }}
          >
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, flex: 1, minWidth: 0, ml: '30px' }}>
              {/* Changed ml from 20px to 30px */}
              <FileList files={fileList} onDeleteFile={handleDeleteFile} />
              {/* Starter prompt chips — inline with buttons, shown when chat is empty */}
              {chatMessages.length === 0 && !pendingResponse && (() => {
                const currentTeamId = sessionStorage.getItem('squad') || '1';
                const currentSquad = squads.find((s) => s.teamId === currentTeamId);
                const prompts = (currentSquad?.samplePrompts || []).slice(0, 1);
                if (!prompts.length) return null;
                return prompts.map((prompt, idx) => (
                  <Chip
                    key={idx}
                    label={prompt}
                    variant="outlined"
                    clickable
                    onClick={() => setMessage(prompt)}
                    size="small"
                    sx={{
                      fontSize: '0.75rem',
                      height: 32,
                      borderColor: theme.palette.primary.main,
                      color: theme.palette.primary.main,
                      '&:hover': {
                        backgroundColor: theme.palette.primary.main + '14',
                      },
                    }}
                  />
                ));
              })()}
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<ScheduleIcon />}
                onClick={() => setComposerScheduleOpen(true)}
                disabled={!message.trim()}
                sx={{ textTransform: 'none', fontWeight: 600, height: 36, alignItems: 'center' }}
              >
                {t('schedule_later')}
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<BookmarkAddIcon />}
                onClick={handleSavePrompt}
                disabled={savingPrompt || !message.trim()}
                sx={{ textTransform: 'none', fontWeight: 600, height: 36, alignItems: 'center' }}
              >
                {t('save_prompt')}
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={enhancing ? <CircularProgress size={16} color="inherit" /> : <AutoFixHighIcon />}
                onClick={enhancePromptHandler}
                disabled={enhancing || !message.trim()}
                sx={{ textTransform: 'none', fontWeight: 600, height: 36, alignItems: 'center' }}
              >
                {enhancing ? t('task_processing') : t('enhance_prompt')}
              </Button>
              <Tooltip title={t('creative_model_tooltip', 'Changes the model for content-creating agents. Research and verification agents use an optimized lightweight model.')} arrow placement="top">
              <Select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                displayEmpty
                size="small"
                sx={{
                  height: 36,
                  fontSize: '0.8rem',
                  minWidth: 130,
                  '& .MuiSelect-select': { py: 0.5 },
                }}
              >
                <MenuItem value="">
                  <em>{t('creative_model_auto', 'Auto (tiered)')}</em>
                </MenuItem>
                <MenuItem value="o3-mini">o3-mini</MenuItem>
                <MenuItem value="gpt-5-mini">gpt-5-mini</MenuItem>
                <MenuItem value="gpt-5.1-2025-11-13">gpt-5.1</MenuItem>
                <MenuItem value="gpt-5.2">gpt-5.2</MenuItem>
                <MenuItem value="gpt-5.4">gpt-5.4</MenuItem>
              </Select>
              </Tooltip>
            </Box>
          </Box>

          {/* Error recovery bar */}
          {lastError && (() => {
            const isTimeout = /timeout|timed out/i.test(lastError);
            const isConnection = /connection|websocket|lost/i.test(lastError);
            const severity = 'error';
            const errorIcon = isTimeout ? '⏱️' : isConnection ? '🔌' : '⚠️';
            const lastFailedMessage = useBoundStore.getState().lastFailedMessage;
            return (
              <Box sx={{ mb: 1, width: '100%' }}>
                <Alert
                  severity={severity}
                  sx={{ alignItems: 'center', borderRadius: 2 }}
                  action={
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                          color="error"
                          size="small"
                          startIcon={<ReplayIcon />}
                          onClick={retryLastMessage}
                          sx={{ textTransform: 'none', fontWeight: 600 }}
                        >
                          {t('retry', 'Retry')}
                        </Button>
                      {lastFailedMessage && (
                        <Button
                          color="inherit"
                          size="small"
                          startIcon={<EditIcon />}
                          onClick={() => {
                            setMessage(lastFailedMessage);
                            clearError();
                          }}
                          sx={{ textTransform: 'none', fontWeight: 600 }}
                        >
                          {t('edit_retry', 'Edit & Retry')}
                        </Button>
                      )}
                      <Button
                        color="inherit"
                        size="small"
                        onClick={clearError}
                        sx={{ textTransform: 'none' }}
                      >
                        {t('dismiss', 'Dismiss')}
                      </Button>
                    </Box>
                  }
                >
                  {errorIcon} {lastError}
                  {isTimeout && (
                    <Typography variant="caption" sx={{ display: 'block', mt: 0.5, opacity: 0.8 }}>
                      {t('error_timeout_hint', 'The task took too long. Try simplifying your request or retry.')}
                    </Typography>
                  )}
                  {isConnection && (
                    <Typography variant="caption" sx={{ display: 'block', mt: 0.5, opacity: 0.8 }}>
                      {t('error_connection_hint', 'Connection was interrupted. Your task may still be processing on the server.')}
                    </Typography>
                  )}
                </Alert>
              </Box>
            );
          })()}
          
          <Box
            sx={{
              width: '100%',
              display: 'flex',
              alignItems: 'flex-start',
              mb: 0.5,
              minHeight: '165px', 
              ml: 0,
              pr: 0,
              position: 'relative',
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 1,
              boxSizing: 'border-box',
              backgroundColor: theme.palette.background.paper,
              padding: 0, // Changed from 1 to 0
              // Scrollbar styling
              '& textarea::-webkit-scrollbar': {
                width: '6px',
                backgroundColor: 'transparent',
              },
              '& textarea::-webkit-scrollbar-thumb': {
                backgroundColor: theme.palette.divider,
                borderRadius: '10px',
              },
              // Aggressively remove inner borders
              '& .MuiOutlinedInput-root': {
                '& fieldset': { border: 'none !important' },
              },
              '& .MuiOutlinedInput-notchedOutline': { border: 'none !important' },
              '& .MuiInputBase-root': { padding: 0 },
              '& fieldset': { border: 'none !important' },
              '& .MuiInput-underline:before': { borderBottom: 'none !important' },
              '& .MuiInput-underline:after': { borderBottom: 'none !important' }
            }}
          >
            <PromptPicker
              options={optionsList}
              value={interimTranscript ? message + interimTranscript : message}
              onChange={(val) => setMessage(val)}
              onKeyDown={handleKeyDown}
              onSelect={(item) => {
                const val = (typeof item === 'string') ? item : (item.prompt_text || '');
                setMessage(val);
                try {
                  inputRef?.current?.focus();
                } catch (err) {
                  // Focus can fail if the dialog closes during selection.
                }
              }}
              placeholder={animatedPlaceholder}
              inputRef={inputRef}
              waitingForInput={waitingForInput}
              onInputFocus={handlePromptFocus}
              onDeletePrompt={handleDeletePrompt}
            />
            {waitingForInput && (
              <CheckCircleIcon
                sx={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: theme.palette.error.main,
                  fontSize: 20,
                  pointerEvents: 'none'
                }}
              />
            )}
          </Box>
        </Box>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',   // center the icon column horizontally
            justifyContent: 'center',// center icons vertically so they line up with the textbox
             paddingLeft: '0px',
             backgroundColor: theme.palette.background.default,
           }}
         >
          <Tooltip
            placement="left-start"
            title={pendingResponse ? t('stop_task', 'Stop task') : t('send_message')}
          >
            <IconButton
              color={pendingResponse ? "error" : "primary"}
              onClick={pendingResponse ? stopHandler : clickHandler}
              disabled={pendingResponse && cancellationPending}
              sx={{ p: '10px', marginLeft: '10px' }}
              aria-label={pendingResponse ? t('stop_task', 'Stop task') : t('send_message')}
            >
              {pendingResponse ? (
                cancellationPending ? (
                  <CircularProgress sx={{ p: '0px' }} size={24} />
                ) : (
                  <StopCircleIcon sx={{ p: '0px' }} />
                )
              ) : (
                <PlayArrowIcon sx={{ p: '0px' }}/>
              )}
            </IconButton>
          </Tooltip>
          {/*
          <Tooltip placement="left-start" title={t('enhance_prompt')}>
            <IconButton
              color="primary"
              onClick={enhancePromptHandler}
              sx={{ p: '10px', marginLeft: '10px' }}
              aria-label={t('enhance_prompt')}
            >
              <AutoFixHighIcon />
            </IconButton>
          </Tooltip>
          */}
          <Tooltip placement="left-start" title={t('new_conversation', 'New Conversation')}>
            <IconButton
              color="primary"
              onClick={() => {
                if (startNewConversation) startNewConversation();
              }}
              sx={{ p: '10px', marginLeft: '10px' }}
              aria-label={t('new_conversation', 'New Conversation')}
            >
              <RestartAltIcon />
            </IconButton>
          </Tooltip>
          <Tooltip placement="left-start" title={t('dictate_message')}>
            <IconButton
              color="primary"
              onClick={toggleVoice}
              sx={{ p: '10px', marginLeft: '10px' }}
              aria-label={t('dictate_message')}
            >
              <MicIcon />
            </IconButton>
          </Tooltip>
          {/* Using a key based on chatMessages length (from ChatDialog) to force a remount */}
          <FileUpload
            key={useBoundStore.getState().chatMessages.length}
            onFileUpload={handleFileUpload}
            accept=".csv,.txt,.pdf,.png,.jpg,.mp4"
            label={t('upload_file')}
          />
        </Box>
      </Paper>

      <ScheduleTaskDialog
        open={composerScheduleOpen}
        onClose={() => setComposerScheduleOpen(false)}
        initialPrompt={message}
      />
    </>
  );
}

const ChatDialog = () => {
  const { speak, cancel } = useSpeechSynthesis();
  const chatMessages = useBoundStore((state) => state.chatMessages);
  const pendingResponse = useBoundStore((state) => state.pendingResponse);
  const lastRunId = useBoundStore((state) => state.lastRunId);
  const [runArtifactsOpen, setRunArtifactsOpen] = useState(false);
  const chatScrollRef = useRef(null);

  

  // Make uid reactive (auth.currentUser alone won't rerender this component)
  const [storeuid, setStoreuid] = useState(() => sessionStorage.getItem('uid') || '');

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      const uid = getCanonicalUid(u);
      if (uid) {
        setStoreuid(uid);
        // keep sessionStorage in sync so other modules don’t diverge
        sessionStorage.setItem('uid', uid);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    // Scroll chat container to bottom when messages change or task completes
    const el = chatScrollRef.current;
    if (el) {
      setTimeout(() => { el.scrollTop = el.scrollHeight; }, 50);
    }
  }, [chatMessages, pendingResponse]);

  const theme = useTheme(); // ensure theme is available
  return (
    <>
      <GlobalStyles styles={{
        '.hljs': {
          color: theme.palette.text.primary + ' !important',
        },
        // White keywords:
        '.hljs .hljs-keyword, .hljs .hljs-selector-tag, .hljs .hljs-literal, .hljs .hljs-section, .hljs .hljs-link': {
          color: theme.palette.text.primary + ' !important',
          fontWeight: 600,
        },
        // Ensure complete white coloring for strings including any inner tokens:
        '.hljs .hljs-string, .hljs .hljs-string *': {
          color: theme.palette.text.primary + ' !important',
        },
        // Other rules remain unchanged:
        '.hljs-comment, .hljs-quote, .hljs-deletion': {
          color: theme.palette.text.primary + ' !important',
        },
        '.hljs-meta': {
          color: theme.palette.text.primary + ' !important',
        },
        'pre, code': {
          background: theme.palette.background.main + ' !important',
          color: theme.palette.text.primary + ' !important',
        }
      }} />
      <Box
        ref={chatScrollRef}
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflowY: 'auto',
          minWidth: 0,
          position: 'relative',
          color: theme.palette.text.primary,          // using theme value
          backgroundColor: theme.palette.background.default // using theme value
        }}
      >
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
            alignSelf: 'stretch',
            justifyContent: 'flex-end',
            minWidth: 0,
            backgroundColor: theme.palette.background.default, // Use theme default background
            width: '100%'  // added width
          }}
        >
          <Grid container sx={{ width: '100%', minWidth: 0 }}>
            {chatMessages.map((msg, index) => {
              const { id, message, msg_from, msgType, hidden } = msg;
              if (hidden) return null;
              // Special case: Render authorize_link messages as a clickable link
              if (msgType === "authorize_link") {
                let linkText = "";
                let url = "";
                if (Array.isArray(message)) {
                  linkText = message[0]?.content || "";
                } else if (typeof message === "object" && message.content) {
                  linkText = message.content;
                } else if (typeof message === "string") {
                  linkText = message;
                }
                // Try to extract a URL from the message
                const urlMatch = linkText.match(/https?:\/\/\S+/);
                url = urlMatch ? urlMatch[0] : "";
                return (
                  <Fragment key={id}>
                    <Grid container item xs={3} sm={1} sx={{ flexDirection: "column", marginBottom: "20px", alignItems: "center", justifyContent: "center", display: "flex" }}>
                      <CycloneIcon style={{ marginTop: "10px", color: theme.palette.primary.dark, fontSize: "50px" }} />
                    </Grid>
                    <Grid container item xs={9} sm={11} sx={{ flexDirection: "row", fontSize: "14px", paddingRight: "10px", paddingBottom: "15px", paddingTop: "15px", wordBreak: 'break-word', width: '100%', maxWidth: '100%', fontWeight: "500", color: theme.palette.text.primary }}>
                      <div style={{ marginBottom: "10px" }}>
                        {url ? (
                          <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: theme.palette.primary.main, fontWeight: 600, fontSize: 16 }}>
                            {linkText}
                          </a>
                        ) : (
                          linkText
                        )}
                      </div>
                    </Grid>
                    {index < chatMessages.length - 1 && (
                      <Divider sx={{ width: '100%', marginY: 2 }} />
                    )}
                  </Fragment>
                );
              }
              if (msg_from === "user" && msgType !== "user") return null;
              if (msg_from !== "user" && msgType === "result") {
                let aggregatedText = "";
                if (Array.isArray(message)) {
                  aggregatedText = message
                    .map(item => typeof item === "string" ? item : (item.content || ""))
                    .join(" ");
                } else if (typeof message === "object" && (message.content || message.data)) {
                  aggregatedText = message.content || "";
                } else if (typeof message === "string") {
                  aggregatedText = message;
                }
                if (typeof aggregatedText !== "string") {
                  aggregatedText = JSON.stringify(aggregatedText);
                }
                const READY_PATTERN = /\b(TERMINATE|PLAN_READY_ON_SCREEN|DOCS_DONE)\b/i;
                // Show the message if it contains TERMINATE/READY pattern OR if it's the last result message
                // OR if it has substantive content after stripping terminal sentinels (e.g. an MP3/video URL
                // delivered in a message just before the TERMINATE sentinel).
                const isLastResult = index === chatMessages.length - 1 ||
                  !chatMessages.slice(index + 1).some(m => m.msg_from !== 'user' && m.msgType === 'result' && !m.hidden);
                const hasSubstantiveContent = aggregatedText.replace(/\b(TERMINATE|PLAN_READY_ON_SCREEN|DOCS_DONE)\b/gi, '').trim().length > 0;
                if (!READY_PATTERN.test(aggregatedText) && !isLastResult && !hasSubstantiveContent) return null;
              }
              let parts = [];
              if (Array.isArray(message)) {
                parts = message;
              } else if (typeof message === "object" && (message.content || message.data)) {
                parts = [message];
              } else if (typeof message === "string") {
                parts = [{ type: "text", content: message }];
              } else {
                return null;
              }
              const extractText = (part) => {
                if (typeof part === "string") return part;
                if (typeof part === "object") {
                  if (typeof part.content === "string") {
                    return part.content;
                  }
                  return JSON.stringify(part);
                }
                return "";
              };
              const handleCopy = () => {
                const textToCopy = parts.map(extractText).join(" ");
                navigator.clipboard.writeText(textToCopy)
                  .then(() => { console.log("Text copied to clipboard."); })
                  .catch((error) => { console.error("Failed to copy text: ", error); });
              };
              return (
                <Fragment key={id}>
                  <Grid
                    container
                    item
                    xs={3}
                    sm={1}
                    sx={{
                      flexDirection: "column",
                      //borderTop: "1px solid #2222",
                      marginBottom: "20px",
                      alignItems: "center",
                      justifyContent: "center",
                      display: "flex"
                    }}
                  >
                    {msg_from === "user" ? (
                      <AccountCircleIcon style={{ marginTop: "10px", color: theme.palette.primary.dark, fontSize: "50px" }} />
                    ) : (
                      <CycloneIcon style={{ marginTop: "10px", color: theme.palette.primary.dark, fontSize: "50px" }} />
                    )}
                    <Tooltip placement="right-start" title={t('listen_to_answer')}>
                      <IconButton
                        disabled={false}
                        onClick={() => {
                          const textToCopy = parts.map(extractText).join(" ");
                          // Capitalize first letter
                          const capitalized = textToCopy.charAt(0).toUpperCase() + textToCopy.slice(1);
                          speak({ text: capitalized });
                        }}
                        color="primary"
                        sx={{ '&:hover': { backgroundColor: 'transparent' }, p: '5px', display: "flex", color: 'white' }}
                        aria-label={t('listen_to_answer')}
                      >
                        <RecordVoiceOverIcon style={{ fontSize: "20", color: theme.palette.primary.dark }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip placement="right-start" title={t('stop_listening')}>
                      <IconButton
                        disabled={false}
                        onClick={cancel}
                        sx={{ '&:hover': { backgroundColor: 'transparent' }, p: '5px', display: "flex" }}
                        aria-label={t('stop_listening')}
                      >
                        <VolumeOffIcon style={{ fontSize: "20", color: theme.palette.primary.dark }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip placement="right-start" title={t('copy_content')}>
                      <IconButton
                        disabled={false}
                        onClick={handleCopy}
                        sx={{ '&:hover': { backgroundColor: 'transparent' }, p: '5px', display: "flex" }}
                        aria-label={t('copy_content')}
                      >
                        <ContentCopyIcon style={{ fontSize: "20", color: theme.palette.primary.dark }} />
                      </IconButton>
                    </Tooltip>
                    <ScrollButton />
                  </Grid>
                  <Grid
                    container
                    item
                    xs={9}
                    sm={11}
                    sx={{
                      flexDirection: "row",
                      fontSize: "14px",
                      paddingRight: "10px",
                      paddingBottom: "15px",
                      paddingTop: "15px",
                      wordBreak: 'break-word',
                      width: '100%',
                      maxWidth: '100%',
                      fontWeight: "500",
                      color: theme.palette.text.primary
                    }}
                  >
                    {parts.map((part, index) => renderPart(part, index))}
                  </Grid>
                  {index < chatMessages.length - 1 && (
                    <Divider sx={{ width: '100%', marginY: 2 }} /> // Add this Divider
                  )}
                </Fragment>
              );
            })}
          </Grid>

          {/* Live agent thinking feed + pipeline stepper */}
          <AgentThinkingCards theme={theme} />

          {/* View Artifacts shortcut — appears after a run completes */}
          {!pendingResponse && lastRunId && chatMessages.length > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', px: 2, py: 0.5 }}>
              <Tooltip title="View files produced by this run">
                <Button
                  size="small"
                  variant="text"
                  startIcon={<FolderOpenIcon fontSize="small" />}
                  onClick={() => setRunArtifactsOpen(true)}
                  sx={{ textTransform: 'none', fontSize: '0.75rem', opacity: 0.7 }}
                >
                  View Artifacts
                </Button>
              </Tooltip>
            </Box>
          )}
        </Box>
        <ArtifactsModal
          open={runArtifactsOpen}
          onClose={() => setRunArtifactsOpen(false)}
          runId={lastRunId}
        />
        {/* AgentActivityPanel modal removed — replaced by inline StreamingThinker */}
        <Box
            sx={{
              p: 1,
              bgcolor: theme.palette.background.default, // updated from '#212121'
              paddingRight: "10px",
              justifyContent: "center",
              alignItems: "center",
              bottom: 0,
              right: 0,
              zIndex: 1200
            }}
          >
            <CustomizedInputBase storeuid={storeuid} />
          </Box>
      </Box>
      <HelpChatbot />
    </>
  );
};

export default ChatDialog;

CustomizedInputBase.propTypes = {
  storeuid: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

ThemedLink.propTypes = {
  href: PropTypes.string,
  children: PropTypes.node,
};

FileList.propTypes = {
  files: PropTypes.array,
  onDeleteFile: PropTypes.func,
};
