import { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getSignedUrls } from '@/lib/supabase/storage';
import { getStatusColor, getStatusLabel } from '@/lib/daily-log/local-pending';
import type { WorkDailyLog, WorkDailyLogRevision, WorkDailyLogMedia } from '@/types';

import { DailyLogRevisionHistory } from './DailyLogRevisionHistory';

type Props = {
  log: WorkDailyLog;
  revisions: WorkDailyLogRevision[];
  approverName?: string | null;
};

export function DailyLogReadOnly({ log, revisions, approverName }: Props) {
  const current = revisions.find((r) => r.id === log.current_revision_id) ?? revisions[0];
  if (!current) return null;

  const statusColor = getStatusColor(log.status);

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      {/* Status banner */}
      <View style={[styles.banner, { backgroundColor: statusColor.bg }]}>
        <Text style={[styles.bannerText, { color: statusColor.fg }]}>
          {log.status === 'approved' && log.approved_at
            ? `Aprovado em ${formatDateShort(log.approved_at)}${approverName ? ` por ${approverName}` : ''}`
            : log.status === 'pending_approval'
              ? 'Aguardando aprovacao do engenheiro'
              : getStatusLabel(log.status)}
        </Text>
      </View>

      {/* Atividades */}
      <Section title="Atividades">
        <Text style={styles.bodyText}>{current.activities}</Text>
      </Section>

      {/* Equipe presente */}
      <Section title="Equipe presente">
        {current.crew_present.map((name, i) => (
          <Text key={i} style={styles.bodyText}>
            {name}
          </Text>
        ))}
      </Section>

      {/* Postes instalados */}
      <Section title="Postes instalados">
        <Text style={styles.bodyText}>{current.posts_installed_count}</Text>
      </Section>

      {/* Metragem */}
      {current.meters_installed ? (
        <Section title="Metragem instalada">
          <View style={styles.metersRow}>
            <MeterBadge label="BT" value={current.meters_installed.BT} />
            <MeterBadge label="MT" value={current.meters_installed.MT} />
            <MeterBadge label="Rede" value={current.meters_installed.rede} />
          </View>
        </Section>
      ) : null}

      {/* Materiais */}
      {current.materials_consumed && current.materials_consumed.length > 0 ? (
        <Section title="Materiais consumidos">
          {current.materials_consumed.map((m, i) => (
            <Text key={i} style={styles.bodyText}>
              {m.name}: {m.quantity} {m.unit}
            </Text>
          ))}
        </Section>
      ) : null}

      {/* Incidentes */}
      {current.incidents ? (
        <Section title="Incidentes">
          <Text style={styles.bodyText}>{current.incidents}</Text>
        </Section>
      ) : null}

      {/* Fotos */}
      <MediaGallery media={current.work_daily_log_media ?? []} />

      {/* Historico de revisoes */}
      {revisions.length > 0 ? (
        <Section title="Historico de revisoes">
          <DailyLogRevisionHistory revisions={revisions} />
        </Section>
      ) : null}

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function MeterBadge({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.meterBadge}>
      <Text style={styles.meterLabel}>{label}</Text>
      <Text style={styles.meterValue}>{value}m</Text>
    </View>
  );
}

function MediaGallery({ media }: { media: WorkDailyLogMedia[] }) {
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    if (media.length === 0) return;
    const paths = media.map((m) => m.storage_path);
    void getSignedUrls(paths).then(setUrls).catch(() => {});
  }, [media]);

  if (media.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Fotos</Text>
      <View style={styles.photoGrid}>
        {media.map((m) => {
          const url = urls[m.storage_path];
          return url ? (
            <Image key={m.id} source={{ uri: url }} style={styles.photoThumb} />
          ) : (
            <View key={m.id} style={styles.photoPlaceholder}>
              <Text style={styles.photoPlaceholderText}>...</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function formatDateShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: 16,
    paddingBottom: 48,
  },
  banner: {
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  bannerText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#5a6473',
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingHorizontal: 4,
    letterSpacing: 0.5,
  },
  sectionBody: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e3e8ef',
  },
  bodyText: {
    color: '#1c1f24',
    fontSize: 14,
    lineHeight: 20,
  },
  metersRow: {
    flexDirection: 'row',
    gap: 12,
  },
  meterBadge: {
    flex: 1,
    backgroundColor: '#e3effc',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  meterLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5a6473',
  },
  meterValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0a3a82',
    marginTop: 2,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoThumb: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  photoPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 8,
    backgroundColor: '#e3e8ef',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholderText: {
    color: '#5a6473',
    fontSize: 12,
  },
  bottomSpacer: {
    height: 40,
  },
});
