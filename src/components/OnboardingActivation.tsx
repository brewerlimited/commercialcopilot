"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { getDefaultNoticePeriodDays } from "@/lib/commercialControl";
import { buildEventReference } from "@/lib/eventReference";
import { getRequiredUser, isAuthErrorMessage } from "@/lib/security";
import { trackAnalyticsWithUser } from "@/lib/analyticsClient";
import {
  CONTRACT_BASIS_OPTIONS,
  EMPTY_ISSUE_DRAFT,
  EMPTY_PROJECT_DRAFT,
  TRADE_EXAMPLES,
  TRADE_OPTIONS,
  contractBasisToContractType,
  hasMeaningfulIssueText,
  onboardingStorageKey,
  resolveOnboardingState,
  tradePackageToProfile,
  type OnboardingIssueDraft,
  type OnboardingPrefs,
  type OnboardingProjectDraft,
  type OnboardingState,
} from "@/lib/onboarding";
import { AppCard, IconBubble, QuietButton, SmallIcon, appUi, toneColours } from "@/components/appUi";

type ProjectRow = {
  id: string;
  project_name: string | null;
  main_contractor?: string | null;
  contract_type?: string | null;
  trade_package?: string | null;
  trade_profile?: string | null;
  status?: string | null;
  is_demo?: boolean | null;
};

type EventRow = {
  id: string;
  title: string | null;
  status?: string | null;
  created_at?: string | null;
  first_issue_captured_at?: string | null;
  onboarding_captured_at?: string | null;
  is_demo?: boolean | null;
};

type LoadedState = {
  userId: string;
  prefs: OnboardingPrefs;
  projects: ProjectRow[];
  events: EventRow[];
  state: OnboardingState;
};

type OnboardingPrefsRow = {
  onboarding_completed_at?: string | null;
  welcome_dismissed_at?: string | null;
  guide_hidden_at?: string | null;
  project_draft?: OnboardingProjectDraft | null;
  issue_draft?: OnboardingIssueDraft | null;
  last_ui_state?: OnboardingState | null;
};

const optionalColumnPattern = /trade_package|project_reference|is_demo|first_issue_captured_at|onboarding_captured_at|onboarding_state|schema cache|column|does not exist/i;

type QueryResult<T = unknown> = {
  data?: T | null;
  error?: { message?: string | null } | null;
};

type QueryChain<T = unknown> = PromiseLike<QueryResult<T>> & {
  select: (columns?: string) => QueryChain<T>;
  eq: (column: string, value: unknown) => QueryChain<T>;
  order: (column: string, options?: Record<string, unknown>) => QueryChain<T>;
  maybeSingle: () => Promise<QueryResult<T>>;
  single: () => Promise<QueryResult<T>>;
  upsert: (payload: unknown, options?: Record<string, unknown>) => QueryChain<T>;
  insert: (payload: unknown) => QueryChain<T>;
  limit: (count: number) => QueryChain<T>;
};

function tables<T = unknown>(client: unknown) {
  return client as {
    from: (table: string) => QueryChain<T>;
  };
}

function fieldStyle(): React.CSSProperties {
  return {
    width: "100%",
    minHeight: 48,
    border: `1px solid ${appUi.border}`,
    borderRadius: 14,
    background: appUi.input,
    color: appUi.text,
    padding: "0 14px",
    font: "inherit",
    fontWeight: 650,
    outline: "none",
  };
}

function labelStyle(): React.CSSProperties {
  return { display: "grid", gap: 7, color: appUi.muted, fontSize: 12, lineHeight: 1.25, fontWeight: 750 };
}

function onboardingTitleStyle(size = 28): React.CSSProperties {
  return {
    margin: 0,
    color: appUi.text,
    fontSize: size,
    lineHeight: 1.12,
    letterSpacing: 0,
    fontWeight: 780,
  };
}

function onboardingCopyStyle(): React.CSSProperties {
  return {
    margin: "8px 0 0",
    color: appUi.muted,
    fontSize: 13,
    lineHeight: 1.55,
    fontWeight: 500,
  };
}

function OnboardingCallout({
  children,
  tone = "purple",
}: {
  children: React.ReactNode;
  tone?: "purple" | "blue" | "green" | "orange";
}) {
  const tc = toneColours(tone);
  return (
    <div style={{ border: `1px solid ${tc.border}`, background: tc.bg, color: appUi.text, borderRadius: 16, padding: 14, fontSize: 13, lineHeight: 1.5, fontWeight: 650 }}>
      {children}
    </div>
  );
}

function readLocalDraft<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function writeLocalDraft(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Local recovery is a convenience only; it must not block the product.
  }
}

function removeLocalDraft(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {}
}

