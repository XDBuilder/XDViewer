const { contextBridge, ipcRenderer, webUtils } = require('electron');
const fs = require('fs');

contextBridge.exposeInMainWorld('electronInfo', {
  chrome: process.versions.chrome,
  electron: process.versions.electron,
  node: process.versions.node
});
// 렌더러에서 메인 프로세스 호출 및 결과 받기
contextBridge.exposeInMainWorld('electronAPI', {
  openFileDialog: () => ipcRenderer.send('open-file-dialog'),
  onFilePathReceived: (callback) => ipcRenderer.on('file-path', callback),
  readGeoJSON: (filePath) => {
    return new Promise((resolve, reject) => {
      // fs 모듈은 렌더러 프로세스에서 사용할 수 없으므로, 메인 프로세스에서 처리
      // 메인 프로세스에서 파일을 읽어와서 렌더러로 전달
      ipcRenderer.invoke('read-geojson', filePath)
        .then(data => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        })
        .catch(err => reject(err));
    });
  },
  readMeta: (filePath) => {
    return ipcRenderer.invoke('read-meta', filePath);
  },
  readJsonFile: (path) => {
    const jsonStr = fs.readFileSync(path, 'utf8');
    return JSON.parse(jsonStr);
  },
  getPathForFile: (file) => {
    // Electron의 webUtils를 사용하여 File 객체로부터 경로 가져오기
    try {
      return webUtils.getPathForFile(file);
    } catch (error) {
      console.error('Error getting file path:', error);
      return null;
    }
  }
});
