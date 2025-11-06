const { app, Tray, BrowserWindow, ipcMain, clipboard } = require('electron')
const path = require('path')

let tray = null
let popupWindow = null

function createTray() {
    tray = new Tray(path.join(__dirname, 'assets', 'tray-icon.png'))
    tray.setToolTip('Notion Icon Picker')

    tray.on('click', () => {
        if (popupWindow && !popupWindow.isDestroyed()) {
            popupWindow.isVisible() ? popupWindow.hide() : popupWindow.show()
        } else {
            createPopupWindow()
        }
    })
}

function createPopupWindow() {
    popupWindow = new BrowserWindow({
        width: 320,
        height: 420,
        show: false,
        frame: false,
        resizable: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        webPreferences: {
            preload: path.join(__dirname, 'script.js'),      // Allow Node in renderer
            contextIsolation: false,    // Disable context isolation
            enableRemoteModule: true    // If you need remote module (deprecated but often used)
        }
    })

    popupWindow.loadFile(path.join(__dirname, 'index.html'))

    popupWindow.once('ready-to-show', () => { popupWindow.show() })

    popupWindow.on('blur', () => { popupWindow.hide() })
}

app.whenReady().then(() => {
    createTray()
})

