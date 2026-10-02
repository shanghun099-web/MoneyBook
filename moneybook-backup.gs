/**
 * MoneyBook(가계부) → 구글 드라이브 백업 스크립트  (v1)
 *   - 앱이 보낸 가계부 전체(거래·고정비·예산·자동 분류)를 내 드라이브 "MoneyBook 가계부 백업" 폴더에 저장
 *   - 보낼 때마다 새 파일로 저장하고 지우지 않음 (그날그날 기록이 그대로 쌓임)
 *   - 새 폰에서 "드라이브에서 되살리기"로 그대로 돌려받음
 *   - PIN 비밀번호는 보내지 않습니다
 *
 * 설치 (한 번만, 컴퓨터에서):
 *  1. https://script.google.com 에서 "새 프로젝트" → 이 파일 내용을 전부 붙여넣고 저장(💾)
 *  2. 위쪽 함수 고르는 칸에서 "setup" 을 고르고 "▷ 실행" → 권한 검토 → 내 계정
 *       (확인되지 않은 앱이라고 나오면 "고급" → "이동" → 허용)
 *  3. 오른쪽 위 "배포" → "새 배포" → 유형 "웹 앱"
 *       - 다음 사용자 인증 정보로 실행: 나
 *       - 액세스 권한이 있는 사용자: 모든 사용자   ← 이게 아니면 앱에서 연결이 안 됩니다
 *  4. "배포" → 나오는 웹 앱 URL(…/exec) 복사
 *  5. MoneyBook → 설정 → 구글 드라이브 백업 → 주소 칸에 붙여넣고 "연결 확인"
 *
 * 웹 앱 URL 은 비밀번호처럼 다루세요. 주소를 아는 사람은 백업을 읽을 수 있습니다.
 *
 * 스크립트를 고친 뒤에는 "배포" → "배포 관리" → 연필(수정) → 버전: "새 버전" → "배포"
 * ("새 배포"를 누르면 URL 이 바뀌니 주의)
 */

const FOLDER_NAME = 'MoneyBook 가계부 백업';

function doGet() {
  return json_({ ok: true, v: 1, app: 'moneybook' });
}

/* 처음 한 번 편집기에서 실행해 드라이브 권한을 허용하고 백업 폴더를 만든다 */
function setup() {
  Logger.log('백업 폴더: ' + folder_().getUrl());
}

function doPost(e) {
  let p;
  try { p = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: '요청을 읽지 못했습니다' }); }
  try {
    const folder = folder_();
    if (p.action === 'save') {
      if (!p.data) throw new Error('백업 내용이 비었습니다');
      JSON.parse(p.data);   // 깨진 내용은 저장하지 않는다
      const lock = LockService.getScriptLock();
      lock.waitLock(20000);
      try {
        const name = 'moneybook_' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HHmmss') + '.json';
        folder.createFile(name, p.data, 'application/json');
        return json_({ ok: true, name: name });
      } finally {
        lock.releaseLock();
      }
    }
    if (p.action === 'list') {
      const files = files_(folder).slice(0, 30).map(f => ({ name: f.getName(), size: f.getSize() }));
      return json_({ ok: true, files: files, url: folder.getUrl() });
    }
    if (p.action === 'restore') {
      const list = files_(folder);
      const f = p.name ? list.find(x => x.getName() === p.name) : list[0];
      if (!f) return json_({ ok: false, error: '드라이브에 백업이 아직 없습니다' });
      return json_({ ok: true, name: f.getName(), data: f.getBlob().getDataAsString() });
    }
    throw new Error('모르는 요청입니다: ' + p.action);
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

/* 백업 폴더: 저장된 ID → 내 드라이브에서 이름으로 → 새로 만들기 */
function folder_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('folder');
  if (id) {
    try { const f = DriveApp.getFolderById(id); if (!f.isTrashed()) return f; } catch (e) { /* 지워졌으면 아래에서 */ }
  }
  const found = DriveApp.getRootFolder().getFoldersByName(FOLDER_NAME);
  const folder = found.hasNext() ? found.next() : DriveApp.createFolder(FOLDER_NAME);
  props.setProperty('folder', folder.getId());
  return folder;
}

/* 백업 파일들, 최신 것부터 (이름에 날짜·시각이 들어 있어 이름순 = 시간순) */
function files_(folder) {
  const out = [], it = folder.searchFiles('title contains "moneybook_" and trashed = false');
  while (it.hasNext()) out.push(it.next());
  return out.sort((a, b) => b.getName() < a.getName() ? -1 : 1);
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
