// 채팅형 자연어 입력을 품목/수량/운임으로 "추정"하는 규칙 기반 파서.
// 실제 LLM 호출 없이 동작하는 1차 버전이며, 결과는 항상 사용자가 확인/수정한다.
// (요구사항 3번: 미리보기 표에서 확인 후 확정)

const FILLER_WORDS = ["사이즈", "규격", "짜리", "정도", "쯤", "약"];

// 가공 방식을 나타내는 수식어. 사용자가 생략해서 말하는 경우가 많아
// 매칭 비교에서는 제외하되(품목 자체를 가려버리지 않도록), 후보가 여러 개로
// 갈리면 "확인 필요"로 남아 사용자가 직접 고르게 된다.
const STRIP_FOR_MATCH = ["굴림", "잔다듬"];

// 세척 왕 마사토 입자 크기 호칭(작은 것부터 미립 < 소립 < 중립 < 대립) → 단가표 규격(mm) 매핑.
const GRAIN_SIZE_ALIASES = {
  미립: "1-3mm",
  소립: "2-4mm",
  중립: "5-8mm",
  대립: "9-12mm",
};

// 두께를 한글 발음으로 말하는 경우("오십티", "삼십티") → "50T", "30T" 로 변환.
const SINO_TENS = {
  십: 10, 이십: 20, 삼십: 30, 사십: 40, 오십: 50, 육십: 60, 칠십: 70, 팔십: 80, 구십: 90,
};
const SINO_TENS_PATTERN = Object.keys(SINO_TENS)
  .sort((a, b) => b.length - a.length)
  .join("|");
const THICKNESS_WORD_REGEX = new RegExp(`(${SINO_TENS_PATTERN})\\s*티`, "g");
// "50티"처럼 아라비아 숫자 + "티"로 말하는 경우도 "50T"로 변환.
const THICKNESS_DIGIT_REGEX = /(\d+)\s*티\b/g;

function convertThicknessWords(text) {
  return text
    .replace(THICKNESS_WORD_REGEX, (_, word) => `${SINO_TENS[word]}T`)
    .replace(THICKNESS_DIGIT_REGEX, (_, digits) => `${digits}T`);
}

// "2030"처럼 하이픈 없이 붙여 쓴 규격 코드를 "20-30"으로 변환.
// (두 자리+두 자리로 떨어지는 4자리 숫자만 대상으로 한다. 예: 1020→10-20, 2030→20-30)
const CONCAT_RANGE_REGEX = /\b(\d{2})(\d{2})\b/g;

function convertConcatenatedRange(text) {
  return text.replace(CONCAT_RANGE_REGEX, (match, a, b) => `${Number(a)}-${Number(b)}`);
}

// "이공삼공"처럼 규격 숫자를 한글 발음으로 한 글자씩 읽은 경우("2030"을 "이-공-삼-공"으로)
// → "20-30"으로 변환. 숫자 자체를 세는 한자어 수사(일십이=12 같은)와 다르게, 그냥 자릿수를
// 하나씩 그대로 읽은 것이라 네 글자를 각각 숫자로 바꾼 뒤 2자리씩 묶는다.
const SPOKEN_DIGIT_MAP = { 공: "0", 영: "0", 일: "1", 이: "2", 삼: "3", 사: "4", 오: "5", 육: "6", 륙: "6", 칠: "7", 팔: "8", 구: "9" };
const SPOKEN_DIGIT_CHARS = Object.keys(SPOKEN_DIGIT_MAP).join("");
const SPOKEN_4DIGIT_REGEX = new RegExp(`(?<![가-힣0-9])([${SPOKEN_DIGIT_CHARS}]{4})(?![가-힣0-9])`, "g");

function convertSpokenDigitRange(text) {
  return text.replace(SPOKEN_4DIGIT_REGEX, (match) => {
    const digits = match
      .split("")
      .map((ch) => SPOKEN_DIGIT_MAP[ch])
      .join("");
    return `${Number(digits.slice(0, 2))}-${Number(digits.slice(2))}`;
  });
}

