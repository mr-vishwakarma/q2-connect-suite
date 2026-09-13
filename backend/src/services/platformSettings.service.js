const PlatformSetting = require('../models/PlatformSetting');

const DEFAULT_PLATFORM_SETTINGS = [
  {
    key: 'platform_name',
    category: 'general',
    value: 'Q2 Connect Suite',
    description: 'Official SaaS platform brand name',
    isPublic: true,
  },
  {
    key: 'support_email',
    category: 'general',
    value: 'support@q2connect.com',
    description: 'Central helpdesk and tenant support email',
    isPublic: true,
  },
  {
    key: 'support_phone',
    category: 'general',
    value: '+91 9876543210',
    description: 'Central helpdesk phone line',
    isPublic: true,
  },
  {
    key: 'default_currency',
    category: 'general',
    value: 'INR',
    description: 'Standard platform currency (INR, USD)',
    isPublic: true,
  },
  {
    key: 'default_timezone',
    category: 'general',
    value: 'Asia/Kolkata (IST)',
    description: 'Platform standard timezone',
    isPublic: true,
  },
  {
    key: 'max_login_attempts',
    category: 'security',
    value: 5,
    description: 'Consecutive failed login attempts before account lockout',
    isPublic: false,
  },
  {
    key: 'lockout_duration_minutes',
    category: 'security',
    value: 15,
    description: 'Account lock duration in minutes',
    isPublic: false,
  },
  {
    key: 'jwt_expiry_hours',
    category: 'security',
    value: 24,
    description: 'JWT token lifespan in hours',
    isPublic: false,
  },
  {
    key: 'maintenance_mode',
    category: 'maintenance',
    value: false,
    description: 'Platform-wide maintenance window switch',
    isPublic: true,
  },
  {
    key: 'maintenance_message',
    category: 'maintenance',
    value: 'Platform maintenance in progress. Please check back shortly.',
    description: 'Public banner during maintenance',
    isPublic: true,
  },
  {
    key: 'trial_period_days',
    category: 'trial',
    value: 14,
    description: 'Default onboarding trial length in days',
    isPublic: false,
  },
  {
    key: 'notify_expiring_days',
    category: 'trial',
    value: 3,
    description: 'Days before trial expiry to notify tenant',
    isPublic: false,
  },
  {
    key: 'max_hostels_per_tenant',
    category: 'limits',
    value: 50,
    description: 'Default limit of branches per organization',
    isPublic: false,
  },
  {
    key: 'max_students_per_tenant',
    category: 'limits',
    value: 5000,
    description: 'Default limit of active students per organization',
    isPublic: false,
  },
  {
    key: 'max_file_size_mb',
    category: 'limits',
    value: 10,
    description: 'Upload file size limit in MB',
    isPublic: false,
  },
];

