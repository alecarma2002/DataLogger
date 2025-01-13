const express = require('express');
const ModbusRTU =require('modbus-serial');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const modbusUpdateInterval = 1000; 
const retryDelay = 2000; 
const replyTimeout = 500;
const configFilePath = './config.json';
const logFilePath = '/datalogger/Logs';
const client = new ModbusRTU();
const app = express();
const serverPort = 3000;
const logZipInterval = 60000;



let gasValues;
let detValues = [];
let config;
const defaultConfig = {
    "selectedDet": [],
    "LoggerEnabled": true,
    };

let result = {
    "detValues": [],
    "status": {
        "ModbusConnection": "",
        "ModbusLog": "",
        "LoggerStatus": "",
        "LoggerLog": "",
    }
};
let connectionRetry;




function loadConfig(path) {
    return new Promise((resolve, reject) => {
        fs.readFile(path, (err, data) => {
            if (err) {
                if (err.code === 'ENOENT') {
                    console.error("Config file not found, using default.");
                    fs.writeFile(path, JSON.stringify(defaultConfig, null, 2), (writeErr) => {
                        if (writeErr) {
                            console.error('Error writing default config:', writeErr);
                            reject(writeErr);
                        } else {
                            console.log('Default config created.');
                            resolve(defaultConfig);
                        }
                    });
                } else {
                    reject(err);
                }
            } else {
                try {
                    const parsedConfig = JSON.parse(data);
                    resolve(parsedConfig);
                } catch (parseErr) {
                    console.error('Error parsing config, using default:', parseErr);
                    resolve({ selectedDet: [] });
                }
            }
        });
    });
}

async function initializeConfig(path) {
    try {
        config = await loadConfig(path);
        console.log("Config loaded successfully.");
        result.status.LoggerStatus = "initializing"
    } catch (err) {
        console.error("Error initializing config:", err);
    }
}



function inizializeWebServer() {
    app.listen(serverPort, () => console.log('Web interface hosted on port: ', serverPort));
    app.use(express.static('/datalogger/public'));
    app.use(express.json());
}

async function connectModbus() {
    try {
        console.log("Attempting Modbus connection...");
        await client.connectRTUBuffered("/dev/ttyUSB0", { baudRate: 9600 });
        console.log("Modbus connected!");
        result.status.ModbusConnection = "Connected";
        clearInterval(connectionRetry); 
        startDataPolling(); 
    } catch (err) {
        console.error("Connection error:", err.message);
        result.status.ModbusConnection = "Connection error";
        result.status.ModbusLog = err.message;

        if (!connectionRetry) {
            connectionRetry = setInterval(connectModbus, retryDelay); 
        }
    }
}

async function startDataPolling() {
    const polling = setInterval(async () => {
        try {
            await getValues();
        } catch (err) {
            console.error("Error while polling Modbus data:", err.message);
            if(err.message == "Port Not Open"){
                clearInterval(polling);
                connectModbus();
            }else{
                result.status.ModbusConnection = "Polling error";
                result.status.ModbusLog = err.message;
            }
        }
    }, modbusUpdateInterval);
}

async function getValues() {
    let tempValues = [];
    for (let x = 0; x < config.selectedDet.length; x++) {
        const module = config.selectedDet[x].module;
        const channel = config.selectedDet[x].channel;
        const valueReg = 257 + (module - 11) * 4 + (channel - 1);
        const statusReg = (module - 11) * 4 + channel;
        try {
            const value = Number(await readRegister(valueReg, replyTimeout));
            const statusBin = parseInt(await readRegister(statusReg, replyTimeout), 10);
            let status = "Unknown";

            const isInAlarm = ((statusBin & (1 << 0)) !== 0) | ((statusBin & (1 << 1)) !== 0);
            const isInFault = ((statusBin & (1 << 4)) !== 0);
            const isDisabled = ((statusBin & (1 << 3)) !== 0);

            if (isDisabled) {
                status = "Disabled";
            } else if (isInFault && isInAlarm) {
                status = "Fault and Alarm";
            } else if (isInFault) {
                status = "Fault";
            } else if (isInAlarm) {
                status = "Alarm";
            } else if (statusBin !== 0) {
                status = "Normal";
            }

            tempValues[x] = {
                "module": module,
                "channel": channel,
                "status": status,
                "value": value
            };
            if(config.LoggerEnabled){
                try{
                    saveToDB(tempValues[x]);
                    result.status.LoggerStatus = "Running...";
                }catch(err){
                    result.status.LoggerStatus = "Failure";
                    result.status.LoggerLog = err.message;
                }
            }else if(result.status.LoggerStatus != "Stopped"){
                result.status.LoggerStatus = "Not Running";
            }
            result.status.ModbusConnection = "Connected";
        } catch (err) {
            console.error(`Error reading values for module ${module}, channel ${channel}:`, err.message);
            if(err.message == "Port Not Open"){
                result.status.ModbusConnection = "Connection error";
            }else if (err.message == "Modbus response timed out"){
                result.status.ModbusConnection = "Timed Out";
            }
            result.status.ModbusLog = err.message;
            throw err;
        }
    }
    result.detValues = tempValues;
    
}

