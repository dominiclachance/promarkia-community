from __future__ import annotations

import argparse
import base64
import json
import shutil
import subprocess
import tempfile
import time
import urllib.parse
import urllib.request
from pathlib import Path

from websockets.sync.client import connect


def chrome_path() -> str:
    candidates = [
        shutil.which("chrome"),
        shutil.which("google-chrome"),
        shutil.which("chromium"),
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    ]
    for candidate in candidates:
        if candidate and Path(candidate).is_file():
            return candidate
    raise RuntimeError("Chrome or Chromium was not found")


class Cdp:
    def __init__(self, socket_url: str):
        self.socket = connect(socket_url)
        self.request_id = 0

    def call(self, method: str, params: dict | None = None) -> dict:
        self.request_id += 1
        current = self.request_id
        self.socket.send(json.dumps({"id": current, "method": method, "params": params or {}}))
        while True:
            message = json.loads(self.socket.recv())
            if message.get("id") == current:
                if "error" in message:
                    raise RuntimeError(message["error"])
                return message.get("result", {})

    def evaluate(self, expression: str):
        result = self.call(
            "Runtime.evaluate",
            {"expression": expression, "returnByValue": True, "awaitPromise": True},
        )
        if "exceptionDetails" in result:
            description = result.get("result", {}).get("description", "JavaScript evaluation failed")
            raise RuntimeError(description)
        return result["result"].get("value")

    def capture(self, path: Path, *, full_page: bool = False) -> None:
        params: dict = {"format": "png", "fromSurface": True}
        if full_page:
            metrics = self.call("Page.getLayoutMetrics")
            size = metrics["cssContentSize"]
            params["captureBeyondViewport"] = True
            params["clip"] = {
                "x": 0,
                "y": 0,
                "width": size["width"],
                "height": size["height"],
                "scale": 1,
            }
        payload = self.call("Page.captureScreenshot", params)
        path.write_bytes(base64.b64decode(payload["data"]))

    def close(self) -> None:
        self.socket.close()


def wait_for_json(url: str, timeout: float = 15) -> dict:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=1) as response:
                return json.load(response)
        except OSError:
            time.sleep(0.2)
    raise RuntimeError(f"Timed out waiting for {url}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://127.0.0.1:8788")
    parser.add_argument("--output", type=Path, default=Path("docs/assets"))
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    frames = args.output / "demo-frames"
    frames.mkdir(exist_ok=True)

    profile = tempfile.mkdtemp(prefix="promarkia-capture-")
    process = subprocess.Popen(
        [
            chrome_path(),
            "--headless=new",
            "--disable-gpu",
            "--hide-scrollbars",
            "--remote-debugging-port=9334",
            f"--user-data-dir={profile}",
            "about:blank",
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    cdp = None
    try:
        wait_for_json("http://127.0.0.1:9334/json/version")
        request = urllib.request.Request(
            "http://127.0.0.1:9334/json/new?"
            + urllib.parse.quote(args.url, safe=":/?=&"),
            method="PUT",
        )
        with urllib.request.urlopen(request) as response:
            target = json.load(response)
        cdp = Cdp(target["webSocketDebuggerUrl"])
        cdp.call("Page.enable")
        cdp.call(
            "Emulation.setDeviceMetricsOverride",
            {"width": 1280, "height": 900, "deviceScaleFactor": 1, "mobile": False},
        )
        cdp.call("Page.reload", {"ignoreCache": True})
        time.sleep(1)
        cdp.capture(frames / "frame-00.png")

        values = [
            ("company-url", "https://example.com"),
            ("goal", "Launch a local AI campaign workspace"),
            ("audience", "Founder-led marketing teams"),
            ("offer", "Free Community Edition"),
        ]
        for index, (element_id, value) in enumerate(values, start=1):
            cdp.evaluate(
                "(() => { const el=document.getElementById(%s); el.value=%s; "
                "el.dispatchEvent(new Event('input',{bubbles:true})); })()"
                % (json.dumps(element_id), json.dumps(value))
            )
            cdp.capture(frames / f"frame-{index:02d}.png")

        created = cdp.evaluate(
            """(async () => {
              const response = await fetch('/api/campaigns', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                  company_url: document.getElementById('company-url').value,
                  goal: document.getElementById('goal').value,
                  audience: document.getElementById('audience').value,
                  offer: document.getElementById('offer').value
                })
              });
              if (!response.ok) throw new Error(await response.text());
              return await response.json();
            })()"""
        )
        cdp.evaluate(
            "campaignId=%s; result.classList.remove('hidden'); "
            "statusEl.textContent='queued'; loadCampaign();"
            % json.dumps(created["id"])
        )
        deadline = time.time() + 45
        while time.time() < deadline:
            status = cdp.evaluate(
                "(async () => { await loadCampaign(); "
                "return document.getElementById('status').textContent.trim(); })()"
            )
            if status in {"awaiting approval", "failed"}:
                break
            time.sleep(0.25)
        if status != "awaiting approval":
            raise RuntimeError(f"Campaign did not complete for capture: {status}")
        cdp.evaluate("document.getElementById('result').scrollIntoView({block:'start'})")
        time.sleep(0.3)
        cdp.capture(frames / "frame-05.png")
        cdp.evaluate("document.getElementById('approve-button').click()")
        time.sleep(0.5)
        cdp.capture(frames / "frame-06.png")

        cdp.evaluate("window.scrollTo(0,0)")
        cdp.capture(args.output / "community-desktop.png", full_page=True)
        cdp.call(
            "Emulation.setDeviceMetricsOverride",
            {"width": 390, "height": 844, "deviceScaleFactor": 1, "mobile": True},
        )
        cdp.call("Page.reload", {"ignoreCache": True})
        time.sleep(0.8)
        cdp.capture(args.output / "community-mobile.png", full_page=True)
    finally:
        if cdp:
            cdp.close()
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
        shutil.rmtree(profile, ignore_errors=True)


if __name__ == "__main__":
    main()
