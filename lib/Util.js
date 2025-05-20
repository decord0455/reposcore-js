import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.join(__dirname, '..', '.env');
const CACHE_PATH = path.join(__dirname, '..', 'cache.json');

// 현재 활성화된 로그 레벨 설정
const currentLogLevel = process.env.LOG_LEVEL ? process.env.LOG_LEVEL.toUpperCase() : 'INFO';

const LOG_LEVELS = {
    LOG: 0,    // 기본 로그 레벨
    DEBUG: 1,  // 디버깅용 상세 정보
    INFO: 2,   // 일반 정보
    WARN: 3,   // 경고
    ERROR: 4   // 에러
};

// 로그 레벨별 색상 및 스타일 정의
const LOG_COLORS = {
    ERROR: {
        bg: chalk.bgRed,
        fg: chalk.white,
        prefix: '🚨 '
    },
    WARN: {
        bg: chalk.bgYellow,
        fg: chalk.black,
        prefix: '⚠️ '
    },
    INFO: {
        fg: chalk.green,
        prefix: 'ℹ️ '
    },
    DEBUG: {
        fg: chalk.cyan,
        prefix: '🔍 '
    },
    LOG: {
        fg: chalk.white,
        prefix: '📝 '
    }
};

// 현재 활성화된 테마 저장 변수
let currentTextColor = '#212529'; // 기본 테마 텍스트 색상

// 테마 텍스트 색상 설정 함수
/**
 * 현재 텍스트 색상을 설정
 * 외부의 currentTextColor 전역 변수 값을 변경
 * @param {string} color - 설정할 텍스트 색상 값 ex) 'red', '#ff0000', 'rgb(255,0,0)'
 * @returns {void} - 반환값 없음
 */
function setTextColor(color) {
    currentTextColor = color;
}

// 로그 메시지 포맷팅 함수
/**
 * 로그 수준에 따라 색상을 적용하여 로그 메시지를 포맷팅
 * ERROR와 WARN 수준은 배경색을 포함하고, 나머지는 글자색만 적용
 * @param {string} level - 로그 레벨
 * @param {string} message - 출력할 로그 메시지
 * @param {string} timestamp - 로그가 생성된 시각 ex) '2025-05-21 05:02:26'
 * @returns {string} - 색상 코드가 적용된 포맷된 로그 문자열
 */
function formatLogMessage(level, message, timestamp) {
    const colors = LOG_COLORS[level] || LOG_COLORS.LOG;
    
    // ERROR와 WARN은 배경색 사용
    if (level === 'ERROR' || level === 'WARN') {
        return `${timestamp} ${colors.bg(colors.fg(`${colors.prefix}[${level}]`))} ${message}`;
    }
    
    // 나머지는 글자색만 사용
    return `${timestamp} ${colors.fg(`${colors.prefix}[${level}]`)} ${message}`;
}

/**
 * 주어진 메시지를 로그 레벨에 따라 포맷팅하여 출력
 * 로그 레벨이 현재 설정된 로그 수준 이상일 경우만 출력
 * @param {string} message - 출력할 메시지 내용
 * @param {string} [level='LOG'] - 로그 레벨 (기본값 : 'LOG')
 * @returns {string|undefined} - 로그가 출력된 경우 포맷된 문자열을 반환하고, 출력되지 않으면 undefined를 반환
 */
function log(message, level = 'LOG') {
    // 대문자로 변환하여 일관성 유지
    level = level.toUpperCase();
    
    // 유효한 로그 레벨인지 확인
    if (!LOG_LEVELS.hasOwnProperty(level)) {
        level = 'LOG';
    }
    // 레벨에 따라 출력 필터링
    if (LOG_LEVELS[level] < LOG_LEVELS[currentLogLevel]) {
        return; // 출력 안 함
    }

    const now = new Date().toLocaleString('ko-KR', { 
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    }).replace(/\./g, '').replace(/\s+/g, ' ');
    
    // 테마 색상 적용 대신 로그 레벨별 색상 적용
    const formattedMessage = formatLogMessage(level, message, `[${now}]`);
    console.log(formattedMessage);
    
    return formattedMessage; // 테스트 및 체이닝을 위해 포맷팅된 메시지 반환
}

/**
 * 주어진 JSON 객체를 재귀적으로 탐색하여 Map으로 변환
 * 지정된 깊이(기본값 2) 이상으로는 Map으로 변환하지 않고 원시 값 또는 배열 등을 그대로 반환
 * @param {object} jsonObj - Map으로 변환할 JSON 객체
 * @param {number=} [depth=0] - 현재 재귀 호출의 깊이 (선택 사항, 기본값 : 0)
 * @returns {Map<string, any>|any} - 변환된 Map 객체 또는 변환 기준에 해당하여 변환되지 않은 원래 값
 */
function jsonToMap(jsonObj, depth = 0) {
    if (depth >= 2 || typeof jsonObj !== 'object' || jsonObj === null || Array.isArray(jsonObj)) {
        return jsonObj;
    }

    const map = new Map();
    for (const key of Object.keys(jsonObj)) {
        map.set(key, jsonToMap(jsonObj[key], depth + 1));
    }
    return map;
}

/**
 * 중첩된 Map 구조를 일반 JavaScript 객체(JSON 형태로 표현 가능한)로 재귀적으로 변환
 * Map의 키-값 쌍을 객체의 속성으로 매핑하며, 값이 Map인 경우 재귀 호출하여 하위 객체로 생성
 * @param {Map<string, any>} map - 객체로 변환할 Map 객체 키는 문자열이여야 함
 * @returns {object} - Map 구조에서 변환된 일반 JavaScript 객체
 */
