import { Agent, IdentifierKind, type Identifier } from "@xmtp/agent-sdk";

export async function createAgent() {
  return Agent.createFromEnv();
}

export function ethIdentifier(address: string): Identifier {
  return {
    identifier: address.toLowerCase(),
    identifierKind: IdentifierKind.Ethereum,
  };
}
