/**
 * wagmi config for Mimir on Mantle.
 *
 * Supports: MetaMask, Coinbase Wallet, injected wallets.
 * Primary chain: Mantle Sepolia (5003), MNT native (18 decimals).
 *
 * No bridge chains are registered — the project is single-chain on Mantle now.
 */
import { createConfig, http } from "wagmi";
import { coinbaseWallet, injected, metaMask } from "@wagmi/connectors";
import { mantleChain, getMantleRpcUrl } from "./mantle";

export const wagmiConfig = createConfig({
  chains: [mantleChain],
  connectors: [
    metaMask(),
    coinbaseWallet({
      appName: "Mimir",
      appLogoUrl: "https://mimir.app/logo.png",
    }),
    injected({ target: "phantom" }),
    injected(),
  ],
  transports: {
    [mantleChain.id]: http(getMantleRpcUrl()),
  },
  ssr: true,
});