function mapToJson(map) {
    const obj = {};
    for (const [key, value] of map) {
        obj[key] = value instanceof Map ? mapToJson(value) : value;
    }
    return obj;
}

// 뱃지 추가
/**
 * 주어진 점수에 따라 해당하는 배지(이모지와 제목) 문자열을 반환
 * 정의된 점수 구간에 따라 각기 다른 배지를 매핑하며, 점수가 0 미만이거나 정의되지 않은 구간일 경우 빈 문자열을 반환 가능
 * @param {number} score - 배지를 결정할 숫자 점수
 * @returns {string} - 점수에 맞는 배지 문자열 ex) '🌱 새싹' 또는 해당하는 배지가 없을 경우 빈 문자열
 */
export function getBadge(score) {
    const levels = [
        { min: 0, max: 9, emoji: '🌱', title: '새싹' },
        { min: 10, max: 19, emoji: '🌿', title: '성장중' },
        { min: 20, max: 29, emoji: '🌳', title: '나무' },
        { min: 30, max: 39, emoji: '🌲', title: '성숙한 나무' },
        { min: 40, max: 49, emoji: '🌴', title: '야자나무' },
        { min: 50, max: 59, emoji: '🎄', title: '크리스마스 트리' },
        { min: 60, max: 69, emoji: '🌸', title: '꽃' },
        { min: 70, max: 79, emoji: '🌺', title: '벚꽃' },
        { min: 80, max: 89, emoji: '🌹', title: '장미' },
        { min: 90, max: 99, emoji: '🌻', title: '해바라기' },
        { min: 100, max: Infinity, emoji: '☀️', title: '태양' },
    ];
    const badge = levels.find(l => score >= l.min && score <= l.max);
    return badge ? `${badge.emoji} ${badge.title}` : '';
}

/**
 * 지정된 경로(CACHE_PATH)에서 캐시 파일을 비동기적으로 로드
 * 파일을 읽어와 JSON 형식으로 파싱한 후, Map 구조로 변환하여 반환
 * 파일이 존재하지 않거나 읽기 오류가 발생하면 null을 반환
 * @returns {Promise<Map<string, any>|null>} - 로드 성공 시 캐시 데이터가 포함된 Map 객체를, 실패 시 null을 반환하는 Promise
 */
async function loadCache() {
    try {
        await fs.access(CACHE_PATH, fs.constants.R_OK);
        const data = await fs.readFile(CACHE_PATH, 'utf-8');
        return jsonToMap(JSON.parse(data));
    } catch {
        return null;
    }
}

/**
 * 주어진 Map 객체를 지정된 경로(CACHE_PATH)에 캐시 파일로 비동기적으로 저장
 * Map 객체를 JSON 객체로 변환하고, JSON 문자열로 만든 후 파일에 작성
 * @param {Map<string, any>} participantsMap - 캐시 파일로 저장할 Map 객체
 * @returns {Promise<void>} - 파일 저장 작업이 완료되면 Resolving되는 Promise. 별도의 반환 값은 없음
 */
async function saveCache(participantsMap) {
    const jsonData = mapToJson(participantsMap);
    await fs.writeFile(CACHE_PATH, JSON.stringify(jsonData, null, 2));
}

/**
 * .env 파일에 GITHUB_TOKEN 환경 변수 값을 업데이트하거나 새로 추가
 * .env 파일이 이미 존재하면 파일을 읽어서 GITHUB_TOKEN 라인을 찾아 값을 업데이트
 * 기존 토큰과 동일하면 업데이트하지 않고 로그만 남김
 * GITHUB_TOKEN 라인이 없으면 파일 끝에 새로 추가
 * .env 파일이 존재하지 않으면 새로 생성하고 GITHUB_TOKEN 값을 저장
 * @param {string} token - .env 파일에 저장하거나 업데이트할 새로운 GitHub 토큰 값
 * @returns {Promise<void>} - 환경 변수 업데이트/저장 작업이 완료되면 Resolving되는 Promise. 별도의 반환 값은 없음
 */
async function updateEnvToken(token) {
    const tokenLine = `GITHUB_TOKEN=${token}`;

    try {
        await fs.access(ENV_PATH, fs.constants.R_OK);

        const envContent = await fs.readFile(ENV_PATH, 'utf-8');
        const lines = envContent.split('\n');
        let tokenUpdated = false;
        let hasTokenKey = false;

        const newLines = lines.map(line => {
            if (line.startsWith('GITHUB_TOKEN=')) {
                hasTokenKey = true;
                const existingToken = line.split('=')[1];
                if (existingToken !== token) {
                    tokenUpdated = true;
                    return tokenLine;
                } else {
                    log('.env 파일에 이미 동일한 토큰이 등록되어 있습니다.', 'INFO');
                    return line;
                }
            }
            return line;
        });

        if (hasTokenKey && tokenUpdated) {
            await fs.writeFile(ENV_PATH, newLines.join('\n'));
            log('.env 파일의 토큰이 업데이트되었습니다.', "INFO");
        }

        if (!hasTokenKey) {
            await fs.writeFile(ENV_PATH, `${tokenLine}\n`);
            log('.env 파일에 토큰이 저장되었습니다.', 'INFO');
        }
    } catch {
        await fs.writeFile(ENV_PATH, `${tokenLine}\n`);
        log('.env 파일이 생성되고 토큰이 저장되었습니다.', 'INFO');
    }
}

export {
    LOG_LEVELS,
    log,
    setTextColor,
    jsonToMap,
    mapToJson,
    loadCache,
    saveCache,
    updateEnvToken
};
