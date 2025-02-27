import { NetFieldsReverse } from '../types/net_fields';
import { NetParams } from '../types/net_props';
import { CactbotBaseRegExp } from '../types/net_trigger';

import {
  logDefinitionsVersions,
  LogDefinitionTypes,
  LogDefinitionVersions,
  ParseHelperFields,
} from './netlog_defs';
import Regexes from './regexes';

const separator = '\\|';
const matchDefault = '[^|]*';

// If NetRegexes.setFlagTranslationsNeeded is set to true, then any
// regex created that requires a translation will begin with this string
// and match the magicStringRegex.  This is maybe a bit goofy, but is
// a pretty straightforward way to mark regexes for translations.
// If issue #1306 is ever resolved, we can remove this.
const magicTranslationString = `^^`;
const magicStringRegex = /^\^\^/;
const keysThatRequireTranslation = [
  'ability',
  'name',
  'source',
  'target',
  'line',
];

const defaultParams = <
  T extends LogDefinitionTypes,
  V extends LogDefinitionVersions,
>(type: T, version: V, include?: string[]): Partial<ParseHelperFields<T>> => {
  include ??= Object.keys(logDefinitionsVersions[version][type].fields);
  const params: { [index: number]: { field: string; value?: string; optional: boolean } } = {};
  const firstOptionalField = logDefinitionsVersions[version][type].firstOptionalField;

  for (const [prop, index] of Object.entries(logDefinitionsVersions[version][type].fields)) {
    if (!include.includes(prop))
      continue;
    const param: { field: string; value?: string; optional: boolean } = {
      field: prop,
      optional: firstOptionalField !== undefined && index >= firstOptionalField,
    };
    if (prop === 'type')
      param.value = logDefinitionsVersions[version][type].type;

    params[index] = param;
  }

  return params as unknown as Partial<ParseHelperFields<T>>;
};

type ParseHelperType<T extends LogDefinitionTypes> =
  & {
    [field in Extract<keyof NetFieldsReverse[T], string>]?: string;
  }
  & { capture?: boolean };

const parseHelper = <T extends LogDefinitionTypes>(
  params: ParseHelperType<T> | undefined,
  funcName: string,
  fields: Partial<ParseHelperFields<T>>,
): CactbotBaseRegExp<T> => {
  params = params ?? {};
  const validFields: string[] = [];

  for (const index in fields) {
    const field = fields[index];
    if (field)
      validFields.push(field.field);
  }

  Regexes.validateParams(params, funcName, ['capture', ...validFields]);

  // Find the last key we care about, so we can shorten the regex if needed.
  const capture = Regexes.trueIfUndefined(params.capture);
  const fieldKeys = Object.keys(fields).sort((a, b) => parseInt(a) - parseInt(b));
  let maxKeyStr: string;
  if (capture) {
    const keys: Extract<keyof NetFieldsReverse[T], string>[] = [];
    for (const key in fields)
      keys.push(key);
    let tmpKey = keys.pop();
    if (!tmpKey) {
      maxKeyStr = fieldKeys[fieldKeys.length - 1] ?? '0';
    } else {
      while (
        fields[tmpKey]?.optional &&
        !((fields[tmpKey]?.field ?? '') in params)
      )
        tmpKey = keys.pop();
      maxKeyStr = tmpKey ?? '0';
    }
  } else {
    maxKeyStr = '0';
    for (const key in fields) {
      const value = fields[key] ?? {};
      if (typeof value !== 'object')
        continue;
      const fieldName = fields[key]?.field;
      if (fieldName && fieldName in params)
        maxKeyStr = key;
    }
  }
  const maxKey = parseInt(maxKeyStr);

  // For testing, it's useful to know if this is a regex that requires
  // translation.  We test this by seeing if there are any specified
  // fields, and if so, inserting a magic string that we can detect.
  // This lets us differentiate between "regex that should be translated"
  // e.g. a regex with `target` specified, and "regex that shouldn't"
  // e.g. a gains effect with just effectId specified.
  const transParams = Object.keys(params).filter((k) => keysThatRequireTranslation.includes(k));
  const needsTranslations = NetRegexes.flagTranslationsNeeded && transParams.length > 0;

  // Build the regex from the fields.
  let str = needsTranslations ? magicTranslationString : '^';
  let lastKey = -1;
  for (const keyStr in fields) {
    const key = parseInt(keyStr);
    // Fill in blanks.
    const missingFields = key - lastKey - 1;
    if (missingFields === 1)
      str += '\\y{NetField}';
    else if (missingFields > 1)
      str += `\\y{NetField}{${missingFields}}`;
    lastKey = key;

    const value = fields[keyStr];
    if (typeof value !== 'object')
      throw new Error(`${funcName}: invalid value: ${JSON.stringify(value)}`);

    const fieldName = fields[keyStr]?.field;
    const fieldValue = fields[keyStr]?.value?.toString() ?? matchDefault;

    if (fieldName) {
      str += Regexes.maybeCapture(
        // more accurate type instead of `as` cast
        // maybe this function needs a refactoring
        capture,
        fieldName,
        params[fieldName],
        fieldValue,
      ) +
        separator;
    } else {
      str += fieldValue + separator;
    }

    // Stop if we're not capturing and don't care about future fields.
    if (key >= maxKey)
      break;
  }
  return Regexes.parse(str) as CactbotBaseRegExp<T>;
};

