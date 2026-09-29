import { ArgumentationTab } from "@/components/argumentation/argumentation-tab";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ArgumentationTab recordId={Number(id)}/>;
}
