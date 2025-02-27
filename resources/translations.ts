import { CactbotBaseRegExp } from '../types/net_trigger';
import {
  commonReplacement,
  partialCommonTimelineReplacementKeys,
  partialCommonTriggerReplacementKeys,
} from '../ui/raidboss/common_replacement';
import { TimelineReplacement } from '../ui/raidboss/timeline_parser';

import { Lang } from './languages';
import NetRegexes from './netregexes';
import Regexes from './regexes';

// Fill in LocaleRegex so that things like LocaleRegex.countdownStart.de is a valid regex.
const localeLines = {
  countdownStart: {
    en: 'Battle commencing in (?<time>\\y{Float}) seconds! \\((?<player>.*?)\\)',
    de: 'Noch (?<time>\\y{Float}) Sekunden bis Kampfbeginn! \\((?<player>.*?)\\)',
    fr: 'Début du combat dans (?<time>\\y{Float}) secondes[ ]?! \\((?<player>.*?)\\)',
    ja: '戦闘開始まで(?<time>\\y{Float})秒！ （(?<player>.*?)）',
    cn: '距离战斗开始还有(?<time>\\y{Float})秒！ （(?<player>.*?)）',
    ko: '전투 시작 (?<time>\\y{Float})초 전! \\((?<player>.*?)\\)',
  },
  countdownEngage: {
    en: 'Engage!',
    de: 'Start!',
    fr: 'À l\'attaque[ ]?!',
    ja: '戦闘開始！',
    cn: '战斗开始！',
    ko: '전투 시작!',
  },
  countdownCancel: {
    en: 'Countdown canceled by (?<player>\\y{Name})',
    de: '(?<player>\\y{Name}) hat den Countdown abgebrochen',
    fr: 'Le compte à rebours a été interrompu par (?<player>\\y{Name})[ ]?\\.',
    ja: '(?<player>\\y{Name})により、戦闘開始カウントがキャンセルされました。',
    cn: '(?<player>\\y{Name})取消了战斗开始倒计时。',
    ko: '(?<player>\\y{Name}) 님이 초읽기를 취소했습니다\\.',
  },
  areaSeal: {
    en: '(?<area>.*?) will be sealed off in (?<time>\\y{Float}) seconds!',
    de: 'Noch (?<time>\\y{Float}) Sekunden, bis sich (?<area>.*?) schließt',
    fr: 'Fermeture (?<area>.*?) dans (?<time>\\y{Float}) secondes[ ]?\\.',
    ja: '(?<area>.*?)の封鎖まであと(?<time>\\y{Float})秒',
    cn: '距(?<area>.*?)被封锁还有(?<time>\\y{Float})秒',
    ko: '(?<time>\\y{Float})초 후에 (?<area>.*?)(이|가) 봉쇄됩니다\\.',
  },
  areaUnseal: {
    en: '(?<area>.*?) is no longer sealed.',
    de: '(?<area>.*?) öffnet sich erneut.',
    fr: 'Ouverture (?<area>.*?)[ ]?!',
    ja: '(?<area>.*?)の封鎖が解かれた……',
    cn: '(?<area>.*?)的封锁解除了',
    ko: '(?<area>.*?)의 봉쇄가 해제되었습니다\\.',
  },
  // Recipe name always start with \ue0bb
  // HQ icon is \ue03c
  craftingStart: {
    en: 'You begin synthesizing (?<count>(an?|\\d+) )?\ue0bb(?<recipe>.*)\\.',
    de:
      'Du hast begonnen, durch Synthese (?<count>(ein(e|es|em|er)?|\\d+) )?\ue0bb(?<recipe>.*) herzustellen\\.',
    fr: 'Vous commencez à fabriquer (?<count>(une?|\\d+) )?\ue0bb(?<recipe>.*)\\.',
    ja: '(?<player>\\y{Name})は\ue0bb(?<recipe>.*)(×(?<count>\\d+))?の製作を開始した。',
    cn: '(?<player>\\y{Name})开始制作“\ue0bb(?<recipe>.*)”(×(?<count>\\d+))?。',
    ko: '\ue0bb(?<recipe>.*)(×(?<count>\\d+)개)? 제작을 시작합니다\\.',
  },
  trialCraftingStart: {
    en: 'You begin trial synthesis of \ue0bb(?<recipe>.*)\\.',
    de: 'Du hast mit der Testsynthese von \ue0bb(?<recipe>.*) begonnen\\.',
    fr: 'Vous commencez une synthèse d\'essai pour une? \ue0bb(?<recipe>.*)\\.',
    ja: '(?<player>\\y{Name})は\ue0bb(?<recipe>.*)の製作練習を開始した。',
    cn: '(?<player>\\y{Name})开始练习制作\ue0bb(?<recipe>.*)。',
    ko: '\ue0bb(?<recipe>.*) 제작 연습을 시작합니다\\.',
  },
  craftingFinish: {
    en: 'You synthesize (?<count>(an?|\\d+) )?\ue0bb(?<recipe>.*)(\ue03c)?\\.',
    de:
      'Du hast erfolgreich (?<count>(ein(e|es|em|er)?|\\d+) )?(?<recipe>.*)(\ue03c)? hergestellt\\.',
    fr: 'Vous fabriquez (?<count>(une?|\\d+) )?\ue0bb(?<recipe>.*)(\ue03c)?\\.',
    ja: '(?<player>\\y{Name})は\ue0bb(?<recipe>.*)(\ue03c)?(×(?<count>\\d+))?を完成させた！',
    cn: '(?<player>\\y{Name})制作“\ue0bb(?<recipe>.*)(\ue03c)?”(×(?<count>\\d+))?成功！',
    ko: '(?<player>\\y{Name}) 님이 \ue0bb(?<recipe>.*)(\ue03c)?(×(?<count>\\d+)개)?(을|를) 완성했습니다!',
  },
  trialCraftingFinish: {
    en: 'Your trial synthesis of \ue0bb(?<recipe>.*) proved a success!',
    de: 'Die Testsynthese von \ue0bb(?<recipe>.*) war erfolgreich!',
    fr: 'Votre synthèse d\'essai pour fabriquer \ue0bb(?<recipe>.*) a été couronnée de succès!',
    ja: '(?<player>\\y{Name})は\ue0bb(?<recipe>.*)の製作練習に成功した！',
    cn: '(?<player>\\y{Name})练习制作\ue0bb(?<recipe>.*)成功了！',
    ko: '\ue0bb(?<recipe>.*) 제작 연습에 성공했습니다!',
  },
  craftingFail: {
    en: 'Your synthesis fails!',
    de: 'Deine Synthese ist fehlgeschlagen!',
    fr: 'La synthèse échoue\\.{3}',
    ja: '(?<player>\\y{Name})は製作に失敗した……',
    cn: '(?<player>\\y{Name})制作失败了……',
    ko: '제작에 실패했습니다……\\.',
  },
  trialCraftingFail: {
    en: 'Your trial synthesis of \ue0bb(?<recipe>.*) failed\\.{3}',
    de: 'Die Testsynthese von \ue0bb(?<recipe>.*) ist fehlgeschlagen\\.{3}',
    fr:
      'Votre synthèse d\'essai pour fabriquer \ue0bb(?<recipe>.*) s\'est soldée par un échec\\.{3}',
    ja: '(?<player>\\y{Name})は\ue0bb(?<recipe>.*)の製作練習に失敗した……',
    cn: '(?<player>\\y{Name})练习制作\ue0bb(?<recipe>.*)失败了……',
    ko: '\ue0bb(?<recipe>.*) 제작 연습에 실패했습니다……\\.',
  },
  craftingCancel: {
    en: 'You cancel the synthesis\\.',
    de: 'Du hast die Synthese abgebrochen\\.',
    fr: 'La synthèse est annulée\\.',
    ja: '(?<player>\\y{Name})は製作を中止した。',
    cn: '(?<player>\\y{Name})中止了制作作业。',
    ko: '제작을 중지했습니다\\.',
  },
  trialCraftingCancel: {
    en: 'You abandoned trial synthesis\\.',
    de: 'Testsynthese abgebrochen\\.',
    fr: 'Vous avez interrompu la synthèse d\'essai\\.',
    ja: '(?<player>\\y{Name})は製作練習を中止した。',
    cn: '(?<player>\\y{Name})停止了练习。',
    ko: '제작 연습을 중지했습니다\\.',
  },
} as const;