export default class NetRegexes {
  static logVersion: LogDefinitionVersions = 'latest';

  static flagTranslationsNeeded = false;
  static setFlagTranslationsNeeded(value: boolean): void {
    NetRegexes.flagTranslationsNeeded = value;
  }
  static doesNetRegexNeedTranslation(regex: RegExp | string): boolean {
    // Need to `setFlagTranslationsNeeded` before calling this function.
    console.assert(NetRegexes.flagTranslationsNeeded);
    const str = typeof regex === 'string' ? regex : regex.source;
    return !!magicStringRegex.exec(str);
  }

  /**
   * matches: https://github.com/quisquous/cactbot/blob/main/docs/LogGuide.md#line-20-0x14-networkstartscasting
   */
  static startsUsing(params?: NetParams['StartsUsing']): CactbotBaseRegExp<'StartsUsing'> {
    return parseHelper(params, 'startsUsing', defaultParams('StartsUsing', NetRegexes.logVersion));
  }

  /**
   * matches: https://github.com/quisquous/cactbot/blob/main/docs/LogGuide.md#line-21-0x15-networkability
   * matches: https://github.com/quisquous/cactbot/blob/main/docs/LogGuide.md#line-22-0x16-networkaoeability
   */
  static ability(params?: NetParams['Ability']): CactbotBaseRegExp<'Ability'> {
    return parseHelper(params, 'ability', {
      ...defaultParams('Ability', NetRegexes.logVersion),
      // Override type
      0: { field: 'type', value: '2[12]', optional: false },
    });
  }

  /**
   * matches: https://github.com/quisquous/cactbot/blob/main/docs/LogGuide.md#line-21-0x15-networkability
   * matches: https://github.com/quisquous/cactbot/blob/main/docs/LogGuide.md#line-22-0x16-networkaoeability
   *
   * @deprecated Use `ability` instead
   */
  static abilityFull(params?: NetParams['Ability']): CactbotBaseRegExp<'Ability'> {
    return this.ability(params);
  }

  /**
   * matches: https://github.com/quisquous/cactbot/blob/main/docs/LogGuide.md#line-27-0x1b-networktargeticon-head-marker
   */
  static headMarker(params?: NetParams['HeadMarker']): CactbotBaseRegExp<'HeadMarker'> {
    return parseHelper(params, 'headMarker', defaultParams('HeadMarker', NetRegexes.logVersion));
  }

