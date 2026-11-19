export default function Soon({ title, stage }: { title: string; stage: number }) {
  return (
    <div className="px-4 pt-6">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <div className="mt-6 rounded-2xl border border-line bg-card p-5 text-sm text-muted">
        Раздел не реализован. Появится на этапе {stage}.
      </div>
    </div>
  );
}
