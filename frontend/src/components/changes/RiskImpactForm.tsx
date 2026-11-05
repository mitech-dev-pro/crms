"use client";

import type { ChangeFormData, UpdateChangeField } from "@/types/change-form";

type RiskImpactFormProps = {
  formData: ChangeFormData;
  updateField: UpdateChangeField;
};

export default function RiskImpactForm({
  formData,
  updateField,
}: RiskImpactFormProps) {
  const inputClassName =
    "w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100";

  const labelClassName = "mb-2 block text-sm font-medium text-gray-700";

  return (
    <div className="space-y-6">
      {/* Impact Level */}
      <div>
        <label htmlFor="impactLevel" className={labelClassName}>
          Impact Level
          <span className="text-red-500"> *</span>
        </label>

        <select
          id="impactLevel"
          required
          value={formData.impactLevel}
          onChange={(event) =>
            updateField(
              "impactLevel",
              event.target.value as ChangeFormData["impactLevel"],
            )
          }
          className={inputClassName}
        >
          <option value="">Select impact level</option>
          <option value="Low">Low</option>
          <option value="Medium">Medium</option>
          <option value="High">High</option>
        </select>

        <p className="mt-1 text-xs text-gray-500">
          Consider the potential effect on business operations, customers, and
          service delivery.
        </p>
      </div>

      {/* Affected Systems */}
      <div>
        <label htmlFor="affectedSystems" className={labelClassName}>
          Affected Systems / Departments
          <span className="text-red-500"> *</span>
        </label>

        <textarea
          id="affectedSystems"
          rows={3}
          required
          value={formData.affectedSystems}
          onChange={(event) =>
            updateField("affectedSystems", event.target.value)
          }
          className={inputClassName}
          placeholder="e.g. Mankrado, IT Department, Claims Department"
        />
      </div>

      {/* Risk Description */}
      <div>
        <label htmlFor="riskDescription" className={labelClassName}>
          Risk Description
          <span className="text-red-500"> *</span>
        </label>

        <textarea
          id="riskDescription"
          rows={4}
          required
          value={formData.riskDescription}
          onChange={(event) =>
            updateField("riskDescription", event.target.value)
          }
          className={inputClassName}
          placeholder="Describe the potential risks associated with this change."
        />
      </div>

      {/* Mitigation Plan */}
      <div>
        <label htmlFor="mitigationPlan" className={labelClassName}>
          Mitigation Plan
          <span className="text-red-500"> *</span>
        </label>

        <textarea
          id="mitigationPlan"
          rows={4}
          required
          value={formData.mitigationPlan}
          onChange={(event) =>
            updateField("mitigationPlan", event.target.value)
          }
          className={inputClassName}
          placeholder="Explain the actions that will reduce or manage the identified risks."
        />
      </div>

      <p className="text-xs text-gray-500">
        Fields marked with * are required.
      </p>
    </div>
  );
}
