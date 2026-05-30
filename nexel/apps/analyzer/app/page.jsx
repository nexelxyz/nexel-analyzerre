export default function Home() {
  return (
    <main>
      <div className="app-header">
        <div className="app-header-tag">Analyzer · v0.2 · Base Mainnet</div>
        <h1>
          Inspect any address.
          <br />
          Score any <em>agent.</em>
        </h1>
        <p>
          Live on-chain analysis for wallets and smart contract agents on Base.
          No synthetic data. No mock registries. Read directly from the chain.
        </p>
      </div>

      <div className="app-wrap">
        <div className="product-grid">

          {/* ── Wallet Analyzer ──────────────────────────────────────────── */}
          <div className="product-card">
            <div className="product-card-num">01 · Wallet Analyzer</div>
            <h2>
              Inspect any Base <em>wallet.</em>
            </h2>
            <p className="product-card-desc">
              Paste any Base mainnet address. Nexel queries the chain directly
              through Alchemy and returns its real on-chain footprint, trust
              score, and risk signals.
            </p>
            <ul className="product-card-features">
              <li>Balance &amp; transaction count</li>
              <li>Wallet age tier</li>
              <li>Reputation score</li>
              <li>Sybil probability</li>
              <li>Risk level</li>
              <li>Trust score (0–100)</li>
            </ul>
            <a href="/analyzer" className="inspect-btn" style={{ alignSelf: "flex-start", textDecoration: "none" }}>
              Open Wallet Analyzer →
            </a>
          </div>

          {/* ── Agent Analyzer ───────────────────────────────────────────── */}
          <div className="product-card">
            <div className="product-card-num">02 · Agent Analyzer</div>
            <h2>
              Detect and score any contract <em>agent.</em>
            </h2>
            <p className="product-card-desc">
              Paste any Base mainnet address. Nexel detects whether it is a
              smart contract agent or an EOA wallet, then scores it across five
              on-chain trust dimensions.
            </p>
            <ul className="product-card-features">
              <li>EOA vs. contract detection</li>
              <li>Contract verification status</li>
              <li>Deployment age &amp; timestamp</li>
              <li>Transaction activity &amp; unique callers</li>
              <li>Interaction diversity</li>
              <li>Trust tier &amp; agent score (0–100)</li>
            </ul>
            <a href="/agent" className="inspect-btn" style={{ alignSelf: "flex-start", textDecoration: "none" }}>
              Open Agent Analyzer →
            </a>
          </div>

        </div>
      </div>
    </main>
  );
}
