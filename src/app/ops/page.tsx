"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

interface OpsData {
  knowledge: {
    currentVersion: {
      version: number;
      propertyId: string;
      publishedAt: number;
      publishedBy: string;
      status: string;
      items: any[];
    };
    versions: any[];
    ingestionRecords: any[];
    totalActiveFacts: number;
  };
  escalations: any[];
  feedback: {
    summary: {
      total: number;
      helpful: number;
      notHelpful: number;
      satisfactionRate: number;
      reasons: Record<string, number>;
    };
    recent: any[];
  };
  flags: Record<string, boolean>;
  system: {
    status: string;
    mockLlm: boolean;
    timestamp: number;
  };
}

export default function OpsPage() {
  const [data, setData] = useState<OpsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "knowledge" | "ingestion" | "feedback" | "escalations" | "flags">("overview");

  // Ingestion form state
  const [fileName, setFileName] = useState("");
  const [fileType, setFileType] = useState<"txt" | "md" | "json" | "csv">("txt");
  const [fileContent, setFileContent] = useState("");
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/ops");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileName || !fileContent) return;

    try {
      const res = await fetch("/api/ops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName,
          content: fileContent,
          fileType,
          uploadedBy: "ops_supervisor",
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setUploadMsg(`Document uploaded successfully! Record ID: ${json.record.sourceId}`);
        setFileName("");
        setFileContent("");
        fetchData();
      } else {
        setUploadMsg(`Error: ${json.error}`);
      }
    } catch (err: any) {
      setUploadMsg(`Error: ${err.message}`);
    }
  };

  const handleApprove = async (sourceId: string) => {
    try {
      const res = await fetch("/api/ops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve_publish",
          sourceId,
          operator: "ops_supervisor",
        }),
      });
      if (res.ok) {
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRollback = async (targetVersion: number) => {
    if (!confirm(`Are you sure you want to rollback to Version ${targetVersion}?`)) return;
    try {
      const res = await fetch("/api/ops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "rollback",
          targetVersion,
          operator: "ops_supervisor",
        }),
      });
      if (res.ok) {
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleFlag = async (flagKey: string, currentValue: boolean) => {
    try {
      const res = await fetch("/api/ops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_flag",
          flagKey,
          flagValue: !currentValue,
          operator: "ops_supervisor",
        }),
      });
      if (res.ok) {
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleResolveEscalation = async (escalationId: string) => {
    try {
      const res = await fetch("/api/ops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "resolve_escalation",
          escalationId,
          operator: "front_desk_duty_mgr",
        }),
      });
      if (res.ok) {
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#111315] text-[#ECEEEF] flex items-center justify-center p-6">
        <p className="text-sm tracking-wide">Loading Aster House Operations Control...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#111315] text-[#ECEEEF] flex items-center justify-center p-6">
        <p className="text-sm text-red-400">Failed to load operations control plane.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111315] text-[#ECEEEF] font-sans antialiased">
      {/* Top Header */}
      <header className="border-b border-[#282C30] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-xs uppercase tracking-widest text-[#8E959E] hover:text-white transition">
            ← Guest Chat
          </Link>
          <div className="h-4 w-[1px] bg-[#282C30]" />
          <h1 className="text-sm font-semibold tracking-wide text-white">
            Aster House &bull; Operations &amp; Knowledge Governance
          </h1>
          <span className="text-[11px] px-2 py-0.5 rounded bg-[#1F2428] text-[#8E959E] border border-[#2D3339]">
            {data.system.mockLlm ? "Demo Mode (Mock LLM)" : "Production Mode"}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-[#8E959E]">
          <span>Property: <strong className="text-white">aster-house-main</strong></span>
          <span>&bull;</span>
          <span>Active KB: <strong className="text-white">v{data.knowledge.currentVersion.version}</strong></span>
        </div>
      </header>

      {/* Main Grid */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Navigation Tabs */}
        <div className="flex gap-2 border-b border-[#282C30] mb-8 pb-3 overflow-x-auto">
          {[
            { id: "overview", label: "Overview" },
            { id: "knowledge", label: `Knowledge Base (${data.knowledge.totalActiveFacts})` },
            { id: "ingestion", label: `Ingestion & Conflicts (${data.knowledge.ingestionRecords.length})` },
            { id: "feedback", label: `Guest Feedback (${data.feedback.summary.total})` },
            { id: "escalations", label: `Escalations (${data.escalations.filter((e) => e.status === "open").length} open)` },
            { id: "flags", label: "Kill Switches & Flags" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 text-xs font-medium rounded transition ${
                activeTab === tab.id
                  ? "bg-[#21262D] text-white border border-[#3A4149]"
                  : "text-[#8E959E] hover:text-[#ECEEEF] hover:bg-[#1A1E22]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab 1: Overview */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-[#181B1E] border border-[#282C30] rounded-lg p-5">
                <p className="text-[11px] uppercase tracking-wider text-[#8E959E]">Active Knowledge</p>
                <p className="text-2xl font-semibold text-white mt-2">v{data.knowledge.currentVersion.version}</p>
                <p className="text-xs text-[#8E959E] mt-1">{data.knowledge.totalActiveFacts} verified hotel facts</p>
              </div>
              <div className="bg-[#181B1E] border border-[#282C30] rounded-lg p-5">
                <p className="text-[11px] uppercase tracking-wider text-[#8E959E]">Guest Satisfaction</p>
                <p className="text-2xl font-semibold text-white mt-2">{data.feedback.summary.satisfactionRate}%</p>
                <p className="text-xs text-[#8E959E] mt-1">{data.feedback.summary.helpful} helpful / {data.feedback.summary.notHelpful} unhelpful</p>
              </div>
              <div className="bg-[#181B1E] border border-[#282C30] rounded-lg p-5">
                <p className="text-[11px] uppercase tracking-wider text-[#8E959E]">Open Escalations</p>
                <p className="text-2xl font-semibold text-white mt-2">
                  {data.escalations.filter((e) => e.status === "open").length}
                </p>
                <p className="text-xs text-[#8E959E] mt-1">Requires front desk contact</p>
              </div>
              <div className="bg-[#181B1E] border border-[#282C30] rounded-lg p-5">
                <p className="text-[11px] uppercase tracking-wider text-[#8E959E]">System Status</p>
                <p className="text-2xl font-semibold text-emerald-400 mt-2">Healthy</p>
                <p className="text-xs text-[#8E959E] mt-1">All circuit breakers closed</p>
              </div>
            </div>

            <div className="bg-[#181B1E] border border-[#282C30] rounded-lg p-6">
              <h2 className="text-sm font-semibold text-white mb-4">Operational Architecture Rules</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-[#A0A8B0] leading-relaxed">
                <div className="p-4 bg-[#131517] rounded border border-[#22262A]">
                  <strong className="text-white block mb-1">Law 1 &mdash; AI Authority Constraint</strong>
                  The LLM phrasing engine handles conversation language only. Rates, availability, capacity limits, policies, and dates are strictly owned by deterministic domain software.
                </div>
                <div className="p-4 bg-[#131517] rounded border border-[#22262A]">
                  <strong className="text-white block mb-1">Law 2 &mdash; Knowledge Governance</strong>
                  Uploaded documents (TXT, CSV, MD, PDF) do not publish automatically. They pass through hashing, schema parsing, conflict detection, and require explicit operator approval.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Knowledge */}
        {activeTab === "knowledge" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-medium text-white">Active Hotel Facts (Version {data.knowledge.currentVersion.version})</h2>
                <p className="text-xs text-[#8E959E]">Published by {data.knowledge.currentVersion.publishedBy}</p>
              </div>
            </div>

            <div className="bg-[#181B1E] border border-[#282C30] rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#1F2327] border-b border-[#282C30] text-[#8E959E]">
                  <tr>
                    <th className="py-3 px-4 font-medium">Fact ID</th>
                    <th className="py-3 px-4 font-medium">Category</th>
                    <th className="py-3 px-4 font-medium">Title</th>
                    <th className="py-3 px-4 font-medium">Ground Truth Summary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#24282D]">
                  {data.knowledge.currentVersion.items.map((item) => (
                    <tr key={item.id} className="hover:bg-[#1C2024] transition">
                      <td className="py-3 px-4 font-mono text-emerald-400">{item.id}</td>
                      <td className="py-3 px-4 text-[#8E959E] uppercase tracking-wider text-[10px]">{item.category}</td>
                      <td className="py-3 px-4 text-white font-medium">{item.title}</td>
                      <td className="py-3 px-4 text-[#C2C9D0]">{item.summary}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Version History & Rollback */}
            <div className="bg-[#181B1E] border border-[#282C30] rounded-lg p-6">
              <h3 className="text-sm font-semibold text-white mb-3">Version History &amp; Instant Rollback</h3>
              <div className="space-y-3">
                {data.knowledge.versions.map((ver) => (
                  <div key={ver.version} className="flex items-center justify-between p-3 bg-[#131517] rounded border border-[#22262A] text-xs">
                    <div>
                      <span className="font-semibold text-white mr-2">Version {ver.version}</span>
                      <span className="text-[#8E959E]">Status: <strong className="text-white">{ver.status}</strong></span>
                      <span className="text-[#8E959E] ml-4">By: {ver.publishedBy}</span>
                    </div>
                    {ver.status !== "published" && (
                      <button
                        onClick={() => handleRollback(ver.version)}
                        className="px-3 py-1 bg-[#2D3339] hover:bg-[#3D454D] text-white rounded text-xs transition"
                      >
                        Rollback to v{ver.version}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Ingestion & Conflicts */}
        {activeTab === "ingestion" && (
          <div className="space-y-8">
            {/* Upload Document Form */}
            <div className="bg-[#181B1E] border border-[#282C30] rounded-lg p-6">
              <h2 className="text-sm font-semibold text-white mb-2">Ingest New Hotel Policy / Document</h2>
              <p className="text-xs text-[#8E959E] mb-4">
                Upload policy updates in TXT, Markdown, CSV, or JSON. The governance pipeline parses candidate facts, checks for discrepancies against existing rules, and holds for supervisor review.
              </p>

              <form onSubmit={handleUpload} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-[#8E959E] mb-1">Document Name</label>
                    <input
                      type="text"
                      value={fileName}
                      onChange={(e) => setFileName(e.target.value)}
                      placeholder="e.g. 2026_Parking_Policy_Update.txt"
                      className="w-full bg-[#111315] border border-[#2D3339] rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#8E959E] mb-1">File Format</label>
                    <select
                      value={fileType}
                      onChange={(e) => setFileType(e.target.value as any)}
                      className="w-full bg-[#111315] border border-[#2D3339] rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-white"
                    >
                      <option value="txt">Plain Text (TXT)</option>
                      <option value="md">Markdown (MD)</option>
                      <option value="json">Structured JSON</option>
                      <option value="csv">CSV Spreadsheet</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-[#8E959E] mb-1">Document Content</label>
                  <textarea
                    rows={6}
                    value={fileContent}
                    onChange={(e) => setFileContent(e.target.value)}
                    placeholder="Enter policy text or paste document contents here..."
                    className="w-full bg-[#111315] border border-[#2D3339] rounded px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-white"
                    required
                  />
                </div>

                <div className="flex items-center gap-4">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-white text-[#111315] font-semibold rounded text-xs hover:bg-[#D5D8DC] transition"
                  >
                    Submit for Governance Review
                  </button>
                  {uploadMsg && <span className="text-xs text-emerald-400">{uploadMsg}</span>}
                </div>
              </form>
            </div>

            {/* Ingestion Review Queue */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-white">Ingestion Review &amp; Conflict Queue</h3>
              {data.knowledge.ingestionRecords.length === 0 ? (
                <p className="text-xs text-[#8E959E]">No ingestion records currently pending.</p>
              ) : (
                data.knowledge.ingestionRecords.map((rec) => (
                  <div key={rec.sourceId} className="bg-[#181B1E] border border-[#282C30] rounded-lg p-5 space-y-3">
                    <div className="flex items-center justify-between border-b border-[#24282D] pb-3">
                      <div>
                        <span className="font-semibold text-white text-xs">{rec.fileName}</span>
                        <span className="text-[11px] text-[#8E959E] ml-3">Hash: {rec.sourceHash.slice(0, 12)}...</span>
                        <span className="text-[11px] text-[#8E959E] ml-3">Uploaded by: {rec.uploadedBy}</span>
                      </div>
                      <span className={`text-[11px] px-2 py-0.5 rounded uppercase font-semibold ${
                        rec.status === "approved" ? "bg-emerald-950 text-emerald-400 border border-emerald-800" : "bg-amber-950 text-amber-400 border border-amber-800"
                      }`}>
                        {rec.status}
                      </span>
                    </div>

                    {/* Conflicts */}
                    {rec.conflicts && rec.conflicts.length > 0 && (
                      <div className="p-3 bg-red-950/40 border border-red-800/60 rounded text-xs space-y-1">
                        <strong className="text-red-400 block font-medium">⚠️ Policy Discrepancy Detected:</strong>
                        {rec.conflicts.map((c: any, i: number) => (
                          <div key={i} className="text-red-200">
                            {c.reason} (Severity: {c.severity})
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Candidate facts summary */}
                    <div className="text-xs text-[#A0A8B0]">
                      <strong>Candidate Facts ({rec.candidateFacts.length}):</strong>
                      <ul className="list-disc pl-5 mt-1 space-y-1">
                        {rec.candidateFacts.map((cf: any) => (
                          <li key={cf.id}>
                            <span className="text-white font-medium">{cf.title}:</span> {cf.summary}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {rec.status === "pending_review" && (
                      <div className="pt-2">
                        <button
                          onClick={() => handleApprove(rec.sourceId)}
                          className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold transition"
                        >
                          Approve &amp; Publish New Knowledge Version
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab 4: Feedback */}
        {activeTab === "feedback" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-[#181B1E] border border-[#282C30] rounded-lg p-5">
                <p className="text-[11px] uppercase tracking-wider text-[#8E959E]">Total Feedback</p>
                <p className="text-2xl font-semibold text-white mt-1">{data.feedback.summary.total}</p>
              </div>
              <div className="bg-[#181B1E] border border-[#282C30] rounded-lg p-5">
                <p className="text-[11px] uppercase tracking-wider text-[#8E959E]">Positive Rating</p>
                <p className="text-2xl font-semibold text-emerald-400 mt-1">{data.feedback.summary.helpful}</p>
              </div>
              <div className="bg-[#181B1E] border border-[#282C30] rounded-lg p-5">
                <p className="text-[11px] uppercase tracking-wider text-[#8E959E]">Negative Rating</p>
                <p className="text-2xl font-semibold text-red-400 mt-1">{data.feedback.summary.notHelpful}</p>
              </div>
            </div>

            <div className="bg-[#181B1E] border border-[#282C30] rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#1F2327] border-b border-[#282C30] text-[#8E959E]">
                  <tr>
                    <th className="py-3 px-4 font-medium">Request ID</th>
                    <th className="py-3 px-4 font-medium">Rating</th>
                    <th className="py-3 px-4 font-medium">Reason</th>
                    <th className="py-3 px-4 font-medium">Comment</th>
                    <th className="py-3 px-4 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#24282D]">
                  {data.feedback.recent.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-4 px-4 text-[#8E959E] text-center">No feedback records yet.</td>
                    </tr>
                  ) : (
                    data.feedback.recent.map((fb: any) => (
                      <tr key={fb.id} className="hover:bg-[#1C2024] transition">
                        <td className="py-3 px-4 font-mono text-[#8E959E]">{fb.requestId.slice(0, 16)}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            fb.rating === "helpful" ? "bg-emerald-950 text-emerald-400" : "bg-red-950 text-red-400"
                          }`}>
                            {fb.rating}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-[#C2C9D0]">{fb.reason || "-"}</td>
                        <td className="py-3 px-4 text-white">{fb.comment || "-"}</td>
                        <td className="py-3 px-4 text-[#8E959E]">{new Date(fb.timestamp).toLocaleTimeString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 5: Escalations */}
        {activeTab === "escalations" && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-white">Front Desk Human Escalation Queue</h2>
            {data.escalations.length === 0 ? (
              <p className="text-xs text-[#8E959E]">No active escalations recorded.</p>
            ) : (
              data.escalations.map((esc: any) => (
                <div key={esc.id} className="bg-[#181B1E] border border-[#282C30] rounded-lg p-5 space-y-2 text-xs">
                  <div className="flex items-center justify-between border-b border-[#24282D] pb-2">
                    <div>
                      <span className="font-semibold text-white">Reason: {esc.reason}</span>
                      <span className="text-[#8E959E] ml-4">Session: {esc.sessionId}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      esc.status === "open" ? "bg-amber-950 text-amber-400 border border-amber-800" : "bg-emerald-950 text-emerald-400"
                    }`}>
                      {esc.status}
                    </span>
                  </div>
                  <p className="text-white"><strong>Guest Inquiry:</strong> {esc.guestMessage}</p>
                  <p className="text-[#A0A8B0]"><strong>Summary:</strong> {esc.summary}</p>
                  {esc.status === "open" && (
                    <div className="pt-2">
                      <button
                        onClick={() => handleResolveEscalation(esc.id)}
                        className="px-3 py-1 bg-[#2D3339] hover:bg-[#3D454D] text-white rounded text-xs transition"
                      >
                        Mark Handled by Front Desk
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 6: Flags */}
        {activeTab === "flags" && (
          <div className="space-y-6">
            <div className="bg-[#181B1E] border border-[#282C30] rounded-lg p-6">
              <h2 className="text-sm font-semibold text-white mb-2">Emergency Kill Switches &amp; Feature Flags</h2>
              <p className="text-xs text-[#8E959E] mb-6">
                Allows operators to immediately decouple dependencies (e.g. LLM outage, ingestion lockdown, PMS maintenance) without downtime or code deployment.
              </p>

              <div className="space-y-4">
                {Object.entries(data.flags).map(([key, val]) => (
                  <div key={key} className="flex items-center justify-between p-3 bg-[#131517] rounded border border-[#22262A]">
                    <div>
                      <p className="text-xs font-semibold text-white font-mono">{key}</p>
                      <p className="text-[11px] text-[#8E959E]">
                        {key === "availabilityProviderEnabled" && "Controls live availability tool lookup"}
                        {key === "groundedLlmPhrasing" && "Controls whether LLM generates phrasing or falls back to template"}
                        {key === "opsIngestionEnabled" && "Enables/disables new document uploads to knowledge pipeline"}
                        {key === "guestFeedbackEnabled" && "Controls guest rating submissions"}
                        {key === "intentClassifierLlm" && "Toggles AI intent classifier vs fallback"}
                        {key === "forceDeterministicFaqOnly" && "Forces zero model invocation across entire app"}
                      </p>
                    </div>
                    <button
                      onClick={() => handleToggleFlag(key, val)}
                      className={`px-3 py-1 rounded text-xs font-semibold transition ${
                        val
                          ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                          : "bg-red-950 text-red-400 border border-red-800"
                      }`}
                    >
                      {val ? "ENABLED" : "DISABLED"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
