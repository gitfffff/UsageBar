/**
 * Auto-Updater Module - Checks for updates from GitHub releases
 */

import { autoUpdater } from 'electron-updater';
import { dialog, BrowserWindow, Notification } from 'electron';

// Configure auto-updater for GitHub releases
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

let updateWindow: BrowserWindow | null = null;

export function setupAutoUpdater(): void {
    // Check for updates silently on startup
    autoUpdater.checkForUpdates().catch((err) => {
        console.log('Update check failed:', err.message);
    });

    // Update available
    autoUpdater.on('update-available', (info) => {
        console.log('Update available:', info.version);

        // Show notification
        if (Notification.isSupported()) {
            const notification = new Notification({
                title: 'UsageBar Update Available',
                body: `Version ${info.version} is available. Click to download.`,
                icon: undefined
            });
            notification.on('click', () => {
                autoUpdater.downloadUpdate();
            });
            notification.show();
        }
    });

    // Download progress
    autoUpdater.on('download-progress', (progress) => {
        console.log(`Download progress: ${progress.percent.toFixed(1)}%`);
    });

    // Update downloaded
    autoUpdater.on('update-downloaded', (info) => {
        console.log('Update downloaded:', info.version);

        dialog.showMessageBox({
            type: 'info',
            title: 'Update Ready',
            message: `Version ${info.version} has been downloaded.`,
            detail: 'The update will be installed when you quit UsageBar.',
            buttons: ['Install Now', 'Later'],
            defaultId: 0
        }).then((result) => {
            if (result.response === 0) {
                autoUpdater.quitAndInstall(false, true);
            }
        });
    });

    // Error handling
    autoUpdater.on('error', (err) => {
        console.log('Auto-updater error:', err.message);
    });
}

export function checkForUpdates(): void {
    autoUpdater.checkForUpdates().catch((err) => {
        console.log('Manual update check failed:', err.message);
    });
}
