// iotiBike firmware — entry point.
//
// Boots the device, initializes NVS (device-token storage), and will orchestrate
// the three subsystems as they land:
//   1. gps.c      — NEO-6M NMEA parsing (UART2)        [next]
//   2. modem.c    — A7670 PPP dial-up (UART1)
//   3. uploader.c — batched TLS POST + offline buffer
//
// Flow (store-and-forward): sample GPS every SAMPLE_INTERVAL_S into a buffer;
// every UPLOAD_INTERVAL_S bring up PPP and POST the batch to the cloud; flush
// the offline buffer on reconnect.

#include <stdio.h>

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "nvs_flash.h"
#include "esp_log.h"
#include "esp_system.h"

#include "config.h"

static const char *TAG = "iotibike";

static void init_nvs(void)
{
    esp_err_t err = nvs_flash_init();
    if (err == ESP_ERR_NVS_NO_FREE_PAGES || err == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_ERROR_CHECK(nvs_flash_erase());
        err = nvs_flash_init();
    }
    ESP_ERROR_CHECK(err);
}

void app_main(void)
{
    ESP_LOGI(TAG, "iotiBike firmware v%s booting", FW_VERSION);
    init_nvs();

    ESP_LOGI(TAG, "config: GPS UART%d @ %d, modem UART%d @ %d, host %s",
             GPS_UART_NUM, GPS_UART_BAUD, MODEM_UART_NUM, MODEM_UART_BAUD, API_HOST);

    // TODO(step 1): gps_start();        // begin NMEA parse task, log first fix
    // TODO(step 2): modem_start();      // power A7670, dial PPP
    // TODO(step 3): uploader_start();   // batch + POST to API_TELEMETRY_PATH

    // Heartbeat until the subsystems are wired in.
    while (true) {
        ESP_LOGI(TAG, "alive (subsystems pending) — free heap: %lu",
                 (unsigned long) esp_get_free_heap_size());
        vTaskDelay(pdMS_TO_TICKS(10000));
    }
}
