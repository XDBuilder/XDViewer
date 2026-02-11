# XDViewer 프로젝트 - 개발 노트

## 프로젝트 개요
Electron과 XDWorld WebGL 엔진으로 구축된 XDWorld 3D GeoJSON 뷰어 애플리케이션
- 3D 환경에서 GeoJSON 레이어 조회 및 관리
- Point, LineString, Polygon 지오메트리 타입 지원
- 색상, 투명도, 가시성 제어가 가능한 레이어 관리
- 객체 선택 기능

## 핵심 기술 사항

### XDWorld API
- **색상 형식**: ARGB 순서 - `new Module.JSColor(Alpha, Red, Green, Blue)`
  - Alpha가 **첫 번째**로 와야 함 (마지막 아님)
  - Alpha 범위: 0-255 (0 = 투명, 255 = 불투명)
  - 투명도 퍼센트를 알파값으로 변환: `Alpha = 255 - (투명도% * 2.55)`

### 반복하지 말아야 할 실수들

#### 1. const/let 변수 스코프 문제
**문제**: if 블록 안에서 `const`로 변수를 선언했는데, 블록 밖에서 접근해야 하는 경우

**오류 예시**:
```javascript
if (type === "Point") {
    const pointColorCode = document.createElement('span'); // const로 선언
    // ...
}
// 나중에 if 블록 밖에서:
colorRow.appendChild(pointColorCode); // 오류: pointColorCode가 정의되지 않음
```

**해결 방법**: 여러 스코프에서 사용될 변수들은 함수 최상단에서 `let`으로 선언:
```javascript
// 함수 스코프 최상단에서
let pointColorCode, lineColorCode, fillColorCode, strokeColorCode;

// if 블록 안에서는 선언 없이 할당만
if (type === "Point") {
    pointColorCode = document.createElement('span'); // 할당만
    // ...
}

// 나중에 사용해도 문제없음
colorRow.appendChild(pointColorCode); // 정상 작동
```

**발생 시점**: 2026-02-06 - Hex 코드 표시 기능 추가 시, hex 코드 변수들을 타입별 if 블록 내에서 const로 선언했으나 속성 패널을 만들 때 블록 밖에서 접근하려 해서 레이어 목록이 표시되지 않는 문제 발생

#### 2. 색상 순서 혼동
**문제**: XDWorld는 ARGB 형식을 사용하는데, RGB나 BGR로 착각

**시도했던 오류들**:
- BGR 순서 (틀림)
- RGB 순서 (틀림)
- 일부 색상만 BGR 적용 (틀림)

**올바른 해결책**: 항상 Alpha를 맨 앞에 두는 ARGB 사용
```javascript
new Module.JSColor(alpha, red, green, blue)
```

#### 3. 폴리곤 아이콘 투명도
**문제**: 레이어 목록 아이콘 업데이트 시, 폴리곤 아이콘은 면과 선 투명도를 모두 반영해야 함

**해결 방법**: `getMarkerIcon()`에 면과 선의 색상/투명도를 모두 전달:
```javascript
getMarkerIcon(fileName, fillColor, true, 2, fillTransparency, strokeColor, strokeTransparency)
```

아이콘은 면을 먼저 그리고 그 위에 선을 겹쳐 그려야 함 (면위에 선을 그려야지).

## 코드 품질 원칙

### 중복 코드 제거
반복되는 패턴은 헬퍼 함수로 추출하여 재사용성을 높이고 유지보수를 쉽게 만듭니다.

**안 좋은 예시 - 중복 코드**:
```javascript
// 여러 이벤트 리스너에서 동일한 코드 반복
lineColorPicker.addEventListener('change', (e) => {
    // 레이어 재생성 코드 반복
    Module.XDEMapRemoveLayer(fileName);
    const layerList = new Module.JSLayerList(true);
    layer = layerList.createLayer(fileName, Module.ELT_3DLINE);
    layer.setVisible(checkbox.checked);
    createLineObjects(...);

    // 아이콘 업데이트 코드 반복
    if (iconElement) {
        const iconUrl = getMarkerIcon(...);
        iconElement.src = iconUrl;
    }
});

lineWidthInput.addEventListener('change', (e) => {
    // 위와 동일한 레이어 재생성 코드 반복
    Module.XDEMapRemoveLayer(fileName);
    const layerList = new Module.JSLayerList(true);
    layer = layerList.createLayer(fileName, Module.ELT_3DLINE);
    layer.setVisible(checkbox.checked);
    createLineObjects(...);
});
```

**좋은 예시 - 헬퍼 함수 사용**:
```javascript
// 헬퍼 함수 정의
function recreateLayer(layerType, createFunction) {
    Module.XDEMapRemoveLayer(fileName);
    const layerList = new Module.JSLayerList(true);
    layer = layerList.createLayer(fileName, layerType);
    layer.setVisible(checkbox.checked);
    createFunction();
}

function updateIcon(iconType, color, transparency = 0, strokeColor = null, strokeTransparency = 0) {
    if (iconElement) {
        const iconUrl = getMarkerIcon(fileName, color, true, iconType, transparency, strokeColor, strokeTransparency);
        iconElement.src = iconUrl;
    }
}

// 이벤트 리스너에서 헬퍼 함수 사용
lineColorPicker.addEventListener('change', (e) => {
    const newColor = hexToRgba(e.target.value);
    lineColorCode.textContent = e.target.value.toUpperCase();

    recreateLayer(Module.ELT_3DLINE, () => {
        createLineObjects(layer, data.features, 0.0, newColor, currentLineWidth, currentLineTransparency);
    });

    updateIcon(1, newColor, currentLineTransparency);
});

lineWidthInput.addEventListener('change', (e) => {
    currentLineWidth = parseFloat(e.target.value) || 3.0;

    recreateLayer(Module.ELT_3DLINE, () => {
        createLineObjects(layer, data.features, 0.0, hexToRgba(lineColorPicker.value), currentLineWidth, currentLineTransparency);
    });
});
```

