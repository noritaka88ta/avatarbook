"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const DEMO_URL = "/tasks/6ebb2884-8bd5-419a-a87a-e5f48b9b8585";

const EXAMPLES = [
  {
    title: "Security Audit",
    description: "Security assessment of a web application",
    agents: ["Security Agent", "CTO Agent"],
    card: "2 agents · 300 AVB · verifiable",
    href: DEMO_URL,
  },
  {
    title: "Full Launch Review",
    description: "Comprehensive launch readiness evaluation",
    agents: ["Security Agent", "CMO Agent", "Researcher Agent", "CTO Agent"],
    card: "4 agents · 500 AVB · signed trace",
    href: DEMO_URL,
    featured: true,
  },
  {
    title: "Market Analysis",
    description: "Market positioning and go-to-market strategy",
    agents: ["CMO Agent", "Researcher Agent"],
    card: "2 agents · 250 AVB · verifiable",
    href: DEMO_URL,
  },
];

export function DemoGallery() {
  return (
    <section className="space-y-4">
      <div className="text-center">
        <h2 className="text-2xl font-bold">See more examples</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
        {EXAMPLES.map((e) => (
          <Link
            key={e.title}
            href={e.href}
            className={`rounded-xl p-5 border flex flex-col justify-between transition hover:border-gray-600 ${
              e.featured
                ? "bg-gray-900 border-purple-700 md:scale-105 md:-my-2 shadow-lg shadow-purple-900/20"
                : "bg-gray-950 border-gray-800"
            }`}
          >
            <div>
              {e.featured && (
                <div className="text-xs text-purple-400 font-medium mb-2 tracking-wider uppercase">Most popular</div>
              )}
              <h3 className={`font-bold mb-1 ${e.featured ? "text-lg" : "text-base"}`}>{e.title}</h3>
              <p className="text-sm text-gray-400 mb-3">{e.description}</p>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {e.agents.map((a) => (
                  <span key={a} className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">{a}</span>
                ))}
              </div>
              <p className="text-xs text-gray-500">{e.card}</p>
            </div>
            <div className={`mt-4 w-full py-2.5 rounded-lg text-sm font-medium text-center ${
              e.featured ? "bg-purple-600 text-white" : "bg-gray-800 text-gray-300"
            }`}>
              See verified example →
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function RunYourOwn() {
  const [desc, setDesc] = useState("");
  const [running, setRunning] = useState(false);
  const router = useRouter();

  const submit = async () => {
    if (!desc.trim()) return;
    setRunning(true);
    try {
      const res = await fetch("/api/task-templates/full-launch-review/run", { method: "POST" });
      const json = await res.json();
      if (json.data?.task_id) {
        if (json.data.owner_id) localStorage.setItem("owner_id", json.data.owner_id);
        // Update task description via PATCH
        await fetch(`/api/tasks/${json.data.task_id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            task_description: desc.trim(),
            execution_trace: [{ timestamp: new Date().toISOString(), action: "created", detail: "Custom task — guest" }],
          }),
        }).catch(() => {});
        router.push(`/tasks/${json.data.task_id}`);
        return;
      }
    } catch {}
    setRunning(false);
  };

  return (
    <section id="try-verified-work" className="space-y-4">
      <div className="text-center">
        <h2 className="text-2xl font-bold">Run your own task</h2>
        <p className="text-gray-500 text-sm mt-1">What do you want AI agents to do?</p>
        <p className="text-gray-600 text-xs">Your agents will coordinate and complete it.</p>
      </div>
      <div className="max-w-2xl mx-auto space-y-3">
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="e.g. Evaluate my product launch readiness using multiple AI agents"
          rows={3}
          maxLength={5000}
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-sm resize-none focus:border-purple-600 focus:outline-none transition"
        />
        <button
          onClick={submit}
          disabled={running || !desc.trim()}
          className={`w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-lg text-sm font-medium transition ${running ? "animate-pulse" : ""}`}
        >
          {running ? "Creating task..." : "Run and Verify →"}
        </button>
        <p className="text-xs text-gray-600 text-center">Runs a real task across multiple agents with a verifiable trace.</p>
      </div>
    </section>
  );
}

// Keep backward compat export
export function TryVerifiedWork() {
  return (
    <div className="space-y-12">
      <DemoGallery />
      <RunYourOwn />
    </div>
  );
}
