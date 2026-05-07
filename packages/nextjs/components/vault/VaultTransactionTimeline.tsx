"use client";

type Props = {
  sourceTxHash?: `0x${string}`;
  sourceTxLink?: string;
  verifyHash?: `0x${string}`;
  verifyLink?: string;
  commitHash?: `0x${string}`;
  commitLink?: string;
  composeHash?: `0x${string}`;
  composeLink?: string;
};

export const VaultTransactionTimeline = ({
  sourceTxHash,
  sourceTxLink,
  verifyHash,
  verifyLink,
  commitHash,
  commitLink,
  composeHash,
  composeLink,
}: Props) => {
  if (!sourceTxHash && !verifyHash && !commitHash && !composeHash) return null;
  return (
    <div className="card bg-base-100 border border-base-300 p-4 space-y-2">
      <div className="font-medium">Transaction timeline</div>
      <div className="text-xs space-y-1">
        {sourceTxHash ? (
          <p>
            Source:{" "}
            <a className="link font-mono break-all" href={sourceTxLink} target="_blank" rel="noreferrer">
              {sourceTxHash}
            </a>
          </p>
        ) : null}
        {verifyHash ? (
          <p>
            Verify:{" "}
            <a className="link font-mono break-all" href={verifyLink} target="_blank" rel="noreferrer">
              {verifyHash}
            </a>
          </p>
        ) : null}
        {commitHash ? (
          <p>
            Commit + execute:{" "}
            <a className="link font-mono break-all" href={commitLink} target="_blank" rel="noreferrer">
              {commitHash}
            </a>
          </p>
        ) : null}
        {composeHash ? (
          <p>
            Compose:{" "}
            <a className="link font-mono break-all" href={composeLink} target="_blank" rel="noreferrer">
              {composeHash}
            </a>
          </p>
        ) : null}
      </div>
    </div>
  );
};
