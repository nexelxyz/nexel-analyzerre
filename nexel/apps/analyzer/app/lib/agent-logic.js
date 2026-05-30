export function deriveAgentAnalysis({
  ageInDays,
  txCount,
  daysSinceLastActivity,
  isVerified,
  uniqueCallers,
}) {
  // Age — 0 to 25 pts
  let agePts = 0;
  if (ageInDays >= 7)  agePts = 10;
  if (ageInDays >= 30) agePts = 18;
  if (ageInDays >= 90) agePts = 25;

  let ageTier = "New";
  if (ageInDays >= 7)  ageTier = "Emerging";
  if (ageInDays >= 30) ageTier = "Established";
  if (ageInDays >= 90) ageTier = "Mature";

  // Activity — 0 to 30 pts
  let activityPts = 0;
  if (txCount >= 1)   activityPts = 8;
  if (txCount >= 11)  activityPts = 18;
  if (txCount >= 51)  activityPts = 25;
  if (txCount >= 200) activityPts = 30;

  let activityTier = "Dormant";
  if (txCount >= 1)  activityTier = "Low";
  if (txCount >= 11) activityTier = "Active";
  if (txCount >= 51) activityTier = "High";

  // Recency — 0 to 20 pts
  let recencyPts = 0;
  if (daysSinceLastActivity <= 30) recencyPts = 10;
  if (daysSinceLastActivity <= 7)  recencyPts = 15;
  if (daysSinceLastActivity <= 1)  recencyPts = 20;

  let recencyTier = "Dormant";
  if (daysSinceLastActivity <= 30) recencyTier = "Slow";
  if (daysSinceLastActivity <= 7)  recencyTier = "Active";
  if (daysSinceLastActivity <= 1)  recencyTier = "Live";

  // Verification — 0 or 15 pts
  const verificationPts = isVerified ? 15 : 0;

  // Interaction diversity — 0 to 10 pts
  const diversityPts = Math.min(10, Math.floor(uniqueCallers / 5));

  const total =
    agePts + activityPts + recencyPts + verificationPts + diversityPts;

  let trustTier = "Unverified";
  if (total >= 25) trustTier = "Emerging";
  if (total >= 50) trustTier = "Established";
  if (total >= 75) trustTier = "Trusted";

  return {
    scores: {
      age: agePts,
      activity: activityPts,
      recency: recencyPts,
      verification: verificationPts,
      diversity: diversityPts,
      total,
    },
    tiers: { ageTier, activityTier, recencyTier, trustTier },
  };
}
