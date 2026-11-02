import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, Card, Stack, useStyles2 } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';
import { PluginPage } from '@grafana/runtime';
import { css } from '@emotion/css';

import { api, AgentSummary, ExecutionSummary } from '../api/client';
import { prefixRoute } from '../utils/utils.routing';
import { ROUTES } from '../constants';

export default function OverviewPage() {
  const styles = useStyles2(getStyles);
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [runs, setRuns] = useState<ExecutionSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [a, r] = await Promise.all([api.listAgents(), api.listExecutions()]);
      setAgents(a);
      setRuns(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const stats = useMemo(() => {
    const enabled = agents.filter((a) => a.enabled).length;
    const succeeded = runs.filter((r) => r.status === 'succeeded').length;
    const failed = runs.filter((r) => r.status === 'failed').length;
    return {
      agents: agents.length,
      enabled,
      runs: runs.length,
      succeeded,
      failed,
      successRate: runs.length ? Math.round((succeeded / runs.length) * 100) : 0,
    };
  }, [agents, runs]);

  return (
    <PluginPage>
      <Stack direction="column" gap={2}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <div>
            <h2 className={styles.title}>Agent Manager</h2>
            <p className={styles.subtitle}>Install, run, and monitor agents from Grafana.</p>
          </div>
          <Stack direction="row" gap={1}>
            <Button variant="secondary" onClick={refresh} disabled={loading}>
              Refresh
            </Button>
            <Link to={prefixRoute(ROUTES.Agents)}>
              <Button>Manage agents</Button>
            </Link>
          </Stack>
        </Stack>

        {error && (
          <Alert title="Cannot reach the Agent Management API" severity="error">
            {error}
            <div className={styles.hint}>
              Open <strong>Configuration</strong> (plugin settings) and set API URL to the host you
              use in the browser (e.g. <code>http://192.168.1.178:8081</code>) plus your API token.
              Then return here.
            </div>
          </Alert>
        )}

        <div className={styles.statGrid}>
          <Card className={styles.statCard}>
            <Card.Heading>Installed agents</Card.Heading>
            <Card.Description>
              <div className={styles.statValue}>{stats.agents}</div>
              <div className={styles.statMeta}>{stats.enabled} enabled</div>
            </Card.Description>
          </Card>
          <Card className={styles.statCard}>
            <Card.Heading>Recent runs</Card.Heading>
            <Card.Description>
              <div className={styles.statValue}>{stats.runs}</div>
              <div className={styles.statMeta}>
                {stats.succeeded} ok · {stats.failed} failed
              </div>
            </Card.Description>
          </Card>
          <Card className={styles.statCard}>
            <Card.Heading>Success rate</Card.Heading>
            <Card.Description>
              <div className={styles.statValue}>{stats.successRate}%</div>
              <div className={styles.statMeta}>of listed executions</div>
            </Card.Description>
          </Card>
        </div>

        <Card>
          <Card.Heading>Installed agents</Card.Heading>
          <Card.Description>
            {agents.length === 0 && !error ? (
              <p>
                No agents yet.{' '}
                <Link to={prefixRoute(ROUTES.Agents)}>Install the echo-agent</Link> to smoke-test the
                platform.
              </p>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Version</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {agents.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <div className={styles.agentName}>{a.name}</div>
                        <div className={styles.muted}>{a.id}</div>
                      </td>
                      <td>{a.version}</td>
                      <td>{a.enabled ? 'Enabled' : 'Disabled'}</td>
                      <td>
                        <Link to={prefixRoute(`${ROUTES.Agents}/${a.id}`)}>
                          <Button size="sm" variant="secondary">
                            Open
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card.Description>
        </Card>

        <Card>
          <Card.Heading>Latest executions</Card.Heading>
          <Card.Description>
            {runs.length === 0 && !error ? (
              <p>No runs yet. Open an agent and click Execute.</p>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Agent</th>
                    <th>Status</th>
                    <th>Duration</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {runs.slice(0, 8).map((r) => (
                    <tr key={r.run_id}>
                      <td>{new Date(r.created_at).toLocaleString()}</td>
                      <td>
                        {r.agent_id}@{r.agent_version}
                      </td>
                      <td>
                        <span className={r.status === 'succeeded' ? styles.ok : styles.bad}>{r.status}</span>
                      </td>
                      <td>{r.duration_ms != null ? `${r.duration_ms.toFixed(0)} ms` : '—'}</td>
                      <td>
                        <Link to={prefixRoute(`${ROUTES.History}/${r.run_id}`)}>Details</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className={styles.footerLink}>
              <Link to={prefixRoute(ROUTES.History)}>View full history →</Link>
            </div>
          </Card.Description>
        </Card>
      </Stack>
    </PluginPage>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  title: css`
    margin: 0;
  `,
  subtitle: css`
    margin: ${theme.spacing(0.5)} 0 0;
    color: ${theme.colors.text.secondary};
  `,
  hint: css`
    margin-top: ${theme.spacing(1)};
  `,
  statGrid: css`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: ${theme.spacing(2)};
  `,
  statCard: css`
    min-height: 110px;
  `,
  statValue: css`
    font-size: 28px;
    font-weight: 600;
    margin-top: ${theme.spacing(1)};
  `,
  statMeta: css`
    color: ${theme.colors.text.secondary};
    margin-top: ${theme.spacing(0.5)};
  `,
  table: css`
    width: 100%;
    border-collapse: collapse;
    th,
    td {
      text-align: left;
      padding: ${theme.spacing(1)};
      border-bottom: 1px solid ${theme.colors.border.weak};
    }
  `,
  agentName: css`
    font-weight: 600;
  `,
  muted: css`
    color: ${theme.colors.text.secondary};
    font-size: ${theme.typography.bodySmall.fontSize};
  `,
  ok: css`
    color: ${theme.colors.success.text};
  `,
  bad: css`
    color: ${theme.colors.error.text};
  `,
  footerLink: css`
    margin-top: ${theme.spacing(1.5)};
  `,
});
