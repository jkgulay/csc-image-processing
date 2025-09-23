import {app, BrowserWindow} from 'electron'
import path from "path"
import { isDev } from './utils.js';

type test = string;

app.on("ready", () => {
    const mainWindow = new BrowserWindow({
        webPreferences: {
            nodeIntegration: true,
            devTools: isDev(),
        }
    })
    if(isDev()){
        mainWindow.loadURL("http://localhost:3000/")
    }else{

        const pathToMainFile = path.join(app.getAppPath(), "/dist-react/index.html")
        mainWindow.loadFile(pathToMainFile)
    }
})
