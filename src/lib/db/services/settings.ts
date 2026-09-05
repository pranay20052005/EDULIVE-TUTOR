/**
 * Settings Database Service
 * Handles loading and saving platform & institute settings
 */

import { supabase, handleDatabaseError } from "../client";

export interface InstituteSettings {
  instituteName: string;
  contactEmail: string;
  contactPhone: string;
  academicYear: string;
  timezone: string;
  paymentAlerts: boolean;
  lowAttendance: boolean;
  newEnrollments: boolean;
  marketing: boolean;
}

export const defaultSettings: InstituteSettings = {
  instituteName: "EduLive Learning Pvt. Ltd.",
  contactEmail: "support@edulive.in",
  contactPhone: "+91 80000 12345",
  academicYear: "2024-25",
  timezone: "Asia/Kolkata",
  paymentAlerts: true,
  lowAttendance: true,
  newEnrollments: true,
  marketing: false,
};

export const settingsService = {
  /**
   * Fetch all settings as key-value map or parsed config
   */
  async getAll(): Promise<InstituteSettings> {
    const { data, error } = await supabase.from("settings").select("setting_key, setting_value");

    if (error) {
      console.error("Error fetching settings:", error);
      return defaultSettings;
    }

    if (!data || data.length === 0) {
      return defaultSettings;
    }

    const map: Record<string, string> = {};
    data.forEach((row) => {
      map[row.setting_key] = row.setting_value;
    });

    return {
      instituteName: map["institute_name"] || defaultSettings.instituteName,
      contactEmail: map["contact_email"] || defaultSettings.contactEmail,
      contactPhone: map["contact_phone"] || defaultSettings.contactPhone,
      academicYear: map["academic_year"] || defaultSettings.academicYear,
      timezone: map["timezone"] || defaultSettings.timezone,
      paymentAlerts: map["payment_alerts"]
        ? map["payment_alerts"] === "true"
        : defaultSettings.paymentAlerts,
      lowAttendance: map["low_attendance"]
        ? map["low_attendance"] === "true"
        : defaultSettings.lowAttendance,
      newEnrollments: map["new_enrollments"]
        ? map["new_enrollments"] === "true"
        : defaultSettings.newEnrollments,
      marketing: map["marketing"] ? map["marketing"] === "true" : defaultSettings.marketing,
    };
  },

  /**
   * Save settings to database
   */
  async save(settings: Partial<InstituteSettings>): Promise<void> {
    const entries: Array<{ setting_key: string; setting_value: string; updated_at: string }> = [];
    const now = new Date().toISOString();

    if (settings.instituteName !== undefined) {
      entries.push({
        setting_key: "institute_name",
        setting_value: settings.instituteName,
        updated_at: now,
      });
    }
    if (settings.contactEmail !== undefined) {
      entries.push({
        setting_key: "contact_email",
        setting_value: settings.contactEmail,
        updated_at: now,
      });
    }
    if (settings.contactPhone !== undefined) {
      entries.push({
        setting_key: "contact_phone",
        setting_value: settings.contactPhone,
        updated_at: now,
      });
    }
    if (settings.academicYear !== undefined) {
      entries.push({
        setting_key: "academic_year",
        setting_value: settings.academicYear,
        updated_at: now,
      });
    }
    if (settings.timezone !== undefined) {
      entries.push({ setting_key: "timezone", setting_value: settings.timezone, updated_at: now });
    }
    if (settings.paymentAlerts !== undefined) {
      entries.push({
        setting_key: "payment_alerts",
        setting_value: String(settings.paymentAlerts),
        updated_at: now,
      });
    }
    if (settings.lowAttendance !== undefined) {
      entries.push({
        setting_key: "low_attendance",
        setting_value: String(settings.lowAttendance),
        updated_at: now,
      });
    }
    if (settings.newEnrollments !== undefined) {
      entries.push({
        setting_key: "new_enrollments",
        setting_value: String(settings.newEnrollments),
        updated_at: now,
      });
    }
    if (settings.marketing !== undefined) {
      entries.push({
        setting_key: "marketing",
        setting_value: String(settings.marketing),
        updated_at: now,
      });
    }

    if (entries.length === 0) return;

    const { error } = await supabase
      .from("settings")
      .upsert(entries, { onConflict: "setting_key" });

    if (error) {
      throw new Error(`Failed to save settings: ${handleDatabaseError(error)}`);
    }
  },
};
