import type { NFSeProvider } from "../types";
import { MockNFSeProvider } from "./mock-provider";
import { NationalNFSeProvider } from "./national-provider";

export function getNFSeProvider(): NFSeProvider {
  return process.env.NFSE_PROVIDER === "national" ? new NationalNFSeProvider() : new MockNFSeProvider();
}
