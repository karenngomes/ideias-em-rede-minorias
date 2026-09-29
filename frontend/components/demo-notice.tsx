export function DemoNotice() {
  return (
    <div className="px-5 pt-6 lg:px-8">
      <div className="mx-auto flex max-w-[1500px] items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
        <span className="mt-0.5 size-2 shrink-0 rounded-full bg-amber-500"/>
        <p><strong>Dados demonstrativos.</strong> Esta visualização ainda usa dados de exemplo e não representa esta audiência. Ela passará a usar os dados de opiniões, grafo e resumo quando estiverem integrados.</p>
      </div>
    </div>
  );
}
