import { Lang } from '../../resources/languages';
import { LocaleText } from '../../types/trigger';

import { OopsyOptions } from './oopsy_options';

// Fields for net log ability lines.
export const kFieldFlags = 8;
export const kFieldDamage = 9;

// If kFieldFlags is any of these values, then consider field 10/11 as 8/9.
// It appears a little bit that flags come in pairs of values, but it's unclear
// what these mean.
export const kShiftFlagValues = ['3E', '113', '213', '313'];
export const kFlagInstantDeath = '36'; // Always 36 ?
// miss, damage, block, parry, instant death
export const kAttackFlags = ['01', '03', '05', '06', kFlagInstantDeath];
export const kHealFlags = ['04'];

// TODO: should we include damage != 0 here?
export const damageFields = {
  flags: `[^|]*(?:${kAttackFlags.join('|')})(?=\\|)`,
};

export const playerDamageFields = {
  targetId: '[^4].......',
  ...damageFields,
};

/* eslint-disable max-len */

/*
Field 7 Flags:
  '0' = meditation, aoe with no targets

  damage low bytes:
    0x01 = dodge
    0x03 = damage
    0x05 = blocked damage
    0x06 = parried damage
    0x?? = instant death

  damage modifiers:
    0x100 = crit damage
    0x200 = direct hit damage
    0x300 = crit direct hit damage

  heal modifiers:
    0x00004 = heal
    0x10004 = crit heal

  Special cases:
    * If flags are 3E, shift 9+10 two over to be 7+8.  (why???)
    * Plenary indulgence has flags=113/213/313 for stacks, shift two as well.

  Damage:
    * Left-extend zeroes to 8 chars, e.g. 2934001 => 02934001, or 1000 => 00001000.
    * Should be interpreted as 4 bytes (8 chars).
    * First two bytes are damage.
    * 00004000 mask implies extra damage (and some weird math):
      bytes = ABCD, where C = 0x40.
      total damage = DA(B-D), as three bytes together interpreted as an integer.
      e.g. 424E400F => 0F 42 (4E - 0F = 3F) => 0F423F => 999999
    * 00001000 mask implies 0 damage, e.g. hallowed.

Examples:
(1) 18216 damage from Grand Cross Alpha (basic damage)
  16:40001333:Neo Exdeath:242B:Grand Cross Alpha:1048638C:Tater Tot:750003:47280000:1C:80242B:0:0:0:0:0:0:0:0:0:0:0:0:36906:41241:5160:5160:880:1000:0.009226365:-7.81128:-1.192093E-07:16043015:17702272:12000:12000:1000:1000:-0.01531982:-19.02808:0:

(2) 82538 damage from Hyperdrive (0x4000 extra damage mask)
  15:40024FBA:Kefka:28E8:Hyperdrive:106C1DBA:Okonomi Yaki:750003:426B4001:1C:28E88000:0:0:0:0:0:0:0:0:0:0:0:0:35811:62464:4560:4560:940:1000:-0.1586061:-5.753153:0:30098906:31559062:12000:12000:1000:1000:0.3508911:0.4425049:2.384186E-07:

(3) 22109 damage from Grand Cross Omega (:3E:0: shift, unknown 0x40000 flag)
  16:40001333:Neo Exdeath:242D:Grand Cross Omega:1048638C:Tater Tot:3E:0:750003:565D0000:1C:80242D:0:0:0:0:0:0:0:0:0:0:41241:41241:5160:5160:670:1000:-0.3251641:6.526299:1.192093E-07:7560944:17702272:12000:12000:1000:1000:0:19:2.384186E-07:

(4) 15732 crit heal from 3 confession stack Plenary Indulgence (:?13:4C3: shift)
  16:10647D2F:Tako Yaki:1D09:Plenary Indulgence:106DD019:Okonomi Yaki:313:4C3:10004:3D74:0:0:0:0:0:0:0:0:0:0:0:0:7124:40265:14400:9192:1000:1000:-10.78815:11.94781:0:11343:40029:19652:16451:1000:1000:6.336648:7.710004:0:

(5) instant death twister
  16:40004D5D:Twintania:26AB:Twister:10573FDC:Tini Poutini:33:0:1C:26AB8000:0:0:0:0:0:0:0:0:0:0:0:0:43985:43985:5760:5760:910:1000:-8.42179:9.49251:-1.192093E-07:57250:57250:0:0:1000:1000:-8.565645:10.20959:0:

(6) zero damage targetless aoe (E0000000 target)
  16:103AAEE4:Potato Chippy:B1:Miasma II:E0000000::0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0::::::::::19400:40287:17649:17633:1000:1000:-0.656189:-3.799561:-5.960464E-08:

*/

/* eslint-enable */

export const ShortNamify = (
  name: string | undefined,
  playerNicks: { [name: string]: string },
): string => {
  // TODO: make this unique among the party in case of first name collisions.
  // TODO: probably this should be a general cactbot utility.
  if (!name)
    return '???';

  const nick = playerNicks[name];
  if (nick)
    return nick;

  const idx = name.indexOf(' ');
  return idx < 0 ? name : name.substr(0, idx);
};

export const Translate = (lang: Lang, obj?: LocaleText | string): string | undefined => {
  if (typeof obj !== 'object')
    return obj;
  return obj[lang] ?? obj['en'];
};

export const GetFormattedTime = (baseTime: number | undefined, time: number): string => {
  if (!baseTime)
    return '';
  const totalSeconds = Math.floor((time - baseTime) / 1000);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes}:${seconds < 10 ? `0${seconds}` : seconds}`;
};

// Turns a scrambled string damage field into an integer.
// Since fields are modified in place right now, this does nothing if called
// again with an integer.  This is kind of a hack, sorry.
export const UnscrambleDamage = (field?: string): number => {
  if (field === undefined)
    return 0;
  const len = field.length;
  if (len <= 4)
    return 0;
  // Get the left two bytes as damage.
  let damage = parseInt(field.substr(0, len - 4), 16);
  // Check for third byte == 0x40.
  if (field[len - 4] === '4') {
    // Wrap in the 4th byte as extra damage.  See notes above.
    const rightDamage = parseInt(field.substr(len - 2, 2), 16);
    damage = damage - rightDamage + (rightDamage << 16);
  }
  return damage;
};

export const IsPlayerId = (id?: string): boolean => {
  if (id === undefined)
    return false;
  const firstChar = id[0];
  return firstChar ? firstChar < '4' : false;
};

export const IsTriggerEnabled = (options: OopsyOptions, id: string): boolean => {
  if (id in options.DisabledTriggers)
    return false;

  const autoConfig = options.PerTriggerAutoConfig[id];
  if (autoConfig)
    return autoConfig.enabled;

  return true;
};

export const GetSoloMistakeText = (ability: string): LocaleText => {
  return {
    en: `${ability} (alone)`,
    de: `${ability} (allein)`,
    fr: `${ability} (seul(e))`,
    ja: `${ability} (一人)`,
    cn: `${ability} (单吃)`,
    ko: `${ability} (혼자 맞음)`,
  };
};

export const GetShareMistakeText = (ability: string, numTargets: number): LocaleText => {
  return {
    en: `${ability} (share x${numTargets})`,
    de: `${ability} (geteilt)`, // FIXME
    fr: `${ability} (partage)`, // FIXME
    ja: `${ability} (頭割り)`, // FIXME
    cn: `${ability} (重叠)`, // FIXME
    ko: `${ability} (같이 맞음)`, // FIXME
  };
};
