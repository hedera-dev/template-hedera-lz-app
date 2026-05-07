"use client";

type Props = {
  open: boolean;
  onToggle: (open: boolean) => void;
  processLog?: string;
  lzLink?: string;
  strategyAddress?: string;
};

export const VaultTechnicalDetails = ({ open, onToggle, processLog, lzLink, strategyAddress }: Props) => {
  return (
    <div className="collapse bg-base-100 border border-base-300">
      <input type="checkbox" checked={open} onChange={e => onToggle(e.target.checked)} />
      <div className="collapse-title font-medium">Technical details</div>
      <div className="collapse-content space-y-2">
        {lzLink ? (
          <div className="text-xs">
            LayerZero scan:{" "}
            <a className="link break-all" href={lzLink} target="_blank" rel="noreferrer">
              {lzLink}
            </a>
          </div>
        ) : null}
        {strategyAddress ? <div className="text-xs">Strategy contract: {strategyAddress}</div> : null}
        {processLog ? (
          <pre className="text-xs whitespace-pre-wrap break-all bg-base-200 p-2 rounded">{processLog}</pre>
        ) : (
          <div className="text-xs text-base-content/60">No technical payload yet.</div>
        )}
      </div>
    </div>
  );
};
