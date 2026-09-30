import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatUkDateInput, isoToUk, ukToIso } from '../lib/format';
import { passwordRules } from '../lib/password';
import { fonts, useColors } from '../theme';
import { Field } from './ui';

/**
 * Date input shown as DD-MM-YYYY (dashes added while typing). Reports the
 * value as YYYY-MM-DD, "" when empty, or null while incomplete/invalid.
 */
export function DateField({
  label,
  initialIso,
  onChange,
  error,
  hint,
  optional,
}: {
  label: string;
  initialIso?: string | null;
  onChange: (iso: string | null) => void;
  error?: string;
  hint?: string;
  optional?: boolean;
}) {
  const [text, setText] = useState(isoToUk(initialIso));
  return (
    <Field
      label={label}
      value={text}
      onChangeText={(raw) => {
        const formatted = formatUkDateInput(raw);
        setText(formatted);
        onChange(formatted === '' ? '' : ukToIso(formatted));
      }}
      placeholder={optional ? 'DD-MM-YYYY (optional)' : 'DD-MM-YYYY'}
      keyboardType="number-pad"
      maxLength={10}
      error={error}
      hint={hint}
    />
  );
}

/** Password input with the policy shown as a live checklist underneath. */
export function PasswordField({
  label = 'Password',
  value,
  onChangeText,
  isNew = true,
}: {
  label?: string;
  value: string;
  onChangeText: (v: string) => void;
  isNew?: boolean;
}) {
  const colors = useColors();
  return (
    <View style={styles.wrap}>
      <Field
        label={label}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry
        autoCapitalize="none"
        autoComplete={isNew ? 'new-password' : 'current-password'}
        textContentType={isNew ? 'newPassword' : 'password'}
        maxLength={256}
      />
      {isNew ? (
        <View style={styles.rules}>
          {passwordRules(value).map((rule) => (
            <Text key={rule.label} style={[styles.rule, { color: rule.met ? colors.good : colors.ink, opacity: rule.met ? 1 : 0.6 }]}>
              {rule.met ? '✓' : '○'} {rule.label}
            </Text>
          ))}
          <Text style={[styles.rule, { color: colors.ink, opacity: 0.6 }]}>
            Capitals, symbols and spaces are allowed but not required.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  rules: { gap: 2 },
  rule: { fontFamily: fonts.sans, fontSize: 12 },
});
