// Small shared building blocks so screens stay about content, not styling.
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type TextProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Status } from '../lib/status';
import { fonts, statusColor, useColors } from '../theme';

export function Screen({
  children,
  scroll = true,
  refreshing,
  onRefresh,
}: {
  children: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const colors = useColors();
  const body = <View style={styles.inner}>{children}</View>;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={['bottom', 'left', 'right']}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.moss} />
            ) : undefined
          }
        >
          {body}
        </ScrollView>
      ) : (
        body
      )}
    </SafeAreaView>
  );
}

export function Heading({ children, style, ...rest }: TextProps & { children: ReactNode }) {
  const colors = useColors();
  return (
    <Text style={[styles.heading, { color: colors.ink }, style]} {...rest}>
      {children}
    </Text>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  const colors = useColors();
  return <Text style={[styles.section, { color: colors.mossDark }]}>{children}</Text>;
}

export function Body({ children, style, muted, ...rest }: TextProps & { children: ReactNode; muted?: boolean }) {
  const colors = useColors();
  return (
    <Text style={[styles.body, { color: colors.ink, opacity: muted ? 0.7 : 1 }, style]} {...rest}>
      {children}
    </Text>
  );
}

type ButtonKind = 'primary' | 'secondary' | 'danger';

export function Button({
  title,
  onPress,
  kind = 'primary',
  busy,
  disabled,
}: {
  title: string;
  onPress: () => void;
  kind?: ButtonKind;
  busy?: boolean;
  disabled?: boolean;
}) {
  const colors = useColors();
  const bg = kind === 'primary' ? colors.moss : 'transparent';
  const fg = kind === 'primary' ? colors.onMoss : kind === 'danger' ? colors.rust : colors.moss;
  const border = kind === 'danger' ? colors.rust : colors.moss;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={busy || disabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, borderColor: border, opacity: pressed || disabled ? 0.6 : 1 },
      ]}
    >
      {busy ? <ActivityIndicator color={fg} /> : <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>}
    </Pressable>
  );
}

export function Field({
  label,
  error,
  hint,
  ...input
}: TextInputProps & { label: string; error?: string; hint?: string }) {
  const colors = useColors();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.mossDark }]}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.line}
        style={[
          styles.input,
          { color: colors.ink, backgroundColor: colors.card, borderColor: error ? colors.rust : colors.line },
        ]}
        {...input}
      />
      {error ? (
        <Text style={[styles.hint, { color: colors.rust }]}>{error}</Text>
      ) : hint ? (
        <Text style={[styles.hint, { color: colors.ink, opacity: 0.6 }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

export function Choice<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
}) {
  const colors = useColors();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.mossDark }]}>{label}</Text>
      <View style={styles.choiceRow}>
        {options.map((o) => {
          const active = o === value;
          return (
            <Pressable
              key={o}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              onPress={() => onChange(o)}
              style={[
                styles.choice,
                { borderColor: active ? colors.moss : colors.line, backgroundColor: active ? colors.moss : colors.card },
              ]}
            >
              <Text style={[styles.choiceText, { color: active ? colors.onMoss : colors.ink }]}>{o}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function Card({ children, onPress }: { children: ReactNode; onPress?: () => void }) {
  const colors = useColors();
  const style = [styles.card, { backgroundColor: colors.card, borderColor: colors.line }];
  return onPress ? (
    <Pressable onPress={onPress} style={({ pressed }) => [style, { opacity: pressed ? 0.8 : 1 }]}>
      {children}
    </Pressable>
  ) : (
    <View style={style}>{children}</View>
  );
}

export function Badge({ status }: { status: Status }) {
  const colors = useColors();
  const color = statusColor(colors, status.level);
  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.badgeText, { color: colors.ink }]}>{status.label}</Text>
    </View>
  );
}

export function Banner({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warn' | 'error' }) {
  const colors = useColors();
  const color = tone === 'error' ? colors.rust : tone === 'warn' ? colors.amber : colors.moss;
  return (
    <View style={[styles.banner, { borderColor: color, backgroundColor: colors.card }]}>
      <Text style={[styles.body, { color: colors.ink }]}>{children}</Text>
    </View>
  );
}

export function Loading() {
  const colors = useColors();
  return (
    <View style={[styles.center, { backgroundColor: colors.paper }]}>
      <ActivityIndicator color={colors.moss} />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1 },
  inner: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 20, gap: 14 },
  heading: { fontFamily: fonts.serifBold, fontSize: 28, letterSpacing: -0.2 },
  section: { fontFamily: fonts.serif, fontSize: 18, marginTop: 10 },
  body: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 21 },
  button: { borderWidth: 1.5, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' },
  buttonText: { fontFamily: fonts.sansSemiBold, fontSize: 15 },
  field: { gap: 6 },
  label: { fontFamily: fonts.sansMedium, fontSize: 13 },
  input: { fontFamily: fonts.sans, fontSize: 16, borderWidth: 1.5, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 10 },
  hint: { fontFamily: fonts.sans, fontSize: 12 },
  choiceRow: { flexDirection: 'row', gap: 8 },
  choice: { flex: 1, borderWidth: 1.5, borderRadius: 6, paddingVertical: 9, alignItems: 'center' },
  choiceText: { fontFamily: fonts.sansMedium, fontSize: 13 },
  card: { borderWidth: 1, borderRadius: 10, padding: 14, gap: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  badgeText: { fontFamily: fonts.sansMedium, fontSize: 12 },
  banner: { borderLeftWidth: 4, borderWidth: 1, borderRadius: 6, padding: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
