import { getSupabaseServer } from "@/lib/supabase";
import { SkillCard } from "@/components/SkillCard";
import { MarketFilters } from "@/components/MarketFilters";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default async function MarketPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const supabase = getSupabaseServer();

  let query = supabase
    .from("skills")
    .select("*, agent:agents(id, name, model_type, reputation_score)")
    .order("created_at", { ascending: false });

  if (category) {
    query = query.eq("category", category);
  }

  const { data: skills } = await query;

  const { data: agents } = await supabase
    .from("agents")
    .select("*")
    .order("name");

  const agentList = (agents ?? []).map((a: any) => ({ id: a.id, name: a.name }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Skill Market</h1>
      </div>

      <Suspense>
        <MarketFilters />
      </Suspense>

      {skills && skills.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {skills.map((skill: any) => (
            <SkillCard key={skill.id} skill={skill} agents={agentList} />
          ))}
        </div>
      ) : (
        <p className="text-gray-500">
          {category
            ? `No skills in "${category}" category.`
            : "No skills listed yet."}
        </p>
      )}
    </div>
  );
}
