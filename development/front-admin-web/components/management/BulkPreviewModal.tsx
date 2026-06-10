'use client';

import React from 'react';
import type { BulkPreviewResponse, BulkRowResult } from '@/lib/services/service-ops-api';
import './BulkPreviewModal.css';

interface BulkPreviewModalProps {
  response: BulkPreviewResponse;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function BulkPreviewModal({ response, onConfirm, onCancel, loading = false }: BulkPreviewModalProps) {
  const { rows, summary } = response;

  return (
    <div className="bulk-preview-overlay">
      <div className="bulk-preview-modal">
        <h2 className="bulk-preview-title">업로드 미리보기</h2>

        <div className="bulk-preview-summary">
          <span className="bulk-preview-summary-unchanged">변경 없음 {summary.unchanged}</span>
          <span className="bulk-preview-summary-update">업데이트 {summary.update}</span>
          <span className="bulk-preview-summary-new">신규 {summary.new}</span>
          <span className="bulk-preview-summary-error">오류 {summary.error}</span>
          <span className="bulk-preview-summary-total">합계 {summary.total}</span>
        </div>

        <div className="bulk-preview-table-wrapper">
          <table className="bulk-preview-table">
            <thead>
              <tr>
                <th>행</th>
                <th>상태</th>
                <th>키</th>
                <th>변경사항</th>
                <th>오류</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.rowNumber} className={`bulk-preview-row-${row.status}`}>
                  <td>{row.rowNumber}</td>
                  <td>{statusLabel(row.status)}</td>
                  <td>{row.key}</td>
                  <td>{row.changes.join(', ')}</td>
                  <td>{row.errorMessage ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bulk-preview-actions">
          <button onClick={onCancel} disabled={loading} className="button-neutral">
            취소
          </button>
          <button onClick={onConfirm} disabled={loading} className="button-primary">
            {loading ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}

function statusLabel(status: BulkRowResult['status']): string {
  switch (status) {
    case 'UNCHANGED': return '변경 없음';
    case 'UPDATE': return '업데이트';
    case 'NEW': return '신규';
    case 'ERROR': return '오류';
  }
}
