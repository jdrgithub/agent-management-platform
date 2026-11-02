import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert, Card, Stack, useStyles2 } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';
import { PluginPage } from '@grafana/runtime';
import { css } from '@emotion/css';

import { api, ExecutionDetail } from '../api/client';
import { AgentOutputView } from '../components/AgentOutputView';
import { prefixRoute } from '../utils/utils.routing';
import { ROUTES } from '../constants';

export default function RunDetailPage() {
  const { runId = '' } = useParams();
  const styles = useStyles2(getStyles);
  const [run, setRun] = useState<ExecutionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setRun(await api.getExecution(runId));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [runId]);

  return (
    <PluginPage>
      <Stack direction="column" gap={2}>
        <div>
          <Link to={prefixRoute(ROUTES.History)} className={styles.back}>
            ← History
          </Link>
          <h2 className={styles.title}>Run detail</h2>
          <p className={styles.subtitle}>Inputs, outputs, and platform execution steps.</p>
        </div>

        {error && <Alert title="Error">{error}</Alert>}

        {run && (
          <>
            <Card>
              <Card.Heading>
                Status —{' '}
                <span className={run.status === 'succeeded' ? styles.ok : styles.bad}>{run.status}</span>
              </Card.Heading>
              <Card.Description>
                <table className={styles.metaTable}>
                  <tbody>
                    <tr>
                      <th>Agent</th>
                      <td>
                        <Link to={prefixRoute(`${ROUTES.Agents}/${run.agent_id}`)}>
                          {run.agent_id}@{run.agent_version}
                        </Link>
                      </td>
                    </tr>
                    <tr>
                      <th>Run ID</th>
                      <td className={styles.mono}>{run.run_id}</td>
                    </tr>
                    <tr>
                      <th>Created</th>
                      <td>{new Date(run.created_at).toLocaleString()}</td>
                    </tr>
                    <tr>
                      <th>Started</th>
                      <td>{run.started_at ? new Date(run.started_at).toLocaleString() : '—'}</td>
                    </tr>
                    <tr>
                      <th>Finished</th>
                      <td>{run.finished_at ? new Date(run.finished_at).toLocaleString() : '—'}</td>
                    </tr>
                    <tr>
                      <th>Duration</th>
                      <td>{run.duration_ms != null ? `${run.duration_ms.toFixed(0)} ms` : '—'}</td>
                    </tr>
                    <tr>
                      <th>Task success</th>
                      <td>{String(run.task_success)}</td>
                    </tr>
                  </tbody>
                </table>
              </Card.Description>
            </Card>

            <Card>
              <Card.Heading>Steps</Card.Heading>
              <Card.Description>
                {(run.steps || []).length === 0 ? (
                  <p className={styles.subtitle}>
                    No step timeline recorded for this run (older executions before step tracking).
                  </p>
                ) : (
                  <ol className={styles.steps}>
                    {(run.steps || []).map((s, idx) => (
                      <li key={`${s.ts}-${s.name}-${idx}`} className={styles.step}>
                        <div className={styles.stepHeader}>
                          <strong>{s.name}</strong>
                          <span className={s.status === 'error' ? styles.bad : styles.ok}>{s.status}</span>
                          <span className={styles.muted}>{new Date(s.ts).toLocaleString()}</span>
                        </div>
                        {s.detail && <div className={styles.stepDetail}>{s.detail}</div>}
                      </li>
                    ))}
                  </ol>
                )}
              </Card.Description>
            </Card>

            <Card>
              <Card.Heading>Inputs</Card.Heading>
              <Card.Description>
                <pre className={styles.pre}>{JSON.stringify(run.inputs ?? {}, null, 2)}</pre>
              </Card.Description>
            </Card>

            <Card>
              <Card.Heading>Outputs</Card.Heading>
              <Card.Description>
                {run.error && <Alert title="Error">{run.error}</Alert>}
                <AgentOutputView outputs={run.outputs ?? null} />
              </Card.Description>
            </Card>
          </>
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
  metaTable: css`
    width: 100%;
    th {
      text-align: left;
      width: 140px;
      color: ${theme.colors.text.secondary};
      padding: ${theme.spacing(0.5)} ${theme.spacing(1)} ${theme.spacing(0.5)} 0;
      vertical-align: top;
    }
    td {
      padding: ${theme.spacing(0.5)} 0;
    }
  `,
  mono: css`
    font-family: ${theme.typography.fontFamilyMonospace};
    font-size: ${theme.typography.bodySmall.fontSize};
  `,
  steps: css`
    margin: 0;
    padding-left: ${theme.spacing(2.5)};
  `,
  step: css`
    margin-bottom: ${theme.spacing(1.5)};
  `,
  stepHeader: css`
    display: flex;
    gap: ${theme.spacing(1.5)};
    align-items: baseline;
    flex-wrap: wrap;
  `,
  stepDetail: css`
    margin-top: ${theme.spacing(0.5)};
    color: ${theme.colors.text.secondary};
    font-family: ${theme.typography.fontFamilyMonospace};
    font-size: ${theme.typography.bodySmall.fontSize};
  `,
  muted: css`
    color: ${theme.colors.text.secondary};
    font-size: ${theme.typography.bodySmall.fontSize};
  `,
  pre: css`
    background: ${theme.colors.background.secondary};
    padding: ${theme.spacing(1.5)};
    overflow: auto;
    margin: 0;
  `,
  ok: css`
    color: ${theme.colors.success.text};
  `,
  bad: css`
    color: ${theme.colors.error.text};
  `,
});
