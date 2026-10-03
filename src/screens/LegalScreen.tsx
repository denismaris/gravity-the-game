import React, { useMemo, useState } from 'react';
import { FlatList, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale } from '../components';
import { LegalDocument, privacyPolicy, termsOfUse } from '../legal/documents';
import { theme, themedStyles } from '../theme';

export type LegalDoc = 'privacy' | 'terms' | 'licenses';

interface Licence {
  readonly name: string;
  readonly version: string;
  readonly license: string;
  readonly text: string;
}

/** Loaded on first open only: the licence texts are a few hundred KB. */
function licences(): ReadonlyArray<Licence> {
  return require('../legal/licenses.generated.json') as Licence[];
}

/**
 * The privacy policy, the terms of use, or the open-source licences, laid
 * over whatever screen opened them (Settings, or the account screen),
 * with a back button to return to it.
 */
export function LegalScreen({ doc, onClose }: { doc: LegalDoc; onClose: () => void }): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const title = doc === 'privacy' ? 'Privacy' : doc === 'terms' ? 'Terms' : 'Licences';
  return (
    <View style={styles.layer}>
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.sm }]}>
        <PressableScale accessibilityRole="button" accessibilityLabel="Back" onPress={onClose} hitSlop={8} containerStyle={styles.headerSide}>
          <Text style={styles.back}>‹ Back</Text>
        </PressableScale>
        <View style={styles.headerCenter}>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
        </View>
        <View style={styles.headerSide} />
      </View>
      {doc === 'licenses' ? <Licences bottom={insets.bottom} /> : <Document doc={doc === 'privacy' ? privacyPolicy() : termsOfUse()} bottom={insets.bottom} />}
    </View>
  );
}

function Document({ doc, bottom }: { doc: LegalDocument; bottom: number }): React.JSX.Element {
  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottom + theme.spacing.xxl }]}>
      <Text style={styles.docTitle} accessibilityRole="header">
        {doc.title}
      </Text>
      <Text style={styles.lede}>{doc.lede}</Text>
      {doc.sections.map(section => (
        <View key={section.heading} style={styles.section}>
          <Text style={styles.heading} accessibilityRole="header">
            {section.heading}
          </Text>
          {section.paragraphs.map((p, i) => (
            <Text key={i} style={styles.paragraph}>
              {p}
            </Text>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

function Licences({ bottom }: { bottom: number }): React.JSX.Element {
  const list = useMemo(licences, []);
  const [open, setOpen] = useState<string | null>(null);
  return (
    <FlatList
      data={list}
      keyExtractor={item => `${item.name}@${item.version}`}
      contentContainerStyle={[styles.content, { paddingBottom: bottom + theme.spacing.xxl }]}
      ListHeaderComponent={<Text style={styles.lede}>Tessera is built with open-source software. Thank you to everyone who made these. Tap one to read its licence.</Text>}
      renderItem={({ item }) => {
        const key = `${item.name}@${item.version}`;
        const expanded = open === key;
        return (
          <PressableScale
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            accessibilityLabel={`${item.name}, ${item.license} licence`}
            onPress={() => setOpen(expanded ? null : key)}
            feedback={false}
            scaleTo={1}
            style={styles.licence}
          >
            <View style={styles.licenceRow}>
              <Text style={styles.licenceName} numberOfLines={1}>
                {item.name}
                {item.version ? <Text style={styles.licenceVersion}>{`  ${item.version}`}</Text> : null}
              </Text>
              <Text style={styles.licenceKind}>{item.license}</Text>
            </View>
            {expanded && (
              <Text style={styles.licenceText} selectable>
                {item.text}
              </Text>
            )}
          </PressableScale>
        );
      }}
    />
  );
}

const styles = themedStyles(() => ({
  layer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 30, backgroundColor: theme.colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.sm },
  headerSide: { width: 80 },
  back: { color: theme.colors.textPrimary, fontSize: theme.typography.sizes.body, fontWeight: theme.typography.weights.semibold },
  headerCenter: { flex: 1, alignItems: 'center' },
  title: { fontFamily: theme.typography.families.display, fontSize: theme.typography.sizes.title, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  content: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.sm },
  docTitle: { fontFamily: theme.typography.families.display, fontSize: theme.typography.sizes.title + 4, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  lede: { marginTop: theme.spacing.sm, marginBottom: theme.spacing.md, fontSize: theme.typography.sizes.body, lineHeight: 22, color: theme.colors.textSecondary },
  section: { marginTop: theme.spacing.lg },
  heading: { fontFamily: theme.typography.families.display, fontSize: theme.typography.sizes.subtitle + 1, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  paragraph: { marginTop: theme.spacing.sm, fontSize: theme.typography.sizes.body, lineHeight: 22, color: theme.colors.textPrimary },
  licence: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  licenceRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  licenceName: { flex: 1, fontSize: theme.typography.sizes.body, fontWeight: theme.typography.weights.semibold, color: theme.colors.textPrimary },
  licenceVersion: { fontWeight: theme.typography.weights.regular, color: theme.colors.textTertiary },
  licenceKind: { fontFamily: theme.typography.families.mono, fontSize: theme.typography.sizes.caption, color: theme.colors.textSecondary },
  licenceText: { marginTop: theme.spacing.sm, fontFamily: theme.typography.families.mono, fontSize: theme.typography.sizes.micro + 1, lineHeight: 16, color: theme.colors.textSecondary },
}));
