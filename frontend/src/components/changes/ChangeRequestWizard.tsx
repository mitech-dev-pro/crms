"use client";

import { useState } from "react";
import BasicInformationForm from "./BasicInformationForm";
import RiskImpactForm from "./RiskImpactForm";
import type { ChangeFormData, UpdateChangeField } from "@/types/change-form";

const steps = [
  "Basic Information",
  "Risk & Impact",
  "Implementation",
  "Review",
];

const initialFormData: ChangeFormData = {
  title: "",
  changeType: "",
  department: "",
  priority: "Medium",
  description: "",
  justification: "",
  impactLevel: "",
  affectedSystems: "",
  riskDescription: "",
  mitigationPlan: "",
  plannedDate: "",
  implementationPlan: "",
  rollbackPlan: "",
  testPlan: "",
};

export default function ChangeRequestWizard() {
  const [currentStep, setCurrentStep] = useState(0);

  const [formData, setFormData] = useState<ChangeFormData>(initialFormData);

  const updateField: UpdateChangeField = (field, value) => {
    setFormData((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  function validateStep(): boolean {
    if (currentStep === 0) {
      return Boolean(
        formData.title.trim() &&
        formData.changeType &&
        formData.department.trim() &&
        formData.description.trim() &&
        formData.justification.trim(),
      );
    }

    if (currentStep === 1) {
      return Boolean(
        formData.impactLevel &&
        formData.affectedSystems.trim() &&
        formData.riskDescription.trim() &&
        formData.mitigationPlan.trim(),
      );
    }

    return true;
  }

  function nextStep() {
    if (!validateStep()) {
      alert("Please complete all required fields.");
      return;
    }

    setCurrentStep((previous) => Math.min(previous + 1, steps.length - 1));
  }

  function previousStep() {
    setCurrentStep((previous) => Math.max(previous - 1, 0));
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-2">
        {steps.map((step, index) => (
          <div key={step}>
            <div
              className={`mb-2 h-1 rounded-full ${
                index <= currentStep ? "bg-emerald-700" : "bg-gray-200"
              }`}
            />

            <p className="text-xs font-medium text-gray-600">{step}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-6 text-lg font-semibold">
          Step {currentStep + 1}: {steps[currentStep]}
        </h2>

        {currentStep === 0 && (
          <BasicInformationForm formData={formData} updateField={updateField} />
        )}

        {currentStep === 1 && (
          <RiskImpactForm formData={formData} updateField={updateField} />
        )}

        {currentStep === 2 && <p>Implementation Planning form coming next.</p>}

        {currentStep === 3 && (
          <div className="space-y-3">
            <h3 className="font-semibold">Review Your Request</h3>
            <p>Title: {formData.title}</p>
            <p>Type: {formData.changeType}</p>
            <p>Department: {formData.department}</p>
            <p>Priority: {formData.priority}</p>
            <p>Description: {formData.description}</p>
            <p>Justification: {formData.justification}</p>
          </div>
        )}
      </div>

      <div className="flex justify-between">
        <button
          type="button"
          onClick={previousStep}
          disabled={currentStep === 0}
          className="rounded-lg border border-gray-300 px-5 py-2 disabled:opacity-40"
        >
          Previous
        </button>

        {currentStep < steps.length - 1 ? (
          <button
            type="button"
            onClick={nextStep}
            className="rounded-lg bg-emerald-800 px-5 py-2 text-white"
          >
            Next Step
          </button>
        ) : (
          <button
            type="button"
            onClick={() => console.log("Draft:", formData)}
            className="rounded-lg bg-emerald-800 px-5 py-2 text-white"
          >
            Save Draft
          </button>
        )}
      </div>
    </div>
  );
}
