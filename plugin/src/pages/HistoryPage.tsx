import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, Card, Stack, useStyles2 } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';
import { PluginPage } from '@grafana/runtime';
import { css } from '@emotion/css';

import { api, ExecutionSummary } from '../api/client';
import { prefixRoute } from '../utils/utils.routing';
import { ROUTES } from '../constants';

export default function HistoryPage() {
  const styles = useStyles2(getStyles);
  const [rows, setRows] = useState<ExecutionSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      setRows(await api.listExecutions());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <PluginPage>
      <Stack direction="column" gap={2}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <div>
            <h2 className={styles.title}>Execution history</h2>
            <p className={styles.subtitle}>Click a run to inspect inputs, outputs, and steps.</p>
          </div>
          <Button variant="secondary" onClick={refresh}>
            Refresh
          </Button>
        </Stack>
        {error && <Alert title="Error">{error}</Alert>}
        <Card>
          <Card.Description>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Agent</th>
                  <th>Status</th>
                  <th>Task success</th>
                  <th>Duration</th>
                  <th>Run</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.run_id}>
                    <td>{new Date(r.created_at).toLocaleString()}</td>
                    <td>
                      {r.agent_id}@{r.agent_version}
                    </td>
                    <td>
                      <span className={r.status === 'succeeded' ? styles.ok : styles.bad}>{r.status}</span>
                    </td>
                    <td>{String(r.task_success)}</td>
                    <td>{r.duration_ms != null ? `${r.duration_ms.toFixed(0)} ms` : '—'}</td>
                    <td>
                      <Link to={prefixRoute(`${ROUTES.History}/${r.run_id}`)}>View details</Link>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6}>No executions yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
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
  ok: css`
    color: ${theme.colors.success.text};
  `,
  bad: css`
    color: ${theme.colors.error.text};
  `,
});
