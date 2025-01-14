const { contextBridge, ipcRenderer } = require('electron');

// 렌더러에서 메인 프로세스 호출 및 결과 받기
contextBridge.exposeInMainWorld('electronAPI', {
  openFileDialog: () => ipcRenderer.send('open-file-dialog'),
  onFilePathReceived: (callback) => ipcRenderer.on('file-path', callback)
});
