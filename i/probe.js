'use strict';
// 실측용. 열쇠는 비밀이 아닌 시험 고정값이다. build-card.mjs와 값을 맞춘다.
const TEST_ID = 'probe0001';
const TEST_K = 'c29iYW4tcHJvYmUta2V5LW5vdC1hLXNlY3JldC0wMDE';

const params = new URLSearchParams(location.search);
const rawHash = location.hash.startsWith('#') ? location.hash.slice(1) : location.hash;
const variant = params.get('v') || '';
const queryKey = params.get('k') || '';
const expectedHash = `${TEST_ID}.${TEST_K}`;
const hashKey = safeDecode(rawHash).split('.')[1] || '';
const key = hashKey || queryKey;

const report = {
  시각: new Date().toISOString(),
  주소: location.href,
  시험안: variant || '(없음)',
  해시_원문: rawHash || '(없음)',
  해시_판정: '',
  열쇠_위치: hashKey ? '#' : queryKey ? '주소 안' : '없음',
  UA: navigator.userAgent,
  앱_브라우저_추정: guessBrowser(navigator.userAgent),
  들어온_곳: document.referrer || '(없음)',
  보안_환경: window.isSecureContext === true,
  WebCrypto: Boolean(window.crypto && crypto.subtle),
  첫_화면_상태: document.visibilityState,
  공유창_지원: typeof navigator.share === 'function',
  보이기_시작_ms: null,
  카드_받기_ms: null,
  봉인_풀기_ms: null,
  화면_표시_ms: null,
  보인_뒤_표시까지_ms: null,
  봉인_결과: '기다리는 중',
  마지막_공유: '(없음)',
};
report.해시_판정 = judgeHash();

function safeDecode(text) {
  try {
    return decodeURIComponent(text);
  } catch (_) {
    return text;
  }
}

function guessBrowser(ua) {
  const known = [
    [/KAKAOTALK/i, '카카오톡'], [/NAVER/i, '네이버'], [/Line\//i, '라인'],
    [/Instagram/i, '인스타그램'], [/FBAN|FBAV|FB_IAB/i, '페이스북 계열'],
    [/WhatsApp/i, '왓츠앱'], [/Telegram/i, '텔레그램'], [/Slack/i, '슬랙'],
    [/SamsungBrowser/i, '삼성 인터넷'], [/CriOS|Chrome/i, '크롬 계열'], [/Safari/i, '사파리'],
  ];
  const hit = known.find(([pattern]) => pattern.test(ua));
  return hit ? hit[1] : '알 수 없음';
}

function judgeHash() {
  if (!rawHash && queryKey) return '해당 없음 (라 안)';
  if (!rawHash && !variant) return '직접 연 주소';
  if (!rawHash) return '잘림';
  if (rawHash === expectedHash) return '그대로';
  return safeDecode(rawHash) === expectedHash ? '인코딩만 바뀜' : '달라짐';
}

function beacon(stage) {
  const query = new URLSearchParams({
    stage, v: variant, has_hash: rawHash ? '1' : '0', hash: report.해시_판정,
    has_k: queryKey ? '1' : '0', vis: document.visibilityState,
  });
  fetch(`beacon.txt?${query}`, { cache: 'no-store', credentials: 'omit' }).catch(() => {});
}

function renderRows() {
  const rows = [
    ['# 값', report.해시_판정, report.해시_판정 === '그대로' ? 'good' : report.해시_판정 === '직접 연 주소' ? '' : 'bad'],
    ['시험안', report.시험안],
    ['봉인 풀기', report.봉인_결과, report.봉인_결과 === '성공' ? 'good' : report.봉인_결과 === '기다리는 중' ? '' : 'bad'],
    ['화면에 뜨기까지', report.화면_표시_ms === null ? '-' : `페이지를 연 뒤 ${report.화면_표시_ms}ms · 화면이 보인 뒤 ${report.보인_뒤_표시까지_ms}ms`],
    ['WebCrypto', report.WebCrypto ? '됨' : '안 됨', report.WebCrypto ? 'good' : 'bad'],
    ['브라우저 (추정)', report.앱_브라우저_추정],
    ['공유 창', report.공유창_지원 ? '됨' : '안 됨 (복사를 쓰세요)'],
    ['받은 주소', report.주소],
    ['받은 # 값', report.해시_원문],
    ['UA', report.UA],
    ['들어온 곳', report.들어온_곳],
    ['마지막 공유', report.마지막_공유],
  ];
  const list = document.getElementById('rows');
  list.replaceChildren();
  for (const [name, value, tone] of rows) {
    const dt = document.createElement('dt');
    dt.textContent = name;
    const dd = document.createElement('dd');
    dd.textContent = String(value);
    if (tone) dd.className = tone;
    list.append(dt, dd);
  }
}

function fromBase64Url(text) {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(text.length / 4) * 4, '=');
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

async function openLetter() {
  const status = document.getElementById('letter-status');
  if (!key) {
    report.봉인_결과 = '열쇠 없음';
    status.textContent = '이 주소에는 열쇠가 없어 편지를 열 수 없어요.';
    renderRows();
    return;
  }
  if (!report.WebCrypto) {
    report.봉인_결과 = 'WebCrypto 없음';
    status.textContent = '이 브라우저에서는 편지를 열 수 없어요.';
    renderRows();
    return;
  }
  report.보이기_시작_ms = Math.round(performance.now());
  try {
    beacon('visible');
    const response = await fetch('sealed-card.json', { cache: 'no-store', credentials: 'omit' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const sealed = await response.json();
    report.카드_받기_ms = Math.round(performance.now());
    const cryptoKey = await crypto.subtle.importKey('raw', fromBase64Url(key), 'AES-GCM', false, ['decrypt']);
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64Url(sealed.iv) }, cryptoKey, fromBase64Url(sealed.ct));
    report.봉인_풀기_ms = Math.round(performance.now());
    const card = JSON.parse(new TextDecoder().decode(plain));
    document.getElementById('letter-name').textContent = card.name;
    document.getElementById('letter-text').textContent = card.text;
    document.getElementById('letter-photo').src = card.photo;
    document.getElementById('letter').hidden = false;
    status.textContent = '문구 속 주소와 번호가 눌리는지 확인해 주세요. 눌리지 않아야 해요.';
    report.봉인_결과 = '성공';
    // 화면이 멈춰 프레임이 안 오는 환경에서도 결과가 남도록 시간 제한을 함께 둔다.
    let painted = false;
    const markPainted = () => {
      if (painted) return;
      painted = true;
      report.화면_표시_ms = Math.round(performance.now());
      report.보인_뒤_표시까지_ms = report.화면_표시_ms - report.보이기_시작_ms;
      beacon('opened');
      renderRows();
    };
    requestAnimationFrame(markPainted);
    setTimeout(markPainted, 1000);
  } catch (error) {
    report.봉인_결과 = `실패: ${error.name}`;
    status.textContent = '편지를 열지 못했어요.';
  }
  renderRows();
}

function buildLink(letter) {
  const base = location.origin + location.pathname;
  const stamp = Date.now().toString(36);
  if (letter === 'd') return `${base}?v=${letter}-${stamp}&k=${TEST_K}`;
  return `${base}?v=${letter}-${stamp}#${expectedHash}`;
}

function buildShareData(letter) {
  const message = document.getElementById('message').value.trim();
  const url = buildLink(letter);
  if (letter === 'b') return { text: message, url };
  if (letter === 'c') return { url };
  return { text: `${message} ${url}` };
}

async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const area = document.createElement('textarea');
  area.value = text;
  document.body.append(area);
  area.select();
  const copied = document.execCommand('copy');
  area.remove();
  if (!copied) throw new Error('복사 안 됨');
}

