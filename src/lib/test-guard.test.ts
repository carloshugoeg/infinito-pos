import { afterEach, describe, expect, it } from "vitest";
import { assertNonProductionDatabase, isProductionDatabase } from "@/lib/test-guard";

const LOCAL = "postgresql://postgres:postgres@localhost:5433/koi_pos?schema=public";
const PROD = "postgresql://postgres.htlcnzlhuqvcovaggzos:pw@aws-1-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true";

describe("isProductionDatabase", () => {
  it("is false for the local docker DB", () => {
    expect(isProductionDatabase(LOCAL)).toBe(false);
  });
  it("is true for the supabase prod host", () => {
    expect(isProductionDatabase(PROD)).toBe(true);
  });
  it("is false for undefined", () => {
    expect(isProductionDatabase(undefined)).toBe(false);
  });
});

describe("assertNonProductionDatabase", () => {
  const url = process.env.DATABASE_URL;
  const allow = process.env.ALLOW_PROD_SEED;
  afterEach(() => {
    if (url === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = url;
    if (allow === undefined) delete process.env.ALLOW_PROD_SEED;
    else process.env.ALLOW_PROD_SEED = allow;
  });

  it("does not throw on the local DB", () => {
    process.env.DATABASE_URL = LOCAL;
    delete process.env.ALLOW_PROD_SEED;
    expect(() => assertNonProductionDatabase("test")).not.toThrow();
  });
  it("throws on the prod DB with no override", () => {
    process.env.DATABASE_URL = PROD;
    delete process.env.ALLOW_PROD_SEED;
    expect(() => assertNonProductionDatabase("test")).toThrow(/production database/);
  });
  it("allows the prod DB when ALLOW_PROD_SEED=true", () => {
    process.env.DATABASE_URL = PROD;
    process.env.ALLOW_PROD_SEED = "true";
    expect(() => assertNonProductionDatabase("test")).not.toThrow();
  });
});
