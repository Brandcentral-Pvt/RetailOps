import { CometChatSettingsInterface } from '../context/CometChatContext';

/**
 * Type guard to check if a value is a plain object (not an array, not null)
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Recursively merges API settings with default settings.
 *
 * Rules:
 * - If a key exists in API response (even if false or null), use the API value
 * - If a key is undefined or missing in API response, use the default value
 * - For nested objects, recursively apply the same merge logic
 * - For arrays, use API value if present, otherwise use default
 *
 * @param apiSettings - Settings from the API (may be partial)
 * @param defaultSettings - Complete default settings
 * @returns Merged settings object with all required keys
 */
export function mergeWithDefaults<T extends Record<string, unknown>>(
  apiSettings: Partial<T> | undefined,
  defaultSettings: T
): T {
  // If API settings is undefined or null, return defaults
  if (!apiSettings) {
    return defaultSettings;
  }

  const result = { ...defaultSettings };

  for (const key in defaultSettings) {
    if (Object.prototype.hasOwnProperty.call(defaultSettings, key)) {
      const apiValue = apiSettings[key];
      const defaultValue = defaultSettings[key];

      // If the key exists in API settings (not undefined)
      if (apiValue !== undefined) {
        // If both are plain objects, recursively merge
        if (isPlainObject(apiValue) && isPlainObject(defaultValue)) {
          result[key] = mergeWithDefaults(
            apiValue as Record<string, unknown>,
            defaultValue as Record<string, unknown>
          ) as T[Extract<keyof T, string>];
        } else {
          // Use API value (could be null, false, 0, empty string, array, etc.)
          result[key] = apiValue as T[Extract<keyof T, string>];
        }
      }
      // If apiValue is undefined, keep the default value (already in result)
    }
  }

  return result;
}

/**
 * Merges API builder settings with default CometChat settings.
 * Ensures all required keys and nested properties are present.
 *
 * @param apiSettings - Partial settings from the API
 * @param defaultSettings - Complete default CometChatSettings
 * @returns Complete CometChatSettingsInterface with all required keys
 */
export function mergeBuilderSettings(
  apiSettings: Partial<CometChatSettingsInterface> | undefined,
  defaultSettings: CometChatSettingsInterface
): CometChatSettingsInterface {
  return mergeWithDefaults(
    apiSettings as unknown as Partial<Record<string, unknown>>,
    defaultSettings as unknown as Record<string, unknown>
  ) as unknown as CometChatSettingsInterface;
}
