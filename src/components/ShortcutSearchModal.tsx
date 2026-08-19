import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import KeyCombo from './Keycap';
import { SHORTCUT_INDEX_BY_ID, ShortcutIndexEntry } from '@/constants/shortcuts';
import { searchShortcuts } from '@/utils/shortcutSearch';
import { COLORS, FONTS, RADIUS, SHADOWS, SPACING } from '@/theme';

interface CategoryChip {
  id: string;
  title: string;
  icon: string;
}

interface ShortcutSearchModalProps {
  visible: boolean;
  onClose: () => void;
  programId: string;
  programName: string;
  accent: string;
  categories: CategoryChip[];
  recentIds: string[];
  onSelectCategory: (categoryId: string) => void;
  onSelectShortcut: (id: string) => void;
}

function ResultRow({
  entry,
  accent,
  onPress,
}: {
  entry: ShortcutIndexEntry;
  accent: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.resultRow} activeOpacity={0.7} onPress={onPress}>
      <View style={styles.resultKeys}>
        <KeyCombo keys={entry.keys} accent={accent} compact />
      </View>
      <View style={styles.resultTextWrap}>
        <Text style={styles.resultDesc} numberOfLines={1}>
          {entry.desc}
        </Text>
        <Text style={styles.resultCategory} numberOfLines={1}>
          {entry.categoryTitle}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function SectionLabel({ text }: { text: string }) {
  return <Text style={styles.sectionLabel}>{text}</Text>;
}

export default function ShortcutSearchModal({
  visible,
  onClose,
  programId,
  programName,
  accent,
  categories,
  recentIds,
  onSelectCategory,
  onSelectShortcut,
}: ShortcutSearchModalProps) {
  const [query, setQuery] = useState('');

  // 모달이 새로 열릴 때마다 이전 검색어를 지운다 (리렌더 중 조건부 setState — 공식 "prop 변경에 따른 state 조정" 패턴).
  const [prevVisible, setPrevVisible] = useState(visible);
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (visible) setQuery('');
  }

  const results = useMemo(() => searchShortcuts(programId, query), [programId, query]);

  const recentEntries = useMemo(
    () => recentIds.map(id => SHORTCUT_INDEX_BY_ID[id]).filter((e): e is ShortcutIndexEntry => !!e),
    [recentIds],
  );

  const trimmed = query.trim();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose} testID="shortcut-search-backdrop">
        <Pressable style={styles.panel} onPress={() => {}}>
          <View style={styles.header}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {programName} 단축키 검색
            </Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={8}
              testID="shortcut-search-close"
              accessibilityLabel="검색 닫기"
            >
              <Text style={styles.closeIcon}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inputWrap}>
            <Text style={styles.inputIcon}>🔍</Text>
            <TextInput
              testID="shortcut-search-input"
              value={query}
              onChangeText={setQuery}
              placeholder="단축키 또는 설명 검색"
              placeholderTextColor={COLORS.textHint}
              style={styles.input}
              returnKeyType="search"
            />
          </View>

          <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
            {trimmed === '' ? (
              <>
                <SectionLabel text="카테고리로 이동" />
                <View style={styles.chipWrap}>
                  {categories.map(category => (
                    <TouchableOpacity
                      key={category.id}
                      style={styles.chip}
                      activeOpacity={0.75}
                      onPress={() => onSelectCategory(category.id)}
                    >
                      <Text style={styles.chipIcon}>{category.icon}</Text>
                      <Text style={styles.chipText} numberOfLines={1}>
                        {category.title}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {recentEntries.length > 0 && (
                  <>
                    <SectionLabel text="최근 검색" />
                    {recentEntries.map(entry => (
                      <ResultRow
                        key={entry.id}
                        entry={entry}
                        accent={accent}
                        onPress={() => onSelectShortcut(entry.id)}
                      />
                    ))}
                  </>
                )}
              </>
            ) : results.length > 0 ? (
              results.map(entry => (
                <ResultRow
                  key={entry.id}
                  entry={entry}
                  accent={accent}
                  onPress={() => onSelectShortcut(entry.id)}
                />
              ))
            ) : (
              <Text style={styles.empty}>검색 결과 없음</Text>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(3, 4, 10, 0.72)',
    justifyContent: 'flex-start',
    padding: SPACING.lg,
    paddingTop: SPACING.xxl,
  },
  panel: {
    maxHeight: '80%',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceElevated,
    overflow: 'hidden',
    ...SHADOWS.elevated,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  headerTitle: {
    flex: 1,
    fontFamily: FONTS.sansMedium,
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: 0.2,
  },
  closeIcon: {
    fontFamily: FONTS.sans,
    fontSize: 16,
    color: COLORS.textHint,
    paddingLeft: SPACING.sm,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.backgroundAlt,
  },
  inputIcon: {
    fontSize: 13,
  },
  input: {
    flex: 1,
    padding: 0,
    fontFamily: FONTS.sans,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  body: {
    paddingHorizontal: SPACING.md,
  },
  sectionLabel: {
    fontFamily: FONTS.sansMedium,
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textHint,
    letterSpacing: 0.4,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    paddingBottom: SPACING.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceHighlight,
  },
  chipIcon: {
    fontSize: 12,
  },
  chipText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  resultKeys: {
    flex: 45,
  },
  resultTextWrap: {
    flex: 55,
  },
  resultDesc: {
    fontFamily: FONTS.sans,
    fontSize: 12,
    color: COLORS.textPrimary,
  },
  resultCategory: {
    fontFamily: FONTS.sans,
    fontSize: 10,
    color: COLORS.textHint,
    marginTop: 1,
  },
  empty: {
    fontFamily: FONTS.sans,
    fontSize: 12,
    color: COLORS.textHint,
    textAlign: 'center',
    paddingVertical: SPACING.xl,
  },
});
