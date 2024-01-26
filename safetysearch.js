window.addEventListener("DOMContentLoaded", () => {
  //Set input / output containers
  const outputContainer = document.querySelector("div#results");
  const form = document.querySelector("form#system-search");

  //Set headers for requests
  const requestHeaders = new Headers({
    accept: "application/json",
    "Accept-Language": "en",
    "Content-Type": "application/json",
  });
  let systemJumpsData, systemKillsData;
  const systems = [];

  fetch("https://esi.evetech.net/latest/universe/systems/?datasource=tranquility", {
    method: "GET",
    mode: "cors",
    headers: requestHeaders,
  })
    .then((res) => {
      if (!res.ok) {
        throw new Error(`HTTP error! Status: ${res.status}`);
      }
      return res.json();
    })
    .then((resData) => {
      resData.forEach((system) => {
        systems.push(system);
      });
    })
    .catch((err) => console.warn(err));

  //Fetch all system jumps and all system kills
  //[System jumps]
  fetch(
    "https://esi.evetech.net/latest/universe/system_jumps/?datasource=tranquility",
    {
      method: "GET",
      mode: "cors",
      headers: requestHeaders,
    }
  )
    .then((res) => {
      if (!res.ok) {
        throw new Error(`HTTP error! Status: ${res.status}`);
      }
      return res.json();
    })
    .then((resData) => {
      systemJumpsData = resData;

      //[System kills]
      fetch(
        "https://esi.evetech.net/latest/universe/system_kills/?datasource=tranquility",
        {
          method: "GET",
          mode: "cors",
          headers: requestHeaders,
        }
      )
        .then((res) => {
          if (!res.ok) {
            throw new Error(`HTTP error! Status: ${res.status}`);
          }
          return res.json();
        })
        .then((resData) => {
          systemKillsData = resData;

          const browserBody = document.getElementById("browser-main");
          const preloadMessage = document.getElementById("data-preload");

          preloadMessage.remove();
          browserBody.className = "";
        })
        .catch((err) => console.warn(err));
    })
    .catch((err) => console.warn(err));

  //System submission
  form.addEventListener("submit", handleSubmit);

  function handleSubmit(evt) {
    outputContainer.innerHTML =
      'Loading, please wait... <span class="load-spinner">*</span>';
    evt.preventDefault();
    const formData = new FormData(form, evt.submitter);
    const loadSpinner = document.getElementById("load-spinner");

    if (formData.get("system-name")) {
      //Submit the request
      fetch(
        "https://esi.evetech.net/latest/universe/ids/?datasource=tranquility&language=en",
        {
          method: "POST",
          body: JSON.stringify([formData.get("system-name")]),
          mode: "cors",
          headers: requestHeaders,
        }
      )
        .then((res) => {
          if (!res.ok) {
            throw new Error(`HTTP error! Status: ${res.status}`);
          }
          return res.json();
        })
        .then((resData) => {
          //Clear Results
          outputContainer.innerHTML = "";

          if (resData?.systems) {
            handleSystemData(resData.systems);
          } else {
            outputContainer.innerHTML = "No results found :(";
          }
        })
        .catch((err) => console.warn(err));
    }
  }

  function handleSystemData(systems) {
    const systemDataPromises = systems.map((system) => {
      return fetchSystemDetails(system.id);
    });

    Promise.all(systemDataPromises)
      .then((systemDataArray) => {
        systemDataArray.forEach((systemData) => {
          const listElem = createListElement(systemData);
          outputContainer.appendChild(listElem);
        });
      })
      .catch((err) => console.warn(err));
  }

  function fetchSystemDetails(systemId) {
    return fetch(
      `https://esi.evetech.net/latest/universe/systems/${systemId}/?datasource=tranquility&language=en`,
      {
        method: "GET",
        mode: "cors",
        headers: requestHeaders,
      }
    )
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP error! Status: ${res.status}`);
        }
        return res.json();
      })
      .then((resExpandedData) => {
        return {
          systemId: systemId,
          expandedData: resExpandedData,
        };
      });
  }

  function createListElement(systemData) {
    const { systemId, expandedData } = systemData;
    const foundSystemJumps = systemJumpsData.filter(
      (system) => system.system_id === systemId
    );
    const foundSystemKills = systemKillsData.filter(
      (system) => system.system_id === systemId
    );

    const jumpKillRatio = foundSystemKills[0]
      ? (foundSystemKills[0].ship_kills / foundSystemJumps[0].ship_jumps) * 100
      : 0;

    const listElem = document.createElement("p");
    const securityStatus = expandedData.security_status.toFixed(2);
    let secLevelColor;
    if (securityStatus >= 0.5) {
      secLevelColor = "lightblue";
    } else if (securityStatus >= 0.0 && securityStatus < 0.5) {
      secLevelColor = "darkorange";
    } else {
      secLevelColor = "mediumvioletred";
    }

    let secLevelText;
    if (securityStatus >= 0.5) {
      secLevelText = "[ HIGH ]";
    } else if (securityStatus >= 0.0 && securityStatus < 0.5) {
      secLevelText = "[ LOW ]";
    } else {
      secLevelText = "[ NULL ]";
    }

    listElem.innerHTML = `
      <section class="text-center p-3">
          <header class="text-muted display-4">
              ${expandedData.name}
          </header>
          Security: ${securityStatus}<section class="d-inline h4" style="color: ${secLevelColor};">
              ${secLevelText}
          </section>
          <br />
          <br />
          <section class="border d-inline-block border-1 border-warning border-start-0 border-top-0 border-end-0">
              Stats from the last hour:
          </section>
          <br />
          <br />
          Jumps: ${foundSystemJumps[0].ship_jumps}
          <br />
          <span class="text-primary">
          Player Kills</span>: ${foundSystemKills[0]?.ship_kills || "None"}
          <br />
          <span class="text-primary">
          Pod Kills</span>: ${foundSystemKills[0]?.pod_kills || "None"}
          <br />
          <span class="text-primary">
          NPC Kills</span>: ${foundSystemKills[0]?.npc_kills || "None"}
          <br />
          <br />
          <span class="text-primary">
          Jump / Kill ratio</span>: ${jumpKillRatio.toFixed(2)}%
          <br />
          <span class="text-primary">
          Chance of PvP</span>: ${analyzeKillRisk(jumpKillRatio)}
      </section>`;
    return listElem;
  }

  function analyzeKillRisk(ratio) {
    console.log(ratio);
    if (ratio <= 2)
      return '<span class="rounded bg-success border border-success p-1">ALMOST NONE</span>';
    else if (ratio > 2 && ratio <= 10)
      return '<span class="rounded bg-success border border-success p-1">VERY LOW</span>';
    else if (ratio > 10 && ratio <= 15)
      return '<span class="rounded bg-warning border border-warning p-1">LOW, BUT WITH CHANCES</span>';
    else if (ratio > 15 && ratio <= 40)
      return '<span style="color: darkorange;border: 1px solid darkorange;">MODERATE</span>';
    else if (ratio > 40 && ratio <= 60)
      return '<span class="p-1" style="color: mediumvioletred;background-color: mediumvioletred;">HIGH</span>';
    else if (ratio > 60)
      return '<span class="rounded bg-danger border border-danger p-1">PVP IS VERY PROBABLE</span>';
  }
});
