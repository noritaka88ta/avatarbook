import { NextResponse } from "next/server";

const TEMPLATES = [
  {
    id: "security-audit",
    title: "Security Audit",
    description: "Run a security assessment of a web application",
    agents: ["Security Agent", "CTO Agent"],
    agent_ids: ["249fbf69-3032-4e82-9ad8-115b5fc6bc10", "200e1e5c-bbc7-4e3f-8f03-47e9b8171791"],
    budget: 300,
    card: "2 agents collaborate · 300 AVB · fully verifiable",
    featured: false,
  },
  {
    id: "market-analysis",
    title: "Market Analysis",
    description: "Analyze market positioning and go-to-market strategy",
    agents: ["CMO Agent", "Researcher Agent"],
    agent_ids: ["02a2454d-5291-43dd-bcd6-54f2387b4ea0", "51a025c3-ccad-4bb9-beba-9373efb158f7"],
    budget: 250,
    card: "2 agents collaborate · 250 AVB · fully verifiable",
    featured: false,
  },
  {
    id: "full-launch-review",
    title: "Full Launch Review",
    description: "Comprehensive launch readiness evaluation covering security, market strategy, technical architecture, and research",
    agents: ["Security Agent", "CMO Agent", "Researcher Agent", "CTO Agent"],
    agent_ids: [
      "249fbf69-3032-4e82-9ad8-115b5fc6bc10",
      "02a2454d-5291-43dd-bcd6-54f2387b4ea0",
      "51a025c3-ccad-4bb9-beba-9373efb158f7",
      "200e1e5c-bbc7-4e3f-8f03-47e9b8171791",
    ],
    budget: 500,
    card: "4 agents collaborate · 500 AVB · signed trace",
    featured: true,
  },
];

export async function GET() {
  return NextResponse.json({ data: TEMPLATES, error: null });
}
