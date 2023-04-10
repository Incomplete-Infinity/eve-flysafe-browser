window.addEventListener("DOMContentLoaded", () => {
    //Set input / output containers
    const outputContainer = document.querySelector("div#results");
    const form = document.querySelector("form#system-search");

    //Set headers for requests
    const requestHeaders = 
        new Headers({
            'accept': 'application/json',
            'Accept-Language': 'en',
            'Content-Type': 'application/json'
        });
    let systemJumpsData, systemKillsData;

    //Fetch all system jumps and all system kills
    //[System jumps]
    fetch(
        "https://esi.evetech.net/latest/universe/system_jumps/?datasource=tranquility", 
        {
            method: "GET",
            mode: 'cors',
            headers: requestHeaders
        })
        .then(res => {
            if (!res.ok) {
                throw new Error(`HTTP error! Status: ${res.status}`);
            }
            return res.json();
        })
        .then(resData => {
            systemJumpsData = resData;

            //[System kills]
            fetch(
            "https://esi.evetech.net/latest/universe/system_kills/?datasource=tranquility", 
            {
                method: "GET",
                mode: 'cors',
                headers: requestHeaders
            })
            .then(res => {
                if (!res.ok) {
                    throw new Error(`HTTP error! Status: ${res.status}`);
                }
                return res.json();
            })
            .then(resData => {
                systemKillsData = resData;

                const browserBody = document.getElementById("browser-main");
                const preloadMessage = document.getElementById("data-preload");

                preloadMessage.remove();
                browserBody.className = "";
            })
            .catch(err => console.warn(err));
        })
        .catch(err => console.warn(err));

    //System submission
    form.addEventListener("submit", (evt) => {                
        outputContainer.innerHTML = 'Loading, please wait... <span class="load-spinner">*</span>';
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
                    mode: 'cors',
                    headers: requestHeaders
                })
                .then(res => {
                    if (!res.ok) {
                        throw new Error(`HTTP error! Status: ${res.status}`);
                    }
                    return res.json();
                })
                .then(resData => {
                    //Clear Results
                    outputContainer.innerHTML = "";                                            

                    if (resData && resData.systems) {                            
                        //Find system details data
                        fetch(
                            `https://esi.evetech.net/latest/universe/systems/${resData.systems[0].id}/?datasource=tranquility&language=en`,
                            {
                                method: "GET",
                                mode: 'cors',
                                headers: requestHeaders
                            })
                            .then(res => {
                                if (!res.ok) {
                                    throw new Error(`HTTP error! Status: ${res.status}`);
                                }
                                return res.json();
                            })
                            .then(resExpandedData => {
                                if (resExpandedData) {
                                    const resultIntroParagraph = document.createElement("p");
                                    resultIntroParagraph.innerText = `Found ${resData.systems.length} result/s:`;
                                    outputContainer.appendChild(resultIntroParagraph);
                                    const uList = document.createElement("ul");
                                    outputContainer.appendChild(uList);
        
                                    resData.systems.forEach((systemData, key) => {
                                        const foundSystemJumps = systemJumpsData.filter(system => {
                                            return system.system_id === systemData.id
                                        });
                                        const foundSystemKills = systemKillsData.filter(system => {
                                            return system.system_id === systemData.id
                                        });
        
                                        const jumpKillRatio = foundSystemKills[0] ? 
                                            ((foundSystemKills[0].ship_kills / foundSystemJumps[0].ship_jumps) * 100) : 0;
                                        
                                        function analizeKillRisk(ratio) {
                                            console.log(ratio);
                                            if (ratio <= 2) return '<span style="color: greenyellow;">ALMOST NONE</span>';
                                            else if (ratio > 2 && ratio <= 10) return '<span style="color: greenyellow;">VERY LOW</span>';
                                            else if (ratio > 10 && ratio <= 15) return '<span style="color: greenyellow;">LOW, BUT WITH CHANCES</span>';
                                            else if (ratio > 25 && ratio <= 40) return '<span style="color: darkorange;">MODERATE</span>';
                                            else if (ratio > 40 && ratio <= 60) return '<span style="color: mediumvioletred;">HIGH</span>';
                                            else if (ratio > 60) return '<span style="color: red;">DEATH IS VERY PROBABLE</span>';
                                        }
        
                                        const listElem = document.createElement("li");
                                        const secLevelHuman = resExpandedData.security_status.toFixed(2) >= 0.5 ? '<span style="color: lightblue;">[ HIGH ]</span>' : 
                                            (resExpandedData.security_status.toFixed(2) >= 0.0 && resExpandedData.security_status.toFixed(2) < 0.5) ? 
                                            '<span style="color: darkorange;">[ LOW ]</span>' :
                                            '<span style="color: mediumvioletred;">[ NULL ]</span>';
                                        listElem.innerHTML = `<span style="color: lightgrey;font-size: 1.2rem;">${systemData.name}</span><br><br>` + 
                                            ` Security: ${resExpandedData.security_status.toFixed(2)} ` + `${secLevelHuman} <br>` + 
                                            ` ID: ${systemData.id}<br><br>` + 
                                            ` <span style="border-bottom: 1px solid yellow;">Stats found in the last hour: </span><br><br>` +
                                            ` Jumps: ${foundSystemJumps[0].ship_jumps}<br>` + 
                                            ` Player Kills: ` + (foundSystemKills[0] ? `${foundSystemKills[0].ship_kills}` : 'None') + '<br>' +
                                            ` Pod Kills: ` + (foundSystemKills[0] ? `${foundSystemKills[0].pod_kills}` : 'None') + '<br>' +
                                            ` NPC Kills: ` + (foundSystemKills[0] ? `${foundSystemKills[0].npc_kills}` : 'None') + '<br><br>' +
                                            ` Jump / Kill ratio: ` + jumpKillRatio.toFixed(2) + `%<br>` + 
                                            ` Risk of being killed: ${analizeKillRisk(jumpKillRatio)}`;
                                        uList.appendChild(listElem);
                                    });
                                }
                            })
                            .catch(err => console.warn(err));
                    } else {
                        outputContainer.innerHTML = "No results found :(";
                    }
                })
                .catch(err => console.warn(err));
        }
    });
});