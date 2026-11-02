import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Field,
  Input,
  Stack,
  TextArea,
  useStyles2,
} from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';
import { PluginPage } from '@grafana/runtime';
import { css } from '@emotion/css';

import { api, AgentDetail, ExecutionDetail } from '../api/client';
import { AgentOutputView } from '../components/AgentOutputView';
import { prefixRoute } from '../utils/utils.routing';
import { ROUTES } from '../constants';

type JsonSchema = {
  type?: string;
  properties?: Record<string, { type?: string; description?: string; default?: unknown }>;
  required?: string[];
};

function buildDefaults(schema?: JsonSchema): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!schema?.properties) {
    return { message: 'hello from grafana' };
  }
  for (const [key, prop] of Object.entries(schema.properties)) {
    if (prop.default !== undefined) {
      out[key] = prop.default;
    } else if (prop.type === 'boolean') {
      out[key] = false;
    } else if (prop.type === 'number' || prop.type === 'integer') {
      out[key] = 0;
    } else {
      out[key] = key === 'message' ? 'hello from grafana' : '';
    }
  }
  return out;
}

export default function AgentDetailPage() {
  const { agentId = '' } = useParams();
  const styles = useStyles2(getStyles);
  const [agent, setAgent] = useState<AgentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inputs, setInputs] = useState<Record<string, unknown>>({});
  const [result, setResult] = useState<ExecutionDetail | null>(null);
  const [busy, setBusy] = useState(false);

  const inputSchema = useMemo(() => {
    return (agent?.manifest as { inputSchema?: JsonSchema } | undefined)?.inputSchema;
  }, [agent]);

  useEffect(() => {
    (async () => {
      try {
        const detail = await api.getAgent(agentId);
        setAgent(detail);
        setInputs(buildDefaults((detail.manifest as { inputSchema?: JsonSchema }).inputSchema));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [agentId]);

  const onExecute = async () => {
    setBusy(true);
    setError(null);
    try {
      setResult(await api.execute(agentId, inputs));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onToggle = async () => {
    if (!agent) {
      return;
    }
    setBusy(true);
    try {
      setAgent(agent.enabled ? await api.disable(agent.id) : await api.enable(agent.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onUninstall = async () => {
    setBusy(true);
    try {
      await api.uninstall(agentId);
      window.location.href = prefixRoute(ROUTES.Agents);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  const properties = Object.entries(inputSchema?.properties || {});

  return (
    <PluginPage>
      <Stack direction="column" gap={2}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <div>
            <Link to={prefixRoute(ROUTES.Agents)} className={styles.back}>
              ← Agents
            </Link>
            <h2 className={styles.title}>{agent?.name || agentId}</h2>
            <p className={styles.subtitle}>{agent?.description}</p>
            {agent && (
              <div className={styles.meta}>
                {agent.id} · v{agent.version} · {agent.enabled ? 'enabled' : 'disabled'}
              </div>
            )}
          </div>
          <Stack direction="row" gap={1}>
            <Button variant="secondary" onClick={onToggle} disabled={busy || !agent}>
              {agent?.enabled ? 'Disable' : 'Enable'}
            </Button>
            <Button variant="destructive" onClick={onUninstall} disabled={busy}>
              Uninstall
            </Button>
          </Stack>
        </Stack>

        {error && <Alert title="Error">{error}</Alert>}

        <Card>
          <Card.Heading>Run agent</Card.Heading>
          <Card.Description>
            <Stack direction="column" gap={1}>
              {properties.length > 0 ? (
                properties.map(([key, prop]) => {
                  const required = inputSchema?.required?.includes(key);
                  if (prop.type === 'boolean') {
                    return (
                      <Checkbox
                        key={key}
                        label={`${key}${required ? ' *' : ''}`}
                        description={prop.description}
                        value={Boolean(inputs[key])}
                        onChange={(e) =>
                          setInputs((prev) => ({ ...prev, [key]: e.currentTarget.checked }))
                        }
                      />
                    );
                  }
                  return (
                    <Field
                      key={key}
                      label={`${key}${required ? ' *' : ''}`}
                      description={prop.description}
                    >
                      <Input
                        value={String(inputs[key] ?? '')}
                        type={prop.type === 'number' || prop.type === 'integer' ? 'number' : 'text'}
                        onChange={(e) => {
                          const raw = e.currentTarget.value;
                          setInputs((prev) => ({
                            ...prev,
                            [key]:
                              prop.type === 'number' || prop.type === 'integer'
                                ? Number(raw)
                                : raw,
                          }));
                        }}
                      />
                    </Field>
                  );
                })
              ) : (
                <Field label="Inputs (JSON)">
                  <TextArea
                    rows={6}
                    value={JSON.stringify(inputs, null, 2)}
                    onChange={(e) => {
                      try {
                        setInputs(JSON.parse(e.currentTarget.value));
                      } catch {
                        /* keep typing */
                      }
                    }}
                  />
                </Field>
              )}
              <Button onClick={onExecute} disabled={busy || !agent?.enabled}>
                Execute
              </Button>
            </Stack>
          </Card.Description>
        </Card>

        {result && (
          <Card>
            <Card.Heading>
              Result — <span className={result.status === 'succeeded' ? styles.ok : styles.bad}>{result.status}</span>
            </Card.Heading>
            <Card.Description>
              <div className={styles.meta}>
                run_id: {result.run_id}
                {result.duration_ms != null ? ` · ${result.duration_ms.toFixed(0)} ms` : ''}
              </div>
              {result.error && <Alert title="Error">{result.error}</Alert>}
              <AgentOutputView outputs={result.outputs ?? null} />
              <div className={styles.meta}>
                <Link to={prefixRoute(`${ROUTES.History}/${result.run_id}`)}>View full run details →</Link>
              </div>
            </Card.Description>
          </Card>
        )}
      </Stack>
    </PluginPage>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  back: css`
    color: ${theme.colors.text.secondary};
    text-decoration: none;
    font-size: ${theme.typography.bodySmall.fontSize};
  `,
  title: css`
    margin: ${theme.spacing(0.5)} 0 0;
  `,
  subtitle: css`
    margin: ${theme.spacing(0.5)} 0 0;
    color: ${theme.colors.text.secondary};
  `,
  meta: css`
    margin-top: ${theme.spacing(0.5)};
    color: ${theme.colors.text.secondary};
    font-size: ${theme.typography.bodySmall.fontSize};
  `,
  pre: css`
    background: ${theme.colors.background.secondary};
    padding: ${theme.spacing(1.5)};
    overflow: auto;
    margin-top: ${theme.spacing(1)};
  `,
  ok: css`
    color: ${theme.colors.success.text};
  `,
  bad: css`
    color: ${theme.colors.error.text};
  `,
});
