#!/usr/bin/env python3
"""Radar device simulator — streams synthetic telemetry so the dashboard, zones,
rules, and alarms can be exercised without a physical ESP32.

Usage:
    1. Run the backend and frontend.
    2. Sign in, go to /radar/devices, "Add device", copy the pairing code.
    3. python scripts/simulate_device.py <PAIRING_CODE>
    4. Open the device dashboard, draw a zone, add an "enter" rule (optionally
       with the alarm action). Watch a target sweep the field and trip it.

The simulator pairs itself (the pairing endpoint is unauthenticated by design),
then streams a target walking around the field. It also prints any command
frames the server sends back — so a fired alarm shows up here as "ALARM ON".
"""

import argparse
import asyncio
import json
import math
import sys
import urllib.parse
import urllib.request

import websockets


def pair(api: str, code: str) -> str:
    """Exchange a pairing code for a device token via POST /api/devices/pair."""
    req = urllib.request.Request(
        f"{api}/api/devices/pair",
        data=json.dumps({"pairing_code": code}).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())["device_token"]
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")
        sys.exit(f"Pairing failed ({e.code}): {detail}")


async def run(api: str, token: str, rate_hz: float) -> None:
    ws_url = api.replace("http", "ws", 1) + "/ws/radar/device?token=" + urllib.parse.quote(token)
    async with websockets.connect(ws_url) as ws:
        print(f"connected; streaming ~{rate_hz:.0f} Hz. Ctrl-C to stop.")
        period = 1.0 / rate_hz

        async def sender() -> None:
            seq = 0
            while True:
                t = seq * period
                # A target walking a lazy figure across the field (metres).
                x = 3.0 * math.sin(t * 0.5)
                y = max(0.2, 3.0 + 2.0 * math.sin(t * 0.3))
                frame = {
                    "type": "telemetry",
                    "seq": seq,
                    "targets": [{"x": round(x, 2), "y": round(y, 2)}],
                }
                await ws.send(json.dumps(frame))
                seq += 1
                await asyncio.sleep(period)

        async def receiver() -> None:
            async for raw in ws:
                try:
                    msg = json.loads(raw)
                except ValueError:
                    continue
                if msg.get("command") == "alarm":
                    print(f"  >>> ALARM {str(msg.get('state', '?')).upper()} "
                          f"(duration_ms={msg.get('duration_ms')})")
                elif msg.get("type") == "error":
                    print("  server error:", msg)

        await asyncio.gather(sender(), receiver())


def main() -> None:
    p = argparse.ArgumentParser(description="Radar device simulator")
    p.add_argument("pairing_code", help="pairing code shown in the dashboard")
    p.add_argument("--api", default="http://localhost:8000", help="backend base URL")
    p.add_argument("--rate", type=float, default=5.0, help="telemetry frames per second")
    args = p.parse_args()

    token = pair(args.api, args.pairing_code.strip().upper())
    print("paired OK")
    try:
        asyncio.run(run(args.api, token, args.rate))
    except KeyboardInterrupt:
        print("\nstopped")


if __name__ == "__main__":
    main()
