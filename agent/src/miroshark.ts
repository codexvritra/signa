/**
 * MiroShark integration — swarm-simulation tool for the SIGNA agent.
 *
 * MiroShark spawns agent crowds that simulate public reaction to a topic
 * across Twitter, Reddit, and prediction markets. Repo:
 * https://github.com/aaronjmars/MiroShark
 *
 * There is no public hosted MiroShark API — every operator self-hosts on
 * Railway / Render / Docker. We support two modes:
 *
 *   - If `MIROSHARK_BASE_URL` is set, this tool POSTs to that instance's
 *     `/api/simulation/create` and returns a real watch-page deeplink.
 *
 *   - If unset, this tool returns deploy-your-own instructions + a
 *     deeplink to the MiroShark GitHub repo. Still honest — the user
 *     can deploy in <3 min and paste the resulting URL back to set the
 *     env var.
 *
 * No fabricated sim results. Either we hit a real running instance or
 * we tell the user how to spin one up.
 */

const MIROSHARK_BASE_URL = process.env.MIROSHARK_BASE_URL || null;
const MIROSHARK_REPO = "https://github.com/aaronjmars/MiroShark";
const MIROSHARK_TOKEN = "0xd7bc6a05a56655fb2052f742b012d1dfd66e1ba3";

export async function simulate(topic: string): Promise<string> {
  if (!topic || topic.trim().length === 0) {
    return JSON.stringify({
      error: "topic_required",
      tool: "miroshark_simulate",
      message: "Pass a one-sentence topic to simulate reaction to.",
    });
  }

  // Mode 1 — no hosted instance configured. Return deploy instructions.
  if (!MIROSHARK_BASE_URL) {
    return JSON.stringify({
      tool: "miroshark_simulate",
      mode: "deploy_required",
      message:
        "MiroShark sims run on a self-hosted instance — no public hosted API exists. Deploy your own (under 3 min on Railway with a free Neo4j Aura + OpenRouter key), then set MIROSHARK_BASE_URL on the SIGNA agent service to route sim requests there.",
      repo: MIROSHARK_REPO,
      install_docs: `${MIROSHARK_REPO}/blob/main/docs/INSTALL.md`,
      one_click_deploy: `${MIROSHARK_REPO}#deploy`,
      token: {
        chain: "base",
        contract: MIROSHARK_TOKEN,
        symbol: "MiroShark",
        buy_via_bankr: `https://bankr.bot/agents/${MIROSHARK_TOKEN}`,
      },
      requested_topic: topic,
    });
  }

  // Mode 2 — real call against a configured MiroShark instance.
  try {
    const base = MIROSHARK_BASE_URL.replace(/\/$/, "");
    const res = await fetch(`${base}/api/simulation/create`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ topic, source: "signa-agent" }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return JSON.stringify({
        tool: "miroshark_simulate",
        mode: "live",
        error: "miroshark_http_error",
        status: res.status,
        body: text.slice(0, 500),
        base,
      });
    }

    const data: any = await res.json();
    // MiroShark returns the simulation id — caller polls or watches.
    const id = data.id || data.simulation_id || data.simulationId;
    if (!id) {
      return JSON.stringify({
        tool: "miroshark_simulate",
        mode: "live",
        warning: "miroshark_missing_id_in_response",
        raw: data,
      });
    }

    return JSON.stringify({
      tool: "miroshark_simulate",
      mode: "live",
      simulation_id: id,
      topic,
      watch: `${base}/watch/${id}`,
      share: `${base}/share/${id}`,
      embed_summary: `${base}/api/simulation/${id}/embed-summary`,
      chart_svg: `${base}/api/simulation/${id}/chart.svg`,
      status:
        "Simulation kicked off. Watch the live page; sim usually settles in 1–3 min depending on agent count.",
    });
  } catch (e) {
    return JSON.stringify({
      tool: "miroshark_simulate",
      mode: "live",
      error: "miroshark_fetch_failed",
      message: e instanceof Error ? e.message : String(e),
      base: MIROSHARK_BASE_URL,
    });
  }
}
