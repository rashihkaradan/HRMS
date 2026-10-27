const LABELS = {
  APPLIED: "Applied",
  SCREENING: "Screening",
  INTERVIEW: "Interview",
  OFFER: "Offer",
  HIRED: "Hired",
  REJECTED: "Rejected",
};

export default function StageBadge({ stage }) {
  const cls = `stamp stamp-${stage.toLowerCase()}`;
  return <span className={cls}>{LABELS[stage] || stage}</span>;
}
