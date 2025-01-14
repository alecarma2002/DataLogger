const fs = require('fs');
const path = require('path');
const archiver = require('archiver');


let LOGGER_LEVEL = "DEFAULT";
let SYS_LOG_PATH = path.join(__dirname);
let SYS_LOG_ENABLED = 0;



exports.log = (msgLevel,msg1,msg2,msg3,msg4) => {
    
    if(msgLevel != "DEFAULT" && msgLevel != "DEBUG" && msgLevel != "TRACE" && msgLevel != "ERROR"){
        msg4=msg3;
        msg3=msg2;
        msg2=msg1;
        msg1=msgLevel;
        msgLevel = "DEFAULT";
    }
    const Msg1 = msg1 ?? "";
    const Msg2 = msg2 ?? "";
    const Msg3 = msg3 ?? "";
    const Msg4 = msg4 ?? "";
    
    const MSG = [Msg1,Msg2,Msg3,Msg4].join(" ");
    
    switch(LOGGER_LEVEL){
        case 'DEFAULT' :
            if(msgLevel == 'DEFAULT'){
                console.log(MSG);
            }
            if(msgLevel == 'ERROR'){
                console.error("ERROR:  ",MSG);
            }
            break;
            
        case 'DEBUG' :
            if(msgLevel == 'DEFAULT'){
                console.log(MSG);
            }
            if(msgLevel == 'ERROR'){
                console.error("ERROR:  ",MSG);
            }
            if(msgLevel == 'DEBUG'){
                console.log(MSG);
            }
            break;
            
        case 'TRACE' :
            if(msgLevel == 'DEFAULT'){
                console.log(MSG);
            }
            if(msgLevel == 'ERROR'){
                console.error("ERROR:  ",MSG);
            }
            if(msgLevel == 'DEBUG'){
                console.log(MSG);
            }
            if(msgLevel == 'TRACE'){
                console.log(MSG);
            }
            break;
            
        case 'ERROR' :
            if(msgLevel == 'ERROR'){
                console.error("ERROR:  ",MSG);
            }
            
            break;
    }
};

exports.logLevel = (level) => {
    let hasChanged = false;
    
    switch (level){
        case 'DEFAULT' :
            LOGGER_LEVEL = "DEFAULT";
            hasChanged = true;
            break;
        case 'DEBUG' :
            LOGGER_LEVEL = "DEBUG";
            hasChanged = true;
            break;
        case 'TRACE' :
            LOGGER_LEVEL = "TRACE";
            hasChanged = true;
            break;
        case 'ERROR' :
            LOGGER_LEVEL = "ERROR";
            hasChanged = true;
            break;
        default :
            this.log('ERROR', level , "is not a supported Logger level!!!")
    }
    
    if(hasChanged){
        this.log("Logger level set to:", LOGGER_LEVEL);
    }
}

exports.saveToFile = (val,path) => {
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
        fs.appendFile(`${path}/${year}-${month}-${day}.txt` , content.toString(),(err)=>{});
    }catch(e){
        this.log("ERROR",e);
    }
}

exports.sysLog = (en) => {
    EN = en || SYS_LOG_ENABLED;
    
    
}

exports.sysLogPath = (path) => {
    fs.access(path, fs.constants.W_OK, (err) => {
      if (err) {
        if (err.code === 'ENOENT') {
            console.error('Path does not exist.');
            fs.mkdir(path, { recursive: true }, (err) => {
                if (err) {
                console.error('Error creating directory:', err);
                }
            });
        } else if (err.code === 'EACCES') {
          console.error('No write permission.');
        } else {
          console.error('An error occurred:', err.message);
        }
      } else {
        console.log('Write permission granted.');
        SYS_LOG_PATH = path;
      }
    });
}