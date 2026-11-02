import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, Card, Field, Input, Stack, useStyles2 } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';
import { PluginPage } from '@grafana/runtime';
import { css } from '@emotion/css';

import { api, AgentSummary } from '../api/client';
import { prefixRoute } from '../utils/utils.routing';
import { ROUTES } from '../constants';

export default function AgentsPage() {
  const styles = useStyles2(getStyles);
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [installPath, setInstallPath] = useState('/agents/echo-agent');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      setAgents(await api.listAgents());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onInstall = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.installFromPath(installPath);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PluginPage>
      <Stack direction="column" gap={2}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <div>
            <h2 className={styles.title}>Agents</h2>
            <p className={styles.subtitle}>Inventory of installed agents and one-click install.</p>
          </div>
          <Button variant="secondary" onClick={refresh} disabled={busy}>
            Refresh
          </Button>
        </Stack>

        {error && <Alert title="Error">{error}</Alert>}

        <Card>
          <Card.Heading>Install agent</Card.Heading>
          <Card.Description>
            <p className={styles.subtitle}>
              Path is inside the API container. The sample package is mounted at{' '}
              <code>/agents/echo-agent</code>.
            </p>
            <Stack direction="row" gap={1}>
              <Field label="Package path" className={styles.grow}>
                <Input value={installPath} onChange={(e) => setInstallPath(e.currentTarget.value)} />
              </Field>
              <div className={styles.installBtn}>
                <Button onClick={onInstall} disabled={busy}>
                  Install
                </Button>
              </div>
            </Stack>
          </Card.Description>
        </Card>

        <div className={styles.grid}>
          {agents.map((a) => (
            <Card key={a.id}>
              <Card.Heading>{a.name}</Card.Heading>
              <Card.Meta>
                {a.id} · v{a.version} · {a.enabled ? 'enabled' : 'disabled'}
              </Card.Meta>
              <Card.Description>{a.description || 'No description'}</Card.Description>
              <Card.Actions>
                <Link to={prefixRoute(`${ROUTES.Agents}/${a.id}`)}>
                  <Button>Open & run</Button>
                </Link>
              </Card.Actions>
            </Card>
          ))}
          {agents.length === 0 && !error && (
            <Card>
              <Card.Heading>No agents installed</Card.Heading>
              <Card.Description>Install `/agents/echo-agent` above to get started.</Card.Description>
            </Card>
          )}
        </div>
      </Stack>
    </PluginPage>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  title: css`
    margin: 0;
  `,
  subtitle: css`
    margin: ${theme.spacing(0.5)} 0 ${theme.spacing(1)};
    color: ${theme.colors.text.secondary};
  `,
  grow: css`
    flex: 1;
  `,
  installBtn: css`
    display: flex;
    align-items: flex-end;
    padding-bottom: ${theme.spacing(2)};
  `,
  grid: css`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: ${theme.spacing(2)};
  `,
});
