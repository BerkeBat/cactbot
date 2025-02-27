import NetRegexes from '../../../../../resources/netregexes';
import ZoneId from '../../../../../resources/zone_id';
import { RaidbossData } from '../../../../../types/data';
import { TriggerSet } from '../../../../../types/trigger';

export type Data = RaidbossData;

const triggerSet: TriggerSet<Data> = {
  zoneId: ZoneId.Snowcloak,
  triggers: [
    {
      id: 'Snowcloak Lunar Cry',
      type: 'StartsUsing',
      netRegex: NetRegexes.startsUsing({ id: 'C1F', source: 'Fenrir', capture: false }),
      alertText: (_data, _matches, output) => output.text!(),
      outputStrings: {
        text: {
          en: 'Hide behind Ice',
          de: 'Hinter dem Eis verstecken',
          fr: 'Cachez vous derrière un pilier de glace',
        },
      },
    },
  ],
  timelineReplace: [
    {
      'locale': 'de',
      'replaceSync': {
        'Fenrir': 'Fenrir',
      },
    },
    {
      'locale': 'fr',
      'replaceSync': {
        'Fenrir': 'Fenrir',
      },
    },
    {
      'locale': 'ja',
      'replaceSync': {
        'Fenrir': 'フェンリル',
      },
    },
    {
      'locale': 'cn',
      'replaceSync': {
        'Fenrir': '芬里尔',
      },
    },
    {
      'locale': 'ko',
      'replaceSync': {
        'Fenrir': '펜리르',
      },
    },
  ],
};

export default triggerSet;
