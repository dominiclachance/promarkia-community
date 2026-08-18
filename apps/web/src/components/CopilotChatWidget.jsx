"use client";
import { useEffect } from "react";
import PropTypes from "prop-types";

export default function CopilotChatWidget({
  iframeSrc = "/chat.html",
  autoOpenDelay = 10000,   // ignored when side === "left"
  side = "right",          // "left" | "right"
  startExpanded = false,
} = {}) {
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    // Read CSS vars that App.jsx writes to :root
    const readVars = () => {
      const cs = getComputedStyle(document.documentElement);
      return {
        launcherBg: cs.getPropertyValue("--chat-launcher-bg").trim() || "#8139ff",
        launcherFg: cs.getPropertyValue("--chat-launcher-fg").trim() || "#ffffff",
        panelBg:    cs.getPropertyValue("--chat-panel-bg").trim()    || "#ffffff",
        controlBg:  cs.getPropertyValue("--chat-control-bg").trim()  || "#ffffff",
        controlFg:  cs.getPropertyValue("--chat-control-fg").trim()  || "#000000",
      };
    };

    // Minimal global API stub
    if (!window.CopilotChat) {
      window.CopilotChat = {
        open: () => {},
        close: () => {},
        toggle: () => {},
        expand: () => {},
        collapse: () => {},
        isOpen: () => false,
        isExpanded: () => false,
      };
    }

    const isLeft = String(side).toLowerCase() === "left";
    let { launcherBg, launcherFg, panelBg, controlBg, controlFg } = readVars();

    // If elements exist already (e.g. theme flipped), just restyle
    const restyleExisting = () => {
      const l = document.getElementById("copilot-chat-launcher");
      const c = document.getElementById("copilot-chat-container");
      const close = document.getElementById("copilot-chat-close");
      const expand = document.getElementById("copilot-chat-expand");
      if (l) { l.style.background = launcherBg; l.style.color = launcherFg; }
      if (c) { c.style.background = panelBg; }
      if (close) { close.style.background = controlBg; close.style.color = controlFg; }
      if (expand){ expand.style.background = controlBg; expand.style.color = controlFg; }
    };

    if (document.getElementById("copilot-chat-launcher")) {
      restyleExisting();
      // Also push palette to iframe
      const frame = document.getElementById("copilot-chat-iframe");
      if (frame?.contentWindow) {
        frame.contentWindow.postMessage({
          type: "chat-theme",
          palette: {
            accent: launcherBg,
            bannerBg: launcherBg,
            bannerFg: launcherFg,
            panelBg,
            suggestedBorder: controlFg,
            suggestedFg: controlFg,
            suggestedBg: "#ffffff",
          }
        }, "*");
      }
      return;
    }

    // --- Create DOM nodes
    const launcher = document.createElement("button");
    launcher.id = "copilot-chat-launcher";
    launcher.type = "button";
    launcher.setAttribute("aria-label", "Open chat");
    launcher.innerHTML = `
      <svg viewBox="0 0 24 24" width="32" height="32" aria-hidden="true" style="pointer-events:none">
        <path d="M21 3H3a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h2v4l4-4h12a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Z"
              fill="none" stroke="currentColor" stroke-width="2"></path>
        <circle cx="8.5" cy="11" r="1.5" fill="currentColor"></circle>
        <circle cx="12"  cy="11" r="1.5" fill="currentColor"></circle>
        <circle cx="15.5" cy="11" r="1.5" fill="currentColor"></circle>
      </svg>`;
    launcher.style.cssText = `
      position:fixed; bottom:24px; ${isLeft ? "left:24px;" : "right:24px;"}
      width:64px; height:64px; border:none; border-radius:50%;
      background:${launcherBg}; color:${launcherFg};
      display:flex; align-items:center; justify-content:center;
      cursor:pointer; box-shadow:0 4px 12px rgba(0,0,0,.3); z-index:9998;
    `;

    const container = document.createElement("div");
    container.id = "copilot-chat-container";
    container.setAttribute("role", "dialog");
    container.setAttribute("aria-modal", "false");
    container.style.cssText = `
      position:fixed; bottom:24px; ${isLeft ? "left:22px;" : "right:22px;"}
      width:400px; height:600px; max-width:100%;
      max-height:calc(100% - 48px);
      display:none; z-index:9999;
      box-shadow:0 4px 16px rgba(0,0,0,.25);
      border-radius:12px; overflow:hidden; background:${panelBg};
    `;

    const iframe = document.createElement("iframe");
    iframe.id = "copilot-chat-iframe";
    iframe.src = iframeSrc;
    iframe.frameBorder = "0";
    iframe.title = "Chat";
    iframe.style.cssText = "width:100%; height:100%; border:0;";

    const closeBtn = document.createElement("button");
    closeBtn.id = "copilot-chat-close";
    closeBtn.type = "button";
    closeBtn.textContent = "×";
    closeBtn.setAttribute("aria-label", "Close chat");
    closeBtn.style.cssText = `
      position:absolute; top:8px; right:8px;
      width:32px; height:32px; border:none; border-radius:50%;
      background:${controlBg}; color:${controlFg};
      font-size:24px; line-height:32px;
      cursor:pointer; box-shadow:0 2px 8px rgba(0,0,0,.3);
    `;

    const expandBtn = document.createElement("button");
    expandBtn.id = "copilot-chat-expand";
    expandBtn.type = "button";
    expandBtn.textContent = "⤢";
    expandBtn.title = "Expand to 50%";
    expandBtn.style.cssText = `
      position:absolute; top:8px; right:48px;
      width:32px; height:32px; border:none; border-radius:50%;
      background:${controlBg}; color:${controlFg};
      font-size:18px; line-height:32px;
      cursor:pointer; box-shadow:0 2px 8px rgba(0,0,0,.3);
    `;

    container.append(iframe, closeBtn, expandBtn);

    // Expanded state handling
    let isExpanded = false;
    const setExpanded = (expanded) => {
      if (expanded) {
        container.style.width = "50vw";
        container.style.height = "60vh";
        container.style.top = "50%";
        container.style.left = "50%";
        container.style.right = "auto";
        container.style.bottom = "auto";
        container.style.transform = "translate(-50%, -50%)";
        expandBtn.textContent = "⤡";
        expandBtn.title = "Collapse back";
      } else {
        container.style.width = "400px";
        container.style.height = "600px";
        container.style.bottom = "24px";
        container.style.top = "auto";
        container.style.transform = "none";
        if (isLeft) { container.style.left = "22px"; container.style.right = "auto"; }
        else { container.style.right = "22px"; container.style.left = "auto"; }
        expandBtn.textContent = "⤢";
        expandBtn.title = "Expand to 50%";
      }
      isExpanded = expanded;
    };

    const openChat = () => {
      launcher.style.display = "none";
      container.style.display = "block";
      if (startExpanded || isLeft) setExpanded(true);
      setTimeout(() => iframe.focus(), 0);
      window.dispatchEvent(new CustomEvent("copilot-chat:open"));

      // Push current palette to iframe on open
      iframe.contentWindow?.postMessage({
        type: "chat-theme",
        palette: {
          accent: launcherBg,
          bannerBg: launcherBg,
          bannerFg: launcherFg,
          panelBg,
          suggestedBorder: controlFg,
          suggestedFg: controlFg,
          suggestedBg: "#ffffff",
        }
      }, "*");
    };

    const closeChat = () => {
      container.style.display = "none";
      launcher.style.display = "flex";
      if (isExpanded) setExpanded(false);
      window.dispatchEvent(new CustomEvent("copilot-chat:close"));
    };

    const toggleExpand = () => setExpanded(!isExpanded);

    launcher.addEventListener("click", openChat);
    closeBtn.addEventListener("click", closeChat);
    expandBtn.addEventListener("click", toggleExpand);

    // Auto-open only when side !== left
    let autoTimer;
    if (!isLeft && typeof autoOpenDelay === "number" && autoOpenDelay > 0) {
      autoTimer = window.setTimeout(openChat, autoOpenDelay);
      launcher.addEventListener("click", () => autoTimer && clearTimeout(autoTimer));
    }

    // Global API
    window.CopilotChat = {
      open: openChat,
      close: closeChat,
      toggle: () => (container.style.display === "block" ? closeChat() : openChat()),
      expand: () => setExpanded(true),
      collapse: () => setExpanded(false),
      isOpen: () => container.style.display === "block",
      isExpanded: () => isExpanded,
    };

    // Mount
    const mount = () => document.body.append(launcher, container);
    if (document.readyState === "loading") {
      const once = () => { mount(); document.removeEventListener("DOMContentLoaded", once); };
      document.addEventListener("DOMContentLoaded", once);
    } else {
      mount();
    }

    // Respond to app theme changes (App.jsx dispatches 'app-theme-change')
    const onThemeChange = () => {
      ({ launcherBg, launcherFg, panelBg, controlBg, controlFg } = readVars());
      restyleExisting();

      // Forward to iframe so it can re-render Web Chat
      const frame = document.getElementById("copilot-chat-iframe");
      if (frame?.contentWindow) {
        frame.contentWindow.postMessage({
          type: "chat-theme",
          palette: {
            accent: launcherBg,
            bannerBg: launcherBg,
            bannerFg: launcherFg,
            panelBg,
            suggestedBorder: controlFg,
            suggestedFg: controlFg,
            suggestedBg: "#ffffff",
          }
        }, "*");
      }
    };
    window.addEventListener("app-theme-change", onThemeChange);

    // Cleanup
    return () => {
      try {
        launcher.removeEventListener("click", openChat);
        closeBtn.removeEventListener("click", closeChat);
        expandBtn.removeEventListener("click", toggleExpand);
        window.removeEventListener("app-theme-change", onThemeChange);
        if (autoTimer) clearTimeout(autoTimer);
        if (launcher.parentNode) launcher.parentNode.removeChild(launcher);
        if (container.parentNode) container.parentNode.removeChild(container);
      } catch (error) {
        // Cleanup is best-effort when the embedding host removes nodes first.
      }
    };
  }, [iframeSrc, autoOpenDelay, side, startExpanded]);

  return null;
}

CopilotChatWidget.propTypes = {
  iframeSrc: PropTypes.string,
  autoOpenDelay: PropTypes.number,
  side: PropTypes.string,
  startExpanded: PropTypes.bool,
};