// 현장에서 실제로 쓰는 업계 줄임말/동의어 → 단가표 정식 품목명으로 보강해준다.
// 원본 입력 자체를 바꾸는 게 아니라 "매칭용 비교 문자열"에만 단어를 보강/치환한다.
function applyAliases(text) {
  let t = convertConcatenatedRange(convertThicknessWords(text));

  // 색상 줄임말 (자갈)
  t = t.replace(/백\s*자갈/g, "화이트 자갈");
  if (/흑자갈|블랙자갈/.test(t) && !/송이/.test(t)) {
    t = t.replace(/흑자갈|블랙자갈/g, "블랙 그레이 자갈");
  }
  t = t.replace(/핑크\s*자갈/g, "파스텔핑크 자갈");

  // 보석 자갈 (단독 "보석"만 와도 자갈로 인식)
  if (/보석/.test(t) && !/자갈/.test(t)) t += " 자갈";

  // 화산송이 계열: 순서 상관없이 "레드/화산송이/송이석" 또는 "블랙·흑/송이" 조합이면 보강
  if (/송이/.test(t)) {
    if (/레드/.test(t)) t += " 레드 화산송이 자갈";
    if (/블랙|흑/.test(t)) t += " 블랙 화산송이 자갈";
  }

  // 세척 왕 마사토 줄임말 통일
  if (/세척.*마사/.test(t)) t = t.replace(/세척\s*(왕\s*)?마사(토)?/g, "세척 왕 마사토");

  // 현무암 판석 부정형 줄임말
  t = t.replace(/현무암\s*부정형/g, "현무암 판석 부정형");

  // "굴벽" 줄임말: 재질이 같이 오면 그 재질의 (굴림) 벽돌로 바로 연결,
  // 재질 없이 "굴벽"만 오면 (굴림) 벽돌류 전체가 후보로 뜨도록 보강만 한다.
  if (/굴벽/.test(t)) {
    t = t.replace(/굴벽/g, "벽돌");
  }

  // "사굴"/"사각굴림" = (굴림) 현무암 판석 400*450*50T (사각형 모양의 굴림 판석)
  t = t.replace(/사각굴림|사굴/g, "굴림 현무암 판석 400 450 50T");

  // 오리엔탈 골드 줄임말: "골드"/"화강암"/"화강석"만 와도 서로 보강
  // (오리엔탈=골드=오리엔탈 골드=화강암=화강석. "화강석"도 화강암의 다른 표현이다)
  if (/오리엔탈|골드|화강암|화강석/.test(t)) {
    t = t.replace(/화강암|화강석/g, "오리엔탈 골드");
    if (!/오리엔탈/.test(t)) t += " 오리엔탈";
    if (!/골드/.test(t)) t += " 골드";
  }

  // 핑크 뮬리 (큐브/판석/벽돌 문맥에서만 — "핑크 자갈"과 겹치지 않도록)
  if (/핑크|뮬리/.test(t) && /(큐브|판석|벽돌)/.test(t) && !/핑크\s*자갈|파스텔핑크/.test(t)) {
    if (!/뮬리/.test(t)) t += " 뮬리";
  }

  // "큐브"만 쓰고 "큐브석"을 안 붙이는 경우 보강
  if (/큐브(?!석)/.test(t)) t += " 큐브석";

  // 마사토 입자 크기 호칭 → mm 규격 보강
  if (/마사토/.test(t)) {
    for (const [grain, mm] of Object.entries(GRAIN_SIZE_ALIASES)) {
      if (t.includes(grain) && !t.includes(mm)) t += ` ${mm}`;
    }
  }

  return t;
}

function normalize(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[\s()·.,]/g, "");
}

// 매칭 전용 정규화: 가공 수식어를 제거해 "굴림/잔다듬" 유무로
// 매칭이 갈리지 않게 한다. (원본 데이터 자체는 건드리지 않음)
function normalizeForMatch(s) {
  let n = normalize(s);
  for (const w of STRIP_FOR_MATCH) n = n.split(w).join("");
  return n;
}

function bigrams(s) {
  const n = normalizeForMatch(s);
  if (n.length < 2) return new Set([n]);
  const set = new Set();
  for (let i = 0; i < n.length - 1; i++) set.add(n.slice(i, i + 2));
  return set;
}

