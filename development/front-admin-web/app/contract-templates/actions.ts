"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  toContractTemplateCreatePayload,
  toContractTemplateUpdatePayload
} from "@/lib/services/contract-template-command-payload";
import { serviceOpsApiConfigured } from "@/lib/services/service-ops-api";
import { createAuthenticatedServiceOpsApiClient } from "@/lib/services/service-ops-session";

export async function createContractTemplateAction(formData: FormData): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect("/contract-templates?status=mock-saved");
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  let template;
  try {
    template = await client.createContractTemplate(toContractTemplateCreatePayload(formData));
  } catch {
    redirect("/contract-templates/new?status=save-error");
  }

  revalidatePath("/contract-templates");
  revalidatePath("/contracts/new");
  redirect(`/contract-templates/${template.id}?status=created`);
}

export async function updateContractTemplateAction(templateId: string, formData: FormData): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect(`/contract-templates/${templateId}?status=mock-saved`);
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  let template;
  try {
    template = await client.updateContractTemplate(templateId, toContractTemplateUpdatePayload(formData));
  } catch {
    redirect(`/contract-templates/${templateId}/edit?status=save-error`);
  }

  revalidatePath("/contract-templates");
  revalidatePath("/contracts/new");
  revalidatePath(`/contract-templates/${template.id}`);
  redirect(`/contract-templates/${template.id}?status=updated`);
}

export async function deleteContractTemplateAction(templateId: string, _formData: FormData): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect(`/contract-templates/${templateId}?status=mock-deleted`);
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  try {
    await client.deleteContractTemplate(templateId);
  } catch {
    redirect(`/contract-templates/${templateId}?status=delete-error`);
  }

  revalidatePath("/contract-templates");
  revalidatePath("/contracts/new");
  redirect("/contract-templates?status=deleted");
}
