import React, { useState } from 'react';
import { Button, Stack, useStyles2 } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';

type Props = {
  outputs: unknown;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isAwsCostShape(value: Record<string, unknown>): boolean {
  return (
    typeof value.total_cost === 'number' &&
    (Array.isArray(value.cost_by_service) || Array.isArray(value.resources))
  );
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 4,
    }).format(amount);
  } catch {
    return `${amount} ${currency || 'USD'}`;
  }
}

function ObjectTable({ rows }: { rows: Record<string, unknown>[] }) {
  const styles = useStyles2(getStyles);
  if (rows.length === 0) {
    return <p className={styles.muted}>No rows.</p>;
  }
  const columns = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((k) => set.add(k));
      return set;
    }, new Set<string>())
  );
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={col}>{col}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, idx) => (
          <tr key={idx}>
            {columns.map((col) => (
              <td key={col}>
                {typeof row[col] === 'object' ? JSON.stringify(row[col]) : String(row[col] ?? '—')}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function AwsCostView({ data }: { data: Record<string, unknown> }) {
  const styles = useStyles2(getStyles);
  const currency = typeof data.currency === 'string' ? data.currency : 'USD';
  const total = typeof data.total_cost === 'number' ? data.total_cost : 0;
  const period = isPlainObject(data.period) ? data.period : null;
  const services = Array.isArray(data.cost_by_service)
    ? (data.cost_by_service as Record<string, unknown>[])
    : [];
  const usageTypes = Array.isArray(data.cost_by_usage)
    ? (data.cost_by_usage as Record<string, unknown>[])
    : [];
  const resources = Array.isArray(data.resources)
    ? (data.resources as Record<string, unknown>[])
    : [];
  return (
    <Stack direction="column" gap={2}>
      <div className={styles.hero}>
        <div className={styles.heroLabel}>Total cost</div>
        <div className={styles.heroValue}>{formatMoney(total, currency)}</div>
        {period && (
          <div className={styles.muted}>
            Period {String(period.start ?? '—')} → {String(period.end ?? '—')}
            {period.resources_start
              ? ` · resources from ${String(period.resources_start)}`
              : ''}
            {data.profile ? ` · profile ${String(data.profile)}` : ''}
            {data.region ? ` · ${String(data.region)}` : ''}
          </div>
        )}
      </div>

      {services.length > 0 && (
        <div>
          <h4 className={styles.sectionTitle}>Cost by service</h4>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Service</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {services.map((row, idx) => (
                <tr key={idx}>
                  <td>{String(row.service ?? '—')}</td>
                  <td className={styles.mono}>
                    {formatMoney(Number(row.amount ?? 0), currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {usageTypes.length > 0 && (
        <div>
          <h4 className={styles.sectionTitle}>Cost by usage type</h4>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Amount</th>
                <th>Usage type</th>
              </tr>
            </thead>
            <tbody>
              {usageTypes.map((row, idx) => (
                <tr key={idx}>
                  <td className={styles.mono}>
                    {formatMoney(Number(row.amount ?? 0), currency)}
                  </td>
                  <td className={styles.mono}>{String(row.usage_type ?? '—')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {resources.length > 0 && (
        <div>
          <h4 className={styles.sectionTitle}>Cost by resource</h4>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Amount</th>
                <th>Service</th>
                <th>Resource</th>
              </tr>
            </thead>
            <tbody>
              {resources.map((row, idx) => (
                <tr key={idx}>
                  <td className={styles.mono}>
                    {formatMoney(Number(row.amount ?? 0), currency)}
                  </td>
                  <td>{String(row.service || '—')}</td>
                  <td className={styles.mono}>
                    {String(row.resource_id ?? row.arn ?? '—')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Stack>
  );
}

function GenericObjectView({ data }: { data: Record<string, unknown> }) {
  const styles = useStyles2(getStyles);
  const scalars: [string, unknown][] = [];
  const tables: [string, Record<string, unknown>[]][] = [];
  const other: [string, unknown][] = [];

  for (const [key, value] of Object.entries(data)) {
    if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
      scalars.push([key, value]);
    } else if (
      Array.isArray(value) &&
      value.every((item) => isPlainObject(item))
    ) {
      tables.push([key, value as Record<string, unknown>[]]);
    } else {
      other.push([key, value]);
    }
  }

  return (
    <Stack direction="column" gap={2}>
      {scalars.length > 0 && (
        <table className={styles.metaTable}>
          <tbody>
            {scalars.map(([key, value]) => (
              <tr key={key}>
                <th>{key}</th>
                <td>{value === null ? '—' : String(value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {tables.map(([key, rows]) => (
        <div key={key}>
          <h4 className={styles.sectionTitle}>{key}</h4>
          <ObjectTable rows={rows} />
        </div>
      ))}
      {other.map(([key, value]) => (
        <div key={key}>
          <h4 className={styles.sectionTitle}>{key}</h4>
          <pre className={styles.pre}>{JSON.stringify(value, null, 2)}</pre>
        </div>
      ))}
    </Stack>
  );
}

export function AgentOutputView({ outputs }: Props) {
  const styles = useStyles2(getStyles);
  const [showRaw, setShowRaw] = useState(false);

  if (outputs == null) {
    return <p className={styles.muted}>No outputs.</p>;
  }

  let body: React.ReactNode;
  if (isPlainObject(outputs) && isAwsCostShape(outputs)) {
    body = <AwsCostView data={outputs} />;
  } else if (isPlainObject(outputs)) {
    body = <GenericObjectView data={outputs} />;
  } else if (Array.isArray(outputs) && outputs.every(isPlainObject)) {
    body = <ObjectTable rows={outputs as Record<string, unknown>[]} />;
  } else {
    body = <pre className={styles.pre}>{JSON.stringify(outputs, null, 2)}</pre>;
  }

  return (
    <Stack direction="column" gap={2}>
      {body}
      <div>
        <Button
          variant="secondary"
          size="sm"
          fill="text"
          onClick={() => setShowRaw((v) => !v)}
        >
          {showRaw ? 'Hide raw JSON' : 'Show raw JSON'}
        </Button>
        {showRaw && <pre className={styles.pre}>{JSON.stringify(outputs, null, 2)}</pre>}
      </div>
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  hero: css`
    padding: ${theme.spacing(2)};
    background: ${theme.colors.background.secondary};
    border-radius: ${theme.shape.radius.default};
  `,
  heroLabel: css`
    color: ${theme.colors.text.secondary};
    font-size: ${theme.typography.bodySmall.fontSize};
    text-transform: uppercase;
    letter-spacing: 0.04em;
  `,
  heroValue: css`
    font-size: ${theme.typography.h2.fontSize};
    font-weight: ${theme.typography.h2.fontWeight};
    margin-top: ${theme.spacing(0.5)};
  `,
  sectionTitle: css`
    margin: 0 0 ${theme.spacing(1)};
    font-size: ${theme.typography.h5.fontSize};
  `,
  table: css`
    width: 100%;
    border-collapse: collapse;
    th,
    td {
      text-align: left;
      padding: ${theme.spacing(0.75)} ${theme.spacing(1)};
      border-bottom: 1px solid ${theme.colors.border.weak};
      vertical-align: top;
    }
    th {
      color: ${theme.colors.text.secondary};
      font-weight: ${theme.typography.fontWeightMedium};
    }
  `,
  metaTable: css`
    width: 100%;
    th {
      text-align: left;
      width: 160px;
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
    word-break: break-all;
  `,
  muted: css`
    color: ${theme.colors.text.secondary};
    font-size: ${theme.typography.bodySmall.fontSize};
    margin: ${theme.spacing(0.5)} 0 0;
  `,
  pre: css`
    background: ${theme.colors.background.secondary};
    padding: ${theme.spacing(1.5)};
    overflow: auto;
    margin: ${theme.spacing(1)} 0 0;
  `,
});