// Jaccard 유사도와, 짧은 쿼리가 긴 품목명 안에 포함되는 경우를 위한
// 포함비율(overlap coefficient)을 함께 봐서 둘 중 유리한 쪽으로 보정한다.
// (예: "벽돌" 2글자 쿼리는 규격 숫자까지 포함된 긴 품목명과 비교하면
//  순수 Jaccard로는 거의 매칭되지 않으므로 포함비율을 섞어준다.)
function jaccard(a, b) {
  const setA = bigrams(a);
  const setB = bigrams(b);
  let inter = 0;
  for (const g of setA) if (setB.has(g)) inter++;
  const union = setA.size + setB.size - inter;
  const jaccardScore = union === 0 ? 0 : inter / union;
  const minSize = Math.min(setA.size, setB.size);
  const overlapScore = minSize === 0 ? 0 : inter / minSize;
  return jaccardScore * 0.5 + overlapScore * 0.5;
}

// 순우리말 숫자("칠만오천")를 숫자로 변환. 한자어 수사(일~구, 십/백/천/만/억) 기준.
const SINO_DIGITS = { 일: 1, 이: 2, 삼: 3, 사: 4, 오: 5, 육: 6, 륙: 6, 칠: 7, 팔: 8, 구: 9 };
const SINO_SMALL_UNITS = { 십: 10, 백: 100, 천: 1000 };
const SINO_BIG_UNITS = { 만: 10000, 억: 100000000 };
const SINO_NUMBER_CHARS_REGEX = /[일이삼사오육륙칠팔구십백천만억]+/;

function parseSinoKoreanNumber(str) {
  let result = 0;
  let section = 0;
  let current = 0;
  for (const ch of str) {
    if (SINO_DIGITS[ch] !== undefined) {
      current = SINO_DIGITS[ch];
    } else if (SINO_SMALL_UNITS[ch]) {
      section += (current || 1) * SINO_SMALL_UNITS[ch];
      current = 0;
    } else if (SINO_BIG_UNITS[ch]) {
      section += current;
      result += section * SINO_BIG_UNITS[ch];
      section = 0;
      current = 0;
    }
  }
  return result + section + current;
}

// "삼에서오"("3에서5"의 한자어 발음) → "3-5"처럼, "~에서~" 사이에 낀 한자어 숫자
// 범위 표현을 규격 범위로 변환한다. (예: "삼에서오", "구에서십이")
const SINO_RANGE_REGEX = /([일이삼사오육륙칠팔구십백]+)\s*에서\s*([일이삼사오육륙칠팔구십백]+)/g;

function convertSinoRange(text) {
  return text.replace(SINO_RANGE_REGEX, (match, a, b) => {
    const av = parseSinoKoreanNumber(a);
    const bv = parseSinoKoreanNumber(b);
    if (av > 0 && bv > 0) return `${av}-${bv}`;
    return match;
  });
}

// "7만5천", "7.5만", "75,000", "75000원", "칠만오천원" 등을 숫자로 변환
function parseKoreanAmount(text) {
  if (!text) return null;
  let t = text.replace(/,/g, "").replace(/원/g, "").trim();

  if (t.includes("만") || t.includes("천")) {
    let total = 0;
    const man = t.match(/(\d+(?:\.\d+)?)\s*만/);
    const chun = t.match(/(\d+(?:\.\d+)?)\s*천/);
    if (man) total += parseFloat(man[1]) * 10000;
    if (chun) total += parseFloat(chun[1]) * 1000;
    if (total > 0) return Math.round(total);
  }

  const plain = t.match(/(\d+(?:\.\d+)?)/);
  if (plain) return Math.round(parseFloat(plain[0]));

  const sino = t.match(SINO_NUMBER_CHARS_REGEX);
  if (sino) {
    const value = parseSinoKoreanNumber(sino[0]);
    if (value > 0) return value;
  }

  return null;
}

