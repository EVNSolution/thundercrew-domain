import type { ContractTemplate } from "@/types/domain";
import type { ServiceOpsContractTemplate } from "./service-ops-api";

export type ContractTemplateDataResult = {
  source: "mock" | "service-ops";
  templates: ContractTemplate[];
  notice?: string;
};

export type ContractTemplateDetailResult = {
  source: "mock" | "service-ops";
  template: ContractTemplate;
  notice?: string;
};

export function toFrontendContractTemplate(template: ServiceOpsContractTemplate): ContractTemplate {
  return {
    createdAt: template.createdAt,
    description: template.description,
    durationLabel: toContractTemplateDurationLabel(template.durationMinutes, template.unlimited),
    durationMinutes: template.durationMinutes,
    enabled: template.enabled,
    id: template.id,
    idx: template.idx,
    name: template.name,
    slug: template.id,
    source: "service-ops",
    systemTemplate: template.systemTemplate,
    unlimited: template.unlimited,
    updatedAt: template.updatedAt
  };
}

export function toContractTemplateDurationLabel(durationMinutes: number | null, unlimited = durationMinutes === null): string {
  if (unlimited || durationMinutes === null) {
    return "무제한";
  }

  const days = Math.floor(durationMinutes / 1440);
  const hours = Math.floor((durationMinutes % 1440) / 60);
  const minutes = durationMinutes % 60;
  const parts = [
    days ? `${days}일` : null,
    hours ? `${hours}시간` : null,
    minutes ? `${minutes}분` : null
  ].filter(Boolean);

  return parts.length ? parts.join(" ") : `${durationMinutes}분`;
}

export function mockContractTemplateList(mockTemplates: ContractTemplate[]): ContractTemplateDataResult {
  return {
    source: "mock",
    templates: mockTemplates.map((template) => ({ ...template, source: "mock" as const }))
  };
}

export function mockContractTemplateDetail(slug: string, mockTemplates: ContractTemplate[]): ContractTemplateDetailResult | null {
  const template = mockTemplates.find((candidate) => candidate.slug === slug);
  if (!template) {
    return null;
  }

  return {
    source: "mock",
    template: { ...template, source: "mock" }
  };
}

export function mockContractTemplateUnavailableServiceDetail(
  slug: string,
  mockTemplates: ContractTemplate[],
  notice: string
): ContractTemplateDetailResult | null {
  const exactFallback = mockContractTemplateDetail(slug, mockTemplates);
  if (exactFallback) {
    return { ...exactFallback, notice };
  }

  if (!isUuidLike(slug) || !mockTemplates.length) {
    return null;
  }

  return {
    notice,
    source: "mock",
    template: { ...mockTemplates[0], source: "mock" }
  };
}

export function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
