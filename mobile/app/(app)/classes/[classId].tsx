import { useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter, useLocalSearchParams, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { getClass, getSections } from '../../../src/api/classes';
import { getTodaySession } from '../../../src/api/attendance';
import { COLORS } from '../../../src/constants';
import { Section } from '../../../src/types';
import { useEffect } from 'react';

function SectionCard({
  section,
  onPress,
}: {
  section: Section;
  onPress: () => void;
}) {
  const { data: todaySession } = useQuery({
    queryKey: ['todaySession', section.id],
    queryFn: () => getTodaySession(section.id),
    staleTime: 1000 * 60, // 1 minute
  });

  const presentCount = todaySession?.records?.filter((r) => r.status === 'present').length ?? 0;
  const absentCount = todaySession?.records?.filter((r) => r.status === 'absent').length ?? 0;
  const hasSession = !!todaySession;
  const isSubmitted = todaySession?.status === 'submitted';

  return (
    <TouchableOpacity style={styles.sectionCard} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.sectionIconContainer}>
        <Ionicons name="people-outline" size={24} color={COLORS.primary} />
      </View>
      <View style={styles.sectionInfo}>
        <View style={styles.sectionNameRow}>
          <Text style={styles.sectionName}>{section.name}</Text>
          {isSubmitted && (
            <View style={styles.submittedBadge}>
              <Ionicons name="checkmark-circle" size={12} color={COLORS.success} />
              <Text style={styles.submittedText}>Done</Text>
            </View>
          )}
        </View>
        <Text style={styles.studentCount}>
          {section.student_count ?? '–'} students
        </Text>

        {hasSession && (
          <View style={styles.sessionStats}>
            <View style={styles.statItem}>
              <View style={[styles.statDot, { backgroundColor: COLORS.success }]} />
              <Text style={styles.statText}>Present: {presentCount}</Text>
            </View>
            <View style={styles.statItem}>
              <View style={[styles.statDot, { backgroundColor: COLORS.danger }]} />
              <Text style={styles.statText}>Absent: {absentCount}</Text>
            </View>
          </View>
        )}
      </View>

      <View style={styles.sectionAction}>
        <TouchableOpacity style={styles.takeAttendanceBtn} onPress={onPress} activeOpacity={0.8}>
          <Ionicons name="mic" size={16} color="#FFFFFF" />
          <Text style={styles.takeAttendanceText}>
            {hasSession && !isSubmitted ? 'Continue' : isSubmitted ? 'View' : 'Take'}
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

export default function ClassDetailScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { classId } = useLocalSearchParams<{ classId: string }>();

  const { data: classData } = useQuery({
    queryKey: ['class', classId],
    queryFn: () => getClass(classId),
    enabled: !!classId,
  });

  const {
    data: sections,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['sections', classId],
    queryFn: () => getSections(classId),
    enabled: !!classId,
  });

  useEffect(() => {
    if (classData?.name) {
      navigation.setOptions({ title: classData.name });
    }
  }, [classData, navigation]);

  const handleSectionPress = useCallback(
    (sectionId: string) => {
      router.push(`/(app)/attendance/${sectionId}`);
    },
    [router]
  );

  const renderItem = useCallback(
    ({ item }: { item: Section }) => (
      <SectionCard section={item} onPress={() => handleSectionPress(item.id)} />
    ),
    [handleSectionPress]
  );

  if (isLoading && !isRefetching) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading sections...</Text>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="cloud-offline-outline" size={48} color={COLORS.danger} />
        <Text style={styles.errorTitle}>Could not load sections</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
          <Ionicons name="refresh-outline" size={18} color="#FFFFFF" />
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={sections ?? []}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Text style={styles.headerTitle}>{classData?.name ?? 'Class'}</Text>
            <Text style={styles.headerSubtitle}>
              {sections?.length ?? 0} sections · Tap to take attendance
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={48} color={COLORS.gray400} />
            <Text style={styles.emptyTitle}>No sections</Text>
            <Text style={styles.emptyMessage}>No sections found for this class.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  listHeader: {
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  sectionCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: COLORS.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  sectionInfo: {
    flex: 1,
  },
  sectionNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  sectionName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  submittedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.success + '20',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 3,
  },
  submittedText: {
    fontSize: 10,
    color: COLORS.success,
    fontWeight: '600',
  },
  studentCount: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  sessionStats: {
    flexDirection: 'row',
    gap: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  sectionAction: {
    marginLeft: 10,
  },
  takeAttendanceBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  takeAttendanceText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.background,
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.background,
    padding: 24,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  retryButton: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    gap: 8,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 40,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  emptyMessage: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});