// "두 파레트", "세개" 처럼 숫자 대신 고유어 수사로 말하는 경우도 인식한다.
const KOREAN_NUM_WORDS = {
  한: 1, 하나: 1, 두: 2, 둘: 2, 세: 3, 셋: 3, 네: 4, 넷: 4,
  다섯: 5, 여섯: 6, 일곱: 7, 여덟: 8, 아홉: 9, 열: 10,
};
// PLT: 파레트/팔레트/파래트/빠레트/파렛/팔렛(+파렛트) 전부 같은 뜻의 현장 표현.
// EA: 개 외에 자갈·마사토류를 셀 때 쓰는 "포대/포"도 EA(낱개)로 취급한다.
const UNIT_WORDS = "plt|pallet|팔레트|파레트|파레투|파래트|빠레트|파렛트|빠렛트|파렛|빠렛|팔렛|pt|ea|포대|포|개";
const PLT_UNIT_WORDS = new Set(["plt", "pallet", "팔레트", "파레트", "파레투", "파래트", "빠레트", "파렛트", "빠렛트", "파렛", "빠렛", "팔렛", "pt"]);
const BAG_UNIT_WORDS = new Set(["포대", "포"]);
const NUM_WORD_PATTERN = Object.keys(KOREAN_NUM_WORDS).join("|");
const QTY_PATTERN = `(\\d+(?:\\.\\d+)?|${NUM_WORD_PATTERN})\\s*(${UNIT_WORDS})`;
const QTY_REGEX = new RegExp(QTY_PATTERN, "i");

// 수량 + 단위(개/EA/PLT, 또는 "파레트"·"두 개" 같은 고유어 표현) 추출. 못 찾으면 null.
function extractQuantity(text) {
  const m = text.match(QTY_REGEX);
  if (!m) return null;
  const qty = KOREAN_NUM_WORDS[m[1]] !== undefined ? KOREAN_NUM_WORDS[m[1]] : parseFloat(m[1]);
  const unitRaw = m[2].toLowerCase();
  const unit = PLT_UNIT_WORDS.has(unitRaw) ? "PLT" : "EA";
  return { qty, unit, matchText: m[0], index: m.index, isBagUnit: BAG_UNIT_WORDS.has(m[2]) };
}

function stripFillers(text) {
  let t = text;
  for (const w of FILLER_WORDS) t = t.split(w).join("");
  return t;
}