  /**
   * matches: https://github.com/quisquous/cactbot/blob/main/docs/LogGuide.md#line-03-0x03-addcombatant
   */
  static addedCombatant(params?: NetParams['AddedCombatant']): CactbotBaseRegExp<'AddedCombatant'> {
    return parseHelper(
      params,
      'addedCombatant',
      defaultParams('AddedCombatant', NetRegexes.logVersion, [
        'type',
        'timestamp',
        'id',
        'name',
      ]),
    );
  }

  /**
   * matches: https://github.com/quisquous/cactbot/blob/main/docs/LogGuide.md#line-03-0x03-addcombatant
   */
  static addedCombatantFull(
    params?: NetParams['AddedCombatant'],
  ): CactbotBaseRegExp<'AddedCombatant'> {
    return parseHelper(
      params,
      'addedCombatantFull',
      defaultParams('AddedCombatant', NetRegexes.logVersion),
    );
  }

  /**
   * matches: https://github.com/quisquous/cactbot/blob/main/docs/LogGuide.md#line-04-0x04-removecombatant
   */
  static removingCombatant(
    params?: NetParams['RemovedCombatant'],
  ): CactbotBaseRegExp<'RemovedCombatant'> {
    return parseHelper(
      params,
      'removingCombatant',
      defaultParams('RemovedCombatant', NetRegexes.logVersion),
    );
  }

  /**
   * matches: https://github.com/quisquous/cactbot/blob/main/docs/LogGuide.md#line-26-0x1a-networkbuff
   */
  static gainsEffect(params?: NetParams['GainsEffect']): CactbotBaseRegExp<'GainsEffect'> {
    return parseHelper(params, 'gainsEffect', defaultParams('GainsEffect', NetRegexes.logVersion));
  }

  /**
   * Prefer gainsEffect over this function unless you really need extra data.
   * matches: https://github.com/quisquous/cactbot/blob/main/docs/LogGuide.md#line-38-0x26-networkstatuseffects
   */
  static statusEffectExplicit(
    params?: NetParams['StatusEffect'],
  ): CactbotBaseRegExp<'StatusEffect'> {
    return parseHelper(
      params,
      'statusEffectExplicit',
      defaultParams('StatusEffect', NetRegexes.logVersion),
    );
  }

  /**
   * matches: https://github.com/quisquous/cactbot/blob/main/docs/LogGuide.md#line-30-0x1e-networkbuffremove
   */
  static losesEffect(params?: NetParams['LosesEffect']): CactbotBaseRegExp<'LosesEffect'> {
    return parseHelper(params, 'losesEffect', defaultParams('LosesEffect', NetRegexes.logVersion));
  }

  /**
   * matches: https://github.com/quisquous/cactbot/blob/main/docs/LogGuide.md#line-35-0x23-networktether
   */
  static tether(params?: NetParams['Tether']): CactbotBaseRegExp<'Tether'> {
    return parseHelper(params, 'tether', defaultParams('Tether', NetRegexes.logVersion));
  }

  /**
   * 'target' was defeated by 'source'
   * matches: https://github.com/quisquous/cactbot/blob/main/docs/LogGuide.md#line-25-0x19-networkdeath
   */
  static wasDefeated(params?: NetParams['WasDefeated']): CactbotBaseRegExp<'WasDefeated'> {
    return parseHelper(params, 'wasDefeated', defaultParams('WasDefeated', NetRegexes.logVersion));
  }

  /**
   * matches: https://github.com/quisquous/cactbot/blob/main/docs/LogGuide.md#line-00-0x00-logline
   */
  static echo(params?: NetParams['GameLog']): CactbotBaseRegExp<'GameLog'> {
    if (typeof params === 'undefined')
      params = {};
    Regexes.validateParams(
      params,
      'echo',
      ['type', 'timestamp', 'code', 'name', 'line', 'capture'],
    );
    params.code = '0038';
    return NetRegexes.gameLog(params);
  }

