// # Logger Class
// is responsible for logging the relevant information to the user

// # Import Dependencies
const dateFormat = require('dateformat');
const colors = require('colors/safe');
const fs = require('fs');
const path = require("path");
const app = require('electron').app;


const Logger = function Logger(name, index) {
    this._name = name;
    this._index = index;
}

Logger.prototype.green = function success(message, duration) {
    console.log(`${getDateString()} [${this._name}][${duration}] - [${this._index}]` + colors.green("[+] " + message));
    debugFile(`${getDateString()}: [${this._name}][${duration}] - [${this._index}]: ${message}` + '\n');
    //consoleLog(`${getDateString()}: [${this._name}][${duration}] - [${this._index}]: ${message}`)

}

Logger.prototype.red = function error(message, duration) {
    console.error(`${getDateString()} [${this._name}][${duration}] - [${this._index}]` + colors.red("[x] " + message));
    errorFile(`${getDateString()}: [${this._name}][${duration}] - [${this._index}]: ${message}` + '\n');
    //consoleLog(`${getDateString()}: [${this._name}][${duration}] - [${this._index}]: ${message}`)
}

Logger.prototype.blue = function won(message, duration) {
    console.log(`${getDateString()} [${this._name}][${duration}] - [${this._index}]` + colors.blue("[$] " + message));
    debugFile(`${getDateString()}: [${this._name}][${duration}] - [${this._index}]: ${message}` + '\n');
    //consoleLog(`${getDateString()}: [${this._name}][${duration}] - [${this._index}]: ${message}`)
}

Logger.prototype.normal = function info(message, duration) {
    console.log(`${getDateString()} [${this._name}][${duration}] - [${this._index}][#] ${message}`);
    debugFile(`${getDateString()}: [${this._name}][${duration}] - [${this._index}]: ${message}` + '\n');
    //consoleLog(`${getDateString()}: [${this._name}][${duration}] - [${this._index}]: ${message}`)
}

Logger.prototype.yellow = function caution(message, duration) {
    console.log(`${getDateString()} [${this._name}][${duration}] - [${this._index}] ` + colors.yellow("[?] " + message));
    debugFile(`${getDateString()}: [${this._name}][${duration}] - [${this._index}]: ${message}` + '\n');
    //consoleLog(`${getDateString()}: [${this._name}][${duration}] - [${this._index}]: ${message}`)
}

Logger.prototype.toFile = function caution(message) {
    debugFile(`${getDateString()}: ${message}` + '\n');
}

function getDateString() {
    return "[" + dateFormat(new Date(), "HH:MM:ss.l") + "]";
}

function debugFile(message){
    //fs.appendFileSync(path.join(app.getPath('appData'), "/application/logs/debug.txt"), message, encoding='utf8')
}

function errorFile(message){
    //fs.appendFileSync(path.join(app.getPath('appData'), "/application/logs/error.txt"), message, encoding='utf8')
}

consoleLog = (message) => {
    const mainWindow = BrowserWindow.fromId(Config.mainWindowId);
    mainWindow.webContents.send("writeToDiv", message);
}

// export for use elsewhere
module.exports = function(name, index) {
    return new Logger(name, index);
};
