const { app, BrowserWindow, ipcMain, dialog, session } = require('electron');
const { autoUpdater } = require('electron-updater');
const http = require('http');
const path = require('path');
const fs = require('fs');
const jschardet = require('jschardet');
const iconv = require('iconv-lite');

let mainWindow;
let splash;

// 로컬 파일 HTTP 서버 (3DS 등 엔진이 HTTP URL을 요구하는 파일용)
let localFileServer = null;
let localFileServerPort = 0;

function ensureLocalFileServer() {
    if (localFileServer) return Promise.resolve(localFileServerPort);

    return new Promise((resolve) => {
        localFileServer = http.createServer((req, res) => {
            const filePath = decodeURIComponent(req.url.substring(1)); // 선행 / 제거
            if (fs.existsSync(filePath)) {
                res.writeHead(200, {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/octet-stream'
                });
                fs.createReadStream(filePath).pipe(res);
            } else {
                res.writeHead(404);
                res.end('Not found');
            }
        });
        localFileServer.listen(0, '127.0.0.1', () => {
            localFileServerPort = localFileServer.address().port;
            console.log('Local file server on port', localFileServerPort);
            resolve(localFileServerPort);
        });
    });
}

// 자동 업데이트 설정
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

/** 메인 창 생성 */
function createWindow() {

    // 브라우저 창 생성
    mainWindow = new BrowserWindow({
        width:  1024, // 창 너비
        height: 768, // 창 높이
        title: `XDViewer v${app.getVersion()}`, // 타이틀바에 버전 표시
        autoHideMenuBar: true, // 메뉴바 자동 숨김
        webPreferences: {
            nodeIntegration: false, // Node.js 통합 비활성화
            contextIsolation: true, // 컨텍스트 격리 활성화
            preload: path.join(__dirname, 'preload.js'), // 프리로드 스크립트 경로
            sandbox: false
        }
    });
    

    // 브라우저 창에 HTML 파일 로드
    mainWindow.loadFile(path.join(__dirname, 'index.html'));

    // 기본 F12 키 동작 비활성화 (DevTools 토글 방지)
    mainWindow.webContents.on('before-input-event', (event, input) => {
        if (input.key === 'F12') {
            event.preventDefault(); // 기본 동작 방지
            if (mainWindow.webContents.isDevToolsOpened()) {
                mainWindow.webContents.closeDevTools(); // DevTools 닫기
            } else {
                mainWindow.webContents.openDevTools({}); // DevTools 열기
            }
        }
    });



// 창 닫힘 처리
    mainWindow.on('closed', () => {
        mainWindow = null; // 창 참조 제거
    });

    // 파일 경로 선택 처리
    ipcMain.on('open-file-dialog', async (event) => {
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openFile'],
            filters: [
                { name: 'JSON/GeoJSON Files', extensions: ['json', 'geojson', 'meta'] }
            ]
        });

        if (!result.canceled && result.filePaths.length > 0) {
            const filePath = result.filePaths[0]; // 선택한 파일 경로
            event.sender.send('file-path', filePath); // 렌더러 프로세스로 파일 경로 전달
        }
    });
}

/** Application이 준비된 후 실행할 스크립트를 지정 */
app.whenReady().then(() => {
    // 스플래시 창 생성


    createWindow(); // 메인 창 생성

    // XDWorld 엔진이 타일 URL을 file:// 프로토콜로 요청하는 문제 수정
    // file://mt1.google.com/... → https://mt1.google.com/... 로 리다이렉트
    const tileHosts = ['google.com', 'openstreetmap.org', 'arcgisonline.com', 'arcgis.com'];
    session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
        if (details.url.startsWith('file://') && tileHosts.some(host => details.url.includes(host))) {
            callback({ redirectURL: details.url.replace('file://', 'https://') });
        } else {
            callback({});
        }
    });

    // 자동 업데이트 체크 (프로덕션 환경에서만)
    if (app.isPackaged) {
        autoUpdater.checkForUpdatesAndNotify();
    }

// 앱 활성화 시 처리 (macOS)
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0)
            createWindow(); // 창이 없을 경우 새 창 생성
    });
});

// 자동 업데이트 이벤트 처리
autoUpdater.on('checking-for-update', () => {
    console.log('업데이트 확인 중...');
});

autoUpdater.on('update-available', (info) => {
    console.log('업데이트가 있습니다:', info.version);
});

autoUpdater.on('update-not-available', () => {
    console.log('최신 버전입니다.');
});

autoUpdater.on('download-progress', (progressObj) => {
    console.log(`다운로드 중: ${Math.round(progressObj.percent)}%`);
});

autoUpdater.on('update-downloaded', (info) => {
    dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: '업데이트 완료',
        message: `새 버전(${info.version})이 다운로드되었습니다. 앱을 재시작하면 업데이트가 적용됩니다.`,
        buttons: ['지금 재시작', '나중에']
    }).then((result) => {
        if (result.response === 0) {
            autoUpdater.quitAndInstall();
        }
    });
});

autoUpdater.on('error', (err) => {
    console.error('업데이트 오류:', err);
});

// 모든 창이 닫혔을 때의 처리
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit(); // macOS가 아닌 경우 앱 종료
});


// 창 포커스 요청 처리 (동기 방식)
ipcMain.handle('focus-window', async () => {
    if (!mainWindow) return false;

    if (mainWindow.isMinimized()) mainWindow.restore();

    mainWindow.setAlwaysOnTop(true);
    mainWindow.show();
    mainWindow.moveTop();
    mainWindow.blur();
    mainWindow.focus();
    mainWindow.webContents.focus();
    mainWindow.setAlwaysOnTop(false);

    return true;
});

ipcMain.handle('get-app-version', () => {
    return app.getVersion();
});

// 로컬 파일을 HTTP URL로 변환 (디렉토리 구조 유지하여 텍스처 상대경로 해결)
ipcMain.handle('get-local-file-url', async (event, filePath) => {
    await ensureLocalFileServer();
    // 경로의 각 세그먼트를 개별 인코딩하여 디렉토리 구조 유지
    const segments = filePath.replace(/\\/g, '/').split('/');
    const encodedPath = segments.map(s => encodeURIComponent(s)).join('/');
    return `http://127.0.0.1:${localFileServerPort}/${encodedPath}`;
});

ipcMain.handle('read-geojson', async (event, filePath) => {
    return await fs.promises.readFile(filePath, 'utf-8');
});

ipcMain.handle('read-meta', async (event, filePath) => {
    const fileBuffer = await fs.promises.readFile(filePath);
    const detected = jschardet.detect(fileBuffer);

    if (detected.encoding === 'EUC-KR') {
        return iconv.decode(fileBuffer, 'EUC-KR');
    } else {
        return fileBuffer.toString(detected.encoding);
    }
});