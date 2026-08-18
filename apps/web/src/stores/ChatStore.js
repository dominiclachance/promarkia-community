import { serializeRecurrence, computeNextRun } from '../utils/schedule';
import { autogenBridgeFetch, getAutogenWebSocketUrl } from '../services/autogenBridge';
import { auth } from '../firebase/authClient';
import { localClient } from '../services/localClient';

const getAuth = () => auth;

// Generate and store a conversation_id if not already set.
let conversation_id = sessionStorage.getItem('conversation_id');

if (!conversation_id) {
  conversation_id = crypto.randomUUID();
  sessionStorage.setItem('conversation_id', conversation_id);
  console.log("Generated new conversation_id:", conversation_id);
} else {
  console.log("Using existing conversation_id:", conversation_id);
}

const user_id = 'guestuser@gmail.com'; // Hard-coded for testing

// Ensure session_id is numeric.
let session_id = sessionStorage.getItem('session_id');
if (!session_id) {
  session_id = Math.floor(Math.random() * 100);
  sessionStorage.setItem('session_id', session_id.toString());
  console.log("Generated new session_id:", session_id);
} else {
  session_id = Number(session_id);
  console.log("Using existing session_id:", session_id);
}

// Team id for the Routing Squad
const ROUTER_TEAM_ID = 33;

const fetchConnectedAccountsForEntity = async (entityId) => {
  if (!entityId) return '';
  try {
    const integrations = await localClient.integrations();
    return integrations
      .filter((item) => item.enabled)
      .map((item) => `${item.provider}=${item.account_label}`)
      .join(',');
  } catch (err) {
    console.error('fetchConnectedAccountsForEntity error', err);
    return '';
  }
};

// Helper to check if a string looks like a base64 encoded PNG image.
function isBase64Image(str = "") {
  return /^[A-Za-z0-9+/=]{100,}$/.test(str);
}

const fetchEntityMcpUrls = async (entityId) => {
  if (!entityId) return {};
  try {
    const servers = await localClient.mcpServers();
    const urls = Object.fromEntries(
      servers.filter((server) => server.enabled && server.url).map((server) => [server.name, server.url]),
    );
    console.log('Fetched MCP URLs for entity:', entityId, urls);
    return urls;
  } catch (err) {
    console.error('fetchEntityMcpUrls error', err);
    return {};
  }
};

const previewHydratedTeamConfig = (config, mcpUrls = {}) => {
  if (!config || !Object.keys(mcpUrls).length) return config;
  const clone = JSON.parse(JSON.stringify(config));
  const walk = (node) => {
    if (!node) return;
    if (Array.isArray(node)) return node.forEach(walk);
    if (typeof node === 'object') {
      Object.entries(node).forEach(([key, value]) => {
        if (typeof value === 'string' && mcpUrls[value]) {
          node[key] = mcpUrls[value];
        } else if (value && typeof value === 'object') {
          walk(value);
        }
      });
    }
  };
  walk(clone);
  return clone;
};

