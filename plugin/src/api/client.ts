import { getBackendSrv } from '@grafana/runtime';

import pluginJson from '../plugin.json';

export type AgentSummary = {
  id: string;
  name: string;
  description: string;
  version: string;
  enabled: boolean;
};

export type AgentDetail = AgentSummary & {
  entrypoint: string;
  manifest: Record<string, unknown>;
  config: Record<string, unknown>;
  llm_config: Record<string, unknown> | null;
};

export type ExecutionSummary = {
  run_id: string;
  agent_id: string;
  agent_version: string;
  status: string;
  task_success: boolean | null;
  duration_ms: number | null;
  created_at: string;
  started_at?: string | null;
  finished_at?: string | null;
};

export type ExecutionStep = {
  ts: string;
  name: string;
  status: string;
  detail?: string | null;
};

export type ExecutionDetail = ExecutionSummary & {
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown> | null;
  error: string | null;
  steps?: ExecutionStep[];
  container_id?: string | null;
};

type PluginSettings = {
  apiUrl?: string;
  apiToken?: string;
};

/**
 * Read plugin jsonData via Grafana's plugin settings API.
 * Compatible with Grafana 10–12 (avoids Grafana 13-only getPluginSettings).
 */
async function getSettings(): Promise<PluginSettings> {
  const meta = await getBackendSrv().get(`/api/plugins/${pluginJson.id}/settings`);
  return (meta?.jsonData || {}) as PluginSettings;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const settings = await getSettings();
  if (!settings.apiUrl) {
    throw new Error('Configure API URL in the Agent Manager plugin settings.');
  }
  if (!settings.apiToken) {
    throw new Error('Configure API token in the Agent Manager plugin settings.');
  }

  const url = `${settings.apiUrl.replace(/\/$/, '')}${path}`;
  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${settings.apiToken}`);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const resp = await fetch(url, { ...init, headers });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`${resp.status} ${resp.statusText}: ${text}`);
  }
  if (resp.status === 204) {
    return undefined as T;
  }
  return (await resp.json()) as T;
}

export const api = {
  listAgents: () => request<AgentSummary[]>('/api/v1/agents'),
  getAgent: (id: string) => request<AgentDetail>(`/api/v1/agents/${id}`),
  installFromPath: (path: string) =>
    request<AgentDetail>('/api/v1/agents/install/path', {
      method: 'POST',
      body: JSON.stringify({ path }),
    }),
  uninstall: (id: string) => request<void>(`/api/v1/agents/${id}`, { method: 'DELETE' }),
  enable: (id: string) => request<AgentDetail>(`/api/v1/agents/${id}/enable`, { method: 'POST' }),
  disable: (id: string) => request<AgentDetail>(`/api/v1/agents/${id}/disable`, { method: 'POST' }),
  configure: (id: string, config: Record<string, unknown>, llm_config?: Record<string, unknown>) =>
    request<AgentDetail>(`/api/v1/agents/${id}/config`, {
      method: 'PUT',
      body: JSON.stringify({ config, llm_config }),
    }),
  execute: (id: string, inputs: Record<string, unknown>) =>
    request<ExecutionDetail>(`/api/v1/agents/${id}/execute`, {
      method: 'POST',
      body: JSON.stringify({ inputs }),
    }),
  listExecutions: (agentId?: string) =>
    request<ExecutionSummary[]>(
      `/api/v1/executions${agentId ? `?agent_id=${encodeURIComponent(agentId)}` : ''}`
    ),
  getExecution: (runId: string) => request<ExecutionDetail>(`/api/v1/executions/${runId}`),
};
