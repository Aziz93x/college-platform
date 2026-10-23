import { expect, it } from "vitest";
import messages from "../../messages/ar.json" with { type: "json" };
import {
  type Catalog,
  checkText,
  flatten,
} from "../../src/modules/texts/domain/catalog.ts";

// Every text of the catalog parses as an ICU message, so the texts page can check a college's
// wording of any of them against it (ADR-0029).
it("finds every text of the catalog a wording its own default would pass", () => {
  for (const { key, value } of flatten(messages as Catalog)) {
    expect([key, checkText(value, value)]).toEqual([key, undefined]);
  }
});
