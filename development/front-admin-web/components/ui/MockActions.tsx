"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type MockFormActionsProps = {
  cancelHref: string;
  submitLabel: string;
  successMessage: string;
};

export function MockFormActions({ cancelHref, submitLabel, successMessage }: MockFormActionsProps) {
  const [message, setMessage] = useState<string | null>(null);

  return (
    <>
      {message ? <p className="action-feedback" role="status">{message}</p> : null}
      <div className="form-actions">
        <Link className="button-secondary" href={cancelHref}>취소</Link>
        <button className="button-primary" type="submit" onClick={() => setMessage(successMessage)}>{submitLabel}</button>
      </div>
    </>
  );
}

type DetailActionPanelProps = {
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  logLabel?: string;
  feedbackMessage: string;
  logItems?: string[];
};

export function DetailActionPanel({ primaryLabel, secondaryHref, secondaryLabel = "목록", logLabel, feedbackMessage, logItems = [] }: DetailActionPanelProps) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [logsOpen, setLogsOpen] = useState(false);

  return (
    <div className="action-panel">
      {feedback ? <p className="action-feedback" role="status">{feedback}</p> : null}
      <div className="form-actions">
        {secondaryHref ? <Link className="button-secondary" href={secondaryHref}>{secondaryLabel}</Link> : <button className="button-secondary" type="button" onClick={() => router.back()}>{secondaryLabel}</button>}
        {logLabel ? <button className="button-ghost-mint" type="button" onClick={() => setLogsOpen((open) => !open)}>{logsOpen ? "로그 닫기" : logLabel}</button> : null}
        <button className="button-primary" type="button" onClick={() => setFeedback(feedbackMessage)}>{primaryLabel}</button>
      </div>
      {logsOpen ? (
        <div className="log-panel" aria-label="운영 로그">
          <h3>최근 로그</h3>
          <ul>
            {(logItems.length ? logItems : ["현재 MVP mock 로그가 없습니다."]).map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
