import { StyleSheet, Text, View } from 'react-native';

import type { WorkDailyLogRevision } from '@/types';

type Props = {
  revisions: WorkDailyLogRevision[];
};

export function DailyLogRevisionHistory({ revisions }: Props) {
  const sorted = [...revisions].sort((a, b) => b.revision_number - a.revision_number);

  return (
    <View>
      {sorted.map((rev) => (
        <View key={rev.id} style={styles.revisionItem}>
          <View style={styles.revisionHeader}>
            <Text style={styles.revisionTitle}>Revisao {rev.revision_number}</Text>
            <Text style={styles.revisionDate}>{formatDateTime(rev.created_at)}</Text>
          </View>
          {rev.rejection_reason ? (
            <Text style={styles.rejectionReason}>Motivo: {rev.rejection_reason}</Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const styles = StyleSheet.create({
  revisionItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e3e8ef',
  },
  revisionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  revisionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1c1f24',
  },
  revisionDate: {
    fontSize: 12,
    color: '#5a6473',
  },
  rejectionReason: {
    marginTop: 4,
    fontSize: 13,
    color: '#7a5b00',
    fontStyle: 'italic',
  },
});
