# iotiBike firmware (ESP32 + A7670 + NEO-6M)

ESP-IDF firmware for the iotiBike tracker: reads GPS, batches points, and uploads
them over 4G to the iotivate cloud.

- **MCU:** classic ESP32 (ESP32-WROOM-32)
- **Cellular:** SIMCOM A7670 (Cat-1 LTE) — run as a **PPP pipe**; TLS is done on
  the ESP32 (mbedTLS) with our own CA bundle, which sidesteps the modem's TLS
  stack and its RSA/SNI limitations.
- **GPS:** u-blox NEO-6M on a dedicated UART (continuous NMEA, 9600 baud) —
  source of **position, speed, and heading**.
- **IMU:** MPU6050 (accel + gyro) on I2C — **motion / tilt / crash events** for
  theft detection and wake-on-motion. (Speed/heading are *not* derived from the
  IMU — accel integration drifts and the MPU6050 has no magnetometer.)
- **Cloud:** `POST https://device.iotivate.dev/api/bike/telemetry`
  (device-token auth). Contract: `docs/RADAR_FIRMWARE_INTEGRATION.md`.

## Architecture

```
NEO-6M ──UART2(NMEA)──▶ ESP32 ──UART1(AT/PPP)──▶ A7670 ──4G──▶ device.iotivate.dev
                          │
                   buffer points (NVS/RAM), batch-upload over PPP+esp_tls,
                   flush offline buffer on reconnect. Token stored in NVS.
```

Store-and-forward: GPS runs continuously; the modem dials PPP periodically to
upload a batch, then can idle — saving data and power on a mobile device.

## Wiring

| Link | ESP32 pin | Module pin | Notes |
|------|-----------|-----------|-------|
| GPS RX | GPIO16 (UART2 RX) | NEO-6M TX | 9600 baud NMEA |
| GPS TX | GPIO17 (UART2 TX) | NEO-6M RX | optional (config) |
| Modem TX | GPIO27 (UART1 TX) | A7670 RX | 115200 |
| Modem RX | GPIO26 (UART1 RX) | A7670 TX | 115200 |
| Modem PWRKEY | GPIO4 | A7670 PWRKEY | power-on pulse |
| IMU SDA | GPIO21 | MPU6050 SDA | I2C |
| IMU SCL | GPIO22 | MPU6050 SCL | I2C |
| IMU INT | GPIO35 | MPU6050 INT | wake-on-motion (optional) |
| GND | GND | all | common ground |

⚠️ **Power the A7670 from its own 3.4–4.2 V supply with 1000 µF+ bulk capacitance**
— it spikes ~2 A on transmit and will brown out the ESP32 otherwise. GPS is 3.3 V.

Pins are configurable in `main/config.h`.

## Build & flash (ESP-IDF v5.x)

```bash
cd firmware/iotibike
idf.py set-target esp32
idf.py menuconfig        # set APN + device token (or provision at runtime)
idf.py build
idf.py -p /dev/ttyUSB0 flash monitor
```

## Configuration
- Pins, baud, API host/path, sample/upload intervals: `main/config.h`.
- Cellular APN: set for your SIM (menuconfig / config.h).
- Device token: obtained once from `POST /api/devices/pair`, stored in NVS.
- CA bundle: `main/certs/` (the root CA `device.iotivate.dev` chains to).

## Status
Scaffold + boot. Build order (matches the content series):
1. **GPS lock** (`gps.c`) — first NMEA fix *(Episode 2: "first signal")*.
2. **IMU** (`imu.c`) — tilt/motion/crash events + wake-on-motion (theft).
3. **Cellular PPP** (`modem.c`) — A7670 dial-up.
4. **Upload** (`uploader.c`) — batched TLS POST + offline buffer.

Note: the cloud ingest currently accepts GPS points only
(`POST /api/bike/telemetry`). IMU **events** (movement / tilt / crash alerts)
will need a small backend extension — an event type alongside the GPS batch.