**이점**:
- 코드 중복 제거로 파일 크기 감소
- 수정 사항이 한 곳에서만 필요 (유지보수성 향상)
- 코드 가독성 향상
- 버그 발생 가능성 감소

## 파일 구조
- `index.html` - 메인 애플리케이션 UI 및 로직
- `index.js` - Electron 메인 프로세스
- `preload.js` - Electron 프리로드 스크립트
- `style.css` - 애플리케이션 스타일

## 코드 패턴

### 레이어 생성
```javascript
const layer = new Module.JSGeoJSONLayer("레이어명", Module.ELT_GEOJSON);
layer.createGeoJSONfromJSON(geojsonString, "layerData");
layer.setSelectable(true); // 객체 선택 활성화
vw.world.addLayer(layer);
```

### Hex 코드 표시가 있는 색상 피커
```javascript
// 함수 스코프에서 선언
let colorPicker, colorCode;

// 엘리먼트 생성
colorPicker = document.createElement('input');
colorPicker.type = 'color';
colorPicker.className = 'color-picker';

colorCode = document.createElement('span');
colorCode.className = 'color-code';
colorCode.textContent = colorPicker.value.toUpperCase();

// 변경 시 업데이트
colorPicker.addEventListener('change', (e) => {
    colorCode.textContent = e.target.value.toUpperCase();
    // ... 기타 로직
});
```

### 객체 선택
```javascript
canvas.addEventListener('click', (event) => {
    const cameraPos = new Module.JSVector3D();
    const worldPos = new Module.JSVector3D();

    // 카메라와 월드 좌표 가져오기
    vw.getViewCameraPosition(cameraPos);
    vw.getWorldPosition(event.offsetX, event.offsetY, worldPos);

    // 객체 선택 시도
    const pickInfo = layer.getPickInfoAtView(cameraPos, worldPos);
    if (pickInfo && pickInfo.getState() !== null) {
        // 객체가 선택됨
        const state = pickInfo.getState();
        // 선택 처리...
    }
});
```

### 레이어 이름 변경
확장 메뉴의 레이어명 옆 "변경" 버튼으로 인라인 편집이 가능합니다.

**중요**: 원본 레이어 이름을 별도로 저장하여 레이어 제거 시 사용합니다.

```javascript
// 원본 레이어 이름 저장 (레이어 제거용)
const originalLayerName = fileName;

// 레이어명 표시 및 변경 버튼
const nameValue = document.createElement('span');
nameValue.textContent = fileName;

const nameEditButton = document.createElement('button');
nameEditButton.textContent = '변경';
nameEditButton.addEventListener('click', () => {
    // nameValue를 input으로 교체
    const editInput = document.createElement('input');
    editInput.value = nameValue.textContent;

    const saveName = () => {
        const newName = editInput.value.trim();
        if (newName) {
            label.textContent = newName;        // 레이어 리스트 업데이트
            label.title = newName;
            nameValue.textContent = newName;    // 확장 메뉴 표시 업데이트
        }
        editInput.replaceWith(nameValue);
    };

    editInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') saveName();
        else if (e.key === 'Escape') editInput.replaceWith(nameValue);
    });
    editInput.addEventListener('blur', saveName);

    nameValue.replaceWith(editInput);
    editInput.focus();
    editInput.select();
});

// 레이어 제거는 원본 이름 사용
removeBtn.addEventListener('click', () => {
    Module.XDEMapRemoveLayer(originalLayerName);
    layerContainer.remove();
});
```

**작동 방식**:
- 확장 메뉴(▸ 클릭) → "레이어명" 오른쪽의 "변경" 버튼 클릭
- 레이어명이 input으로 전환되어 즉시 편집 가능
- Enter 키 또는 포커스 잃을 때 자동 저장
- ESC 키로 취소
- 변경 시 레이어 리스트에도 즉시 반영
- 컨텍스트 메뉴의 "이름 변경"도 자동으로 "변경" 버튼 클릭

## 개발 이력
- 2026-02-06: 객체 선택, 투명도 컨트롤, hex 코드 표시 기능 추가
- 2026-02-06: hex 코드 span의 변수 스코프 문제 수정
- 2026-02-06: 중복 코드 제거 - 레이어 재생성 및 아이콘 업데이트 로직을 헬퍼 함수로 추출 (recreateLayer, updateIcon)
- 2026-02-06: 확장 메뉴에 레이어 이름 표시 및 이름 변경 입력 필드 추가 - 원본 레이어 이름 보존으로 안전한 제거 보장
- 2026-02-06: 더블클릭 이름 변경 기능 제거 - 확장 메뉴에서만 이름 변경 가능하도록 단순화
- 2026-02-06: 레이어명 옆에 "변경" 버튼 추가 - 인라인 편집으로 UX 개선, 변경 시 레이어 리스트 자동 동기화
