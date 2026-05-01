package com.thundercrew.opsapi.equipment.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

@JsonIgnoreProperties(ignoreUnknown = true)
public class BikeEquipmentUpdateRequest {

    @Size(max = 100)
    private String equipmentLabel;

    @Size(max = 100)
    private String modelName;

    @Size(max = 100)
    @Pattern(regexp = "^$|.*\\S.*", message = "must not be blank when provided")
    private String serialNumber;

    private LocalDate managementDueDate;

    private String managementNote;

    private String memo;

    public String equipmentLabel() {
        return equipmentLabel;
    }

    public void setEquipmentLabel(String equipmentLabel) {
        this.equipmentLabel = equipmentLabel;
    }

    public String modelName() {
        return modelName;
    }

    public void setModelName(String modelName) {
        this.modelName = modelName;
    }

    public String serialNumber() {
        return serialNumber;
    }

    public void setSerialNumber(String serialNumber) {
        this.serialNumber = serialNumber;
    }

    public LocalDate managementDueDate() {
        return managementDueDate;
    }

    public void setManagementDueDate(LocalDate managementDueDate) {
        this.managementDueDate = managementDueDate;
    }

    public String managementNote() {
        return managementNote;
    }

    public void setManagementNote(String managementNote) {
        this.managementNote = managementNote;
    }

    public String memo() {
        return memo;
    }

    public void setMemo(String memo) {
        this.memo = memo;
    }
}
