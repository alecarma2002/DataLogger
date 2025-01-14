const fs = require('fs');
const path = require('path');
const archiver = require('archiver');


let LOGGER_LEVEL = "DEFAULT";



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
    
    console.log()
    
    switch(LOGGER_LEVEL){
        case 'DEFAULT' :
            if(msgLevel == 'DEFAULT'){
                console.log(MSG)
            }
            if(msgLevel == 'ERROR'){
                console.error("ERROR:  ",MSG);
            }
            break;
            
        case 'DEBUG' :
            if(msgLevel == 'DEFAULT'){
                console.log(MSG)
            }
            if(msgLevel == 'ERROR'){
                console.error("ERROR:  ",MSG);
            }
            if(msgLevel == 'DEBUG'){
                console.log(MSG)
            }
            break;
            
        case 'TRACE' :
            if(msgLevel == 'DEFAULT'){
                console.log(MSG)
            }
            if(msgLevel == 'ERROR'){
                console.error("ERROR:  ",MSG);
            }
            if(msgLevel == 'DEBUG'){
                console.log(MSG)
            }
            if(msgLevel == 'TRACE'){
                console.log(MSG)
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

