import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type {
  MobileNotificationRecord,
  MobileNotificationsSummary,
} from '@/lib/clientific-api';
import type { MobilePushPermissionStatus } from '@/lib/mobile-push-notifications';
import { getClientificTheme } from '@/lib/clientific-mobile-theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type MobileNotificationsScreenProps = {
  data: MobileNotificationsSummary | null;
  error: string | null;
  isLoading: boolean;
  isMarkingRead: boolean;
  isRefreshing: boolean;
  permissionStatus: MobilePushPermissionStatus;
  onEnablePush: () => Promise<void>;
  onMarkAllRead: () => Promise<void>;
  onOpenNotification: (notification: MobileNotificationRecord) => Promise<void>;
  onRefresh: () => Promise<void>;
};

function getPermissionCopy(status: MobilePushPermissionStatus) {
  switch (status) {
    case 'granted':
      return {
        title: 'Push alerts are on',
        body:
          'This phone is ready to show appointment and schedule alerts as soon as they come in.',
        actionLabel: 'Refresh status',
      };
    case 'denied':
      return {
        title: 'Push alerts are off',
        body:
          'Turn notifications back on in iPhone Settings so owners see new appointment alerts right away.',
        actionLabel: 'Open iPhone Settings',
      };
    default:
      return {
        title: 'Finish notification setup',
        body:
          'Allow notifications on this phone so Clientific can alert the owner when a new appointment is booked.',
        actionLabel: 'Enable notifications',
      };
  }
}

export function MobileNotificationsScreen({
  data,
  error,
  isLoading,
  isMarkingRead,
  isRefreshing,
  permissionStatus,
  onEnablePush,
  onMarkAllRead,
  onOpenNotification,
  onRefresh,
}: MobileNotificationsScreenProps) {
  const colorScheme = useColorScheme();
  const theme = getClientificTheme(colorScheme);
  const permissionCopy = getPermissionCopy(permissionStatus);
  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { backgroundColor: theme.background }]}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          tintColor={theme.accent}
          onRefresh={() => void onRefresh()}
        />
      }
      style={{ backgroundColor: theme.background }}>
      <View
        style={[
          styles.heroCard,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}>
        <Text style={[styles.eyebrow, { color: theme.accent }]}>Notifications</Text>
        <Text style={[styles.heroTitle, { color: theme.text }]}>Owner alerts</Text>
        <Text style={[styles.heroSubtitle, { color: theme.mutedText }]}>
          Keep tabs on new bookings, schedule changes, and the alerts the web dashboard already
          creates.
        </Text>
        <View style={styles.summaryRow}>
          <View
            style={[
              styles.summaryBadge,
              { backgroundColor: theme.accentSoft, borderColor: theme.border },
            ]}>
            <Text style={[styles.summaryBadgeText, { color: theme.accent }]}>
              {unreadCount} unread
            </Text>
          </View>
          <View
            style={[
              styles.summaryBadge,
              { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
            ]}>
            <Text style={[styles.summaryBadgeText, { color: theme.text }]}>
              {notifications.length} recent
            </Text>
          </View>
        </View>
      </View>

      <View
        style={[
          styles.permissionCard,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}>
        <Text style={[styles.permissionTitle, { color: theme.text }]}>{permissionCopy.title}</Text>
        <Text style={[styles.permissionBody, { color: theme.mutedText }]}>{permissionCopy.body}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => void onEnablePush()}
          style={[styles.permissionButton, { backgroundColor: theme.accent }]}
          testID="mobile-notifications-enable-push">
          <Text style={styles.permissionButtonText}>{permissionCopy.actionLabel}</Text>
        </Pressable>
      </View>

      {error ? (
        <View
          style={[
            styles.inlineCard,
            { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
          ]}>
          <Text style={[styles.inlineCardTitle, { color: theme.text }]}>Something needs attention</Text>
          <Text style={[styles.inlineCardText, { color: theme.mutedText }]}>{error}</Text>
        </View>
      ) : null}

      <View
        style={[
          styles.listCard,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}>
        <View style={styles.listHeader}>
          <View>
            <Text style={[styles.listTitle, { color: theme.text }]}>Recent activity</Text>
            <Text style={[styles.listSubtitle, { color: theme.mutedText }]}>
              Owners can review alerts here even if they missed the push banner.
            </Text>
          </View>
          {unreadCount > 0 ? (
            <Pressable
              accessibilityRole="button"
              disabled={isMarkingRead}
              onPress={() => void onMarkAllRead()}
              style={[
                styles.markReadButton,
                { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
              ]}
              testID="mobile-notifications-mark-read">
              <Text style={[styles.markReadButtonText, { color: theme.text }]}>
                {isMarkingRead ? 'Saving...' : 'Mark all read'}
              </Text>
            </Pressable>
          ) : null}
        </View>

        {isLoading && !data ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={theme.accent} />
            <Text style={[styles.loadingText, { color: theme.mutedText }]}>
              Loading recent alerts...
            </Text>
          </View>
        ) : notifications.length ? (
          <View style={styles.notificationList}>
            {notifications.map((notification) => (
              <Pressable
                key={notification.id}
                accessibilityRole="button"
                onPress={() => void onOpenNotification(notification)}
                style={[
                  styles.notificationRow,
                  {
                    backgroundColor: notification.read ? theme.surface : theme.accentSoft,
                    borderColor: theme.border,
                  },
                ]}
                testID={`mobile-notifications-row-${notification.id}`}>
                <View style={styles.notificationRowHeader}>
                  <View style={styles.notificationTitleWrap}>
                    {!notification.read ? (
                      <View
                        style={[
                          styles.unreadDot,
                          { backgroundColor: theme.accent },
                        ]}
                      />
                    ) : null}
                    <Text style={[styles.notificationTitle, { color: theme.text }]}>
                      {notification.title}
                    </Text>
                  </View>
                  <Text style={[styles.notificationTimestamp, { color: theme.mutedText }]}>
                    {notification.createdAtLabel}
                  </Text>
                </View>
                <Text style={[styles.notificationMessage, { color: theme.mutedText }]}>
                  {notification.message}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No alerts yet</Text>
            <Text style={[styles.emptyText, { color: theme.mutedText }]}>
              New appointment and schedule updates will appear here as soon as the business starts
              receiving them.
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 32,
    gap: 16,
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 22,
    gap: 10,
  },
  eyebrow: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
    letterSpacing: 2.1,
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
  },
  heroSubtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  summaryBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  summaryBadgeText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  permissionCard: {
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 10,
  },
  permissionTitle: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '800',
  },
  permissionBody: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  permissionButton: {
    alignSelf: 'flex-start',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  permissionButtonText: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  inlineCard: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 6,
  },
  inlineCardTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  inlineCardText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  listCard: {
    borderWidth: 1,
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 14,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  listTitle: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
  },
  listSubtitle: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  markReadButton: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  markReadButtonText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  loadingState: {
    paddingVertical: 24,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  notificationList: {
    gap: 12,
  },
  notificationRow: {
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
  },
  notificationRowHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  notificationTitleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  notificationTitle: {
    flex: 1,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
  },
  notificationTimestamp: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  notificationMessage: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  emptyState: {
    paddingVertical: 24,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '800',
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
});
