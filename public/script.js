const source = new EventSource('/serverData');

let tableBody = document.getElementById('valueTable');
let connectionStatus = document.getElementById('connectionStatus');
let logStatus = document.getElementById('logStatus');

let addDetButton = document.getElementById('addDetButton');
let remDetButton = document.getElementById('remDetButton');
let loggerButton = document.getElementById('loggerButton');
let logDownload = document.getElementById('downloadLogButton');


source.onmessage = function(event) {  
    const data = JSON.parse(event.data);
    connectionStatus.textContent = data.status.ModbusConnection;
    logStatus.textContent = data.status.LoggerStatus;
    if(data.status.ModbusConnection == "Connected"){
        connectionStatus.style.backgroundColor = 'green';
    }else{
        connectionStatus.style.backgroundColor = 'red';
    }
    if(data.status.LoggerStatus == "Running..."){
        logStatus.style.backgroundColor = 'green';
        loggerButton.textContent = "Stop";
    }else{
        logStatus.style.backgroundColor = 'red';
        loggerButton.textContent = "Start";
    }
    

    if(tableBody){
        detValues = data.detValues;
        while (tableBody.rows.length > 1) {
            tableBody.deleteRow(1);
        }
            
        for (var x = 0; x < detValues.length; x++) {
            
            const row = document.createElement('tr');
            const moduleAddr = document.createElement('td');
            const moduleCh = document.createElement('td');
            const status = document.createElement('td');
            const value = document.createElement('td');
            
            moduleAddr.textContent = detValues[x].module;
            moduleCh.textContent = detValues[x].channel;
            status.textContent = detValues[x].status
            value.textContent = detValues[x].value;
            
            row.appendChild(moduleAddr);
            row.appendChild(moduleCh);
            row.appendChild(status);
            row.appendChild(value);
            
            tableBody.appendChild(row);
        }
    }else{
        tableBody = document.getElementById('valueTable');
        console.log("Getting table")
    }
}

addDetButton.addEventListener("click", async function() {
    const ch = document.getElementById('channelSelection').options[document.getElementById('channelSelection').selectedIndex].text;
    const ma = document.getElementById('moduleSelection').options[document.getElementById('moduleSelection').selectedIndex].text;
    
    const setDet = {
        ma,
        ch,
        mode : "Add"
    };
    const options = {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(setDet)
    };
    
    
    try {
        const response = await fetch('/setting', options);
        if (!response.ok) {
          throw new Error(`Response status: ${response.status}`);
        }
    } catch (error) {
        console.error(error.message);
    }
});

remDetButton.addEventListener("click", async function() {
    const ch = document.getElementById('channelSelection').options[document.getElementById('channelSelection').selectedIndex].text;
    const ma = document.getElementById('moduleSelection').options[document.getElementById('moduleSelection').selectedIndex].text;
    
    const setDet = {
        ma,
        ch,
        mode : "Rem"
    };
    const options = {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(setDet)
    };
    
    
    try {
        const response = await fetch('/setting', options);
        if (!response.ok) {
          throw new Error(`Response status: ${response.status}`);
        }
    } catch (error) {
        console.error(error.message);
    }
});

loggerButton.addEventListener("click", async function() {
    let options;
    switch(loggerButton.textContent){
        case "Start":
            loggerButton.textContent= "starting...";
            options = {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({logMode : true,})
            };
            break;
        case "Stop":
            loggerButton.textContent= "Stopping...";
            options = {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({logMode : false,})
            };
            break;
    }
    if(options){
        try {
            const response = await fetch('/setting', options);
            if (!response.ok) {
              throw new Error(`Response status: ${response.status}`);
            }
        } catch (error) {
            console.error(error.message);
        }
    }
    
});

logDownload.addEventListener("click", function() {
    window.open("http://datalogger:3000/downloadLog")
});