// lib/parse.js 자연어 파서 회귀 테스트.
// 지금까지 실제로 봄찬님이 입력하다가 걸렸던 케이스들을 모아둔다.
// DB 없이, 고정된 샘플 단가표로 돌아가서 네트워크 없이 빠르게 검사한다.
// 실행: npm test
const test = require("node:test");
const assert = require("node:assert/strict");
const { parseInput } = require("./parse.js");

let nextId = 1;
function item(name, spec, palletQty, palletPrice, note) {
  return {
    id: nextId++,
    name,
    spec,
    pallet_qty: palletQty,
    pallet_price: palletPrice,
    note: note || "",
    discontinued: 0,
  };
}

const SAMPLE_PRICE_ITEMS = [
  item("블랙(그레이) 자갈 20kg", "3-5", 55, 262405),
  item("블랙(그레이) 자갈 20kg", "10-20", 55, 232980),
  item("블랙(그레이) 자갈 20kg", "20-30", 55, 232980),
  item("블랙(그레이) 자갈 20kg", "50-70", 55, 262405),
  item("화이트 자갈 20kg", "20-30", 55, 232980),
  item("세척 왕 마사토 20kg", "9-12mm", 80, 361600),
  item("현무암 판석 부정형", "50T", 52, 246910),
  item("(굴림) 현무암 큐브석", "100*100*100", 600, 397470),
  item("오리엔탈 골드 부정형", "30T", 1, 982931),
  item("오리엔탈 골드 판석 (잔다듬)", "300*600*30T", 120, 854400),
  item("챠콜 그레이 경계석", "100*50*500", 100, 500000),
  item("현무암 경계석", "100*100*1000", 60, 521490),
];

function firstItem(result) {
  return result.lineItems[0];
}

test("쉼표로 구분된 기본 입력", () => {
  const r = parseInput("지앤비하우징, 흑자갈, 2030, 5PLT, 운임 75000", SAMPLE_PRICE_ITEMS);
  assert.equal(r.company, "지앤비하우징");
  assert.equal(r.freight, 75000);
  const it = firstItem(r);
  assert.equal(it.name, "블랙(그레이) 자갈 20kg");
  assert.equal(it.spec, "20-30");
  assert.equal(it.inputQty, 5);
  assert.equal(it.inputUnit, "PLT");
  assert.equal(it.needsReview, false);
});

test("쉼표 없이(공백만으로) 회사명+품목+수량 인식", () => {
  const r = parseInput("로드하우징 백자갈 2030 3PLT", SAMPLE_PRICE_ITEMS);
  assert.equal(r.company, "로드하우징");
  assert.equal(firstItem(r).name, "화이트 자갈 20kg");
  assert.equal(firstItem(r).inputQty, 3);
});

test("수량 뒤에 쉼표 없이 운임이 바로 붙은 경우", () => {
  const r = parseInput("지앤비하우징, 흑자갈, 2030, 5PLT 75000", SAMPLE_PRICE_ITEMS);
  assert.equal(r.freight, 75000);
  assert.equal(firstItem(r).inputQty, 5);
});

test("쉼표와 공백이 섞여도 규격+수량+운임을 분리", () => {
  const r = parseInput("지앤비하우징, 흑자갈, 2030 5PLT 30000", SAMPLE_PRICE_ITEMS);
  assert.equal(r.freight, 30000);
  assert.equal(firstItem(r).spec, "20-30");
});

test("규격+수량이 쉼표 뒤에 한 칸에 같이 온 경우", () => {
  const r = parseInput("현무암 판석 부정형, 50T 3파레트", SAMPLE_PRICE_ITEMS);
  const it = firstItem(r);
  assert.equal(it.name, "현무암 판석 부정형");
  assert.equal(it.spec, "50T");
  assert.equal(it.inputQty, 3);
  assert.equal(it.inputUnit, "PLT");
});

test("한글 발음으로 읽은 4자리 사이즈(이공삼공=2030)", () => {
  const r = parseInput("로드하우징, 흑자갈, 이공삼공, 5파레트", SAMPLE_PRICE_ITEMS);
  assert.equal(firstItem(r).spec, "20-30");
});

test("한글 발음 '~에서~' 범위(삼에서오=3-5)", () => {
  const r = parseInput("지앤비하우징, 흑자갈, 삼에서오, 3PLT", SAMPLE_PRICE_ITEMS);
  assert.equal(firstItem(r).spec, "3-5");
});

test("한글 금액 표현(사만원)을 운임으로 인식", () => {
  const r = parseInput("지앤비하우징, 흑자갈, 2030, 5PLT 사만원", SAMPLE_PRICE_ITEMS);
  assert.equal(r.freight, 40000);
});

test("PLT 단위 동의어(빠렛/파레투 등)", () => {
  for (const unit of ["파레트", "팔레트", "빠레트", "파렛", "빠렛", "파레투", "팔렛"]) {
    const r = parseInput(`정원샤이니, 흑자갈, 2030, 2${unit}`, SAMPLE_PRICE_ITEMS);
    assert.equal(firstItem(r).inputUnit, "PLT", `단위 "${unit}"이 PLT로 인식되어야 함`);
  }
});

test("판석류에 포대 단위를 쓰면 확인 필요로 표시", () => {
  const r = parseInput("지앤비하우징, 현무암 판석 부정형, 50T, 2포대", SAMPLE_PRICE_ITEMS);
  const it = firstItem(r);
  assert.equal(it.needsReview, true);
  assert.match(it.reviewReason, /포대/);
});

test("화강암/화강석 별칭 → 오리엔탈 골드", () => {
  const r1 = parseInput("로드하우징, 화강암 부정형, 2PLT", SAMPLE_PRICE_ITEMS);
  assert.equal(firstItem(r1).name, "오리엔탈 골드 부정형");
  const r2 = parseInput("로드하우징, 화강석 부정형, 2PLT", SAMPLE_PRICE_ITEMS);
  assert.equal(firstItem(r2).name, "오리엔탈 골드 부정형");
});

test("차콜(표준 표기) → 챠콜(단가표 표기) 별칭", () => {
  const r = parseInput("지앤비하우징, 차콜 경계석, 3ea", SAMPLE_PRICE_ITEMS);
  assert.equal(firstItem(r).name, "챠콜 그레이 경계석");
});

test("여러 품목이 섞인 긴 입력(흔한 다품목 견적)", () => {
  const r = parseInput(
    "전국구조경, 블랙자갈 20-30 사이즈 40개, 큐브석 180개, 운임 7만5천",
    SAMPLE_PRICE_ITEMS
  );
  assert.equal(r.company, "전국구조경");
  assert.equal(r.freight, 75000);
  assert.equal(r.lineItems.length, 2);
  assert.equal(r.lineItems[0].name, "블랙(그레이) 자갈 20kg");
  assert.equal(r.lineItems[1].name, "(굴림) 현무암 큐브석");
});