// Function to fetch team configuration dynamically using a teamId.
const fetchTeamConfig = async (teamId) => {
  const response = await autogenBridgeFetch(`/teams/${encodeURIComponent(teamId)}`, {
    method: 'GET',
    headers: { 'accept': 'application/json' }
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch team configuration. Status: ${response.status}. Response: ${errorText}`);
  }
  const teamConfig = await response.json();
  console.log("Received team configuration:", teamConfig);
  return teamConfig;
};

// Default team configuration values.
const defaultTeamConfig = {
  provider: "autogen_agentchat.teams.RoundRobinGroupChat",
  config: {
    participants: [
      {
        provider: "autogen_ext.agents.web_surfer.MultimodalWebSurfer",
        component_type: "agent",
        version: 1,
        component_version: 1,
        description:
          'An agent that solves tasks by browsing the web using a headless browser. Where you think you are done, you say "TERMINATE".',
        label: "Web Surfer Agent",
        config: {
          name: "websurfer_agent",
          model_client: {
            provider: "autogen_ext.models.openai.OpenAIChatCompletionClient",
            component_type: "model",
            version: 1,
            component_version: 1,
            description:
              "Chat completion client for OpenAI hosted models.",
            label: "OpenAIChatCompletionClient",
            config: { model: "gpt-4o-mini" }
          },
          description: "an agent that solves tasks by browsing the web",
          headless: true,
          start_page: "https://www.bing.com/",
          animate_actions: false,
          to_save_screenshots: false,
          use_ocr: false,
          to_resize_viewport: false
        }
      }
    ],
    termination_condition: {
      provider: "autogen_agentchat.base.OrTerminationCondition",
      component_type: "termination",
      version: 1,
      component_version: 1,
      label: "OrTerminationCondition",
      config: {
        conditions: [
          {
            provider: "autogen_agentchat.conditions.TextMentionTermination",
            component_type: "termination",
            version: 1,
            component_version: 1,
            description:
              "Terminate the conversation if a specific text is mentioned.",
            label: "TextMentionTermination",
            config: { text: "TERMINATE" }
          },
          {
            provider: "autogen_agentchat.conditions.MaxMessageTermination",
            component_type: "termination",
            version: 1,
            component_version: 1,
            description:
              "Terminate the conversation after a maximum number of messages have been exchanged.",
            label: "MaxMessageTermination",
            config: { max_messages: 10, include_agent_event: false }
          }
        ]
      }
    }
  }
};

// Retained as a documented fallback schema while team configuration is server-managed.
void defaultTeamConfig;

const filterMetaTags = (text = "") => {
  if (typeof text !== "string") return text;
  return text.replace(/<meta[^>]*>/gi, "");
};

export const chatStore = (set, get) => {
  
  // NEW helper: formats a content item into a message object.
  const formatContent = (item) => {
    if (typeof item === 'string') {
      const cleanItem = filterMetaTags(item);
      return isBase64Image(cleanItem) ? { type: "image", content: cleanItem } : { type: "text", content: cleanItem };
    }
    if (typeof item === 'object') {
      if (item.data && isBase64Image(item.data)) {
        return { type: "image", content: item.data };
      }
      if (typeof item.content === 'string') {
        const cleanContent = filterMetaTags(item.content);
        return isBase64Image(cleanContent) ? { type: "image", content: cleanContent } : { type: "text", content: cleanContent };
      }
    }
    return { type: "text", content: item };
  };

  // Helper to run the Routing Squad (team 33) before the main squad.
  // It uses the same sessions/runs/WebSocket flow and updates sessionStorage.squad
  // based on a JSON object returned by the router, e.g.:
  //   {"team_id": 12, "label": "Assistant Squad"}
  const runRoutingSquad = async (taskText) => {
    try {
      const routerTeamId = ROUTER_TEAM_ID;

      // Fetch router team configuration
      const fetchedRouterConfig = await fetchTeamConfig(routerTeamId);
      const routerTeamConfig =
        fetchedRouterConfig?.data?.component ??
        fetchedRouterConfig?.component ??
        fetchedRouterConfig;

      // Create a dedicated routing session so it does not interfere with the main chat session.
      const routingSessionId = Math.floor(Math.random() * 1000000);
      const routingSessionPayload = {
        id: routingSessionId,
        user_id: user_id,
        version: "0.0.1",
        team_id: routerTeamId,
        name: (sessionStorage.getItem('email') || user_id) + " - Routing Squad"
      };
      console.log("Creating routing session with payload:", routingSessionPayload);

      const routingSessionResp = await autogenBridgeFetch('/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(routingSessionPayload)
      });

      if (!routingSessionResp.ok) {
        const errorText = await routingSessionResp.text();
        console.error(`Routing session creation failed. Status: ${routingSessionResp.status}. Response: ${errorText}`);
        return null;
      }

      const routingSessionData = await routingSessionResp.json();
      const routingSession =
        routingSessionData.session ||
        routingSessionData.session_id ||
        routingSessionId;
      console.log("Routing session created with id:", routingSession);

      // Start routing run
      const routingRunPayload = { session_id: routingSession, user_id: user_id };
      console.log("Starting routing run with payload:", routingRunPayload);

      const routingRunResp = await autogenBridgeFetch('/runs', {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(routingRunPayload)
      });

      if (!routingRunResp.ok) {
        const errorText = await routingRunResp.text();
        console.error(`Routing run creation failed. Status: ${routingRunResp.status}. Response: ${errorText}`);
        return null;
      }

      const routingRunData = await routingRunResp.json();
      console.log("Routing run creation response data:", routingRunData);
      const routingRunId = routingRunData.data && routingRunData.data.run_id;
      if (!routingRunId) {
        console.error("Routing run ID not found in response");
        return null;
      }

      const wsUrl = await getAutogenWebSocketUrl(routingRunId);
      console.log("Connecting to Routing WebSocket at:", wsUrl);

      return await new Promise((resolve) => {
        let finished = false;
        const safeResolve = (value) => {
          if (!finished) {
            finished = true;
            resolve(value);
          }
        };

        const extractRoutingChoice = (messages = []) => {
          let chosen = null;
          messages.forEach((msg) => {
            if (chosen || !msg) return;
            const rawContent = msg.content ?? msg.data?.content ?? msg;
            const items = Array.isArray(rawContent) ? rawContent : [rawContent];
            items.forEach((item) => {
              if (chosen) return;
              const text = typeof item === "string" ? item : item?.content;
              if (!text || typeof text !== "string") return;
              let trimmed = text.trim();
              if (trimmed.startsWith("```")) {
                trimmed = trimmed.replace(/^```[a-zA-Z0-9]*\n?/, "").replace(/```$/, "").trim();
              }
              try {
                const parsed = JSON.parse(trimmed);
                if (parsed && typeof parsed.team_id !== "undefined") {
                  chosen = parsed;
                }
              } catch (_) {
                /* ignore non-JSON */
              }
            });
          });
          return chosen;
        };

        const finalizeRoutingChoice = (choice, wsInstance) => {
          const newSquadId = parseInt(choice.team_id, 10);
          if (Number.isNaN(newSquadId)) {
            console.warn("Routing returned non-numeric team_id, ignoring:", choice.team_id);
            return false;
          }
          sessionStorage.setItem("squad", newSquadId.toString());
          if (choice.squadName || choice.label) {
            sessionStorage.setItem("squadName", choice.squadName || choice.label);
          }
          console.log("Routing selected squad:", choice);
          try { wsInstance.close(); } catch (_) { /* ignore */ }
          safeResolve(choice);
          return true;
        };

        const tryHandleMessages = (messages = []) => {
          const choice = extractRoutingChoice(messages);
          return choice ? finalizeRoutingChoice(choice, ws) : false;
        };

        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log("Routing WebSocket connection open, readyState:", ws.readyState);
          const payload = JSON.stringify({
            type: "start",
            task: taskText,
            team_config: routerTeamConfig
          });
          console.log("Sending routing start payload:", payload);
          ws.send(payload);
        };

        ws.onmessage = (event) => {
          console.log("Routing WebSocket message raw:", event.data);
          try {
            const data = JSON.parse(event.data);
            try { get().addToSwalMessages(data); } catch (e) { /* ignore */ }

            if (data.type === "message" && data.data) {
              if (tryHandleMessages([{ content: data.data.content }])) return;
              console.log("Routing message type not 'result'; ignoring for routing decision.");
            } else if (data.type === "result" &&
              data.data &&
              data.data.task_result &&
              Array.isArray(data.data.task_result.messages)) {

              if (tryHandleMessages(data.data.task_result.messages)) return;

              console.warn("Routing result did not contain a valid JSON with team_id; keeping existing squad.");
              try { ws.close(); } catch (e) { /* ignore */ }
              safeResolve(null);
              return;
            } else {
              console.log("Routing message type not 'result'; ignoring for routing decision.");
            }
          } catch (err) {
            console.error("Error parsing Routing WebSocket message:", err);
            try { ws.close(); } catch (e) { /* ignore */ }
            safeResolve(null);
          }
        };

        ws.onerror = (err) => {
          console.error("Routing WebSocket error:", err);
          try { ws.close(); } catch (e) { /* ignore */ }
          safeResolve(null);
        };

        ws.onclose = (evt) => {
          console.log("Routing WebSocket closed:", evt.code, evt.reason);
          safeResolve(null);
        };

        // Safety timeout in case router never responds
        setTimeout(() => {
          if (!finished) {
            console.warn("Routing WebSocket timed out, closing.");
            try { ws.close(); } catch (e) { /* ignore */ }
            safeResolve(null);
          }
        }, 20000);
      });
     } catch (err) {
       console.error("runRoutingSquad failed:", err);
       return null;
     }
  };

  const LOG_SUPPRESSED_SOURCES = new Set([
    "llm_call_event",
    "copywriter_agent",
    "compliance_agent",
    "research_agent",
    "research_assistant",
    "compliance_agent",
    "research_agent",
    "research_assistant",
    "verifier",
    "strategy_architect",
    "media_planner",
    "program_planner",
    "document_creator_agent",
    "wordpress_agent",
    "planner_agent",
    "reviewer_agent",
    "briefing_agent",
    "strategy_architect",
    "media_planner",
    "program_planner",
    "document_creator_agent",
    "media_planner",
    "program_planner",
    "email_agent",
    "google_docs_agent",
    "notion_agent"
  ]);
  void LOG_SUPPRESSED_SOURCES;

  const HIDDEN_MESSAGE_SOURCES = new Set([
       "llm_call_event",
    "copywriter_agent",
    "compliance_agent",
    "research_agent",
    "research_assistant",
    "compliance_agent",
    "research_agent",
    "research_assistant",
    "verifier",
    "strategy_architect",
    "media_planner",
    "program_planner",
    "document_creator_agent",
    "wordpress_agent",
    "planner_agent",
    "reviewer_agent",
    "briefing_agent",
    "strategy_architect",
    "media_planner",
    "program_planner",
    "document_creator_agent",
    "media_planner",
    "program_planner",
    "email_agent",
    "google_docs_agent",
    "notion_agent"
  ]);

  const isHiddenSource = (source) => HIDDEN_MESSAGE_SOURCES.has(source);

  // --- TERMINATE visibility helpers ---
  const TERMINATE_PATTERN = /\b(TERMINATE|POST DRAFT)\b/i;
  const TERMINATE_EXEMPT_SENDERS = new Set(["user", "user_proxy"]);
  const contentToText = (content) => {
    const items = Array.isArray(content) ? content : [content];
    return items
      .map((it) => {
        if (!it) return "";
        if (typeof it === "string") return it;
        if (typeof it === "object") {
          if (typeof it.content === "string") return it.content;
          if (typeof it.data === "string") return it.data;
        }
        return "";
      })
      .join(" ");
  };
  const shouldHideByTerminateRule = ({ msg_from, msgType, content }) => {
    if (TERMINATE_EXEMPT_SENDERS.has(msg_from)) return false;
    if (msgType === "authorize_link") return false;
    return !TERMINATE_PATTERN.test(contentToText(content));
  };

  // One-per-run flag to prevent showing POST DRAFT twice (covers both "message" + "result" replays)
  let postDraftAlreadyShown = false;

  const containsPostDraft = (val) => {
    const text = contentToText(val);
    return /\bPOST\s*DRAFT\b/i.test(text);
  };

  return {
    chatMessages: [],
    currWebSocket: null,
    pendingResponse: false,
    hasSentTask: false,
    // New array to keep every raw incoming message for UI diagnostics / Swal
    swalMessages: [],
    // New normalized array (snake_case) for UI consumers: {id,timestamp,sender,raw}
    swal_messages: [],
    // Minimal helper to store raw messages for Swal inspection
    addToSwalMessages: (raw) => {
      try {
        // Try to parse common shapes to extract a sender/source
        let parsed = raw;
        if (typeof raw === 'string' && raw.trim().startsWith('{')) {
          try { parsed = JSON.parse(raw); } catch(e) { /* keep raw */ }
        }

        // If payload is a stringified JSON, parse it to surface nested fields
        const resolvePayload = (obj) => {
          if (!obj) return obj;
          if (typeof obj.payload === 'string') {
            try {
              return JSON.parse(obj.payload);
            } catch (e) { /* ignore */ }
          }
          return obj;
        };
        const parsedWithPayload = resolvePayload(parsed) || parsed;

        // Prefer agent_response.chat_message.source when available (handles your briefing_agent shape)
        const agentSource = parsedWithPayload?.agent_response?.chat_message?.source || null;

        // Normalize sender token: remove appended UUIDs / trailing ids and keep source token like "briefing_agent"
        const normalizeSender = (val) => {
          if (!val || typeof val !== 'string') return val;
          // If value contains a slash-style "sender/uuid", take left side
          const slashIdx = val.indexOf('/');
          if (slashIdx > 0) val = val.slice(0, slashIdx);
          // If value ends with a UUID-like segment separated by underscore/hyphen, strip it
          // e.g. "briefing_agent_23d53b72-38a4-4384..." -> "briefing_agent"
          const parts = val.split('_');
          const last = parts[parts.length - 1] || '';
          if (last.includes('-') && last.length > 8) {
            parts.pop();
            return parts.join('_');
          }
          // also handle direct "verifier_xxx" or similar
          if (parts.length > 1 && parts[parts.length - 1].match(/^[0-9a-f-]{8,}$/i)) {
            parts.pop();
            return parts.join('_');
          }
          return val;
        };

        // Prefer top-level sender (e.g. "briefing_agent_xxx/...") or sender inside payload, then other fields.
        const senderRaw =
          agentSource ||
          parsedWithPayload?.sender || // payload-parsed sender (if payload contained sender)
          parsed?.sender ||           // top-level sender field (common in logs)
          parsed?.msg_from ||
          parsed?.source ||
          parsed?.data?.source ||
          parsed?.from ||
          parsed?.user ||
          parsed?.username ||
          parsed?.response?.choices?.[0]?.message?.name ||
          parsed?.response?.choices?.[0]?.message?.role ||
          null;
        const sender = normalizeSender(senderRaw);

        set(state => ({
          swalMessages: [
            ...state.swalMessages,
            {
              id: state.swalMessages.length + 1,
              timestamp: Date.now(),
              raw,
            }
          ],
          swal_messages: [
            ...state.swal_messages,
            {
              id: state.swal_messages.length + 1,
              timestamp: Date.now(),
              sender,
              raw
            }
          ]
        }));
      } catch (e) {
        console.error('addToSwalMessages error', e);
      }
    },
    // State for handling mid-conversation input requests.
    waitingForInput: false,
    inputPrompt: "",
    lastLlmCallMessage: null,  // Stores the last llm_call_event message

    clearChatMessages: () => {
      postDraftAlreadyShown = false;
      set({ chatMessages: [] });
    },

    // Add a chat message.
    addToChatMessage: (content, msg_from, msgType = "text", full = null, options = {}) => {
      const { hidden = false } = options;

      let formattedContent;
      if (Array.isArray(content)) {
        formattedContent = content.map(item => formatContent(item));
      } else {
        formattedContent = formatContent(content);
      }

      // Prevent duplicate POST DRAFT bubbles from agents (user/user_proxy exempt)
      if (!TERMINATE_EXEMPT_SENDERS.has(msg_from) && containsPostDraft(formattedContent)) {
        if (postDraftAlreadyShown) return;
        postDraftAlreadyShown = true;
      }

      const rawData = full ? JSON.stringify(full) : content;

      set((state) => ({
        chatMessages: [
          ...state.chatMessages,
          {
            id: state.chatMessages.length + 1,
            message: formattedContent,
            raw: rawData,
            msg_from,
            msgType,
            hidden,
          }
        ]
      }));

      try {
        get().addToSwalMessages({ type: msgType, msg_from, raw: rawData, content: formattedContent });
      } catch (e) {
        // no-op
      }
    },

    initChatWebSocket: async () => {
      // Reset per run so next request can show a new POST DRAFT once
      postDraftAlreadyShown = false;

      // NEW: prevent double-charging (result handler + ws close)

      const createSession = async () => {
        const payloadObj = {
          id: session_id,
          user_id: user_id,
          version: "0.0.1",
          team_id: sessionStorage.getItem('squad'),
          name: sessionStorage.getItem('email') + " - " + sessionStorage.getItem('squadName')
        };
        console.log("Creating session with payload:", payloadObj);
        const response = await autogenBridgeFetch('/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payloadObj)
        });
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Session creation failed. Status: ${response.status}. Response: ${errorText}`);
        }
        const data = await response.json();
        const returnedSession = data.session || data.session_id || session_id;
        sessionStorage.setItem('session_id', returnedSession.toString());
        console.log("Session created with id:", returnedSession);
        return returnedSession;
      };

      const startRun = async (session) => {
        const payloadObj = { session_id: session, user_id: user_id };
        console.log("Starting run with payload:", payloadObj);
        const response = await autogenBridgeFetch('/runs', {
          method: 'POST',
          headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify(payloadObj)
        });
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Run creation failed. Status: ${response.status}. Response: ${errorText}`);
        }
        const responseData = await response.json();
        console.log("Run creation response data:", responseData);
        const run_id = responseData.data && responseData.data.run_id;
        if (!run_id) throw new Error("Run ID not found in response");
        return run_id;
      };

      const connectWebSocket = async () => {
        try {
          const session = await createSession();
          const run_id = await startRun(session);

          const wsUrl = await getAutogenWebSocketUrl(run_id);
          console.log("Connecting to WebSocket at:", wsUrl);

          return new Promise((resolve) => {
            const newWs = new WebSocket(wsUrl);

            newWs.onopen = () => {
              console.log("WebSocket connection open, readyState:", newWs.readyState);
              set(() => ({
                currWebSocket: newWs,
                hasSentTask: false,
                pendingResponse: false
              }));
              const pingInterval = setInterval(() => {
                if (get().currWebSocket && get().currWebSocket.readyState === WebSocket.OPEN) {
                  console.log("Sending ping over WebSocket");
                  get().currWebSocket.send(JSON.stringify({ type: "ping" }));
                }
              }, 60000);
              newWs.onclose = async (event) => {
                console.log("WebSocket closed with code:", event.code, "reason:", event.reason);
                clearInterval(pingInterval);
                set(() => ({ pendingResponse: false, currWebSocket: null }));

              };

              newWs.onmessage = (event) => {
                try {
                  const data = JSON.parse(event.data);

                  if (data.type === "completion") {
                    const completionStatus = String(data.status || '').toLowerCase();
                    const completionError = completionStatus === 'error';
                    const terminalMessage =
                      data?.data?.task_result?.messages?.find((msg) => msg?.content)?.content ||
                      data?.data?.error ||
                      (completionError ? 'The task finished with an error.' : 'The task has stopped.');

                    set({
                      hasSentTask: false,
                      pendingResponse: false,
                      currWebSocket: null,
                      lastCompletedRunId: run_id,
                      lastError: completionError ? contentToText(terminalMessage) : null,
                    });
                    get().addAgentActivity({
                      agent: 'system',
                      type: completionError ? 'error' : 'complete',
                      snippet: contentToText(terminalMessage).substring(0, 150),
                      tokens: 0,
                    });
                    newWs.close(1000, `run ${completionStatus || 'complete'}`);
                    return;
                  }

                  if (data.type === "result") {
                    // Update Session Storage with duration if provided in data.data.duration
                    if (data.data && data.data.duration) {
                      sessionStorage.setItem("TimeCounter", data.data.duration.toString());
                    }

                    if (data.data && data.data.task_result && Array.isArray(data.data.task_result.messages)) {
                      data.data.task_result.messages.forEach(msg => {
                        if (msg.type !== "TextMessage") return;   // ignore tool outputs
                        if (!msg.content) return;
                        const hidden = shouldHideByTerminateRule({
                          msg_from: msg.source,
                          msgType: "result",
                          content: msg.content
                        });
                        const items = Array.isArray(msg.content) ? msg.content : [msg.content];
                        items.forEach((item) => {
                          if (!item) return;
                          get().addToChatMessage(item, msg.source, "result", msg, { hidden });
                        });
                      });
                    }

                    set(() => ({ hasSentTask: false, pendingResponse: false }));
                    newWs.close();
                  } else if (data.type === "message" || data.type === "input_request") {
                    let handledAuthorizeLink = false;

                    if (
                      data.data &&
                      (data.data.source === "booking_agent" ||
                        data.data.source === "email_agent" ||
                        data.data.source === "posting_agent" ||
                        data.data.source === "briefing_agent" ||
                        data.data.source === "research_agent" ||
                        data.data.source === "verifier_agent" ||
                        data.data.source === "strategy_architect" ||
                        data.data.source === "media_planner" ||
                        data.data.source === "program_planner" ||
                        data.data.source === "summary_agent" ||
                        data.data.source === "document_creator_agent")
                    ) {
                      const authItems = Array.isArray(data.data.content)
                        ? data.data.content
                        : [data.data.content];
                      authItems.forEach((item) => {
                        const text = typeof item === "string" ? item : item?.content;
                        if (typeof text === "string" && text.includes("Click here to authenticate yourself")) {
                          const tupleMatch = text.match(/\('(.+?)', '(.+?)'\)/);
                          if (tupleMatch) {
                            const displayMsg = `${tupleMatch[1]} ${tupleMatch[2]}`;
                            get().addToChatMessage({ content: displayMsg }, "system", "authorize_link", data);
                          } else {
                            get().addToChatMessage({ content: text }, "system", "authorize_link", data);
                          }
                          handledAuthorizeLink = true;
                        }
                      });
                    }
                    if (data.data?.source === "llm_call_event") {
                      if (!get().waitingForInput) {
                        set(() => ({ lastLlmCallMessage: data }));
                      }
                    } else if (
                      !handledAuthorizeLink &&
                      data.data?.type === "TextMessage" &&
                      data.data?.content
                    ) {
                      const payloadItems = Array.isArray(data.data.content)
                        ? data.data.content
                        : [data.data.content];

                      payloadItems.forEach((item) => {
                        if (!item) return;

                        const msgFrom =
                          data.data.source === "user"
                            ? "user"
                            : (data.data.source || "assistant");

                        // Hide unless TERMINATE, still allow source-based hiding if you want it stricter
                        const hidden =
                          isHiddenSource(msgFrom) ||
                          shouldHideByTerminateRule({
                            msg_from: msgFrom,
                            msgType: "message",
                            content: item
                          });

                        get().addToChatMessage(
                          item,
                          msgFrom,
                          "message",
                          data,
                          { hidden }
                        );
                      });
                    } else if (data.type === "input_request") {
                      // Restore previous behavior for input_request
                      // If a llm_call_event was received previously, extract its query part.
                      const lastMsg = get().lastLlmCallMessage;
                      if (lastMsg && lastMsg.data && lastMsg.data.content) {
                        let queryText = "";
                        try {
                          const parsedContent = JSON.parse(lastMsg.data.content);
                          // Try to extract from a response structure first.
                          if (
                            parsedContent.response &&
                            parsedContent.response.choices &&
                            parsedContent.response.choices.length > 0 &&
                            parsedContent.response.choices[0].message &&
                            parsedContent.response.choices[0].message.content
                          ) {
                            queryText = parsedContent.response.choices[0].message.content;
                          } else if (parsedContent.arguments) {
                            const args = JSON.parse(parsedContent.arguments);
                            queryText = args.query || "";
                          }
                        } catch (err) {
                          console.error("Error parsing lastLlmCallMessage content:", err);
                          queryText = lastMsg.data.content;
                        }
                        if (queryText) {
                          get().addToChatMessage(queryText, lastMsg.data.source, "llm_call_event", lastMsg);
                        }
                        set(() => ({ lastLlmCallMessage: null }));
                      }
                      // Optionally, you can add a prompt message here if needed
                      set(() => ({
                        waitingForInput: true,
                        inputPrompt: data.prompt,
                        pendingResponse: false
                      }));
                    } else if (data.data && data.data.source === "booking_agent" && Array.isArray(data.data.content)) {
                      data.data.content.forEach(item => {
                        if (item && typeof item.content === "string") {
                          // Try to extract the message and URL from the tuple string
                          const tupleMatch = item.content.match(/\('(.+?)', '(.+?)'\)/);
                          if (tupleMatch) {
                            const displayMsg = `${tupleMatch[1]} ${tupleMatch[2]}`;
                            get().addToChatMessage({ content: displayMsg }, "system", "authorize_link", data);
                          } else {
                            get().addToChatMessage({ content: item.content }, "system", "authorize_link", data);
                          }
                        }
                      });
                    } else {
                      console.log("Unknown message type:", data.type);
                    }
                  } else {
                    console.log("Unknown message type:", data.type);
                  }
                } catch (e) {
                  console.error("Error parsing WebSocket message:", e);
                }
              };

              resolve(newWs);
            };

            // ...existing code...
          });
        } catch (err) {
          console.error("Failed to establish WebSocket connection:", err);
        }
      };

      await connectWebSocket();
    },

    sendChatMessageAsync: async (msg) => {
      try {
        if (get().waitingForInput) {
          const payload = JSON.stringify({ type: "input_response", response: msg });
          set(() => ({ waitingForInput: false, inputPrompt: "", lastLlmCallMessage: null }));
          console.log("Sending input_response payload:", payload);
          get().currWebSocket.send(payload);
          set(() => ({ pendingResponse: true }));
        } else {
          get().addToChatMessage(msg, "user", "user");
          if (!get().hasSentTask) {
            await runRoutingSquad(msg);
          }
          await get().initChatWebSocket();
          let payload;
          if (!get().hasSentTask) {
            const teamId = parseInt(sessionStorage.getItem('squad'));
            const auth = getAuth();
            const user = auth.currentUser;
            const entity_id =
              sessionStorage.getItem('uid') ??
              user?.uid ??
              user?.email ??
              user_id;

            const filecontent = sessionStorage.getItem('filecontent');
            const files = JSON.parse(filecontent || '[]');
            const downloadURLs = files.map(file => file.downloadURL).join(',');

            const connected_account_ids = await fetchConnectedAccountsForEntity(entity_id);

             const mcpUrls = await fetchEntityMcpUrls(entity_id);
             const fetchedTeamConfig = await fetchTeamConfig(teamId);
             const teamConfig =
               fetchedTeamConfig.data?.component ??
               fetchedTeamConfig.component ??
               fetchedTeamConfig;
            console.log('Fetched team config (raw):', teamConfig);

            const hydratedPreview = previewHydratedTeamConfig(teamConfig, mcpUrls);
            console.log('Team config with MCP replacements (preview only):', hydratedPreview);

            payload = JSON.stringify({
              type: "start",
              task: `${msg}. entity_id: ${entity_id} connected_account_ids: ${connected_account_ids} and files: ${downloadURLs}`,
              team_config: hydratedPreview
            });
            set(() => ({ hasSentTask: true }));
          }
          console.log("Sending chat message payload:", payload);
          get().currWebSocket.send(payload);
          set(() => ({ pendingResponse: true }));
        }
        setTimeout(() => {
          if (get().pendingResponse) {
            console.log("No response received within timeout, pendingResponse remains true.");
          }
        }, 30000);
      } catch (err) {
        console.error("Error sending chat message:", err);
        set(() => ({ pendingResponse: false }));
      }
    },

    notifications: [],
    notificationsUnsubscribe: null,

    subscribeNotifications: () => {
      set({ notifications: [], notificationsUnsubscribe: () => {} });
      return () => {};
    },

    markNotificationRead: async (notificationId) => {
      set((state) => ({ notifications: state.notifications.map((item) => item.id === notificationId ? { ...item, read: true } : item) }));
    },

    markAllNotificationsRead: async () => {
      set((state) => ({ notifications: state.notifications.map((item) => ({ ...item, read: true })) }));
    },

    clearReadNotifications: async () => {
      set((state) => ({ notifications: state.notifications.filter((item) => !item.read) }));
    },

    scheduledTasks: [],
    scheduledTasksLoading: false,
    taskRuns: {},
    taskRunsLoading: {},

    loadTaskRuns: async (taskId) => {
      if (!taskId) return;
      set((state) => ({
        taskRunsLoading: { ...state.taskRunsLoading, [taskId]: true },
      }));
      try {
        const runs = [];
        set((state) => ({
          taskRuns: { ...state.taskRuns, [taskId]: runs },
          taskRunsLoading: { ...state.taskRunsLoading, [taskId]: false },
        }));
      } catch (error) {
        console.error('loadTaskRuns error:', error);
        set((state) => ({
          taskRunsLoading: { ...state.taskRunsLoading, [taskId]: false },
        }));
      }
    },

    loadScheduledTasks: async () => {
      set({ scheduledTasksLoading: true });
      const rows = await localClient.schedules();
      const tasks = rows.map((row) => ({
        id: String(row.id), name: row.name, squadId: row.team_id,
        conversationId: null, prompt: row.task,
        firstRunAt: row.next_run_at, nextRunAt: row.next_run_at,
        recurrence: row.recurrence, status: row.status,
        lastRunAt: row.last_run_at, lastError: row.last_error,
      }));
      set({ scheduledTasks: tasks, scheduledTasksLoading: false });
    },

    scheduleTask: async ({ name, squadId, prompt, firstRunAt, recurrence }) => {
      const serializedRecurrence = serializeRecurrence(recurrence);
      await localClient.createSchedule({
        name,
        team_id: Number(squadId),
        task: prompt,
        recurrence: serializedRecurrence,
        next_run_at: computeNextRun({ firstRunAt: new Date(firstRunAt), recurrence }),
        status: 'active',
        require_approval: true,
      });

      await get().loadScheduledTasks();
    },

    // NEW: update an existing scheduled task
    updateScheduledTask: async ({ id, name, squadId, prompt, firstRunAt, recurrence }) => {
      if (!id) throw new Error('Missing task id');

      const serializedRecurrence = serializeRecurrence(recurrence);

      const firstRunDate = firstRunAt ? new Date(firstRunAt) : null;
      if (!firstRunDate || Number.isNaN(firstRunDate.getTime())) {
        throw new Error('Invalid firstRunAt');
      }

      await localClient.updateSchedule(id, {
        name,
        team_id: Number(squadId),
        task: prompt,
        recurrence: serializedRecurrence,
        next_run_at: computeNextRun({ firstRunAt: firstRunDate, recurrence: serializedRecurrence }),
        status: 'active',
        require_approval: true,
      });

      await get().loadScheduledTasks();
    },

    cancelScheduledTask: async (taskId) => {
      await localClient.deleteSchedule(taskId);
      await get().loadScheduledTasks();
    },

    runTaskNow: async (taskId) => {
      const task = get().scheduledTasks.find((t) => t.id === taskId);
      if (!task) return;

      const sendChatMessageAsync = get().sendChatMessageAsync;
      if (sendChatMessageAsync && task.prompt) {
        await sendChatMessageAsync(task.prompt);

      }

      await get().loadScheduledTasks();
    },

    // ...rest of store...
  };
};
