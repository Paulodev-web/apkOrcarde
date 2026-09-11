'use client';

import { Audio, ResizeMode, Video } from 'expo-av';
import { Pause, Play } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/design-system/primitives/Text';
import { colors } from '@/design-system/tokens/colors';
import { radius } from '@/design-system/tokens/radius';
import { spacing } from '@/design-system/tokens/spacing';

/**
 * Áudio e vídeo do chat, tocáveis.
 *
 * Até aqui o app mostrava a palavra "Audio (12s)" e nada acontecia ao tocar
 * nela: o engenheiro gravava um recado de voz, que é a forma mais rápida de
 * explicar coisa de obra, e o gerente simplesmente não conseguia ouvir.
 * `expo-av` já era dependência do projeto e não era usado.
 */

function formataTempo(segundos: number | null | undefined): string {
  if (!segundos || !Number.isFinite(segundos)) return '';
  const s = Math.round(segundos);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function ChatAudioPlayer({
  url,
  durationSeconds,
}: {
  url: string | null;
  durationSeconds?: number | null;
}) {
  const som = useRef<Audio.Sound | null>(null);
  const [tocando, setTocando] = useState(false);
  const [carregando, setCarregando] = useState(false);

  // Descarregar ao sair é obrigatório: som que fica carregado segura áudio do
  // aparelho e o próximo play não sai.
  useEffect(() => {
    return () => {
      void som.current?.unloadAsync();
      som.current = null;
    };
  }, []);

  const alternar = useCallback(async () => {
    if (!url) return;
    try {
      if (som.current) {
        const estado = await som.current.getStatusAsync();
        if (estado.isLoaded && estado.isPlaying) {
          await som.current.pauseAsync();
          setTocando(false);
          return;
        }
        await som.current.playAsync();
        setTocando(true);
        return;
      }

      setCarregando(true);
      const { sound } = await Audio.Sound.createAsync({ uri: url }, { shouldPlay: true });
      som.current = sound;
      setTocando(true);
      sound.setOnPlaybackStatusUpdate((estado) => {
        if (!estado.isLoaded) return;
        if (estado.didJustFinish) {
          setTocando(false);
          void sound.setPositionAsync(0);
        }
      });
    } catch {
      setTocando(false);
    } finally {
      setCarregando(false);
    }
  }, [url]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={tocando ? 'Pausar áudio' : 'Ouvir áudio'}
      onPress={() => void alternar()}
      disabled={!url}
      style={styles.audio}
    >
      <View style={styles.botao}>
        {carregando ? (
          <ActivityIndicator size="small" color={colors.textInverse} />
        ) : tocando ? (
          <Pause size={16} color={colors.textInverse} fill={colors.textInverse} />
        ) : (
          <Play size={16} color={colors.textInverse} fill={colors.textInverse} />
        )}
      </View>
      <Text variant="captionBold" color="textSecondary">
        {url ? formataTempo(durationSeconds) || 'Áudio' : 'Carregando…'}
      </Text>
    </Pressable>
  );
}

export function ChatVideoPlayer({ url }: { url: string | null }) {
  if (!url) {
    return (
      <View style={styles.videoVazio}>
        <Text variant="caption" color="textMuted">
          Carregando vídeo…
        </Text>
      </View>
    );
  }
  return (
    <Video
      source={{ uri: url }}
      style={styles.video}
      useNativeControls
      resizeMode={ResizeMode.CONTAIN}
      isLooping={false}
    />
  );
}

const styles = StyleSheet.create({
  audio: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceSunken,
    borderRadius: radius.md,
    minHeight: 48,
  },
  botao: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  video: { width: 220, height: 160, borderRadius: radius.md, backgroundColor: '#000' },
  videoVazio: {
    width: 220,
    height: 160,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
