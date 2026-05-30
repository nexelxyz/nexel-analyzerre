"use client";

import { useState } from "react";
import ResultCard from "@nexel/ui/components/result/ResultCard.jsx";

const ADDR_RE = /^0x[a-fA-F0-9]{40}$/;

function fmtAge(days) {
  if (days === 0) return "< 1 day";
  if (days < 30)  return `${days}d`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  const y = Math.floor(days / 365);
  const m = Math.floor((days % 365) / 30);
  return m > 0 ? `${y}y ${m}mo` : `${y}y`;
}

function fmtDate(unixTs) {
  if (!unixTs) return "Unknown";
  return new Date(unixTs * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function fmtLastActive(days) {
  if (days >= 999) return "no activity found";
  if (days === 0)  return "today";
  if (days === 1)  return "1 day ago";
  if (days < 7)   return `${days} days ago`;
  if (days < 14)  return "1 week ago";
  if (days < 30)  return `${Math.floor(days / 7)} weeks ago`;
  if (days < 60)  return "1 month ago";
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)}+ years ago`;
}

function fmtAddr(addr) {
  if (!addr) return "Unknown";
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}

export default function AgentAnalyzer() {
  const [address, setAddress] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({
    cls: "",
    node: (
      <>
        → Awaiting address. Paste any Base mainnet address to detect and score
        it.
      </>
    ),
  });

  async function analyze() {
    const addr = address.trim();

    if (!ADDR_RE.test(addr)) {
      setStatus({
        cls: "",
        node: "→ Invalid Base address. Expected 0x + 40 hex characters.",
      });
      return;
    }

    setLoading(true);
    setResult(null);
    setStatus({
      cls: "live",
      node: <strong>Querying Base mainnet via Alchemy…</strong>,
    });

    try {
      const res = await fetch("/api/analyze-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: addr }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to analyze agent");

      setResult({ address: addr, ...data });
      setStatus({
        cls: "",
        node:
          data.type === "CONTRACT"
            ? "→ Contract agent detected. Data fetched from Base mainnet and Basescan."
            : "→ EOA detected. This address is a wallet, not a contract agent.",
      });
    } catch (e) {
      setStatus({
        cls: "",
        node: "→ " + (e.message || "Failed to analyze agent"),
      });
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e) {
    if (e.key === "Enter") analyze();
  }

  function contractCardProps(result) {
    const c = result.contract;
    const txDisplay = c.txCountCapped ? "100+" : String(c.txCount);

    return {
      address: result.address,
      typeLabel: "CONTRACT AGENT",
      score: result.scores.total,
      tier: result.tiers.trustTier.toUpperCase(),
      metrics: [
        {
          label: "Contract Age",
          value: c.deployedAt ? fmtAge(c.ageInDays) : "Unknown",
          sub: c.deployedAt ? result.tiers.ageTier.toLowerCase() : "not indexed",
        },
        {
          label: "Deployed",
          value: fmtDate(c.deployedAt),
          sub: c.deploymentBlock ? `block ${c.deploymentBlock.toLocaleString()}` : "unknown block",
        },
        {
          label: "Creator",
          value: fmtAddr(c.creator),
          sub: "deployer address",
        },
        {
          label: "Verified",
          value: c.isVerified ? "Yes" : "No",
          sub: c.isVerified ? "source on Basescan" : "unverified contract",
        },
        {
          label: "Tx Count",
          value: txDisplay,
          sub: "inbound interactions",
        },
        {
          label: "Last Active",
          value: fmtLastActive(c.daysSinceLastActivity),
          sub: result.tiers.recencyTier.toLowerCase(),
        },
        {
          label: "Unique Callers",
          value: c.uniqueCallers,
          sub: "distinct addresses",
        },
        {
          label: "Balance",
          value: `${Number(c.balance).toFixed(4)} ETH`,
          sub: "on Base mainnet",
        },
      ],
      signals: [
        {
          mark: "●",
          cls:
            result.scores.age >= 18 ? "pos" : result.scores.age >= 10 ? "" : "neg",
          text: `Age — ${result.tiers.ageTier}`,
          pts: `+${result.scores.age}`,
        },
        {
          mark: "●",
          cls:
            result.scores.activity >= 18
              ? "pos"
              : result.scores.activity >= 8
              ? ""
              : "neg",
          text: `Activity — ${result.tiers.activityTier}`,
          pts: `+${result.scores.activity}`,
        },
        {
          mark: "●",
          cls:
            result.scores.recency >= 15
              ? "pos"
              : result.scores.recency >= 10
              ? ""
              : "neg",
          text: `Recency — ${result.tiers.recencyTier}`,
          pts: `+${result.scores.recency}`,
        },
        {
          mark: "●",
          cls: c.isVerified ? "pos" : "neg",
          text: `Verification — ${c.isVerified ? "Verified" : "Not Verified"}`,
          pts: `+${result.scores.verification}`,
        },
        {
          mark: "●",
          cls:
            result.scores.diversity >= 6
              ? "pos"
              : result.scores.diversity >= 2
              ? ""
              : "warn",
          text: `Diversity — ${c.uniqueCallers} unique callers`,
          pts: `+${result.scores.diversity}`,
        },
      ],
      note: (
        <>
          <strong style={{ color: "var(--fg)", letterSpacing: "0.1em" }}>
            LIVE:
          </strong>{" "}
          Creator, deployment block, and activity are read from Base mainnet via
          Alchemy. Verification is read from Basescan. Score is computed by the
          Nexel Agent Analyzer.
        </>
      ),
    };
  }

  // EOA — no agent scoring. Raw on-chain data only.
  // Link to /analyzer for full wallet scoring.
  function eoaCardProps(result) {
    const w = result.wallet;
    return {
      address: result.address,
      typeLabel: "EOA — NOT AN AGENT",
      score: "—",
      tier: "NOT SCOREABLE",
      metrics: [
        {
          label: "Balance",
          value: `${Number(w.balance).toFixed(4)} ETH`,
          sub: "on Base mainnet",
        },
        { label: "Tx Count", value: w.txCount, sub: "outbound transactions" },
      ],
      note: (
        <>
          <strong style={{ color: "var(--fg)", letterSpacing: "0.1em" }}>
            NOTE:
          </strong>{" "}
          This address is an externally owned account (EOA), not a smart
          contract agent. For full wallet scoring, use the{" "}
          <a
            href="/analyzer"
            style={{ color: "var(--fg)", textDecoration: "underline" }}
          >
            Address Analyzer
          </a>
          .
        </>
      ),
    };
  }

  const cardProps =
    result?.type === "CONTRACT"
      ? contractCardProps(result)
      : result?.type === "EOA"
      ? eoaCardProps(result)
      : null;

  return (
    <main>
      <div className="app-header">
        <div className="app-header-tag">Agent Analyzer · v0.2 · Base Mainnet</div>
        <h1>
          Detect any agent.
          <br />
          Score any <em>contract.</em>
        </h1>
        <p>
          Paste any Base mainnet address. Nexel detects whether it is a smart
          contract agent or an EOA wallet, then scores it across five on-chain
          dimensions: age, activity, recency, verification, and interaction
          diversity.
        </p>
      </div>

      <div className="app-wrap">
        <div className="inspector-input-row">
          <input
            type="text"
            className="form-input"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="0x… — any Base mainnet address"
            spellCheck="false"
            autoComplete="off"
          />
          <button
            className="inspect-btn"
            onClick={analyze}
            disabled={loading}
          >
            {loading ? "Analyzing…" : "Analyze →"}
          </button>
        </div>

        <div className={`inspect-status ${status.cls}`}>{status.node}</div>

        {cardProps ? (
          <div style={{ marginTop: "24px" }}>
            <ResultCard {...cardProps} />
          </div>
        ) : (
          <div className="inspect-empty" style={{ marginTop: "24px" }}>
            <div className="inspect-empty-icon">⌕</div>
            <div
              style={{
                fontFamily: "var(--serif)",
                fontSize: "22px",
                color: "var(--fg-dim)",
                marginBottom: "8px",
              }}
            >
              No agent analyzed yet
            </div>
            <div style={{ fontSize: "12px" }}>
              Enter an address above to detect and score it.
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