type LocaleLine = { en: string } & Partial<Record<Exclude<Lang, 'en'>, string>>;

type LocaleRegexesObj = Record<keyof typeof localeLines, Record<Lang, RegExp>>;

class RegexSet {
  regexes?: LocaleRegexesObj;
  netRegexes?: LocaleRegexesObj;

  get localeRegex(): LocaleRegexesObj {
    if (this.regexes)
      return this.regexes;
    this.regexes = this.buildLocaleRegexes(
      localeLines,
      (s: string) => Regexes.gameLog({ line: s + '.*?' }),
    );
    return this.regexes;
  }

  get localeNetRegex(): LocaleRegexesObj {
    if (this.netRegexes)
      return this.netRegexes;
    this.netRegexes = this.buildLocaleRegexes(
      localeLines,
      (s: string) => NetRegexes.gameLog({ line: s + '[^|]*?' }),
    );
    return this.netRegexes;
  }

  buildLocaleRegexes(
    locales: typeof localeLines,
    builder: (s: string) => CactbotBaseRegExp<'GameLog'> | RegExp,
  ): LocaleRegexesObj {
    return Object.fromEntries(
      Object
        .entries(locales)
        .map(([key, lines]) => [key, this.buildLocaleRegex(lines, builder)]),
    ) as LocaleRegexesObj;
  }

