"use client";

type Props = {
  amount: string;
  onAmountChange: (value: string) => void;
  amountLabel?: string;
  amountPlaceholder?: string;
  amountHint?: string;
  quoteNativeFee: string;
  estimatedMsgValue: string;
  onSubmit: () => void;
  submitLabel: string;
  submitDisabled?: boolean;
  busy?: boolean;
  submitError?: string;
};

export const VaultActionForm = ({
  amount,
  onAmountChange,
  amountLabel,
  amountPlaceholder,
  amountHint,
  quoteNativeFee,
  estimatedMsgValue,
  onSubmit,
  submitLabel,
  submitDisabled,
  busy,
  submitError,
}: Props) => {
  return (
    <div className="card bg-base-200 p-4 rounded-xl space-y-3">
      {amountLabel ? <p className="text-sm font-medium">{amountLabel}</p> : null}
      <div className="flex items-center gap-2">
        <input
          className="input input-bordered rounded-lg flex-1"
          value={amount}
          placeholder={amountPlaceholder}
          onChange={e => onAmountChange(e.target.value)}
        />
        <button
          className="btn btn-primary btn-sm rounded-lg px-4 whitespace-nowrap"
          onClick={onSubmit}
          disabled={submitDisabled}
        >
          {busy ? <span className="loading loading-spinner loading-xs" /> : null}
          {submitLabel}
        </button>
      </div>
      {amountHint ? <p className="text-xs text-base-content/60">{amountHint}</p> : null}
      <p className="text-sm text-base-content/70">Quote native fee: {quoteNativeFee}</p>
      <p className="text-sm text-base-content/70">Estimated msg.value: {estimatedMsgValue} ETH</p>
      {submitError ? <div className="alert alert-error text-sm">{submitError}</div> : null}
    </div>
  );
};
