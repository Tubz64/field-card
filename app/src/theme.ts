// Palette and type from the prototype (index.html :root tokens): a moss-green
// / paper-cream "field notebook". Keep light and dark in sync with it.
import { useColorScheme } from 'react-native';
import type { StatusLevel } from './lib/status';

const light = {
  paper: '#EEE9DC',
  ink: '#22301F',
  moss: '#3F5344',
  mossDark: '#2B3B2C',
  sand: '#DCD3B9',
  line: '#C9BE9E',
  amber: '#B7822E',
  rust: '#A24632',
  good: '#4C6B3E',
  card: '#F7F4EA',
  onMoss: '#FFFFFF',
};

const dark: typeof light = {
  paper: '#1B211A',
  ink: '#E9E4D6',
  moss: '#6E8C63',
  mossDark: '#9FB893',
  sand: '#3A4433',
  line: '#48523F',
  amber: '#D9A552',
  rust: '#D98466',
  good: '#8FBF7C',
  card: '#232B20',
  onMoss: '#FFFFFF',
};

export type Colors = typeof light;

export const fonts = {
  serif: 'Fraunces_500Medium',
  serifBold: 'Fraunces_700Bold',
  sans: 'Inter_400Regular',
  sansMedium: 'Inter_500Medium',
  sansSemiBold: 'Inter_600SemiBold',
};

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}

export function statusColor(colors: Colors, level: StatusLevel): string {
  return { good: colors.good, amber: colors.amber, red: colors.rust, none: colors.line }[level];
}