async function share(letter) {
  const status = document.getElementById('share-status');
  if (typeof navigator.share !== 'function') {
    status.textContent = '이 브라우저에는 공유 창이 없어요. 사파리나 크롬에서 열어 주세요.';
    return;
  }
  const data = buildShareData(letter);
  try {
    await navigator.share(data);
    report.마지막_공유 = `${letter}: 완료로 응답`;
  } catch (error) {
    report.마지막_공유 = `${letter}: ${error.name}`;
  }
  status.textContent = `마지막 공유 ${report.마지막_공유}`;
  renderRows();
}

function wireControls() {
  document.querySelectorAll('[data-variant]').forEach((button) => {
    button.addEventListener('click', () => share(button.dataset.variant));
  });
  document.querySelectorAll('[data-copy]').forEach((button) => {
    button.addEventListener('click', async () => {
      const status = document.getElementById('share-status');
      try {
        await copyText(buildShareData(button.dataset.copy).text);
        status.textContent = '복사했어요. 메신저에 붙여 넣어 보내 주세요.';
      } catch (_) {
        status.textContent = '복사하지 못했어요.';
      }
    });
  });
  document.getElementById('copy-report').addEventListener('click', async () => {
    const status = document.getElementById('copy-status');
    try {
      await copyText(JSON.stringify(report, null, 2));
      status.textContent = '복사했어요. results.md에 붙여 넣어 주세요.';
    } catch (_) {
      status.textContent = '복사하지 못했어요. 위 값을 그대로 옮겨 주세요.';
    }
  });
}

function whenVisible(run) {
  if (document.visibilityState === 'visible') {
    run();
    return;
  }
  const onChange = () => {
    if (document.visibilityState !== 'visible') return;
    document.removeEventListener('visibilitychange', onChange);
    run();
  };
  document.addEventListener('visibilitychange', onChange);
}

beacon('script');
wireControls();
renderRows();
whenVisible(openLetter);
