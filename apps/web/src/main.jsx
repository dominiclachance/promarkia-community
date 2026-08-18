import { createRoot } from "react-dom/client";
import App from './App.jsx';
import { ThemeContextProvider } from "./components/chat/layout/ThemeContext.jsx";
import './i18n'; // Import i18n configuration

const DEFAULT_AVATAR =
  'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji/assets/Person/3D/person_3d.png';
window.defaultAvatar = window.defaultAvatar || DEFAULT_AVATAR;

function bootstrap() {
  const root = createRoot(document.getElementById("root"));
  root.render(
    <ThemeContextProvider>
      <App />
    </ThemeContextProvider>
  );
}

if (window.location.hostname === '127.0.0.1') {
  const canonicalUrl = new URL(window.location.href);
  canonicalUrl.hostname = 'localhost';
  window.location.replace(canonicalUrl);
} else {
  bootstrap();
}
