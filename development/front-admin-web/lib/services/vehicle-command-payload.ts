import type {
  ServiceOpsBikeOperationStatus,
  VehicleCreateInput,
  VehicleOperationStatusChangeInput,
  VehicleUpdateInput
} from "./service-ops-api";

const OPERATION_STATUS_VALUES = ["READY", "IN_SERVICE", "REPAIRING", "INSPECTION_REQUIRED"] as const;

export class VehicleCommandPayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VehicleCommandPayloadError";
  }
}

export function toVehicleCreatePayload(formData: FormData): VehicleCreateInput {
  return {
    memo: optionalText(formData.get("memo")),
    modelName: optionalText(formData.get("modelName")),
    operationStatus: toOperationStatus(formData.get("operationStatus")),
    plateNumber: requiredText(formData.get("plateNumber"), "Vehicle plate number is required."),
    vin: requiredText(formData.get("vin"), "Vehicle VIN is required.")
  };
}

export function toVehicleUpdatePayload(formData: FormData): VehicleUpdateInput {
  return {
    memo: optionalText(formData.get("memo")),
    modelName: optionalText(formData.get("modelName")),
    plateNumber: requiredText(formData.get("plateNumber"), "Vehicle plate number is required."),
    vin: requiredText(formData.get("vin"), "Vehicle VIN is required.")
  };
}

export function toVehicleStatusPayload(formData: FormData): VehicleOperationStatusChangeInput {
  return {
    memo: optionalText(formData.get("memo")),
    operationStatus: toOperationStatus(formData.get("operationStatus")),
    reason: optionalText(formData.get("reason"))
  };
}

export function toOperationStatus(value: FormDataEntryValue | null): ServiceOpsBikeOperationStatus {
  const status = requiredText(value, "Vehicle operation status is required.");
  if (OPERATION_STATUS_VALUES.includes(status as ServiceOpsBikeOperationStatus)) {
    return status as ServiceOpsBikeOperationStatus;
  }

  throw new VehicleCommandPayloadError("Invalid vehicle operation status.");
}

function requiredText(value: FormDataEntryValue | null, message: string): string {
  const text = String(value ?? "").trim();
  if (!text) {
    throw new VehicleCommandPayloadError(message);
  }

  return text;
}

function optionalText(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}
