// 도매단가표(PLT) 2026-10-11 기준 데이터를 price_items 테이블에 초기 적재한다.
// 품목×규격 조합으로 행을 분리해서 저장한다. (요구사항 4번)
const db = require("./db.js");

const ROWS = [
  { names: ["화이트 자갈 20kg", "블랙(그레이) 자갈 20kg"], specs: ["3-5mm", "50-70mm"], qty: 55, price: 262405, note: "택배 출고용, 20kg 미만 중량 설정" },
  { names: ["화이트 자갈 20kg", "블랙(그레이) 자갈 20kg"], specs: ["10-20mm", "20-30mm"], qty: 55, price: 232980, note: "택배 출고용, 20kg 미만 중량 설정" },
  { names: ["파스텔핑크 자갈 18kg"], specs: ["3-5mm"], qty: 55, price: 293040, note: "" },
  { names: ["파스텔핑크 자갈 18kg"], specs: ["10-20mm", "20-30mm"], qty: 55, price: 280390, note: "" },
  { names: ["옐로우 자갈 18kg"], specs: ["20-40mm"], qty: 55, price: 280390, note: "" },
  { names: ["내추럴 자갈 18kg"], specs: ["10-20mm"], qty: 55, price: 271920, note: "베트남산 강자갈" },
  { names: ["보석 자갈 18kg"], specs: ["10-20mm", "20-30mm"], qty: 80, price: 432880, note: "" },
  { names: ["레드 화산송이 자갈 15kg", "블랙 화산송이 자갈 15kg"], specs: ["3-5mm", "10-20mm", "20-30mm"], qty: 66, price: 340758, note: "" },
  { names: ["레드 화산송이 톤백 900kg", "블랙 화산송이 톤백 900kg"], specs: ["100-150mm"], qty: 300, price: 368700, note: "" },
  { names: ["그레이 송이석 1EA"], specs: ["100-150mm"], qty: 300, price: 784520, note: "대략 갯수, 매우 가벼움" },
  { names: ["납작스톤 10kg"], specs: ["60-90mm"], qty: 100, price: 902430, note: "" },
  { names: ["세척 왕 마사토 20kg"], specs: ["1-3mm", "2-4mm", "5-8mm", "9-12mm"], qty: 80, price: 361600, note: "택배 출고용, 20kg 미만 중량 설정" },
  { names: ["세척 왕 마사토 10kg"], specs: ["1-3mm", "2-4mm", "5-8mm", "9-12mm"], qty: 140, price: 441000, note: "" },
  { names: ["폴라이트 (경석, 난석, 휴가토) 20L"], specs: ["5-10mm", "10-20mm", "20-30mm"], qty: 50, price: 562300, note: "신규 입고시 용량 줄어들고, 단가 35% 인하" },
  { names: ["현무암 판석 부정형"], specs: ["50T"], qty: 52, price: 246910, note: "파손율 5% 감안" },
  { names: ["(굴림) 현무암 판석 부정형"], specs: ["50T"], qty: 52, price: 269680, note: "파손율 5% 감안" },
  { names: ["현무암 판석 부정형"], specs: ["30T"], qty: 80, price: 259960, note: "파손율 5% 감안" },
  { names: ["현무암 판석"], specs: ["300*600*30T"], qty: 120, price: 638130, note: "파손율 5% 감안" },
  { names: ["현무암 판석"], specs: ["500*500*50T"], qty: 40, price: 403350, note: "파손율 5% 감안" },
  { names: ["현무암 판석"], specs: ["500*500*30T"], qty: 80, price: 438750, note: "파손율 10% 감안" },
  { names: ["(굴림) 현무암 판석"], specs: ["400*450*50T"], qty: 52, price: 564240, note: "파손율 5% 감안" },
  { names: ["현무암 판석 원형"], specs: ["D400 50T"], qty: 90, price: 899740, note: "파손율 5% 감안" },
  { names: ["현무암 판석 원형"], specs: ["D400 30T"], qty: 120, price: 736080, note: "파손율 5% 감안", discontinued: 1 },
  { names: ["현무암 경계석"], specs: ["100*100*1000"], qty: 60, price: 521490, note: "파손율 5% 감안" },
  { names: ["현무암 벽돌"], specs: ["200*100*50"], qty: 500, price: 311460, note: "파손율 5% 감안" },
  { names: ["(굴림) 현무암 벽돌"], specs: ["200*100*50"], qty: 500, price: 329780, note: "파손율 5% 감안" },
  { names: ["(굴림) 현무암 큐브석"], specs: ["100*100*100"], qty: 600, price: 397470, note: "" },
  { names: ["(굴림) 현무암 더블큐브석"], specs: ["200*100*100"], qty: 300, price: 397200, note: "" },
  { names: ["(굴림) 현무암 메주석"], specs: ["50*150*200~30"], qty: 90, price: 309920, note: "" },
  { names: ["오리엔탈 골드 부정형"], specs: ["30T"], qty: 1, price: 982931, note: "25헤베 분량" },
  { names: ["오리엔탈 골드 판석 (잔다듬)"], specs: ["300*600*30T"], qty: 120, price: 854400, note: "파손율 5% 감안" },
  { names: ["오리엔탈 골드 판석 (잔다듬)"], specs: ["400*400*30T"], qty: 120, price: 773280, note: "파손율 5% 감안" },
  { names: ["오리엔탈 골드 경계석 (잔다듬)"], specs: ["100*100*500"], qty: 100, price: 711200, note: "" },
  { names: ["오리엔탈 골드 경계석 곡선 (잔다듬)"], specs: ["0.25R"], qty: 30, price: 439380, note: "" },
  { names: ["(굴림) 오리엔탈 골드 벽돌"], specs: ["200*100*50"], qty: 600, price: 892080, note: "파손율 5% 감안" },
  { names: ["(굴림) 오리엔탈 골드 큐브석"], specs: ["100*100*100"], qty: 600, price: 892080, note: "" },
  { names: ["(굴림) 오리엔탈 골드 더블큐브석"], specs: ["200*100*100"], qty: 350, price: 968100, note: "" },
  { names: ["오리엔탈 골드 원형 400파이 30T (잔다듬)"], specs: ["D400 30T"], qty: 120, price: 1139520, note: "" },
  { names: ["핑크 뮬리 판석 (잔다듬)"], specs: ["300*600*30T"], qty: 120, price: 1090214, note: "" },
  { names: ["핑크 뮬리 판석 (잔다듬)"], specs: ["400*400*30T"], qty: 120, price: 986705, note: "" },
  { names: ["(굴림) 핑크 뮬리 큐브석"], specs: ["100*100*100"], qty: 600, price: 911520, note: "불량율 5% 감안" },
  { names: ["펄라이트 20L"], specs: [""], qty: 77, price: 382690, note: "" },
  { names: ["유기농 코코칩 57L"], specs: [""], qty: 120, price: 1197600, note: "" },
  { names: ["유기농 코코칩 5L"], specs: [""], qty: 528, price: 1490544, note: "22EA/BOX, 24BOX/PLT, 528EA/PLT" },
  { names: ["유기농 코코피트 5L"], specs: [""], qty: 528, price: 1050720, note: "22EA/BOX, 24BOX/PLT, 528EA/PLT" },
  { names: ["소나무바크 40L (내추럴)"], specs: [""], qty: 90, price: 315420, note: "" },
  { names: ["소나무바크 40L (루미테라)"], specs: [""], qty: 90, price: 993210, note: "" },
  { names: ["황토볼 3kg"], specs: ["5mm", "10mm"], qty: 300, price: 1266240, note: "" },
  { names: ["황토볼 10kg"], specs: ["5mm", "10mm"], qty: 100, price: 1223600, note: "" },
  { names: ["칼라 하이드로볼 1L (0.9~1.0kg)"], specs: ["5mm", "10mm"], qty: 500, price: 955000, note: "클레이 베이지, 세이지 그린, 로즈 핑크, 소프트 옐로우 등" },
  { names: ["현무암 괴석"], specs: ["소/중/대", "중/대/특대"], qty: 1, price: 316230, note: "" },
  { names: ["옐로우 캐니언 괴석"], specs: ["D200-700"], qty: 1, price: 976230, note: "" },
  { names: ["스틸그레이 괴석"], specs: ["D200-700"], qty: 1, price: 855170, note: "" },
  { names: ["염화칼슘 20kg"], specs: ["74%"], qty: 50, price: 306000, note: "" },
  { names: ["현무암 석등"], specs: ["H500"], qty: 25, price: 1604465, note: "" },
  { names: ["현무암 석등"], specs: ["H700"], qty: 20, price: 1699802, note: "" },
];

async function seed() {
  const countRow = await db.prepare(`SELECT COUNT(*) AS c FROM price_items`).get();
  if (Number(countRow.c) > 0) {
    console.log(`price_items already has ${countRow.c} rows. Skip seeding.`);
    return;
  }

  const insertMany = db.transaction(async (rows, tx) => {
    const insert = tx.prepare(
      `INSERT INTO price_items (name, spec, pallet_qty, pallet_price, note, discontinued) VALUES (?, ?, ?, ?, ?, ?)`
    );
    for (const row of rows) {
      for (const name of row.names) {
        for (const spec of row.specs) {
          await insert.run(name, spec, row.qty, row.price, row.note || "", row.discontinued ? 1 : 0);
        }
      }
    }
  });
  await insertMany(ROWS);

  await db.prepare(`INSERT INTO price_versions (label) VALUES (?)`).run("초기 단가표 (도매단가표(PLT) B_2.0)");

  console.log(`Seeded ${ROWS.reduce((s, r) => s + r.names.length * r.specs.length, 0)} price items.`);
  process.exit(0);
}

seed();
