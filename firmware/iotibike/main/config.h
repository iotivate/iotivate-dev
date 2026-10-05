#pragma once

// ---------------------------------------------------------------------------
// iotiBike firmware configuration. Pins are for a classic ESP32-WROOM-32.
// ---------------------------------------------------------------------------

// --- GPS: u-blox NEO-6M on UART2 (continuous NMEA) ---
#define GPS_UART_NUM        UART_NUM_2
#define GPS_UART_BAUD       9600
#define GPS_PIN_RX          16   // ESP32 RX  <- NEO-6M TX
#define GPS_PIN_TX          17   // ESP32 TX  -> NEO-6M RX (optional)

// --- IMU: MPU6050 on I2C (tilt / motion / theft / crash events) ---
// NOTE: speed & heading come from GPS, not the IMU (accel integration drifts;
// the MPU6050 has no magnetometer). The IMU is for motion/tilt/impact events.
#define IMU_I2C_PORT        I2C_NUM_0
#define IMU_PIN_SDA         21
#define IMU_PIN_SCL         22
#define IMU_I2C_FREQ_HZ     400000
#define IMU_PIN_INT         35     // MPU6050 INT -> ESP32 (wake-on-motion)
#define IMU_ADDR            0x68   // 0x69 if AD0 is tied high
#define TILT_ALERT_DEG      35.0f  // tilt beyond this (while armed) -> alert
#define MOTION_WAKE_MG      80     // motion threshold for wake-on-motion (milli-g)

// --- Cellular: SIMCOM A7670 on UART1 (AT / PPP) ---
#define MODEM_UART_NUM      UART_NUM_1
#define MODEM_UART_BAUD     115200
#define MODEM_PIN_TX        27   // ESP32 TX  -> A7670 RX
#define MODEM_PIN_RX        26   // ESP32 RX  <- A7670 TX
#define MODEM_PIN_PWRKEY    4    // pulse to power the modem on
#define MODEM_APN           "internet"   // <-- set for your SIM/carrier

// --- Siren / alarm output (theft/tilt + remote trigger) ---
// Drives a MOSFET gate (NOT the siren directly — GPIO can't source siren current).
// Use a gate pulldown so the MOSFET stays OFF during ESP32 boot/reset (no false
// trigger on power-up). GPIO33 is output-capable and not a strapping pin.
#define SIREN_PIN           33     // -> MOSFET gate -> siren on its own supply
#define SIREN_ACTIVE_HIGH   1

// --- Power monitoring (OPTIONAL "iotiBike Power" add-on, not core V1) ---
// Voltage: divider or (preferred) ADS1115 on the shared I2C bus.
// Current: isolated Hall sensor (e.g. ACS758) -> ADS1115. INA219/226 can't be
// used — their bus-voltage limit (26-36V) is below e-bike packs (48-72V).
// Current sensing taps the battery main lead (invasive) -> keep it optional.
#define POWER_MONITOR_ENABLED 0
#define ADS1115_ADDR        0x48   // shares I2C with the MPU6050

// --- Cloud ingest (device gateway, RSA-terminated at Cloudflare) ---
#define API_HOST            "device.iotivate.dev"
#define API_PORT            443
#define API_TELEMETRY_PATH  "/api/bike/telemetry"

// --- Sampling / upload (store-and-forward) ---
#define SAMPLE_INTERVAL_S   15     // record a GPS point this often
#define UPLOAD_INTERVAL_S   60     // dial PPP and upload a batch this often
#define BATCH_MAX_POINTS    60     // server accepts 1..500 per batch
#define BUFFER_MAX_POINTS   500    // offline ring buffer before oldest drops

// --- NVS keys ---
#define NVS_NAMESPACE       "iotibike"
#define NVS_KEY_TOKEN       "dev_token"   // device token from /api/devices/pair
#define NVS_KEY_FW_VERSION  "fw_ver"

#define FW_VERSION          "0.1.0"
