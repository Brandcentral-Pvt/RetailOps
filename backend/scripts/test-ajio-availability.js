const {
  resolveAjioStockSignal,
  resolveAjioAvailability,
  toAjioAvailabilityFields,
} = require("../services/ajioScraperService");

let pass = 0;
let fail = 0;

function check(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    pass++;
  } else {
    fail++;
    console.log(`  FAIL ${name}\n       expected ${e}\n       actual   ${a}`);
  }
}

console.log("resolveAjioStockSignal");
check("boolean true", resolveAjioStockSignal(true), "available");
check("boolean false", resolveAjioStockSignal(false), "out_of_stock");
check("InStock", resolveAjioStockSignal("InStock"), "available");
check("lowercase instock (was broken)", resolveAjioStockSignal("instock"), "available");
check("In Stock with space", resolveAjioStockSignal("In Stock"), "available");
check("in_stock", resolveAjioStockSignal("in_stock"), "available");
check("lowStock", resolveAjioStockSignal("lowStock"), "available");
check("OutOfStock", resolveAjioStockSignal("OutOfStock"), "out_of_stock");
check("OUT_OF_STOCK", resolveAjioStockSignal("OUT_OF_STOCK"), "out_of_stock");
check("soldout", resolveAjioStockSignal("soldout"), "out_of_stock");
check("numeric 5", resolveAjioStockSignal("5"), "available");
check("numeric 0", resolveAjioStockSignal("0"), "out_of_stock");
check("object isAvailable", resolveAjioStockSignal({ isAvailable: false }), "out_of_stock");
check("object stockLevel", resolveAjioStockSignal({ stockLevel: 3 }), "available");
check("null", resolveAjioStockSignal(null), "unknown");
check("empty", resolveAjioStockSignal(""), "unknown");
check("garbage", resolveAjioStockSignal("banana"), "unknown");

console.log("resolveAjioAvailability");
check(
  "variant stock wins and yields ADD TO BAG",
  resolveAjioAvailability({
    variantOptions: [{ stock: { stockLevel: 0 } }, { stock: { stockLevel: 2 } }],
  }),
  { status: "available", ctaKey: null, label: "ADD TO BAG" },
);
check(
  "all variants empty -> OUT OF STOCK",
  resolveAjioAvailability({
    variantOptions: [{ stock: { stockLevel: 0 } }, { stock: { stockLevel: 0 } }],
  }),
  { status: "out_of_stock", ctaKey: null, label: "OUT OF STOCK" },
);
check(
  "disabled CTA counts as out of stock (was silently dropped)",
  resolveAjioAvailability({ ctaLabel: "ADD TO BAG", ctaState: "disabled" }),
  { status: "out_of_stock", ctaKey: "addToBag", label: "ADD TO BAG" },
);
check(
  "enabled ADD TO BAG -> available, label preserved",
  resolveAjioAvailability({ ctaLabel: " ADD TO BAG ", ctaState: "available" }),
  { status: "available", ctaKey: "addToBag", label: "ADD TO BAG" },
);
check(
  "NOTIFY ME -> out of stock",
  resolveAjioAvailability({ ctaLabel: "Notify Me", ctaState: "available" }),
  { status: "out_of_stock", ctaKey: "notifyMe", label: "NOTIFY ME" },
);
check(
  "SOLD OUT -> out of stock",
  resolveAjioAvailability({ ctaLabel: "Sold Out", ctaState: "available" }),
  { status: "out_of_stock", ctaKey: "soldOut", label: "SOLD OUT" },
);
check(
  "stock beats a stale CTA label for status but keeps the label",
  resolveAjioAvailability({
    stock: { isAvailable: false },
    ctaLabel: "ADD TO BAG",
    ctaState: "available",
  }),
  { status: "out_of_stock", ctaKey: "addToBag", label: "ADD TO BAG" },
);
check(
  "no signals at all -> unknown",
  resolveAjioAvailability({}),
  { status: "unknown", ctaKey: null, label: null },
);
check(
  "container stock level is used",
  resolveAjioAvailability({ containerStockLevel: 4 }),
  { status: "available", ctaKey: null, label: "ADD TO BAG" },
);
check(
  "schema availability string is used",
  resolveAjioAvailability({ productAvailability: "OutOfStock" }),
  { status: "out_of_stock", ctaKey: null, label: "OUT OF STOCK" },
);

console.log("toAjioAvailabilityFields");
check(
  "available maps canonical + display label",
  toAjioAvailabilityFields({ status: "available", label: "ADD TO BAG" }),
  { availability: "InStock", availabilityStatus: "ADD TO BAG" },
);
check(
  "out of stock maps canonical + display label",
  toAjioAvailabilityFields({ status: "out_of_stock", label: "OUT OF STOCK" }),
  { availability: "OutOfStock", availabilityStatus: "OUT OF STOCK" },
);
check(
  "unknown writes nothing (no stale overwrite)",
  toAjioAvailabilityFields({ status: "unknown", label: null }),
  { availability: null, availabilityStatus: null },
);
check(
  "missing label falls back to a clean default",
  toAjioAvailabilityFields({ status: "available", label: null }),
  { availability: "InStock", availabilityStatus: "ADD TO BAG" },
);

console.log("toAjioAvailabilityFields: status/label agreement");
const disabled = resolveAjioAvailability({
  ctaLabel: "ADD TO BAG",
  ctaState: "disabled",
});
check(
  "disabled ADD TO BAG is not shown as a buyable in-stock chip",
  toAjioAvailabilityFields(disabled),
  { availability: "OutOfStock", availabilityStatus: "OUT OF STOCK" },
);
check(
  "genuine OOS button text is preserved",
  toAjioAvailabilityFields({
    status: "out_of_stock",
    ctaKey: "soldOut",
    label: "SOLD OUT",
  }),
  { availability: "OutOfStock", availabilityStatus: "SOLD OUT" },
);
check(
  "NOTIFY ME is preserved",
  toAjioAvailabilityFields({
    status: "out_of_stock",
    ctaKey: "notifyMe",
    label: "NOTIFY ME",
  }),
  { availability: "OutOfStock", availabilityStatus: "NOTIFY ME" },
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
