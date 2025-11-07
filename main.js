const { app, Tray, BrowserWindow, ipcMain, clipboard, Menu, globalShortcut } = require('electron')
const path = require('path')
const fs = require('fs')
let tray = null
let popupWindow = null

//Shortcut
let currentShortcut = 'CommandOrControl+N'

// ✅ REMOVED: saveFolderPath - using temp folder instead

// ✅ ADD: Function to clean up old temp icons (older than 24 hours)
function cleanupOldIcons() {
    const tempDir = path.join(app.getPath('temp'), 'IconPicker')

    if (!fs.existsSync(tempDir)) return

    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000) // 24 hours

    try {
        const files = fs.readdirSync(tempDir)
        files.forEach(file => {
            const filePath = path.join(tempDir, file)
            const stats = fs.statSync(filePath)

            if (stats.mtimeMs < oneDayAgo) {
                fs.unlinkSync(filePath) // Delete old file
                console.log('Cleaned up old icon:', file)
            }
        })
    } catch (error) {
        console.error('Cleanup error:', error)
    }
}

//system tray
function createTray() {
    tray = new Tray(path.join(__dirname, 'assets', 'tray-icon.png'))
    tray.setToolTip('Notion Icon Picker')

    // Create context menu
    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Open Icon Picker',
            click: () => {
                if (popupWindow && !popupWindow.isDestroyed()) {
                    popupWindow.show()
                } else {
                    createPopupWindow()
                }
            }
        },
        {
            type: 'separator'
        },
        // ✅ ADD: Show current shortcut
        {
            label: `Shortcut: ${currentShortcut.replace('CommandOrControl', 'Ctrl')}`,
            enabled: false
        },
        {
            type: 'separator'
        },
        // ✅ ADD: Open temp icons folder
        {
            label: 'Open Temp Icons Folder',
            click: () => {
                const { shell } = require('electron')
                const tempPath = path.join(app.getPath('temp'), 'IconPicker')

                if (!fs.existsSync(tempPath)) {
                    fs.mkdirSync(tempPath, { recursive: true })
                }

                shell.openPath(tempPath)
            }
        },
        {
            type: 'separator'
        },
        {
            label: 'Run on Startup',
            type: 'checkbox',
            checked: app.getLoginItemSettings().openAtLogin,
            click: (menuItem) => {
                app.setLoginItemSettings({
                    openAtLogin: menuItem.checked,
                    openAsHidden: true  // Start minimized to tray
                })
            }
        },
        {
            type: 'separator'
        },
        {
            label: 'Quit',
            click: () => {
                app.quit()
            }
        }
    ])

    tray.setContextMenu(contextMenu)

    tray.on('click', () => {
        if (popupWindow && !popupWindow.isDestroyed()) {
            popupWindow.isVisible() ? popupWindow.hide() : popupWindow.show()
        } else {
            createPopupWindow()
        }
    })
}

//Main Window
function createPopupWindow() {
    popupWindow = new BrowserWindow({
        width: 400,
        height: 500,
        show: false,
        frame: true,
        resizable: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        webPreferences: {
            preload: path.join(__dirname, 'script.js'),
            contextIsolation: false,    // Disable context isolation
            enableRemoteModule: true    // If you need remote module (deprecated but often used)
        }
    })

    popupWindow.loadFile(path.join(__dirname, 'index.html'))

    popupWindow.once('ready-to-show', () => { popupWindow.show() })

    popupWindow.on('blur', () => { popupWindow.hide() })
}

//Shortcut
function registerGlobalShortcut(shortcut) {
    // Unregister previous shortcut
    globalShortcut.unregisterAll()

    // Register new shortcut
    const ret = globalShortcut.register(shortcut, () => {
        if (popupWindow && !popupWindow.isDestroyed()) {
            if (popupWindow.isVisible()) {
                popupWindow.hide()
            } else {
                popupWindow.show()
                popupWindow.focus()
            }
        } else {
            createPopupWindow()
        }
    })

    if (ret) {
        currentShortcut = shortcut
        console.log('Shortcut registered:', shortcut)
        return true
    } else {
        console.log('Shortcut registration failed')
        return false
    }
}

// Save shortcut to config file
function saveShortcutConfig(shortcut) {
    const configPath = path.join(app.getPath('userData'), 'config.json')
    const config = { shortcut }
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
}

// Load shortcut from config file
function loadShortcutConfig() {
    const configPath = path.join(app.getPath('userData'), 'config.json')

    if (fs.existsSync(configPath)) {
        try {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
            return config.shortcut || 'CommandOrControl+N'
        } catch (error) {
            return 'CommandOrControl+N'
        }
    }

    return 'CommandOrControl+N'
}

//Save Button - ✅ CHANGED: Save to temp folder
ipcMain.handle('save-icon', async (event, svgContent, filename) => {
    try {
        // Save to system temp folder
        const outputDir = path.join(app.getPath('temp'), 'IconPicker')

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

//Shortcut
ipcMain.handle('get-shortcut', () => {
    return currentShortcut
})

ipcMain.handle('update-shortcut', (event, newShortcut) => {
    const success = registerGlobalShortcut(newShortcut)
    if (success) {
        saveShortcutConfig(newShortcut)
        createTray() // Refresh tray menu to show new shortcut
        return { success: true, shortcut: currentShortcut }
    } else {
        return { success: false, error: 'Failed to register shortcut. It may be in use by another app.' }
    }
})

app.whenReady().then(() => {
    // ✅ ADD: Clean up old icons on startup
    cleanupOldIcons()

    currentShortcut = loadShortcutConfig()
    registerGlobalShortcut(currentShortcut)
    createTray()
})

app.on('window-all-closed', (e) => {
    e.preventDefault()
})

app.on('will-quit', () => {
    globalShortcut.unregisterAll()
})
