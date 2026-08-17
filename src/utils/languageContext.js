const languageStore = require('../models/languageStore');

/**
 * Shared Language Context and Registry
 * Centralizes locale resolution, language registry access, and fallback chains.
 */
class LanguageContext {
  /**
   * Retrieves active languages formatted for UI navigation and language selectors.
   */
  static async getNavigationLanguages() {
    const languages = await languageStore.getActiveLanguages();
    return languages.map(lang => ({
      code: lang.code,
      name: lang.name,
      nativeName: lang.nativeName || lang.name,
      dir: lang.dir,
      isDefault: lang.isDefault
    }));
  }

  /**
   * Resolves a locale request string into a matching active Language object.
   * @param {string} locale Requested locale code (e.g., 'en-US', 'ar-LB', 'fr')
   */
  static async resolveLocale(locale) {
    return await languageStore.resolveLocale(locale);
  }

  /**
   * Returns fallback chain array for a locale.
   * E.g. for 'ar-LB' -> ['ar-LB', 'ar', 'en']
   */
  static async getFallbackChain(locale) {
    const active = await languageStore.getActiveLanguages();
    const resolved = await languageStore.resolveLocale(locale);
    const defaultLang = active.find(l => l.isDefault) || active[0];

    const chain = [];
    if (locale) chain.push(locale);
    if (resolved && !chain.includes(resolved.code)) {
      chain.push(resolved.code);
    }
    if (defaultLang && !chain.includes(defaultLang.code)) {
      chain.push(defaultLang.code);
    }
    return chain;
  }
}

module.exports = LanguageContext;
