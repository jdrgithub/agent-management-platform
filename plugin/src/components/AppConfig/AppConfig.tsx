import React, { ChangeEvent, useState } from 'react';
import { lastValueFrom } from 'rxjs';
import { css } from '@emotion/css';
import { AppPluginMeta, GrafanaTheme2, PluginConfigPageProps, PluginMeta } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { Button, Field, FieldSet, Input, useStyles2 } from '@grafana/ui';
import { testIds } from '../testIds';

type AppPluginSettings = {
  apiUrl?: string;
  apiToken?: string;
};

type State = {
  apiUrl: string;
  apiToken: string;
};

export interface AppConfigProps extends PluginConfigPageProps<AppPluginMeta<AppPluginSettings>> {}

const AppConfig = ({ plugin }: AppConfigProps) => {
  const s = useStyles2(getStyles);
  const { enabled, pinned, jsonData } = plugin.meta;
  const [state, setState] = useState<State>({
    apiUrl: jsonData?.apiUrl || `${window.location.protocol}//${window.location.hostname}:8081`,
    apiToken: jsonData?.apiToken || '',
  });

  const isSubmitDisabled = Boolean(!state.apiUrl || !state.apiToken);

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    setState({
      ...state,
      [event.target.name]: event.target.value.trim(),
    });
  };

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitDisabled) {
      return;
    }

    updatePluginAndReload(plugin.meta.id, {
      enabled,
      pinned,
      jsonData: {
        apiUrl: state.apiUrl,
        // Stored in jsonData so the browser UI can call the standalone API.
        // For untrusted multi-tenant Grafana, add a plugin backend proxy later.
        apiToken: state.apiToken,
      },
    });
  };

  return (
    <form onSubmit={onSubmit}>
      <FieldSet label="Connect to the platform API">
        <p>
          This page only stores connection settings. After saving, open the app from the Grafana left
          nav under <strong>Apps → Agent Manager → Overview</strong> (or go to{' '}
          <code>/a/amp-agent-manager-app/overview</code>).
        </p>
        <Field
          label="API URL"
          description="Must be reachable from YOUR browser (not from inside the Grafana container). If you open Grafana via an IP, use that same host with port 8081."
        >
          <Input
            width={60}
            name="apiUrl"
            id="config-api-url"
            data-testid={testIds.appConfig.apiUrl}
            value={state.apiUrl}
            placeholder="http://192.168.1.178:8081"
            onChange={onChange}
          />
        </Field>

        <Field
          label="API Token"
          description="Must match API_TOKEN from the platform .env"
          className={s.marginTop}
        >
          <Input
            width={60}
            name="apiToken"
            id="config-api-token"
            type="password"
            value={state.apiToken}
            placeholder="API token"
            onChange={onChange}
          />
        </Field>

        <div className={s.marginTop}>
          <Button type="submit" data-testid={testIds.appConfig.submit} disabled={isSubmitDisabled}>
            Save settings
          </Button>
        </div>
      </FieldSet>
    </form>
  );
};

export default AppConfig;

const getStyles = (theme: GrafanaTheme2) => ({
  marginTop: css`
    margin-top: ${theme.spacing(3)};
  `,
});

const updatePluginAndReload = async (pluginId: string, data: Partial<PluginMeta<AppPluginSettings>>) => {
  try {
    await updatePlugin(pluginId, data);
    window.location.reload();
  } catch (e) {
    console.error('Error while updating the plugin', e);
  }
};

const updatePlugin = async (pluginId: string, data: Partial<PluginMeta>) => {
  const response = await getBackendSrv().fetch({
    url: `/api/plugins/${pluginId}/settings`,
    method: 'POST',
    data,
  });

  return lastValueFrom(response);
};
