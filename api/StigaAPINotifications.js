// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------

const { formatStruct } = require('./StigaAPIUtilitiesFormat');
const StigaAPIComponent = require('./StigaAPIComponent');

// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------

class StigaAPINotification {
    constructor(notificationData, detailData = undefined) {
        this.data = notificationData;
        this.details = detailData;
    }

    getUuid() {
        return this.data?.attributes?.uuid || undefined;
    }

    getNotificationUuid() {
        return this.data?.attributes?.notification_uuid || undefined;
    }

    isRead() {
        return this.data?.attributes?.read_at !== undefined;
    }

    getReadAt() {
        const readAt = this.data?.attributes?.read_at;
        return readAt ? new Date(readAt) : undefined;
    }

    getCreatedAt() {
        const createdAt = this.data?.attributes?.created_at;
        return createdAt ? new Date(createdAt) : undefined;
    }

    getTitle() {
        return this.details?.attributes?.title || 'No title';
    }

    getBody() {
        return this.details?.attributes?.body || 'No body';
    }

    getTopic() {
        return this.details?.attributes?.topic || undefined;
    }

    getData() {
        return this.details?.attributes?.data || {};
    }

    getType() {
        return this.getData()?.type || undefined;
    }

    getCategory() {
        return this.getData()?.category || undefined;
    }

    getDeviceUuid() {
        return this.getData()?.deviceUuid || undefined;
    }

    getPosition() {
        const data = this.getData();
        return data?.x && data?.y ? { x: Number.parseFloat(data.x), y: Number.parseFloat(data.y) } : undefined;
    }

    toString() {
        return formatStruct({ title: this.getTitle(), status: this.isRead() ? 'read' : 'unread', createdAt: this.getCreatedAt()?.toLocaleString() || 'unknown' }, 'notification');
    }
}

// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------

class StigaAPINotifications extends StigaAPIComponent {
    constructor(serverConnection, options = {}) {
        super(options);
        this.server = serverConnection;
        this.notificationsData = undefined;
        this.notifications = [];
    }

    async load() {
        try {
            const response = await this.server.get('/api/user/notifications');
            if (response.ok) {
                this.notificationsData = await response.json();
                this._parseNotifications();
                return true;
            }
        } catch (e) {
            this.display.error('notifications: failed to load:', e);
        }
        return false;
    }

    _parseNotifications() {
        const details = new Map();
        if (this.notificationsData?.included) this.notificationsData.included.filter((item) => item.type === 'Notifications').forEach((item) => details.set(item.id, item));
        this.notifications = this.notificationsData?.data?.map((notification) => new StigaAPINotification(notification, details.get(notification.attributes?.notification_uuid))) ?? [];
    }

    getAll() {
        return this.notifications;
    }

    getUnread() {
        return this.notifications.filter((n) => !n.isRead());
    }

    getRead() {
        return this.notifications.filter((n) => n.isRead());
    }

    getByType(type) {
        return this.notifications.filter((n) => n.getType() === type);
    }

    getByCategory(category) {
        return this.notifications.filter((n) => n.getCategory() === category);
    }

    getByDevice(deviceUuid) {
        return this.notifications.filter((n) => n.getDeviceUuid() === deviceUuid);
    }

    getRecent(hours = 24) {
        const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
        return this.notifications.filter((notification) => {
            const createdAt = notification.getCreatedAt();
            return createdAt && createdAt > cutoff;
        });
    }

    getCount() {
        return this.notifications.length;
    }

    getUnreadCount() {
        return this.getUnread().length;
    }

    toString() {
        return formatStruct({ total: this.getCount(), unread: this.getUnreadCount() }, 'notifications');
    }
}

// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------

module.exports = StigaAPINotifications;

// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------
