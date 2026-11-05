"use client";

import {
  CHANGE_TYPES,
  type ChangeFormData,
  type UpdateChangeField,
} from "@/types/change-form";

type BasicInformationFormProps = {
  formData: ChangeFormData;
  updateField: UpdateChangeField;
};

export default function BasicInformationForm({
  formData,
  updateField,
}: BasicInformationFormProps) {
  const inputClassName =
    "w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100";

  const labelClassName = "mb-2 block text-sm font-medium text-gray-700";

  return (
    <div className="space-y-6">
      {/* Change Title */}
      <div>
        <label htmlFor="title" className={labelClassName}>
          Change Title <span className="text-red-500">*</span>
        </label>

        <input
          id="title"
          name="title"
          type="text"
          required
          value={formData.title}
          onChange={(event) => updateField("title", event.target.value)}
          className={inputClassName}
          placeholder="e.g. Upgrade Claims Management System"
        />
      </div>

      {/* Change Type */}
      <div>
        <label htmlFor="changeType" className={labelClassName}>
          Change Type <span className="text-red-500">*</span>
        </label>

        <select
          id="changeType"
          name="changeType"
          required
          value={formData.changeType}
          onChange={(event) =>
            updateField(
              "changeType",
              event.target.value as ChangeFormData["changeType"],
            )
          }
          className={inputClassName}
        >
          <option value="">Select change type</option>

          {CHANGE_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      {/* Department */}
      <div>
        <label htmlFor="department" className={labelClassName}>
          Department <span className="text-red-500">*</span>
        </label>

        <input
          id="department"
          name="department"
          type="text"
          required
          value={formData.department}
          onChange={(event) => updateField("department", event.target.value)}
          className={inputClassName}
          placeholder="e.g. Information Technology"
        />
      </div>

      {/* Priority */}
      <div>
        <label htmlFor="priority" className={labelClassName}>
          Priority <span className="text-red-500">*</span>
        </label>

        <select
          id="priority"
          name="priority"
          required
          value={formData.priority}
          onChange={(event) =>
            updateField(
              "priority",
              event.target.value as ChangeFormData["priority"],
            )
          }
          className={inputClassName}
        >
          <option value="Low">Low</option>
          <option value="Medium">Medium</option>
          <option value="High">High</option>
        </select>
      </div>

      {/* Change Description */}
      <div>
        <label htmlFor="description" className={labelClassName}>
          Change Description <span className="text-red-500">*</span>
        </label>

        <textarea
          id="description"
          name="description"
          rows={4}
          required
          value={formData.description}
          onChange={(event) => updateField("description", event.target.value)}
          className={inputClassName}
          placeholder="Describe the proposed change, including its scope and objectives."
        />
      </div>

      {/* Business Justification */}
      <div>
        <label htmlFor="justification" className={labelClassName}>
          Business Justification <span className="text-red-500">*</span>
        </label>

        <textarea
          id="justification"
          name="justification"
          rows={4}
          required
          value={formData.justification}
          onChange={(event) => updateField("justification", event.target.value)}
          className={inputClassName}
          placeholder="Explain why this change is necessary and the expected business benefits."
        />
      </div>

      <p className="text-xs text-gray-500">
        Fields marked with * are required.
      </p>
    </div>
  );
}
