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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { getClasses } from '../../src/api/classes';
import { useAuthStore } from '../../src/store/authStore';
import { COLORS } from '../../src/constants';
import { Class } from '../../src/types';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function ClassCardSkeleton() {
  return (
    <View style={[styles.classCard, styles.skeletonCard]}>
      <View style={styles.skeletonTitle} />
      <View style={styles.skeletonSubtitle} />
    </View>
  );
}

function ClassCard({ item, onPress }: { item: Class; onPress: () => void }) {
  const colors = [
    '#4F46E5', '#7C3AED', '#0891B2', '#059669', '#D97706', '#DC2626',
  ];
  const colorIndex = item.name.charCodeAt(0) % colors.length;
  const color = colors[colorIndex];

  return (
    <TouchableOpacity
      style={styles.classCard}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={[styles.classIconContainer, { backgroundColor: color + '18' }]}>
        <View style={[styles.classIconBg, { backgroundColor: color }]}>
          <Text style={styles.classIconText}>
            {item.name.substring(0, 2).toUpperCase()}
          </Text>
        </View>
      </View>
      <View style={styles.classInfo}>
        <Text style={styles.className}>{item.name}</Text>
        <Text style={styles.classMeta}>
          {item.section_count ?? '–'} {item.section_count === 1 ? 'section' : 'sections'}
        </Text>
      </View>
      <View style={styles.classChevron}>
        <Ionicons name="chevron-forward" size={20} color={COLORS.gray400} />
      </View>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { teacher } = useAuthStore();

  const {
    data: classes,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['classes'],
    queryFn: getClasses,
  });

  const handleClassPress = useCallback(
    (classId: string) => {
      router.push(`/(app)/classes/${classId}`);
    },
    [router]
  );

  const renderItem = useCallback(
    ({ item }: { item: Class }) => (
      <ClassCard item={item} onPress={() => handleClassPress(item.id)} />
    ),
    [handleClassPress]
  );

  const renderHeader = () => (
    <View style={styles.listHeader}>
      {/* Greeting */}
      <View style={styles.greetingContainer}>
        <Text style={styles.greeting}>
          {getGreeting()},{'\n'}
          <Text style={styles.teacherName}>{teacher?.full_name ?? 'Teacher'}</Text>
        </Text>
        <View style={styles.dateBadge}>
          <Ionicons name="calendar-outline" size={14} color={COLORS.primary} />
          <Text style={styles.dateText}>{formatDate(new Date())}</Text>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Ionicons name="school-outline" size={22} color={COLORS.primary} />
          <Text style={styles.statValue}>{classes?.length ?? '–'}</Text>
          <Text style={styles.statLabel}>Classes</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="people-outline" size={22} color={COLORS.success} />
          <Text style={styles.statValue}>
            {classes?.reduce((sum, c) => sum + (c.section_count ?? 0), 0) ?? '–'}
          </Text>
          <Text style={styles.statLabel}>Sections</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="mic-outline" size={22} color={COLORS.warning} />
          <Text style={styles.statValue}>Voice</Text>
          <Text style={styles.statLabel}>Mode</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Your Classes</Text>
    </View>
  );

  if (isLoading && !isRefetching) {
    return (
      <View style={styles.container}>
        {renderHeader()}
        {[1, 2, 3, 4].map((k) => (
          <ClassCardSkeleton key={k} />
        ))}
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.container}>
        {renderHeader()}
        <View style={styles.errorContainer}>
          <Ionicons name="cloud-offline-outline" size={48} color={COLORS.danger} />
          <Text style={styles.errorTitle}>Could not load classes</Text>
          <Text style={styles.errorMessage}>
            {(error as any)?.message ?? 'Please check your connection and try again.'}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
            <Ionicons name="refresh-outline" size={18} color="#FFFFFF" />
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={classes ?? []}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
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
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="school-outline" size={48} color={COLORS.gray400} />
            <Text style={styles.emptyTitle}>No classes found</Text>
            <Text style={styles.emptyMessage}>
              You have no classes assigned yet. Contact your school admin.
            </Text>
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
    marginBottom: 8,
  },
  greetingContainer: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  greeting: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 6,
  },
  teacherName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: 'flex-start',
    gap: 6,
  },
  dateText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  classCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
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
  classIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  classIconBg: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  classIconText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  classInfo: {
    flex: 1,
  },
  className: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 3,
  },
  classMeta: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  classChevron: {
    marginLeft: 8,
  },
  skeletonCard: {
    height: 84,
    marginBottom: 12,
  },
  skeletonTitle: {
    height: 16,
    width: '60%',
    backgroundColor: COLORS.gray200,
    borderRadius: 8,
    marginBottom: 8,
  },
  skeletonSubtitle: {
    height: 12,
    width: '40%',
    backgroundColor: COLORS.gray100,
    borderRadius: 6,
  },
  errorContainer: {
    alignItems: 'center',
    paddingTop: 40,
    gap: 12,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  errorMessage: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  retryButton: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
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
    paddingHorizontal: 20,
  },
});