  buildLocaleRegex(
    lines: LocaleLine,
    builder: (s: string) => CactbotBaseRegExp<'GameLog'> | RegExp,
  ): Record<Lang, CactbotBaseRegExp<'GameLog'> | RegExp> {
    const regexEn = builder(lines.en);
    return {
      en: regexEn,
      de: lines.de ? builder(lines.de) : regexEn,
      fr: lines.fr ? builder(lines.fr) : regexEn,
      ja: lines.ja ? builder(lines.ja) : regexEn,
      cn: lines.cn ? builder(lines.cn) : regexEn,
      ko: lines.ko ? builder(lines.ko) : regexEn,
    };
  }
}

const regexSet = new RegexSet();

export const LocaleRegex = regexSet.localeRegex;
export const LocaleNetRegex = regexSet.localeNetRegex;

// Translate a trigger or timeline regex (replaceSync) or timeline text (replaceText),
// returning the text and whether or not it can be considered "translated".
// Note, this won't catch anything that needs multiple translations, but will catch
// anything from common translations that are partial (e.g. a seal regex needs
// a zone name to be considered a full translation.
export const translateWithReplacements = (
  text: string,
  replaceKey: 'replaceSync' | 'replaceText',
  replaceLang: Lang,
  replacements?: TimelineReplacement[],
): { text: string; wasTranslated: boolean } => {
  // All regex replacements are always global.
  const isGlobal = replaceKey === 'replaceSync';

  let wasTranslated = false;
  for (const r of replacements ?? []) {
    if (r.locale && r.locale !== replaceLang)
      continue;
    const reps = r[replaceKey];
    if (!reps)
      continue;
    for (const [key, value] of Object.entries(reps)) {
      const regex = isGlobal ? Regexes.parseGlobal(key) : Regexes.parse(key);
      if (text.match(regex))
        wasTranslated = true;
      text = text.replace(regex, value);
    }
  }

  // Common Replacements
  const replacement = commonReplacement[replaceKey];
  for (const [key, value] of Object.entries(replacement ?? {})) {
    const repl = value[replaceLang];
    if (!repl)
      continue;
    const regex = isGlobal ? Regexes.parseGlobal(key) : Regexes.parse(key);

    const partialKeys = replaceKey === 'replaceSync'
      ? partialCommonTriggerReplacementKeys
      : partialCommonTimelineReplacementKeys;
    if (text.match(regex)) {
      // Consider any partial translations as "not found" (e.g. a seal
      // message that still needs the zone name to be translated to be
      // considered fully translated).
      let isPartial = false;
      for (const partialKey of partialKeys) {
        if (Regexes.parseGlobal(partialKey).test(key)) {
          isPartial = true;
          break;
        }
      }
      if (!isPartial)
        wasTranslated = true;
    }

    text = text.replace(regex, repl);
  }

  return { text, wasTranslated };
};

// Translates a timeline or trigger regex for a given language.
export const translateRegex = (
  text: string | RegExp,
  replaceLang: Lang,
  replacements?: TimelineReplacement[],
): string => {
  if (typeof text === 'string')
    return translateWithReplacements(text, 'replaceSync', replaceLang, replacements).text;
  return translateWithReplacements(text.source, 'replaceSync', replaceLang, replacements).text;
};

// Translates a timeline text for a given language.
export const translateText = (
  text: string,
  replaceLang: Lang,
  replacements?: TimelineReplacement[],
): string => translateWithReplacements(text, 'replaceText', replaceLang, replacements).text;
