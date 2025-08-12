const { contextBridge, ipcRenderer } = require('electron');

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
  }
});
