import { NextResponse } from "next/server";
import { ethers } from "ethers";
import { deriveAgentAnalysis } from "../../lib/agent-logic.js";

// Basescan V2 free tier: getsourcecode works.
// getcontractcreation is paywalled — creator resolved via binary search instead.
const BASESCAN = "https://api.etherscan.io/v2/api?chainid=8453";

// Call Alchemy-enhanced RPC methods through the existing ethers provider.
// The alchemy-sdk (v3.6.5) uses an ethers v5 internal that fails in the
// Next.js server runtime. provider.send() uses ethers v6 and is stable.
async function alchemySend(provider, method, params) {
  try {
    return await provider.send(method, params);
  } catch (err) {
    console.error(`${method} ERROR:`, err.message);
    return null;
  }
}

async function bscan(params) {
  try {
    const url = `${BASESCAN}&${params}&apikey=${process.env.BASESCAN_API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    console.log("BASESCAN", params.split("&")[1], "→ status:", data.status);
    return data;
  } catch (err) {
    console.error("BASESCAN ERROR:", err.message);
    return null;
  }
}

// Binary search for the block where eth_getCode first returns non-"0x".
// O(log n) RPC calls — ~25 calls for a 30M-block chain. Runs concurrently
// with the other data fetches so it doesn't add to the critical path.
async function findDeploymentBlock(provider, address) {
  try {
    let lo = 0;
    let hi = await provider.getBlockNumber();
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      const code = await provider.getCode(address, mid);
      code === "0x" ? (lo = mid + 1) : (hi = mid);
    }
    return lo;
  } catch (err) {
    console.error("findDeploymentBlock ERROR:", err.message);
    return null;
  }
}

export async function POST(request) {
  try {
    const { address: rawAddress } = await request.json();

    // Normalize to lowercase — ethers v6 validates EIP-55 checksum on
    // mixed-case addresses and rejects valid addresses with wrong casing.
    const address =
      typeof rawAddress === "string" ? rawAddress.trim().toLowerCase() : "";

    if (!ethers.isAddress(address)) {
      return NextResponse.json({ error: "Invalid address" }, { status: 400 });
    }

    const provider = new ethers.JsonRpcProvider(
      `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
    );

    const code = await provider.getCode(address);
    const isContract = code !== "0x";

    console.log("ADDRESS:", address, "| isContract:", isContract);

    // ── EOA path ──────────────────────────────────────────────────────────────
    // No scoring applied. Direct users to /api/analyze for full wallet analysis.
    if (!isContract) {
      const [balanceWei, txCount] = await Promise.all([
        provider.getBalance(address),
        provider.getTransactionCount(address),
      ]);
      return NextResponse.json({
        type: "EOA",
        address,
        wallet: {
          balance: ethers.formatEther(balanceWei),
          txCount,
        },
      });
    }

    // ── CONTRACT path ─────────────────────────────────────────────────────────
    // Four concurrent fetches — findDeploymentBlock is the long pole (~1.3s).
    // The others (~50–200ms each) finish first and wait.
    const TRANSFER_CATS = ["external", "internal", "erc20", "erc721", "erc1155"];

    const [balanceWei, verificationData, recentTxResult, deploymentBlock] =
      await Promise.all([
        provider.getBalance(address),

        bscan(`module=contract&action=getsourcecode&address=${address}`),

        alchemySend(provider, "alchemy_getAssetTransfers", [{
          toAddress: address,
          category: TRANSFER_CATS,
          order: "desc",
          maxCount: "0x64",
          withMetadata: true,
        }]),

        findDeploymentBlock(provider, address),
      ]);

    const balance = ethers.formatEther(balanceWei);

    // Deployment timestamp + creator — resolved from the deployment block.
    let creator = null;
    let deployedAt = null;
    let ageInDays = 0;

    if (deploymentBlock !== null) {
      try {
        if (deploymentBlock === 0) {
          // Genesis predeploy — get chain-start timestamp, no creation tx exists.
          const genesis = await provider.getBlock(0);
          if (genesis) {
            deployedAt = genesis.timestamp;
            ageInDays = Math.floor((Date.now() / 1000 - deployedAt) / 86400);
          }
        } else {
          // Normal deployment — timestamp + creation tx (direct deploys only).
          // Factory-deployed contracts (CREATE2) have tx.to !== null; those
          // return creator: null.
          const block = await provider.getBlock(deploymentBlock, true);
          if (block) {
            deployedAt = block.timestamp;
            ageInDays = Math.floor((Date.now() / 1000 - deployedAt) / 86400);
            const nullToTxs = block.transactions.filter(tx => tx.to === null);
            for (const tx of nullToTxs) {
              const receipt = await provider.getTransactionReceipt(tx.hash);
              if (receipt?.contractAddress?.toLowerCase() === address) {
                creator = tx.from;
                break;
              }
            }
          }
        }
      } catch (err) {
        console.error("deployment block lookup ERROR:", err.message);
      }
    }

    console.log(
      "creator:", creator,
      "| deploymentBlock:", deploymentBlock,
      "| deployedAt:", deployedAt,
      "| ageInDays:", ageInDays
    );

    // Verification — non-empty SourceCode means verified on Basescan.
    const sourceCode = verificationData?.result?.[0]?.SourceCode ?? "";
    const isVerified =
      typeof sourceCode === "string" && sourceCode.trim().length > 0;

    // Activity — 100 most recent asset transfers to this contract.
    const txs = recentTxResult?.transfers ?? [];
    const txCount = txs.length;
    const txCountCapped = recentTxResult?.pageKey !== undefined;
    const lastActivityAt = txs[0]?.metadata?.blockTimestamp
      ? Math.floor(new Date(txs[0].metadata.blockTimestamp).getTime() / 1000)
      : null;
    const daysSinceLastActivity = lastActivityAt
      ? Math.floor((Date.now() / 1000 - lastActivityAt) / 86400)
      : 999;
    const uniqueCallers = new Set(
      txs.map((tx) => tx.from?.toLowerCase()).filter(Boolean)
    ).size;

    console.log(
      "isVerified:", isVerified,
      "| txCount:", txCount,
      "| uniqueCallers:", uniqueCallers,
      "| daysSinceLastActivity:", daysSinceLastActivity
    );

    const { scores, tiers } = deriveAgentAnalysis({
      ageInDays,
      txCount,
      daysSinceLastActivity,
      isVerified,
      uniqueCallers,
    });

    console.log("SCORE:", scores.total, "| TIER:", tiers.trustTier);

    return NextResponse.json({
      type: "CONTRACT",
      address,
      contract: {
        creator,
        deploymentBlock,
        deployedAt,
        ageInDays,
        isVerified,
        balance,
        txCount,
        txCountCapped,
        uniqueCallers,
        lastActivityAt,
        daysSinceLastActivity,
      },
      scores,
      tiers,
    });
  } catch (err) {
    console.error("ANALYZE-AGENT UNHANDLED ERROR:", err);
    return NextResponse.json(
      { error: "Failed to analyze agent" },
      { status: 500 }
    );
  }
}
