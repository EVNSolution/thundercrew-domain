'use client';

import React, { useRef, useState } from 'react';
import type { BulkPreviewResponse } from '@/lib/services/service-ops-api';
import { BulkPreviewModal } from './BulkPreviewModal';

interface ExcelImportButtonProps {
  onPreview: (formData: FormData) => Promise<BulkPreviewResponse>;
  onApply: (formData: FormData) => Promise<unknown>;
  onSuccess?: () => void;
  label?: string;
}

export function ExcelImportButton({ onPreview, onApply, onSuccess, label = 'Excel 업로드' }: ExcelImportButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<BulkPreviewResponse | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setError(null);
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const result = await onPreview(fd);
      setPreview(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : '업로드 오류');
    } finally {
      setLoading(false);
      // Reset file input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleConfirm = async () => {
    if (!selectedFile) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', selectedFile);
      await onApply(fd);
      setPreview(null);
      setSelectedFile(null);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 오류');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setPreview(null);
    setSelectedFile(null);
    setError(null);
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <button onClick={() => fileInputRef.current?.click()} disabled={loading}>
        {loading ? '처리 중...' : label}
      </button>
      {error && <span style={{ color: 'red', marginLeft: 8 }}>{error}</span>}
      {preview && (
        <BulkPreviewModal
          response={preview}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          loading={loading}
        />
      )}
    </>
  );
}