async function readRegister(reg, timeout) {
    return Promise.race([
        new Promise((resolve, reject) => {
            client.readHoldingRegisters(reg, 1, function (err, data) {
                if (err) {
                    reject(err);
                } else {
                    resolve(data.data[0]);
                }
            });
        }),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Modbus response timed out")), timeout)
        ),
    ]);
}

function saveToDB(val){
    try{
        const timestamp = Date.now();  
        const date = new Date(timestamp);  
        
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');  
        const day = String(date.getDate()).padStart(2, '0');
        const hour = String(date.getHours()).padStart(2, '0');
        const minute = String(date.getMinutes()).padStart(2, '0');
        const second = String(date.getSeconds()).padStart(2, '0');
        const formattedDate = `${year}-${month}-${day} ${hour}:${minute}:${second}`;
        const content = formattedDate + "," + val.module + "," + val.channel + "," + val.status + "," + val.value + ";\n"
        fs.appendFile(`${logFilePath}/${year}-${month}-${day}.txt` , content.toString(),(err)=>{});
    }catch(e){
        console.log(e)
    }
}

function prepLogZip(){
    setInterval(() => {
        try{
            const folderPath = path.join(__dirname, 'Logs');
            const tzipPath = path.join(__dirname, 'temp/tLogs.zip');
            const zipPath = path.join(__dirname, 'temp/Logs.zip');
            const output = fs.createWriteStream(tzipPath);
            const archive = archiver('zip', { zlib: { level: 9 } });
            
            archive.pipe(output);
            archive.directory(folderPath, false);
            archive.finalize()
            
            output.on('close', () => {
                fs.unlink(zipPath, (err) => {
                    if (err) throw err;
                });
                fs.rename(tzipPath, zipPath, (err) => {
                    if (err) throw err;
                    console.log('Zip folder updated');
                });
            });
            
        } catch (e) {
            console.log("Could not update zip folder");
            console.log(e)
        }
    }, logZipInterval);
}
    

initializeConfig(configFilePath);
inizializeWebServer();
connectModbus();
prepLogZip();
    

// API Endpoints
app.get('/serverData', (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
    });

    const interval = setInterval(() => {
        if (result) {
            const data = `data: ${JSON.stringify(result)}\n\n`;
            res.write(data);
        }
    }, 1000);

    res.on('close', () => {
        clearInterval(interval);
        res.end();
    });
});

app.post('/setting', (req, res) =>{
    
    if(req.body.mode == "Add"){
        const newDet = { "module": Number(req.body.ma), "channel": Number(req.body.ch) }
        const exists = config.selectedDet.some((det) => det.module === newDet.module && det.channel === newDet.channel);
            
        if (exists) {
            console.log("Detector already exists:", newDet);
        } else {
            console.log("Detector does not exist, adding it.");
            config.selectedDet.push(newDet);
        }
    }
    
    if(req.body.mode == "Rem"){
        const newDet = { "module": Number(req.body.ma), "channel": Number(req.body.ch) }
        const exists = config.selectedDet.some((det) => det.module === newDet.module && det.channel === newDet.channel);
            
        if (exists) {
            console.log("Removing Detector:", newDet);
            config.selectedDet = config.selectedDet.filter((det) => !(det.module === newDet.module && det.channel === newDet.channel));
        } else {
            console.log("Detector does not exist");
        }
    }
    
    if(req.body.logMode == true){
        config.LoggerEnabled = true;
        console.log("Logger Enabled");
    }
    if(req.body.logMode == false){
        config.LoggerEnabled = false;
        result.status.LoggerStatus = "Stopped";
        console.log("Logger Stopped");
    }
    config.selectedDet.sort((a, b) => {

        if (a.module !== b.module) {
            return a.module - b.module;
        }
        return a.channel - b.channel;
    });
    
    res.end();
    fs.writeFile(configFilePath, JSON.stringify(config, null, 2), (err) => {
        if (err) {
            console.error('Error writing configuration file:', err);
        } else {
            console.log('Configuration file saved successfully!');
        }
    })
});

app.get('/downloadLog', (req, res) => {
    res.download(path.join(__dirname, 'temp/Logs.zip'), 'temp/Logs.zip', (err) => {
      if (err) {
        console.error('Error sending ZIP file:', err.message);
        res.status(500).send('Error sending file');
      } else {
        
      }
    });
});









































