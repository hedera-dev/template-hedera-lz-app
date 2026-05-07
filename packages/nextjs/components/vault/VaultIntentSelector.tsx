"use client";

import type { VaultIntent } from "~~/hooks/lz-app";

type Props = {
  intent: VaultIntent;
  onChange: (intent: VaultIntent) => void;
  disabled?: boolean;
};

const options: { id: VaultIntent; title: string; subtitle: string }[] = [
  {
    id: "deposit_base_to_hedera",
    title: "Deposit to Hedera Vault",
    subtitle: "Base ETH -> Hedera vault shares",
  },
  {
    id: "redeem_cross_chain_base",
    title: "Redeem to Base ETH",
    subtitle: "Hedera redeem -> Base ETH unlock",
  },
];

export const VaultIntentSelector = ({ intent, onChange, disabled }: Props) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
      {options.map(option => (
        <button
          key={option.id}
          className={`h-auto min-h-[74px] border px-3 py-3 text-left transition-colors rounded-xl ${
            intent === option.id
              ? "border-primary bg-primary text-primary-content"
              : "border-base-300 bg-base-100 hover:border-base-content/40"
          }`}
          disabled={disabled}
          onClick={() => onChange(option.id)}
        >
          <span className="block font-semibold leading-tight">{option.title}</span>
          <span className="block text-xs opacity-80 mt-1">{option.subtitle}</span>
        </button>
      ))}
    </div>
  );
};
