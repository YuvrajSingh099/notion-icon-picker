const { app, Tray, BrowserWindow, ipcMain, clipboard } = require('electron')
const path = require('path')
const fs = require('fs')
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
        width: 1000,
        height: 800,
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

ipcMain.handle('save-icon', async (event, svgContent, filename) => {
    try {
        const outputDir = path.join(app.getPath('downloads'), 'notion-icons-modified')
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true })
        }

        const filePath = path.join(outputDir, filename)
        fs.writeFileSync(filePath, svgContent, 'utf-8')

        return {
            success: true,
            path: filePath
        }
    } catch (error) {
        console.error('Error saving icon:', error)
        return {
            success: false,
            error: error.message
        }
    }
})



app.whenReady().then(() => {
    createTray()
})

