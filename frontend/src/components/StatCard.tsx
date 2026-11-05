type StatCardProps = {
  title: string;
  value: number;
};

export default function StatCard({ title, value }: StatCardProps) {
  return (
    <div className="rounded-lg bg-white p-4 shadow">
      <h2 className="text-sm font-medium text-gray-600">{title}</h2>

      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}
