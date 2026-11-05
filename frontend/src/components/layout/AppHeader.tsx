import { Bell, ChevronDown } from "lucide-react";

export default function AppHeader() {
  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
      <div>
        <h2 className="text-sm font-semibold text-gray-900">
          Change Management Portal
        </h2>
        <p className="text-xs text-gray-500">MiLife Ghana</p>
      </div>

      <div className="flex items-center gap-5">
        <Bell size={20} className="text-gray-600" />

        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-800">
            JD
          </div>

          <div className="hidden sm:block">
            <p className="text-sm font-medium text-gray-900">John Doe</p>
            <p className="text-xs text-gray-500">Requester</p>
          </div>

          <ChevronDown size={16} className="text-gray-500" />
        </div>
      </div>
    </header>
  );
}
