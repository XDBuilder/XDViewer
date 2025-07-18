const { app, globalShortcut, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');

let mainWindow;
let splash;

/** 메인 창 생성 */
function createWindow() {

    // 브라우저 창 생성
    mainWindow = new BrowserWindow({
        width: 800, // 창 너비
        height: 600, // 창 높이    
        autoHideMenuBar: true, // 메뉴바 자동 숨김
        webPreferences: {
            nodeIntegration: false, // Node.js 통합 비활성화
            contextIsolation: true, // 컨텍스트 격리 활성화
            preload: path.join(__dirname, 'preload.js') // 프리로드 스크립트 경로
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



    // globalShortcut을 사용하여 F12 단축키 동작 정의
    globalShortcut.register('F12', () => {
        console.log('F12 has been pressed');
    });

    // 창 닫힘 처리
    mainWindow.on('closed', () => {
        mainWindow = null; // 창 참조 제거
    });

    // 파일 경로 선택 처리
    ipcMain.on('open-file-dialog', async (event) => {
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openFile'] // 파일 열기 다이얼로그 속성
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



    // F12 단축키 해제 (앱 종료 시)
    app.on('will-quit', () => {
        globalShortcut.unregisterAll(); // 모든 단축키 해제
    });

    // 앱 활성화 시 처리 (macOS)
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0)
            createWindow(); // 창이 없을 경우 새 창 생성
    });
});

// 모든 창이 닫혔을 때의 처리
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit(); // macOS가 아닌 경우 앱 종료
});

/** tileset.json 파일 처리 함수 */
function handleTilesetJson(filePath) {
    console.log(filePath); // 파일 경로 출력

    // 레이어 목록 생성
    let layerList = new Module.JSLayerList(true);
    // 새로운 레이어 생성
    let layer = layerList.createLayer("3DTILES_LAYER", Module.ELT_3DTILES);

    // 3D 타일 데이터 가져오기
    layer.import3DTiles({
        url: filePath, // 파일 경로 사용
        autoMove: true, // 자동 이동 활성화
        offsetZ: "50.0"
    });
}
