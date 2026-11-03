
"use strict";

(() => {
  const panel = document.createElement("section");
  panel.className = "panel";
  panel.innerHTML = `
    <h2>📍 Live GPS</h2>
    <p id="gps-status" aria-live="polite">
      Waiting for location permission...
    </p>
    <p id="gps-details" class="note"></p>
    <button id="gps-retry" type="button" class="secondary">
      Enable / Retry GPS
    </button>
    <p class="note">
      GPS updates while this page is active.
      Driving time still requires a verified store location
      and road-routing service.
    </p>
  `;

  const header = document.querySelector("header");
  if (header) header.after(panel);
  else document.body.prepend(panel);

  const status = panel.querySelector("#gps-status");
  const details = panel.querySelector("#gps-details");
  const retry = panel.querySelector("#gps-retry");

  let watchId = null;

  function startGPS() {
    if (!navigator.geolocation) {
      status.textContent = "GPS is not supported in this browser.";
      return;
    }

    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
    }

    status.textContent = "Connecting to GPS...";

    watchId = navigator.geolocation.watchPosition(
      position => {
        const { latitude, longitude, accuracy } = position.coords;

        // Keep the current position available to BatchCheck.
        window.batchCheckLocation = {
          latitude,
          longitude,
          accuracy,
          timestamp: position.timestamp
        };

        status.textContent = "🟢 GPS connected — Live location";

        details.textContent =
          `Accuracy: approximately ${Math.round(accuracy)} meters` +
          ` · Last updated: ${new Date(position.timestamp).toLocaleTimeString()}`;

        retry.textContent = "Refresh GPS";
      },
      error => {
        const messages = {
          1: "Location permission denied. Enable it in Safari settings.",
          2: "Location unavailable. Check Location Services.",
          3: "GPS timed out. Trying again may help."
        };

        status.textContent =
          "⚠ " + (messages[error.code] || "Unable to get location.");

        details.textContent = "No current GPS position available.";
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 20000
      }
    );
  }

  retry.addEventListener("click", startGPS);

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) startGPS();
  });

  startGPS();
})();

