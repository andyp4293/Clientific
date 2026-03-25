"use client";

type CustomerGroupOption = {
  id: string;
  name: string;
  promotionSmsEnabled: boolean;
};

interface CustomerGroupSelectorProps {
  groups: CustomerGroupOption[];
  selectedGroupIds: string[];
  onChange: (nextGroupIds: string[]) => void;
}

export default function CustomerGroupSelector({
  groups,
  selectedGroupIds,
  onChange,
}: CustomerGroupSelectorProps) {
  const selectedIds = new Set(selectedGroupIds);

  function toggleGroup(groupId: string) {
    if (selectedIds.has(groupId)) {
      onChange(selectedGroupIds.filter((id) => id !== groupId));
      return;
    }

    onChange([...selectedGroupIds, groupId]);
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Customer groups</p>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Organize this customer and control which groups receive promotion and deal texts.
        </p>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50/70 px-4 py-3 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-400">
          Create your first group from the customers page to start organizing contacts.
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {groups.map((group) => {
            const checked = selectedIds.has(group.id);

            return (
              <label
                key={group.id}
                className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition-colors ${
                  checked
                    ? "border-primary bg-primary/5 dark:border-primary/60 dark:bg-primary/10"
                    : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900/40"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleGroup(group.id)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary dark:border-gray-600 dark:bg-gray-800"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{group.name}</p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Promotion SMS {group.promotionSmsEnabled ? "enabled" : "disabled"}
                  </p>
                </div>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
