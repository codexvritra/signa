import { IdentifierKind, type Signer, type Identifier } from "@xmtp/browser-sdk";
import { toBytes } from "viem";

export const XMTP_ENV = "production" as const;

type SignableWalletClient = {
  signMessage: (args: {
    account?: `0x${string}`;
    message: string;
  }) => Promise<`0x${string}`>;
};

export function buildXmtpSigner(
  walletClient: SignableWalletClient,
  address: `0x${string}`,
): Signer {
  const identifier: Identifier = {
    identifier: address.toLowerCase(),
    identifierKind: IdentifierKind.Ethereum,
  };
  return {
    type: "EOA",
    getIdentifier: () => identifier,
    signMessage: async (message: string) => {
      const sig = await walletClient.signMessage({ account: address, message });
      return toBytes(sig);
    },
  };
}

export function ethIdentifier(address: string): Identifier {
  return {
    identifier: address.toLowerCase(),
    identifierKind: IdentifierKind.Ethereum,
  };
}
