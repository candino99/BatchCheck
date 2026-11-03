
"use strict";

(() => {
  const panel = document.createElement("section");
  panel.className = "panel";

  panel.innerHTML = `
    <h2>🚗 GPS Drive to Store</h2>
    <p class="note">
      Enter the confirmed pickup store address,
      not the customer's delivery address.
    </p>
    <label>
      Store pickup address
      <input id="route-address"
        placeholder="Store street address, city, FL"
        style="width:100%;box-sizing:border-box">
    </label>
    <div class="actions">
      <button type="button" id="route-check">
        Calculate GPS drive
      </button>
    </div>
    <p id="route-result" aria-live="polite">
      Waiting for a store address.
    </p>
    <p class="note">
      Road estimate only; live traffic not included.
    </p>
  `;

  const gpsPanel = document.querySelector("#gps-status")
    ?.closest("section");

  if (gpsPanel) gpsPanel.after(panel);
  else document.querySelector("header")?.after(panel);

  const address = panel.querySelector("#route-address");
  const result = panel.querySelector("#route-result");
  const button = panel.querySelector("#route-check");

  button.addEventListener("click", async () => {
    const location = window.batchCheckLocation;
    const query = address.value.trim();

    if (!location) {
      result.textContent = "Waiting for GPS connection.";
      return;
    }

    if (!query) {
      result.textContent = "Enter the pickup store address.";
      return;
    }

    button.disabled = true;
    result.textContent = "Finding store and calculating route...";

    try {
      const searchURL =
        "https://nominatim.openstreetmap.org/search" +
        "?format=json&limit=3&countrycodes=us&q=" +
        encodeURIComponent(query);

      const geoResponse = await fetch(searchURL);

      if (!geoResponse.ok) {
        throw new Error("Address lookup unavailable.");
      }

      const matches = await geoResponse.json();

      if (!matches.length) {
        throw new Error("Store address not found.");
      }

      if (matches.length > 1) {
        result.textContent =
          "Multiple locations found. Enter a more exact " +
          "street address and ZIP code.";
        return;
      }

      const store = matches[0];
      const lon = Number(store.lon);
      const lat = Number(store.lat);

      const routeURL =
        "https://router.project-osrm.org/route/v1/driving/" +
        location.longitude + "," + location.latitude +
        ";" + lon + "," + lat +
        "?overview=false";

      const routeResponse = await fetch(routeURL);

      if (!routeResponse.ok) {
        throw new Error("Routing service unavailable.");
      }

      const data = await routeResponse.json();

      if (data.code !== "Ok" || !data.routes?.length) {
        throw new Error("No driving route found.");
      }

      const minutes = Math.ceil(
        data.routes[0].duration / 60
      );

      const miles = (
        data.routes[0].distance / 1609.344
      ).toFixed(1);

      result.textContent =
        `Estimated drive: ${minutes} minutes (${miles} miles). ` +
        `Verify destination: ${store.display_name}.`;

      // Update the manual calculator's drive field.
      const driveInput = document.querySelector("#drive");

      if (driveInput) {
        driveInput.value = minutes;
      }

      window.batchCheckRoute = {
        minutes,
        miles: Number(miles),
        destination: store.display_name,
        timestamp: Date.now()
      };

    } catch (error) {
      result.textContent =
        "Unable to calculate route: " + error.message;
    } finally {
      button.disabled = false;
    }
  });
})();