// priceItems: [{id, name, spec, pallet_qty, pallet_price, note, discontinued}]
function matchItem(queryText, priceItems) {
  // 순수 숫자만 남은 경우(예: "흑자갈, 2030, 5PLT 75000"처럼 운임 금액이
  // 수량 뒤에 쉼표 없이 붙어버린 경우)는 품목명일 수 없으므로 매칭을 시도하지 않는다.
  // 숫자끼리 bigram이 우연히 겹쳐서 엉뚱한 품목(예: 규격에 숫자가 들어간 석등 등)이
  // 매칭되는 것을 막기 위함.
  if (/^[\d,.\s]+$/.test(queryText.trim()) && queryText.trim() !== "") {
    return { best: null, score: 0, ambiguous: false, suggestions: [] };
  }

  const query = applyAliases(queryText);
  const candidates = priceItems.filter((p) => !p.discontinued);
  const scored = candidates
    .map((p) => ({ item: p, score: jaccard(query, `${p.name} ${p.spec}`) }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  const second = scored[1];
  const ambiguous = best && second && best.score - second.score < 0.06 && second.score > 0.2;

  // 품목명은 같고 규격(입자크기 등)만 다른 "같은 가족" 품목은 점수에 상관없이
  // 전부 후보로 보여준다. (예: "세척 마사토"만 입력해도 1-3/2-4/5-8/9-12mm가 다 뜨도록)
  let suggestionPool;
  if (best) {
    const family = scored.filter((s) => s.item.name === best.item.name);
    const familyIds = new Set(family.map((s) => s.item.id));
    const others = scored.filter((s) => !familyIds.has(s.item.id) && s.score >= 0.12).slice(0, 5);
    suggestionPool = [...family, ...others].sort((a, b) => b.score - a.score);
  } else {
    suggestionPool = scored.filter((s) => s.score >= 0.12).slice(0, 5);
  }

  return {
    best: best && best.score >= 0.18 ? best.item : null,
    score: best ? best.score : 0,
    ambiguous,
    suggestions: suggestionPool.slice(0, 12).map((s) => ({ ...s.item, score: Math.round(s.score * 100) / 100 })),
  };
}

function ceilDiv(a, b) {
  return Math.ceil(a / b);
}

// segments: 콤마로 분리된 사용자 입력. priceItems: DB의 현재 단가 목록.
// 콤마 다음 칸에 수량만 따로 떨어져 나온 경우 ("큐브석, 1plt") 앞 칸과 합쳐준다.
// 안 그러면 품목명 칸만 보고 업체명으로 오인하게 된다.
const QTY_ONLY = new RegExp(`^${QTY_PATTERN}$`, "i");

// "세척마사토, 대립, 5plt" 처럼 입자크기·색상 같은 속성 한 단어가 콤마로
// 따로 떨어져 나온 경우도 앞 칸(품목명)에 붙여준다. 그래야 "대립"이 독립된
// 품목이나 업체명으로 오인되지 않는다.
const ATTRIBUTE_ONLY_WORDS = [
  ...Object.keys(GRAIN_SIZE_ALIASES),
  "핑크", "블랙", "화이트", "흑", "백", "그레이",
  "골드", "오리엔탈", "뮬리", "레드", "보석", "부정형",
  "굴림", "잔다듬", "큐브", "큐브석",
];
const ATTRIBUTE_ONLY_REGEX = new RegExp(
  `^(${ATTRIBUTE_ONLY_WORDS.join("|")}|\\d+-\\d+(mm)?|\\d{3,4}|\\d+t|\\d+\\s*티|[일이삼사오육칠팔구십]+티)$`,
  "i"
);

function mergeStrandedQuantities(segments) {
  const merged = [];
  for (const seg of segments) {
    const prev = merged[merged.length - 1];
    const prevNeedsInfo = merged.length > 0 && !QTY_ONLY.test(prev);
    const isStrayQty = prevNeedsInfo && QTY_ONLY.test(seg);
    const isStrayAttribute = prevNeedsInfo && ATTRIBUTE_ONLY_REGEX.test(seg);

    // "50T 3파레트", "2030 5PLT 30000"처럼 규격/운임이 수량과 쉼표 없이 한 칸에
    // 같이 온 경우: 앞 품목이 아직 수량을 못 찾은 상태(= 자기 몫의 수량이 없음)이고
    // 이 칸에 수량 표현이 있으면, 그 수량은 사실 앞 품목의 수량일 가능성이 높으므로
    // 칸 전체를 앞 품목에 붙여준다. (남은 규격 숫자/운임 숫자는 이후 단계에서 분리)
    // 앞 품목 세그먼트 자체에 이미 수량이 들어있다면(예: "...50T 2PLT"), 그건 이미
    // 완성된 품목이므로 뒤에 오는 다른 품목(예: "큐브석 180개")을 거기 붙이면 안 된다.
    const prevAlreadyHasQty = merged.length > 0 && QTY_REGEX.test(prev);
    const isQtyCarrier = prevNeedsInfo && !prevAlreadyHasQty && !isStrayQty && !isStrayAttribute && QTY_REGEX.test(seg);

    if (isStrayQty || isStrayAttribute || isQtyCarrier) {
      merged[merged.length - 1] = `${prev} ${seg}`;
    } else {
      merged.push(seg);
    }
  }
  return merged;
}

// 콤마 없이 통짜 문장으로 말하는 경우("전국구조경에서 ... 주문했어")를 위한 전처리.
// "~에서"로 업체명을 뽑아내고, 끝에 붙는 구어체 요청 표현은 잘라낸다.
const TRAILING_REQUEST_PHRASES = /\s*(주문(?:했어요?|할게요?|합니다|해\s*주세요|해\s*줘요?)?|구매(?:했어요?|합니다)?|(?:견적|배송)?\s*부탁(?:해요?|드립니다|드려요)?|해\s*줘요?|보내\s*주세요|좀)\s*$/;

function extractCompanyFromSentence(text) {
  const m = text.match(/^([가-힣a-zA-Z0-9&()]{2,})\s*에서\s+/);
  if (!m) return { company: "", rest: text };
  return { company: m[1], rest: text.slice(m[0].length) };
}

function stripTrailingRequestPhrase(text) {
  let t = text;
  let prev;
  do {
    prev = t;
    t = t.replace(TRAILING_REQUEST_PHRASES, "").trim();
  } while (t !== prev && t.length > 0);
  return t;
}

// "A 그리고 B 랑 C" 처럼 음성 입력에서 품목을 이어붙이는 접속어를 제거한다.
function stripConnectors(text) {
  return text
    .replace(/그리고요|그리고서|그리고|그다음에는|그다음에|그다음|그러고서|그러고나서|그러고|또한|또는|\s또\s|^또\s/g, " ")
    .replace(/(이랑|하고서|하고)\s/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// 쉼표가 하나도 없는 통짜 문장(운전 중 음성 입력 등)을 위한 분리 방식.
// "수량+단위"가 나오는 지점마다 그 앞까지를 한 품목으로 잘라낸다.
// 예: "블랙자갈 20-30 5개 현무암 부정형 50티 2파레트"
//     → ["블랙자갈 20-30 5개", "현무암 부정형 50티 2파레트"]
function chunkByQuantityBoundaries(text) {
  const chunks = [];
  let lastEnd = 0;
  const re = new RegExp(QTY_PATTERN, "gi");
  let m;
  while ((m = re.exec(text)) !== null) {
    const chunk = text.slice(lastEnd, m.index + m[0].length).trim();
    if (chunk) chunks.push(chunk);
    lastEnd = re.lastIndex;
  }
  const tail = text.slice(lastEnd).trim();
  if (tail) {
    // 수량 표현을 아예 못 찾은 경우엔 통짜 문장 전체를, 마지막 수량 뒤에 뭔가
    // 더 남아있는 경우(예: "...5PLT 75000"의 "75000")엔 그 나머지를 그대로
    // 별도 조각으로 남겨서 버려지지 않게 한다. 운임 금액인지 품목인지는
    // 호출하는 쪽(parseInput)에서 판단한다.
    chunks.push(tail);
  }
  return chunks.map(stripConnectors).filter(Boolean);
}

// 구분자가 하나도 없는 문장의 "첫 번째 조각"에서, 맨 앞에 업체명이 바로
// 붙어 있을 수 있다(예: "로드하우징 백자갈 2030 3PLT"). 앞에서부터 단어를
// 하나씩 떼어보면서, 떼어낸 나머지가 단가표와 더 잘 매칭되는 지점을 찾는다.
function splitLeadingCompany(chunk, priceItems) {
  const words = chunk.split(/\s+/).filter(Boolean);
  if (words.length <= 1) return { company: "", item: chunk };

  const maxCut = Math.min(3, words.length - 1);
  for (let cut = 1; cut <= maxCut; cut++) {
    const companyCandidate = words.slice(0, cut).join(" ");
    const itemCandidate = words.slice(cut).join(" ");
    const itemScore = matchItem(stripFillers(itemCandidate), priceItems).score;
    // 떼어낸 앞부분 자체가 단가표 품목처럼 보이면(=실제로는 품목명의 일부였다면) 자르지 않는다.
    const companyScore = matchItem(stripFillers(companyCandidate), priceItems).score;
    if (itemScore >= 0.3 && companyScore < 0.25) {
      return { company: companyCandidate, item: itemCandidate };
    }
  }
  return { company: "", item: chunk };
}

function parseInput(rawText, priceItems) {
  const { company: sentenceCompany, rest } = extractCompanyFromSentence(
    convertSinoRange(convertSpokenDigitRange(rawText.trim()))
  );
  const cleaned = stripTrailingRequestPhrase(rest);

  const hasDelimiters = /[,\n]/.test(cleaned);
  let rawSegments;
  let chunkedCompany = "";

  if (hasDelimiters) {
    rawSegments = cleaned
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
  } else {
    // 쉼표 없는 통짜 문장: 운임 부분을 먼저 떼어내고(보통 맨 끝에 붙으므로),
    // 나머지는 수량이 나오는 지점 기준으로 품목을 자동으로 나눈다.
    const freightIdx = cleaned.search(/운임|배송비|화물비|차량비/);
    let mainText = cleaned;
    let freightChunk = "";
    if (freightIdx !== -1) {
      mainText = cleaned.slice(0, freightIdx).trim();
      freightChunk = cleaned.slice(freightIdx).trim();
    }
    rawSegments = chunkByQuantityBoundaries(mainText);

    // "~에서"도 콤마도 없으면, 첫 조각 맨 앞에 업체명이 바로 붙어있을 수 있다.
    if (!sentenceCompany && rawSegments.length > 0) {
      const { company: leadCompany, item } = splitLeadingCompany(rawSegments[0], priceItems);
      if (leadCompany) {
        chunkedCompany = leadCompany;
        rawSegments[0] = item;
      }
    }

    if (freightChunk) rawSegments.push(freightChunk);
  }

  let company = sentenceCompany || chunkedCompany;
  let itemSegments = rawSegments;

  // 첫 칸이 수량도 없고 "~에서"로도 못 뽑아냈다면, 그 칸이 업체명인지
  // 품목명인지를 단가표와 매칭해봐서 판단한다. 단가표에서 그럴듯하게 매칭되면
  // (예: "세척마사토", "핑크") 업체명이 아니라 품목명의 시작으로 본다.
  if (!company && rawSegments.length > 0) {
    const first = rawSegments[0];
    const firstHasQty = QTY_REGEX.test(first);
    if (!firstHasQty) {
      const probe = matchItem(stripFillers(first), priceItems);
      const looksLikeProduct = probe.best && probe.score >= 0.3;
      if (!looksLikeProduct) {
        company = first;
        itemSegments = rawSegments.slice(1);
      }
    }
  }

  const segments = mergeStrandedQuantities(itemSegments);

  const lineItems = [];
  let freight = 0;
  let freightRaw = "";

  segments.forEach((seg) => {
    const hasQty = QTY_REGEX.test(seg);
    const isFreight = /운임|배송비|화물비|차량비/.test(seg) && !hasQty;

    if (isFreight) {
      freightRaw = seg;
      freight = parseKoreanAmount(seg) || 0;
      return;
    }

    if (!hasQty) {
      // 품목/수량 단위 없이 숫자만 덩그러니 남은 조각은 품목명일 수 없다.
      // (예: 콤마 없는 문장에서 마지막 수량 뒤에 운임 금액만 남는 경우)
      // 운임으로 간주한다.
      if (/^[\d,]{4,}$/.test(seg.trim()) || (/[만천원]/.test(seg.trim()) && parseKoreanAmount(seg.trim()))) {
        if (!freightRaw) {
          freightRaw = seg;
          freight = parseKoreanAmount(seg) || 0;
        }
        return;
      }
      // 수량 정보가 없는 세그먼트는 품목으로 간주하되 수량 1, 단위 확인필요 처리
      const matched = matchItem(stripFillers(seg), priceItems);
      lineItems.push(buildLineItem(seg, 1, "EA", matched, "수량 확인 필요"));
      return;
    }

    const q = extractQuantity(seg);
    let itemText = stripFillers(seg.slice(0, q.index) + seg.slice(q.index + q.matchText.length)).trim();

    // "흑자갈 2030 5PLT 30000"처럼 품목명/규격/수량/운임이 전부 쉼표 없이 한 칸에
    // 섞여버린 경우, 수량을 떼어내고 나면 "2030 30000"처럼 규격 숫자와 운임 숫자가
    // 공백 하나로 같이 남는다. 맨 끝에 붙은 5자리 이상 숫자는 규격(보통 2~4자리)이라고
    // 보기 어려우므로 운임 금액으로 보고 따로 떼어낸다.
    const trailingMoney = itemText.match(/\s(\d{5,})$/);
    if (trailingMoney && !freightRaw) {
      freightRaw = trailingMoney[1];
      freight = parseKoreanAmount(trailingMoney[1]) || 0;
      itemText = itemText.slice(0, trailingMoney.index).trim();
    }

    // "사만원"/"4만원"/"칠만오천원"처럼 끝에 한글 금액 표현이 붙은 경우. "만/천/원"이
    // 들어간 단어는 규격(사이즈) 표현에는 안 쓰이므로, 운임 금액으로 봐도 안전하다.
    if (!freightRaw) {
      const words = itemText.split(/\s+/);
      const lastWord = words[words.length - 1];
      if (lastWord && /[만천원]/.test(lastWord)) {
        const amount = parseKoreanAmount(lastWord);
        if (amount) {
          freightRaw = lastWord;
          freight = amount;
          itemText = words.slice(0, -1).join(" ").trim();
        }
      }
    }

    // "흑자갈, 2030, 5PLT 75000"처럼 쉼표 없이 수량 뒤에 운임 금액이 바로
    // 붙어버린 경우: 품목명 자리에 순수 숫자만 남는다. 이 경우 그 수량은
    // 사실 바로 앞 품목(아직 수량을 못 찾아 "수량 확인 필요" 상태인 품목)의
    // 수량이고, 남은 숫자는 운임 금액으로 봐야 자연스럽다.
    if (/^[\d,]{4,}$/.test(itemText)) {
      const prev = lineItems[lineItems.length - 1];
      if (prev && prev.note === "수량 확인 필요") {
        const priceItem = priceItems.find((p) => p.id === prev.priceItemId);
        prev.inputQty = q.qty;
        prev.inputUnit = q.unit;
        prev.eaQty = priceItem
          ? q.unit === "PLT"
            ? Math.round(q.qty * priceItem.pallet_qty)
            : Math.round(q.qty)
          : prev.eaQty;
        prev.note = q.unit === "PLT" ? `${q.qty}PLT` : "EA";
      }
      if (!freightRaw) {
        freightRaw = itemText;
        freight = parseKoreanAmount(itemText) || 0;
      }
      return;
    }

    const matched = matchItem(itemText, priceItems);
    // "포대/포"는 자갈·마사토류처럼 부대 단위로 파는 품목에만 쓰는 표현이라,
    // 판석(평평한 돌판)류에 쓰였다면 사용자가 잘못 입력했을 가능성이 높다.
    const bagOnSlab = q.isBagUnit && matched.best && /판석/.test(matched.best.name);
    lineItems.push(
      buildLineItem(
        itemText || seg,
        q.qty,
        q.unit,
        matched,
        undefined,
        bagOnSlab ? "판석류는 보통 포대 단위로 팔지 않습니다. 수량 단위를 확인해주세요." : undefined
      )
    );
  });

  return {
    company,
    lineItems,
    freight,
    freightRaw,
  };
}

function buildLineItem(rawText, qty, unit, matched, forceNote, extraReviewReason) {
  const item = matched.best;
  const needsReview = !item || matched.ambiguous || matched.score < 0.35 || Boolean(extraReviewReason);

  if (!item) {
    return {
      rawText,
      name: rawText,
      spec: "",
      priceItemId: null,
      inputQty: qty,
      inputUnit: unit,
      eaQty: unit === "EA" ? qty : null,
      eaUnitPrice: null,
      needsReview: true,
      reviewReason: "단가표에서 일치하는 품목을 찾지 못했습니다.",
      note: forceNote || (unit === "PLT" ? `${qty}PLT` : "EA"),
      suggestions: matched.suggestions,
    };
  }

  const eaUnitPrice = ceilDiv(item.pallet_price, item.pallet_qty);
  const eaQty = unit === "PLT" ? Math.round(qty * item.pallet_qty) : Math.round(qty);

  return {
    rawText,
    name: item.name,
    spec: item.spec,
    priceItemId: item.id,
    inputQty: qty,
    inputUnit: unit,
    eaQty,
    eaUnitPrice,
    needsReview,
    reviewReason: extraReviewReason
      ? extraReviewReason
      : needsReview
      ? matched.ambiguous
        ? "유사한 품목이 여러 개 있어 확인이 필요합니다."
        : "매칭 신뢰도가 낮아 확인이 필요합니다."
      : "",
    note: forceNote || (unit === "PLT" ? `${qty}PLT` : "EA"),
    suggestions: matched.suggestions,
  };
}

module.exports = { parseInput, matchItem, parseKoreanAmount, extractQuantity, ceilDiv, normalize };
