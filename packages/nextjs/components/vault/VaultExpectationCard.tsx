"use client";

type Props = {
  title: string;
  description: string;
  source: string;
  destination: string;
  amountLabel?: string;
  amountHint?: string;
};

export const VaultExpectationCard = ({ title, description, source, destination, amountLabel, amountHint }: Props) => {
  return (
    <div className="card bg-base-100 border border-base-300 p-4 rounded-xl space-y-1">
      <div className="font-semibold">{title}</div>
      <div className="text-sm text-base-content/70">{description}</div>
      <div className="text-xs text-base-content/70">Source: {source}</div>
      <div className="text-xs text-base-content/70">Destination: {destination}</div>
      {amountLabel ? <div className="text-xs text-base-content/70">Input amount: {amountLabel}</div> : null}
      {amountHint ? <div className="text-xs text-base-content/60">{amountHint}</div> : null}
    </div>
  );
};