const platformSettingsService = {
  async getSettings() {
    let settingsList = await PlatformSetting.find().lean();

    // Auto-seed defaults if collection is empty
    if (settingsList.length === 0) {
      await PlatformSetting.insertMany(DEFAULT_PLATFORM_SETTINGS);
      settingsList = await PlatformSetting.find().lean();
    }

    const map = {};
    settingsList.forEach((s) => {
      map[s.key] = s.value;
    });

    return {
      general: {
        platformName: map['platform_name'] || 'Q2 Connect Suite',
        supportEmail: map['support_email'] || 'support@q2connect.com',
        supportPhone: map['support_phone'] || '+91 9876543210',
        defaultCurrency: map['default_currency'] || 'INR',
        defaultTimezone: map['default_timezone'] || 'Asia/Kolkata (IST)',
        allowSelfRegistration: map['allow_self_registration'] !== false,
      },
      security: {
        maxLoginAttempts: Number(map['max_login_attempts']) || 5,
        lockoutDurationMinutes: Number(map['lockout_duration_minutes']) || 15,
        sessionTimeoutMinutes: Number(map['session_timeout_minutes']) || 60,
        enforceMfaForSuperAdmin: Boolean(map['enforce_mfa']),
        jwtExpiryHours: Number(map['jwt_expiry_hours']) || 24,
      },
      trial: {
        defaultTrialDays: Number(map['trial_period_days']) || 14,
        allowTrialExtension: true,
        maxTrialExtensions: 2,
        notifyExpiringDaysBefore: Number(map['notify_expiring_days']) || 3,
      },
      maintenance: {
        isMaintenanceMode: Boolean(map['maintenance_mode']),
        maintenanceMessage: map['maintenance_message'] || 'Platform maintenance in progress. Please check back shortly.',
        allowedIps: [],
      },
      limits: {
        maxHostelsPerTenant: Number(map['max_hostels_per_tenant']) || 50,
        maxStudentsPerTenant: Number(map['max_students_per_tenant']) || 5000,
        maxFileSizeMb: Number(map['max_file_size_mb']) || 10,
      },
      raw: settingsList,
    };
  },

  async updateSettings(payload, actorUserId) {
    const keyValues = [];

    if (Array.isArray(payload)) {
      payload.forEach((item) => {
        if (item.key) keyValues.push({ key: item.key, value: item.value });
      });
    } else if (payload && typeof payload === 'object') {
      if (payload.general) {
        if (payload.general.platformName !== undefined) keyValues.push({ key: 'platform_name', value: payload.general.platformName });
        if (payload.general.supportEmail !== undefined) keyValues.push({ key: 'support_email', value: payload.general.supportEmail });
        if (payload.general.supportPhone !== undefined) keyValues.push({ key: 'support_phone', value: payload.general.supportPhone });
        if (payload.general.defaultCurrency !== undefined) keyValues.push({ key: 'default_currency', value: payload.general.defaultCurrency });
        if (payload.general.defaultTimezone !== undefined) keyValues.push({ key: 'default_timezone', value: payload.general.defaultTimezone });
      }
      if (payload.security) {
        if (payload.security.maxLoginAttempts !== undefined) keyValues.push({ key: 'max_login_attempts', value: payload.security.maxLoginAttempts });
        if (payload.security.lockoutDurationMinutes !== undefined) keyValues.push({ key: 'lockout_duration_minutes', value: payload.security.lockoutDurationMinutes });
        if (payload.security.jwtExpiryHours !== undefined) keyValues.push({ key: 'jwt_expiry_hours', value: payload.security.jwtExpiryHours });
      }
      if (payload.trial) {
        if (payload.trial.defaultTrialDays !== undefined) keyValues.push({ key: 'trial_period_days', value: payload.trial.defaultTrialDays });
        if (payload.trial.notifyExpiringDaysBefore !== undefined) keyValues.push({ key: 'notify_expiring_days', value: payload.trial.notifyExpiringDaysBefore });
      }
      if (payload.maintenance) {
        if (payload.maintenance.isMaintenanceMode !== undefined) keyValues.push({ key: 'maintenance_mode', value: payload.maintenance.isMaintenanceMode });
        if (payload.maintenance.maintenanceMessage !== undefined) keyValues.push({ key: 'maintenance_message', value: payload.maintenance.maintenanceMessage });
      }
      if (payload.limits) {
        if (payload.limits.maxHostelsPerTenant !== undefined) keyValues.push({ key: 'max_hostels_per_tenant', value: payload.limits.maxHostelsPerTenant });
        if (payload.limits.maxStudentsPerTenant !== undefined) keyValues.push({ key: 'max_students_per_tenant', value: payload.limits.maxStudentsPerTenant });
        if (payload.limits.maxFileSizeMb !== undefined) keyValues.push({ key: 'max_file_size_mb', value: payload.limits.maxFileSizeMb });
      }
    }

    for (const item of keyValues) {
      await PlatformSetting.findOneAndUpdate(
        { key: item.key },
        {
          value: item.value,
          updatedBy: actorUserId,
        },
        { upsert: true, new: true }
      );
    }

    return await this.getSettings();
  },
};

module.exports = { platformSettingsService };
