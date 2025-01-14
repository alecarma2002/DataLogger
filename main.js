const express = require('express');
const ModbusRTU =require('modbus-serial');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const logger = require('./components/logger.js');

const modbusUpdateInterval = 1000; 
const retryDelay = 2000; 
const replyTimeout = 500;
const configFilePath = './config.json';
const valueLogFilePath = path.join(__dirname,'Logs/Value_Logs');
const valueLogZipPath =path.join(__dirname,'temp/Value_Logs.zip');
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


//logger.sysLogPath(valueLogFilePath)

function loadConfig(path) {
    return new Promise((resolve, reject) => {
        fs.readFile(path, (err, data) => {
            if (err) {
                if (err.code === 'ENOENT') {
                    logger.log("DEBUG","Config file not found, using default.");
                    fs.writeFile(path, JSON.stringify(defaultConfig, null, 2), (writeErr) => {
                        if (writeErr) {
                            logger.log("ERROR",'Failed to create default config:', writeErr);
                            reject(writeErr);
                        } else {
                            logger.log("DEBUG",'Default config created.');
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
                    logger.log("ERROR",'Failed to parse config, using default:', parseErr);
                    resolve({ selectedDet: [] });
                }
            }
        });
    });
}

async function initializeConfig(path) {
    try {
        config = await loadConfig(path);
        logger.log("DEBUG","Config loaded successfully.");
        result.status.LoggerStatus = "initializing"
    } catch (err) {
        logger.log("ERROR","Cannot load config:", err);
    }
}

function inizializeWebServer() {
    app.listen(serverPort, () => logger.log("DEBUG",'Web interface hosted on port: ', serverPort));
    app.use(express.static('/datalogger/public'));
    app.use(express.json());
}

async function connectModbus() {
    try {
        logger.log("DEBUG","Attempting Modbus connection...");
        await client.connectRTUBuffered("/dev/ttyUSB0", { baudRate: 9600 });
        logger.log("DEBUG","Modbus connected!");
        result.status.ModbusConnection = "Connected";
        clearInterval(connectionRetry); 
        startDataPolling(); 
    } catch (err) {
        logger.log("ERROR","Unable to connect to Modbus device:", err.message);
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
            logger.log("ERROR","Failed to retreive data from MOdbus Device ", err.message);
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
                    logger.saveToFile(tempValues[x],valueLogFilePath);
                    result.status.LoggerStatus = "Running...";
                }catch(err){
                    result.status.LoggerStatus = "Failure";
                    result.status.LoggerLog = err.message;
                    logger.log("ERROR",err)
                }
            }else if(result.status.LoggerStatus != "Stopped"){
                result.status.LoggerStatus = "Not Running";
            }
            result.status.ModbusConnection = "Connected";
        } catch (err) {
            logger.log("ERROR",`Failed to read values for module ${module}, channel ${channel}:`, err.message);
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

function prepLogZip(){
    setInterval(() => {
        try{
            const folderPath = path.join(__dirname, 'Logs/Value_Logs');
            const tzipPath = path.join(__dirname, 'temp/tLogs.zip');
            const zipPath = path.join(__dirname, 'temp/Value_Logs.zip');
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
                    logger.log("DEBUG",'Zip folder updated');
                });
            });
            
        } catch (e) {
            logger.log("ERROR","Could not update zip folder",e);
            
        }
    }, logZipInterval);
}
console.log(valueLogFilePath)
logger.logLevel("DEBUG")
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
            logger.log("DEBUG","Detector already exists:", newDet);
        } else {
            logger.log("DEBUG","Detector does not exist, adding it.");
            config.selectedDet.push(newDet);
        }
    }
    
    if(req.body.mode == "Rem"){
        const newDet = { "module": Number(req.body.ma), "channel": Number(req.body.ch) }
        const exists = config.selectedDet.some((det) => det.module === newDet.module && det.channel === newDet.channel);
            
        if (exists) {
            logger.log("DEBUG","Removing Detector:", newDet);
            config.selectedDet = config.selectedDet.filter((det) => !(det.module === newDet.module && det.channel === newDet.channel));
        } else {
            logger.log("DEBUG","Detector does not exist");
        }
    }
    
    if(req.body.logMode == true){
        config.LoggerEnabled = true;
        logger.log("DEBUG","Logger Enabled");
    }
    if(req.body.logMode == false){
        config.LoggerEnabled = false;
        result.status.LoggerStatus = "Stopped";
        logger.log("DEBUG","Logger Stopped");
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
            logger.log("ERROR",'Failed to writie configuration file:', err);
        } else {
            logger.log("DEBUG",'Configuration file saved successfully!');
        }
    })
});

app.get('/downloadLog', (req, res) => {
    res.download(valueLogZipPath, 'Value_Logs.zip', (err) => {
      if (err) {
        logger.log("ERROR",'Failed to send ZIP file:', err.message);
        res.status(500).send('Error sending file');
      } else {
        
      }
    });
});









































