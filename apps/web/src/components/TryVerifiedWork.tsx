"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface Template {
  id: string;
  title: string;
  description: string;
  agents: string[];
  budget: number;
  card: string;
  featured: boolean;
}

const TEMPLATES: Template[] = [
  {
    id: "security-audit",
    title: "Security Audit",
    description: "Run a security assessment of a web application",
    agents: ["Security Agent", "CTO Agent"],
    budget: 300,
    card: "2 agents collaborate · 300 AVB · fully verifiable",
    featured: false,
  },
  {
    id: "full-launch-review",
    title: "Full Launch Review",
    description: "Comprehensive launch readiness evaluation",
    agents: ["Security Agent", "CMO Agent", "Researcher Agent", "CTO Agent"],
    budget: 500,
    card: "4 agents collaborate · 500 AVB · signed trace",
    featured: true,
  },
  {
    id: "market-analysis",
    title: "Market Analysis",
    description: "Analyze market positioning and go-to-market strategy",
    agents: ["CMO Agent", "Researcher Agent"],
    budget: 250,
    card: "2 agents collaborate · 250 AVB · fully verifiable",
    featured: false,
  },
];

export function TryVerifiedWork() {
  const [running, setRunning] = useState<string | null>(null);
  const router = useRouter();

  const run = async (templateId: string) => {
    setRunning(templateId);
    try {
      const res = await fetch(`/api/task-templates/${templateId}/run`, { method: "POST" });
      const json = await res.json();
      if (json.data?.task_id) {
        // Store guest owner_id for future use
        if (json.data.owner_id) {
          localStorage.setItem("owner_id", json.data.owner_id);
        }
        router.push(`/tasks/${json.data.task_id}`);
      }
    } catch {}
    setRunning(null);
  };

  return (
    <section id="try-verified-work" className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold">Try it yourself</h2>
        <p className="text-gray-500 text-sm mt-1">What do you want AI agents to do?</p>
        <p className="text-gray-600 text-xs">Your agents will coordinate and complete it.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
        {TEMPLATES.map((t) => (
          <div
            key={t.id}
            className={`rounded-xl p-5 border flex flex-col justify-between transition ${
              t.featured
                ? "bg-gray-900 border-purple-700 md:scale-105 md:-my-2 shadow-lg shadow-purple-900/20"
                : "bg-gray-950 border-gray-800"
            }`}
          >
            <div>
              {t.featured && (
                <div className="text-xs text-purple-400 font-medium mb-2 tracking-wider uppercase">Most popular</div>
              )}
              <h3 className={`font-bold mb-1 ${t.featured ? "text-lg" : "text-base"}`}>{t.title}</h3>
              <p className="text-sm text-gray-400 mb-3">{t.description}</p>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {t.agents.map((a) => (
                  <span key={a} className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">{a}</span>
                ))}
              </div>
              <p className="text-xs text-gray-500">{t.card}</p>
            </div>
            <button
              onClick={() => run(t.id)}
              disabled={running !== null}
              className={`mt-4 w-full py-2.5 rounded-lg text-sm font-medium transition ${
                t.featured
                  ? "bg-purple-600 hover:bg-purple-500 text-white"
                  : "bg-gray-800 hover:bg-gray-700 text-gray-300"
              } ${running === t.id ? "animate-pulse" : ""} disabled:opacity-50`}
            >
              {running === t.id ? "Creating task..." : "Run and Verify →"}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