function cleanName(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function titleFromIssue(description: string) {
  const sentence = description.replace(/\s+/g, " ").trim().split(/[.!?]/)[0] || "Commercial issue";
  return sentence.length > 86 ? `${sentence.slice(0, 83).trim()}...` : sentence;
}

function setupProgressText(state: OnboardingState) {
  if (state === "PROJECT_SETUP_IN_PROGRESS") return "Your project details have been saved.";
  if (state === "FIRST_ISSUE" || state === "FIRST_ISSUE_IN_PROGRESS") return "Project created. Save one first issue and the full dashboard will open.";
  return "Create one real project and one first issue. The full dashboard appears straight after that.";
}

async function maybeUpsertOnboardingPrefs(userId: string, patch: Record<string, unknown>) {
  const supabase = supabaseBrowser();
  const payload = {
    user_id: userId,
    ...patch,
    updated_at: new Date().toISOString(),
  };
  const res = await tables(supabase)
    .from("user_onboarding_state")
    .upsert(payload, { onConflict: "user_id" });
  if (res.error && !optionalColumnPattern.test(String(res.error.message || ""))) throw res.error;
}

async function loadOnboardingState(projectDraft: OnboardingProjectDraft, issueDraft: OnboardingIssueDraft): Promise<LoadedState> {
  const supabase = supabaseBrowser();
  const user = await getRequiredUser(supabase);

  let prefs: OnboardingPrefs = {};
  const prefRes = await tables<OnboardingPrefsRow>(supabase)
    .from("user_onboarding_state")
    .select("onboarding_completed_at,welcome_dismissed_at,guide_hidden_at,project_draft,issue_draft,last_ui_state")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!prefRes.error && prefRes.data) {
    prefs = {
      onboardingCompletedAt: prefRes.data.onboarding_completed_at,
      welcomeDismissedAt: prefRes.data.welcome_dismissed_at,
      guideHiddenAt: prefRes.data.guide_hidden_at,
      projectDraft: prefRes.data.project_draft,
      issueDraft: prefRes.data.issue_draft,
      lastUiState: prefRes.data.last_ui_state,
    };
  } else if (prefRes.error && optionalColumnPattern.test(String(prefRes.error.message || ""))) {
    const fallbackPrefRes = await tables<OnboardingPrefsRow>(supabase)
      .from("user_onboarding_state")
      .select("onboarding_completed_at,welcome_dismissed_at,guide_hidden_at")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!fallbackPrefRes.error && fallbackPrefRes.data) {
      prefs = {
        onboardingCompletedAt: fallbackPrefRes.data.onboarding_completed_at,
        welcomeDismissedAt: fallbackPrefRes.data.welcome_dismissed_at,
        guideHiddenAt: fallbackPrefRes.data.guide_hidden_at,
      };
    } else if (fallbackPrefRes.error && !optionalColumnPattern.test(String(fallbackPrefRes.error.message || ""))) {
      throw fallbackPrefRes.error;
    }
  } else if (prefRes.error && !optionalColumnPattern.test(String(prefRes.error.message || ""))) {
    throw prefRes.error;
  }

  let projectsRes = await tables<ProjectRow[]>(supabase)
    .from("projects")
    .select("id,project_name,main_contractor,contract_type,trade_package,trade_profile,status,is_demo,updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });
  if (projectsRes.error && optionalColumnPattern.test(String(projectsRes.error.message || ""))) {
    projectsRes = await tables<ProjectRow[]>(supabase)
      .from("projects")
      .select("id,project_name,main_contractor,contract_type,trade_profile,status,updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
  }
  if (projectsRes.error) throw projectsRes.error;

  let eventsRes = await tables<EventRow[]>(supabase)
    .from("events")
    .select("id,title,status,created_at,first_issue_captured_at,onboarding_captured_at,is_demo")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (eventsRes.error && optionalColumnPattern.test(String(eventsRes.error.message || ""))) {
    eventsRes = await tables<EventRow[]>(supabase)
      .from("events")
      .select("id,title,status,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
  }
  if (eventsRes.error) throw eventsRes.error;

  const projects = (projectsRes.data ?? []) as ProjectRow[];
  const events = (eventsRes.data ?? []) as EventRow[];
  const state = resolveOnboardingState({
    prefs,
    projects,
    issues: events,
    projectDraft,
    issueDraft,
  });

  if (state === "COMPLETE" && !prefs.onboardingCompletedAt) {
    void maybeUpsertOnboardingPrefs(user.id, { onboarding_completed_at: new Date().toISOString() });
  }

  return { userId: user.id, prefs, projects, events, state };
}

function ActivationShell({
  children,
  side,
}: {
  children: React.ReactNode;
  side?: React.ReactNode;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(280px, 340px)", gap: 18, alignItems: "start" }}>
      <div>{children}</div>
      <div style={{ display: "grid", gap: 14 }}>{side}</div>
    </div>
  );
}

function GettingStartedSide({ state }: { state: OnboardingState }) {
  return (
    <>
      <AppCard style={{ padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <IconBubble tone="purple" size={38}><SmallIcon name="rocket" /></IconBubble>
          <h2 style={{ margin: 0, color: appUi.text, fontSize: 15, lineHeight: 1.25, fontWeight: 780 }}>Getting started</h2>
        </div>
        <p style={{ margin: "14px 0 0", color: appUi.muted, fontSize: 14, lineHeight: 1.6 }}>{setupProgressText(state)}</p>
      </AppCard>
      <AppCard style={{ padding: 18 }}>
        <h2 style={{ margin: 0, color: appUi.text, fontSize: 15, lineHeight: 1.25, fontWeight: 780 }}>What comes later?</h2>
        <p style={{ margin: "12px 0 0", color: appUi.muted, fontSize: 14, lineHeight: 1.65 }}>
          Contract documents, evidence, rates and team details improve the record, but they are not needed to begin.
        </p>
      </AppCard>
      <AppCard style={{ padding: 18 }} tone={state.startsWith("FIRST_ISSUE") ? "blue" : "neutral"}>
        <h2 style={{ margin: 0, color: appUi.text, fontSize: 15, lineHeight: 1.25, fontWeight: 780 }}>Dashboard access</h2>
        <p style={{ margin: "12px 0 0", color: appUi.muted, fontSize: 14, lineHeight: 1.65 }}>
          The live dashboard unlocks after the first real issue is saved, so the opening numbers are based on actual records.
        </p>
      </AppCard>
    </>
  );
}

export function OnboardingActivationDashboard({
  forceStart = false,
  onStateChange,
}: {
  forceStart?: boolean;
  onStateChange?: (state: OnboardingState) => void;
}) {
  const router = useRouter();
  const projectNameRef = useRef<HTMLInputElement | null>(null);
  const issueTitleRef = useRef<HTMLInputElement | null>(null);
  const issueRef = useRef<HTMLTextAreaElement | null>(null);
  const [loaded, setLoaded] = useState<LoadedState | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"welcome" | "project" | "title" | "issue" | "workspace">("welcome");
  const [projectDraft, setProjectDraft] = useState<OnboardingProjectDraft>(EMPTY_PROJECT_DRAFT);
  const [issueDraft, setIssueDraft] = useState<OnboardingIssueDraft>(EMPTY_ISSUE_DRAFT);
  const [optionalOpen, setOptionalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const projectKey = loaded?.userId ? onboardingStorageKey(loaded.userId, "projectDraft") : null;
  const issueKey = loaded?.userId ? onboardingStorageKey(loaded.userId, "issueDraft") : null;

  async function refreshState(existingProjectDraft = projectDraft, existingIssueDraft = issueDraft) {
    setLoading(true);
    try {
      const initialSupabase = supabaseBrowser();
      const user = await getRequiredUser(initialSupabase);
      const pKey = onboardingStorageKey(user.id, "projectDraft");
      const iKey = onboardingStorageKey(user.id, "issueDraft");
      const localProjectDraft = readLocalDraft(pKey, existingProjectDraft);
      const localIssueDraft = readLocalDraft(iKey, existingIssueDraft);
      const loadedState = await loadOnboardingState(localProjectDraft, localIssueDraft);
      const nextProjectDraft = { ...localProjectDraft, ...(loadedState.prefs.projectDraft ?? {}) };
      const nextIssueDraft = { ...localIssueDraft, ...(loadedState.prefs.issueDraft ?? {}) };
      const resolvedState = resolveOnboardingState({
        prefs: loadedState.prefs,
        projects: loadedState.projects,
        issues: loadedState.events,
        projectDraft: nextProjectDraft,
        issueDraft: nextIssueDraft,
      });
      const nextState = forceStart ? "WELCOME" : resolvedState;
      const next = { ...loadedState, state: nextState };
      setProjectDraft(nextProjectDraft);
      setIssueDraft(nextIssueDraft);
      setLoaded(next);
      onStateChange?.(next.state);
      setMode(
        next.state === "WELCOME"
          ? "welcome"
          : next.state.startsWith("PROJECT")
          ? "project"
          : next.state.startsWith("FIRST_ISSUE")
          ? nextIssueDraft.title.trim()
            ? "issue"
            : "title"
          : "workspace"
      );
      if (next.state === "WELCOME") void trackAnalyticsWithUser(initialSupabase, "onboarding_welcome_viewed", { current_onboarding_state: next.state, forced: forceStart });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not load getting started";
      if (isAuthErrorMessage(msg)) {
        router.push("/login");
        return;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceStart, onStateChange]);

  useEffect(() => {
    if (mode === "project") window.setTimeout(() => projectNameRef.current?.focus(), 50);
    if (mode === "title") window.setTimeout(() => issueTitleRef.current?.focus(), 50);
    if (mode === "issue") window.setTimeout(() => issueRef.current?.focus(), 50);
  }, [mode]);

  useEffect(() => {
    if (!projectKey) return;
    const timer = window.setTimeout(() => {
      writeLocalDraft(projectKey, projectDraft);
      if (loaded?.userId) void trackAnalyticsWithUser(supabaseBrowser(), "onboarding_project_draft_saved", {
        trade_package: projectDraft.tradePackage || null,
        contract_basis: projectDraft.contractBasis || null,
        current_onboarding_state: loaded.state,
      });
      if (loaded?.userId) void maybeUpsertOnboardingPrefs(loaded.userId, {
        project_draft: projectDraft,
        last_ui_state: loaded.state,
      });
    }, 450);
    return () => window.clearTimeout(timer);
  }, [projectDraft, projectKey, loaded?.userId, loaded?.state]);

  useEffect(() => {
    if (!issueKey) return;
    const timer = window.setTimeout(() => {
      writeLocalDraft(issueKey, { ...issueDraft, lastEditedAt: new Date().toISOString() });
      if (hasMeaningfulIssueText(issueDraft.description)) {
        void trackAnalyticsWithUser(supabaseBrowser(), "onboarding_first_issue_draft_saved", {
          current_onboarding_state: loaded?.state,
        });
      }
      if (loaded?.userId) void maybeUpsertOnboardingPrefs(loaded.userId, {
        issue_draft: { ...issueDraft, lastEditedAt: new Date().toISOString() },
        last_ui_state: loaded.state,
      });
    }, 450);
    return () => window.clearTimeout(timer);
  }, [issueDraft, issueKey, loaded?.state]);

  const latestProject = useMemo(() => {
    const live = (loaded?.projects ?? []).filter((project) => project.id && !project.is_demo);
    return live[0] ?? null;
  }, [loaded?.projects]);

  const selectedTrade = projectDraft.tradePackage === "Other" ? projectDraft.otherTrade || "Other" : projectDraft.tradePackage;
  const example = TRADE_EXAMPLES[projectDraft.tradePackage] ?? TRADE_EXAMPLES.Other;
  const onboardingButtonBase: React.CSSProperties = {
    minHeight: 48,
    borderRadius: 15,
    padding: "0 18px",
    fontSize: 14,
    fontWeight: 850,
    letterSpacing: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    textDecoration: "none",
  };
  const purpleButtonStyle: React.CSSProperties = {
    ...onboardingButtonBase,
    border: "1px solid #ddd4ff",
    background: appUi.purpleSoft,
    color: appUi.purple,
    boxShadow: "0 12px 28px rgba(109, 74, 255, 0.08)",
  };
  const darkButtonStyle: React.CSSProperties = {
    ...onboardingButtonBase,
    border: `1px solid ${appUi.navy}`,
    background: appUi.navy,
    color: appUi.navyText,
    boxShadow: "0 14px 32px rgba(15, 23, 42, 0.14)",
  };
  const quietButtonStyle: React.CSSProperties = {
    ...onboardingButtonBase,
    border: `1px solid ${appUi.border}`,
    background: appUi.surface,
    color: appUi.text,
  };

  async function dismissWelcome() {
    if (!loaded) return;
    const dismissedAt = new Date().toISOString();
    setLoaded({ ...loaded, prefs: { ...loaded.prefs, welcomeDismissedAt: dismissedAt }, state: "PROJECT_SETUP" });
    setMode("workspace");
    setMessage("You can start from the getting started helper whenever you are ready.");
    writeLocalDraft(onboardingStorageKey(loaded.userId, "welcomeDismissed"), { dismissedAt });
    void maybeUpsertOnboardingPrefs(loaded.userId, { welcome_dismissed_at: dismissedAt });
    void trackAnalyticsWithUser(supabaseBrowser(), "onboarding_skipped", { current_onboarding_state: loaded.state });
  }

  async function testDemoDashboard() {
    if (!loaded) return;
    setError(null);
    setMessage("Preparing demo dashboard…");
    try {
      const supabase = supabaseBrowser();
      const sessionRes = await supabase.auth.getSession();
      const token = sessionRes.data.session?.access_token;
      const email = sessionRes.data.session?.user?.email;
      if (!token) throw new Error("Please sign in again before loading demo mode.");

      const res = await fetch("/api/admin/seed-demo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ targetEmail: email, demoMode: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Demo dashboard could not be prepared.");

      window.localStorage.setItem("cc.demo.mode", "1");
      window.dispatchEvent(new Event("cc:demo-mode-changed"));
      void trackAnalyticsWithUser(supabase, "demo_workspace_opened", { entry_source: "onboarding_welcome" });
      router.push("/app");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Demo dashboard could not be prepared.");
      setMessage(null);
    }
  }

  async function saveProject() {
    if (!loaded) return;
    setError(null);
    const cleanProject = cleanName(projectDraft.projectName);
    const cleanTrade = cleanName(selectedTrade);
    const cleanBasis = projectDraft.contractBasis;
    if (!cleanProject) return setError("Project name is required.");
    if (!cleanTrade) return setError("Choose a trade/package.");
    if (!cleanBasis) return setError("Choose the subcontract basis. Not sure is fine.");

    setSaving(true);
    try {
      const supabase = supabaseBrowser();
      void trackAnalyticsWithUser(supabase, "onboarding_create_project_started", {
        trade_package: cleanTrade,
        contract_basis: cleanBasis,
      });
      const contractType = contractBasisToContractType(cleanBasis);
      const tradeProfile = tradePackageToProfile(cleanTrade);
      const basePayload = {
        user_id: loaded.userId,
        project_name: cleanProject,
        main_contractor: cleanName(projectDraft.mainContractor),
        contract_type: contractType,
        trade_profile: tradeProfile,
        trade_package: cleanTrade,
        project_reference: cleanName(projectDraft.projectReference) || null,
        status: "live",
        is_demo: false,
        updated_at: new Date().toISOString(),
      };
      let res = await tables<ProjectRow>(supabase)
        .from("projects")
        .upsert(basePayload, { onConflict: "user_id,project_name,main_contractor" })
        .select("id,project_name,main_contractor,contract_type,trade_package,trade_profile,status,is_demo")
        .single();
      if (res.error && optionalColumnPattern.test(String(res.error.message || ""))) {
        const fallbackPayload = { ...basePayload } as Partial<typeof basePayload>;
        delete fallbackPayload.trade_package;
        delete fallbackPayload.project_reference;
        delete fallbackPayload.is_demo;
        res = await tables<ProjectRow>(supabase)
          .from("projects")
          .upsert(fallbackPayload, { onConflict: "user_id,project_name,main_contractor" })
          .select("id,project_name,main_contractor,contract_type,trade_profile,status")
          .single();
      }
      if (res.error) throw res.error;
      const created = res.data as ProjectRow;
      removeLocalDraft(onboardingStorageKey(loaded.userId, "projectDraft"));
      await maybeUpsertOnboardingPrefs(loaded.userId, { project_draft: null, last_ui_state: "FIRST_ISSUE" });
      const nextIssueDraft: OnboardingIssueDraft = {
        ...EMPTY_ISSUE_DRAFT,
        projectId: created.id,
        projectName: created.project_name || cleanProject,
        tradePackage: cleanTrade,
      };
      setIssueDraft(nextIssueDraft);
      if (issueKey) writeLocalDraft(issueKey, nextIssueDraft);
      setLoaded({
        ...loaded,
        projects: [created, ...loaded.projects.filter((project) => project.id !== created.id)],
        state: "FIRST_ISSUE",
      });
      setMode("title");
      setMessage(`✓ ${cleanProject} created`);
      void trackAnalyticsWithUser(supabase, "onboarding_project_created", {
        project_id: created.id,
        trade_package: cleanTrade,
        contract_basis: cleanBasis,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create project. Your typed details have been kept.");
    } finally {
      setSaving(false);
    }
  }

  async function saveIssue() {
    if (!loaded) return;
    setError(null);
    const project = latestProject;
    if (!project?.id) {
      setMode("project");
      setError("Create a project before saving the issue.");
      return;
    }
    const description = issueDraft.description.trim();
    const cleanTitle = cleanName(issueDraft.title);
    if (!cleanTitle) {
      setMode("title");
      setError("Add a short CE / VO title before saving the issue.");
      return;
    }
    if (!hasMeaningfulIssueText(description)) {
      setError("Add one clear sentence describing what happened.");
      return;
    }
    setSaving(true);
    try {
      const supabase = supabaseBrowser();
      const contractType = project.contract_type || contractBasisToContractType(projectDraft.contractBasis || "not_sure");
      const tradeProfile = project.trade_profile || tradePackageToProfile(project.trade_package || issueDraft.tradePackage || selectedTrade);
      const existingRefs = await tables<Array<{ event_number?: number | string | null }>>(supabase)
        .from("events")
        .select("event_number")
        .eq("user_id", loaded.userId)
        .eq("project_id", project.id)
        .order("event_number", { ascending: false })
        .limit(1);
      if (existingRefs.error && !/project_id|schema cache|column|does not exist/i.test(String(existingRefs.error.message || ""))) throw existingRefs.error;
      const existingNumbers = (existingRefs.data ?? [])
        .map((row: { event_number?: number | string | null }) => Number(row.event_number))
        .filter((value: number) => Number.isFinite(value));
      const nextEventNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
      const eventReference = buildEventReference(contractType, nextEventNumber);
      const capturedAt = new Date().toISOString();
      const basePayload = {
        user_id: loaded.userId,
        title: cleanTitle || titleFromIssue(description),
        project_id: project.id,
        project_name: project.project_name || issueDraft.projectName,
        main_contractor: project.main_contractor || "",
        status: "draft",
        contract_type: contractType,
        contract_source: "standard_logic",
        trade_profile: tradeProfile,
        event_number: nextEventNumber,
        event_reference: eventReference,
        notice_period_days: getDefaultNoticePeriodDays(contractType),
        first_issue_captured_at: capturedAt,
        is_demo: false,
        event_financial_summary: {
          onboarding_first_issue_description: description,
          onboarding_neutral_classification: "Commercial issue",
        },
      };
      let insertRes = await tables<EventRow>(supabase).from("events").insert([basePayload]).select("id,title,status,created_at,first_issue_captured_at,is_demo").single();
      if (insertRes.error && optionalColumnPattern.test(String(insertRes.error.message || ""))) {
        const fallbackPayload = { ...basePayload } as Partial<typeof basePayload>;
        delete fallbackPayload.first_issue_captured_at;
        delete fallbackPayload.is_demo;
        insertRes = await tables<EventRow>(supabase).from("events").insert([fallbackPayload]).select("id,title,status,created_at").single();
      }
      if (insertRes.error) throw insertRes.error;
      const event = insertRes.data as EventRow;
      const basisRes = await (supabase as any).from("event_basis").upsert(
        {
          event_id: event.id,
          happened_summary: description,
          cause_type: null,
          cause_summary: "",
          difference_from_plan: "",
          mechanism_tags: [],
          time_impact_toggle: "unsure",
          mitigation_summary: "",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "event_id" }
      );
      if (basisRes.error && !optionalColumnPattern.test(String(basisRes.error.message || ""))) throw basisRes.error;
      const completedAt = new Date().toISOString();
      removeLocalDraft(onboardingStorageKey(loaded.userId, "issueDraft"));
      await maybeUpsertOnboardingPrefs(loaded.userId, { onboarding_completed_at: completedAt, issue_draft: null, last_ui_state: "COMPLETE" });
      setLoaded({ ...loaded, events: [event, ...loaded.events], prefs: { ...loaded.prefs, onboardingCompletedAt: completedAt }, state: "COMPLETE" });
      onStateChange?.("COMPLETE");
      setMessage("Issue saved");
      void trackAnalyticsWithUser(supabase, "onboarding_first_issue_saved", {
        project_id: project.id,
        contract_basis: contractType,
        trade_package: project.trade_package || issueDraft.tradePackage || null,
      });
      void trackAnalyticsWithUser(supabase, "onboarding_completed", {
        project_id: project.id,
        event_id: event.id,
      });
      router.push(`/app/event/${event.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the issue. Your text has been kept.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AppCard style={{ padding: 24 }}>
        <div style={{ color: appUi.text, fontWeight: 850 }}>Loading workspace…</div>
        <p style={{ margin: "8px 0 0", color: appUi.muted }}>Preparing the right starting point.</p>
      </AppCard>
    );
  }

  if (!loaded || (!forceStart && loaded.state === "COMPLETE")) return null;

  if (mode === "welcome" && loaded.state === "WELCOME") {
    return (
      <ActivationShell side={<GettingStartedSide state={loaded.state} />}>
        <AppCard style={{ padding: 28, minHeight: 500, display: "grid", alignContent: "center" }}>
          <div style={{ maxWidth: 760 }}>
            <IconBubble tone="purple" size={48}><SmallIcon name="building" /></IconBubble>
            <div className="app-page-eyebrow" style={{ marginTop: 20 }}>First setup</div>
            <h1 style={{ ...onboardingTitleStyle(30), marginTop: 6 }}>
              Set up your first live recovery record.
            </h1>
            <p style={{ ...onboardingCopyStyle(), maxWidth: 660 }}>
              Add one project and one commercial issue. Once that issue is saved, the full dashboard will open with live recovery, EWN, CE and payment tracking based on your own records.
            </p>
            <div style={{ marginTop: 18 }}>
              <OnboardingCallout tone="green">
                You only need a project name, trade/package, contract basis, a short CE title and the first factual note about what happened.
              </OnboardingCallout>
            </div>
            <div style={{ marginTop: 26, display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button type="button" onClick={() => setMode("project")} style={{ ...darkButtonStyle, minWidth: 220 }}>
                Create your first project
              </button>
              <button type="button" onClick={testDemoDashboard} style={{ ...purpleButtonStyle, minWidth: 190 }}>
                Test demo dashboard
              </button>
              <button type="button" onClick={dismissWelcome} style={{ ...quietButtonStyle, minWidth: 160 }}>Go to workspace</button>
            </div>
            <div style={{ marginTop: 28, display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
              {[
                ["01", "Create project", "Name the job and choose the trade/package."],
                ["02", "Name the CE", "Give the first CE / VO a short factual title."],
                ["03", "Build basis", "Write what happened in plain English."],
                ["04", "Open dashboard", "Move into the full CE workflow."],
              ].map(([number, label, description]) => (
                <div key={label} style={{ border: `1px solid ${appUi.border}`, borderRadius: 16, padding: 14, background: appUi.raised }}>
                  <div style={{ color: appUi.purple, fontSize: 11, fontWeight: 850 }}>{number}</div>
                  <div style={{ marginTop: 7, color: appUi.text, fontSize: 13, fontWeight: 780 }}>{label}</div>
                  <div style={{ marginTop: 5, color: appUi.muted, fontSize: 12, lineHeight: 1.4 }}>{description}</div>
                </div>
              ))}
            </div>
            {message ? <p style={{ margin: "18px 0 0", color: appUi.green, fontWeight: 800 }}>{message}</p> : null}
          </div>
        </AppCard>
      </ActivationShell>
    );
  }

  if (mode === "workspace") {
    return (
      <ActivationShell side={<GettingStartedSide state="PROJECT_SETUP" />}>
        <AppCard style={{ padding: 28 }}>
          <IconBubble tone="purple" size={48}><SmallIcon name="building" /></IconBubble>
          <div className="app-page-eyebrow" style={{ marginTop: 18 }}>First setup</div>
          <h1 style={{ ...onboardingTitleStyle(), marginTop: 6 }}>Create your first project</h1>
          <p style={onboardingCopyStyle()}>
            Add a project name, trade/package and contract basis, then name and capture your first commercial issue. The full dashboard opens after that first issue is saved.
          </p>
          <div style={{ marginTop: 20 }}>
            <button type="button" onClick={() => setMode("project")} style={{ ...darkButtonStyle, minWidth: 180 }}>Create project</button>
          </div>
          <p style={{ margin: "14px 0 0", color: appUi.muted, fontSize: 13 }}>You only need three project details to begin.</p>
        </AppCard>
      </ActivationShell>
    );
  }

  if (mode === "project") {
    return (
      <ActivationShell side={<GettingStartedSide state={loaded.state} />}>
        <AppCard style={{ padding: 28 }}>
          <div className="app-page-eyebrow">Step 1 of 3</div>
          <h1 style={{ ...onboardingTitleStyle(), marginTop: 6 }}>Create your first project</h1>
          <p style={{ ...onboardingCopyStyle(), marginBottom: 22 }}>
            This gives the first issue somewhere to live. Contract documents, rates and team members can be added later.
          </p>
          <div style={{ display: "grid", gap: 18 }}>
            <label style={labelStyle()}>
              Project name
              <input ref={projectNameRef} value={projectDraft.projectName} onChange={(e) => setProjectDraft((p) => ({ ...p, projectName: e.target.value }))} placeholder="Riverside Apartments" style={fieldStyle()} />
            </label>
            <div style={{ display: "grid", gap: 9 }}>
              <div style={{ color: appUi.muted, fontSize: 12, fontWeight: 800 }}>Trade/package</div>
              <div role="radiogroup" aria-label="Trade/package" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 9 }}>
                {TRADE_OPTIONS.map((trade) => {
                  const active = projectDraft.tradePackage === trade;
                  const tc = toneColours(active ? "purple" : "neutral");
                  return (
                    <button
                      key={trade}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setProjectDraft((p) => ({ ...p, tradePackage: trade }))}
                      style={{ minHeight: 46, borderRadius: 14, border: `1px solid ${tc.border}`, background: tc.bg, color: active ? appUi.purple : appUi.text, fontWeight: 800, cursor: "pointer" }}
                    >
                      {trade}
                    </button>
                  );
                })}
              </div>
              {projectDraft.tradePackage === "Other" ? (
                <input value={projectDraft.otherTrade} onChange={(e) => setProjectDraft((p) => ({ ...p, otherTrade: e.target.value }))} placeholder="Type the trade/package" style={fieldStyle()} />
              ) : null}
            </div>
            <div style={{ display: "grid", gap: 9 }}>
              <div style={{ color: appUi.muted, fontSize: 12, fontWeight: 800 }}>What is the subcontract based on?</div>
              <div role="radiogroup" aria-label="Subcontract basis" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 9 }}>
                {CONTRACT_BASIS_OPTIONS.map((option) => {
                  const active = projectDraft.contractBasis === option.value;
                  const tc = toneColours(active ? "purple" : "neutral");
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setProjectDraft((p) => ({ ...p, contractBasis: option.value }))}
                      style={{ minHeight: 46, borderRadius: 14, border: `1px solid ${tc.border}`, background: tc.bg, color: active ? appUi.purple : appUi.text, fontWeight: 800, cursor: "pointer" }}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <OnboardingCallout tone="blue">
              Choose “Not sure” if the basis is not confirmed. Commercial Co-Pilot will keep the wording neutral until the contract position is clarified.
            </OnboardingCallout>
            <button type="button" onClick={() => setOptionalOpen((open) => !open)} style={{ ...quietButtonStyle, justifySelf: "start" }}>
              Add client, reference or subcontract — optional
            </button>
            {optionalOpen ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label style={labelStyle()}>
                  Main contractor/client
                  <input value={projectDraft.mainContractor} onChange={(e) => setProjectDraft((p) => ({ ...p, mainContractor: e.target.value }))} style={fieldStyle()} />
                </label>
                <label style={labelStyle()}>
                  Project reference
                  <input value={projectDraft.projectReference} onChange={(e) => setProjectDraft((p) => ({ ...p, projectReference: e.target.value }))} style={fieldStyle()} />
                </label>
                <div style={{ gridColumn: "1 / -1", border: `1px dashed ${appUi.border}`, borderRadius: 16, padding: 16, color: appUi.muted, fontSize: 14 }}>
                  Upload subcontract can be added later from the project or CE screen. You are ready to capture issues without it.
                </div>
              </div>
            ) : null}
            {error ? <div style={{ border: `1px solid ${appUi.red}`, background: appUi.redSoft, color: appUi.red, borderRadius: 14, padding: 12, fontWeight: 800 }}>{error}</div> : null}
            <button type="button" disabled={saving} onClick={saveProject} style={{ ...darkButtonStyle, width: "100%", opacity: saving ? 0.65 : 1 }}>
              {saving ? "Creating project…" : "Create project and continue"}
            </button>
          </div>
        </AppCard>
      </ActivationShell>
    );
  }

  if (mode === "title") {
    return (
      <ActivationShell side={<GettingStartedSide state={loaded.state} />}>
        <AppCard style={{ padding: 28 }}>
          {message ? <div style={{ color: appUi.green, fontWeight: 850, marginBottom: 12 }}>{message}</div> : null}
          <div className="app-page-eyebrow">Step 2 of 3</div>
          <h1 style={{ ...onboardingTitleStyle(), marginTop: 6 }}>Name your first CE / VO.</h1>
          <p style={{ ...onboardingCopyStyle(), marginBottom: 18 }}>
            This becomes the draft CE title. Keep it short, factual and easy to recognise in the register.
          </p>
          <label style={labelStyle()}>
            CE / VO title
            <input
              ref={issueTitleRef}
              value={issueDraft.title}
              onChange={(e) => setIssueDraft((p) => ({
                ...p,
                title: e.target.value,
                projectId: latestProject?.id ?? p.projectId,
                projectName: latestProject?.project_name ?? p.projectName,
              }))}
              placeholder="e.g. Access delayed to level 03 workface due to unresolved design information"
              style={{ ...fieldStyle(), height: 58, fontSize: 16 }}
            />
          </label>
          <div style={{ marginTop: 16 }}>
            <OnboardingCallout tone="purple">
              Good title style: “Standing time due to delayed permit for service corridor excavation.”
            </OnboardingCallout>
          </div>
          {error ? <div style={{ marginTop: 14, border: `1px solid ${appUi.red}`, background: appUi.redSoft, color: appUi.red, borderRadius: 14, padding: 12, fontWeight: 800 }}>{error}</div> : null}
          <div style={{ marginTop: 22, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => {
                const cleanTitle = cleanName(issueDraft.title);
                if (!cleanTitle) return setError("Add a short CE / VO title before moving on.");
                setError(null);
                setMode("issue");
              }}
              style={{ ...darkButtonStyle, minWidth: 220 }}
            >
              Continue to Basis of Change
            </button>
            <button type="button" onClick={() => setMode("project")} style={quietButtonStyle}>
              Back to project
            </button>
          </div>
        </AppCard>
      </ActivationShell>
    );
  }

  return (
    <ActivationShell side={<GettingStartedSide state={loaded.state} />}>
      <AppCard style={{ padding: 28 }}>
        {message ? <div style={{ color: appUi.green, fontWeight: 850, marginBottom: 12 }}>{message}</div> : null}
        <div className="app-page-eyebrow">Step 3 of 3</div>
        <h1 style={{ ...onboardingTitleStyle(), marginTop: 6 }}>Build the Basis of Change.</h1>
        <p style={{ ...onboardingCopyStyle(), marginBottom: 14 }}>
          Describe the change, delay or instruction in your own words. This will populate the first Basis of Change notes for <strong>{issueDraft.title || "your first CE / VO"}</strong>.
        </p>
        <OnboardingCallout tone="purple">
          Keep this factual: what changed, who/what caused it, where it happened and why it affected the works.
        </OnboardingCallout>
        <textarea
          ref={issueRef}
          value={issueDraft.description}
          onChange={(e) => setIssueDraft((p) => ({ ...p, description: e.target.value, projectId: latestProject?.id ?? p.projectId, projectName: latestProject?.project_name ?? p.projectName }))}
          rows={7}
          placeholder="Type or paste what happened..."
          style={{ ...fieldStyle(), marginTop: 14, padding: 14, resize: "vertical", lineHeight: 1.55 }}
        />
        <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" onClick={() => issueRef.current?.focus()} style={quietButtonStyle}>Paste an email</button>
          <label style={{ ...quietButtonStyle, cursor: "pointer" }}>
            Add files or photos
            <input type="file" multiple style={{ display: "none" }} onChange={() => setMessage("Files can be attached in Evidence after the issue is saved. Your issue text is safe to continue.")} />
          </label>
          <button type="button" onClick={() => {
            if (issueKey) writeLocalDraft(issueKey, issueDraft);
            setMessage("Saved. Use Getting started to resume this issue.");
          }} style={quietButtonStyle}>Finish later</button>
        </div>
        <div style={{ marginTop: 18, border: `1px solid ${toneColours("blue").border}`, background: toneColours("blue").bg, borderRadius: 16, padding: 16 }}>
          <div style={{ color: appUi.text, fontWeight: 850 }}>Example for {selectedTrade || latestProject?.trade_package || "your package"}</div>
          <p style={{ margin: "8px 0 12px", color: appUi.muted, lineHeight: 1.55 }}>{example}</p>
          <button type="button" onClick={() => setIssueDraft((p) => ({ ...p, description: example }))} style={purpleButtonStyle}>Use this as a starting point</button>
        </div>
        {error ? <div style={{ marginTop: 14, border: `1px solid ${appUi.red}`, background: appUi.redSoft, color: appUi.red, borderRadius: 14, padding: 12, fontWeight: 800 }}>{error}</div> : null}
        <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" disabled={saving} onClick={saveIssue} style={{ ...darkButtonStyle, minWidth: 220, opacity: saving ? 0.65 : 1 }}>
            {saving ? "Saving issue…" : "Create draft CE / VO"}
          </button>
          <button type="button" onClick={() => setMode("title")} style={quietButtonStyle}>Back to title</button>
          <QuietButton href="/app/projects" style={quietButtonStyle}>Open projects</QuietButton>
        </div>
        <div aria-live="polite" style={{ marginTop: 12, color: appUi.muted, fontSize: 13 }}>
          Your draft is kept locally until the CE / VO is created.
        </div>
      </AppCard>
    </ActivationShell>
  );
}

export function FloatingOnboardingHelper() {
  const router = useRouter();
  const [loaded, setLoaded] = useState<LoadedState | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const supabase = supabaseBrowser();
        const user = await getRequiredUser(supabase);
        const projectDraft = readLocalDraft(onboardingStorageKey(user.id, "projectDraft"), EMPTY_PROJECT_DRAFT);
        const issueDraft = readLocalDraft(onboardingStorageKey(user.id, "issueDraft"), EMPTY_ISSUE_DRAFT);
        const loadedState = await loadOnboardingState(projectDraft, issueDraft);
        const mergedProjectDraft = { ...projectDraft, ...(loadedState.prefs.projectDraft ?? {}) };
        const mergedIssueDraft = { ...issueDraft, ...(loadedState.prefs.issueDraft ?? {}) };
        const next = {
          ...loadedState,
          state: resolveOnboardingState({
            prefs: loadedState.prefs,
            projects: loadedState.projects,
            issues: loadedState.events,
            projectDraft: mergedProjectDraft,
            issueDraft: mergedIssueDraft,
          }),
        };
        if (active) setLoaded(next);
      } catch {
        if (active) setLoaded(null);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (!loaded || loaded.state === "COMPLETE" || loaded.prefs.guideHiddenAt) return null;

  const isIssue = loaded.state === "FIRST_ISSUE" || loaded.state === "FIRST_ISSUE_IN_PROGRESS";
  const mainTask = isIssue
    ? loaded.state === "FIRST_ISSUE_IN_PROGRESS" ? "Continue your first CE / VO" : "Name and capture your first CE / VO"
    : loaded.state === "PROJECT_SETUP_IN_PROGRESS" ? "Continue creating your project" : "Create your first project";
  const copy = isIssue
    ? "Add a short title, then describe what happened. Evidence and costs can be added later."
    : loaded.state === "PROJECT_SETUP_IN_PROGRESS"
      ? "Your project details have been saved."
      : "Add a project name, trade/package and contract basis. Everything else can be added later.";

  return (
    <div style={{ position: "fixed", right: 22, bottom: 22, zIndex: 40, display: "grid", justifyItems: "end", gap: 10 }}>
      {open ? (
        <div role="dialog" aria-label="Getting started" style={{ width: 330, background: appUi.surface, border: `1px solid ${appUi.border}`, borderRadius: 18, boxShadow: appUi.shadow, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ color: appUi.text, fontWeight: 900 }}>{mainTask}</div>
              <p style={{ margin: "8px 0 0", color: appUi.muted, lineHeight: 1.5, fontSize: 13 }}>{copy}</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{
                width: 36,
                minHeight: 36,
                padding: 0,
                borderRadius: 12,
                border: `1px solid ${appUi.border}`,
                background: appUi.surface,
                color: appUi.text,
                fontWeight: 850,
                cursor: "pointer",
              }}
            >
              ×
            </button>
          </div>
          <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
            <button
              type="button"
              onClick={() => {
              void trackAnalyticsWithUser(supabaseBrowser(), "onboarding_resumed", { current_onboarding_state: loaded.state });
              router.push("/app");
            }}
              style={{
                minHeight: 44,
                borderRadius: 14,
                border: `1px solid ${appUi.navy}`,
                background: appUi.navy,
                color: appUi.navyText,
                fontWeight: 850,
                cursor: "pointer",
              }}
            >
              {isIssue ? "Resume issue" : "Start setup"}
            </button>
            <button
              type="button"
              onClick={() => {
              void maybeUpsertOnboardingPrefs(loaded.userId, { guide_hidden_at: new Date().toISOString() });
              void trackAnalyticsWithUser(supabaseBrowser(), "onboarding_guide_hidden", { current_onboarding_state: loaded.state });
              setLoaded({ ...loaded, prefs: { ...loaded.prefs, guideHiddenAt: new Date().toISOString() } });
            }}
              style={{
                minHeight: 42,
                borderRadius: 14,
                border: `1px solid ${toneColours("purple").border}`,
                background: toneColours("purple").bg,
                color: appUi.purple,
                fontWeight: 850,
                cursor: "pointer",
              }}
            >
              Do not show this guide again
            </button>
          </div>
        </div>
      ) : null}
      <button
        type="button"
        aria-label="Open getting started helper"
        onClick={() => {
          setOpen((value) => !value);
          void trackAnalyticsWithUser(supabaseBrowser(), "onboarding_helper_opened", { current_onboarding_state: loaded.state });
        }}
        style={{
          minHeight: 46,
          border: `1px solid ${toneColours("purple").border}`,
          borderRadius: 999,
          background: toneColours("purple").bg,
          color: appUi.purple,
          padding: "0 16px",
          display: "inline-flex",
          alignItems: "center",
          gap: 9,
          fontWeight: 850,
          cursor: "pointer",
          boxShadow: appUi.shadowSoft,
        }}
      >
        <SmallIcon name="rocket" />
        Getting started
      </button>
    </div>
  );
}