  /**
   * matches: https://github.com/quisquous/cactbot/blob/main/docs/LogGuide.md#line-00-0x00-logline
   */
  static dialog(params?: NetParams['GameLog']): CactbotBaseRegExp<'GameLog'> {
    if (typeof params === 'undefined')
      params = {};
    Regexes.validateParams(
      params,
      'dialog',
      ['type', 'timestamp', 'code', 'name', 'line', 'capture'],
    );
    params.code = '0044';
    return NetRegexes.gameLog(params);
  }

  /**
   * matches: https://github.com/quisquous/cactbot/blob/main/docs/LogGuide.md#line-00-0x00-logline
   */
  static message(params?: NetParams['GameLog']): CactbotBaseRegExp<'GameLog'> {
    if (typeof params === 'undefined')
      params = {};
    Regexes.validateParams(
      params,
      'message',
      ['type', 'timestamp', 'code', 'name', 'line', 'capture'],
    );
    params.code = '0839';
    return NetRegexes.gameLog(params);
  }

  /**
   * fields: code, name, line, capture
   * matches: https://github.com/quisquous/cactbot/blob/main/docs/LogGuide.md#line-00-0x00-logline
   */
  static gameLog(params?: NetParams['GameLog']): CactbotBaseRegExp<'GameLog'> {
    return parseHelper(params, 'gameLog', defaultParams('GameLog', NetRegexes.logVersion));
  }

  /**
   * matches: https://github.com/quisquous/cactbot/blob/main/docs/LogGuide.md#line-00-0x00-logline
   */
  static gameNameLog(params?: NetParams['GameLog']): CactbotBaseRegExp<'GameLog'> {
    // Backwards compatability.
    return NetRegexes.gameLog(params);
  }

  /**
   * matches: https://github.com/quisquous/cactbot/blob/main/docs/LogGuide.md#line-12-0x0c-playerstats
   */
  static statChange(params?: NetParams['PlayerStats']): CactbotBaseRegExp<'PlayerStats'> {
    return parseHelper(params, 'statChange', defaultParams('PlayerStats', NetRegexes.logVersion));
  }

  /**
   * matches: https://github.com/quisquous/cactbot/blob/main/docs/LogGuide.md#line-01-0x01-changezone
   */
  static changeZone(params?: NetParams['ChangeZone']): CactbotBaseRegExp<'ChangeZone'> {
    return parseHelper(params, 'changeZone', defaultParams('ChangeZone', NetRegexes.logVersion));
  }

  /**
   * matches: https://github.com/quisquous/cactbot/blob/main/docs/LogGuide.md#line-33-0x21-network6d-actor-control
   */
  static network6d(params?: NetParams['ActorControl']): CactbotBaseRegExp<'ActorControl'> {
    return parseHelper(params, 'network6d', defaultParams('ActorControl', NetRegexes.logVersion));
  }

  /**
   * matches: https://github.com/quisquous/cactbot/blob/main/docs/LogGuide.md#line-34-0x22-networknametoggle
   */
  static nameToggle(params?: NetParams['NameToggle']): CactbotBaseRegExp<'NameToggle'> {
    return parseHelper(params, 'nameToggle', defaultParams('NameToggle', NetRegexes.logVersion));
  }

  /**
   * matches: https://github.com/quisquous/cactbot/blob/main/docs/LogGuide.md#line-40-0x28-map
   */
  static map(params?: NetParams['Map']): CactbotBaseRegExp<'Map'> {
    return parseHelper(params, 'map', defaultParams('Map', NetRegexes.logVersion));
  }

  /**
   * matches: https://github.com/quisquous/cactbot/blob/main/docs/LogGuide.md#line-41-0x29-systemlogmessage
   */
  static systemLogMessage(
    params?: NetParams['SystemLogMessage'],
  ): CactbotBaseRegExp<'SystemLogMessage'> {
    return parseHelper(
      params,
      'systemLogMessage',
      defaultParams('SystemLogMessage', NetRegexes.logVersion),
    );
  }
}
