import { recolor, type Grid } from './pixel';

export interface SpriteDef {
  frames: Grid[];
  /** Animation frame rate when frames > 1. */
  fps?: number;
}

const PLAYER_TOP = [
  '...kkkkkk...',
  '..khhhhhhk..',
  '.khhhhhhhhk.',
  '.khsssssshk.',
  '.kskwsskwsk.',
  '.kssssssssk.',
  '..ksskkssk..',
  '..kppppppk..',
  '.kppwppwppk.',
  'ksppppppppsk',
  'kkPPPPPPPPkk',
];

const PLAYER_F_TOP = recolor(
  [
    '...kkkkkk...',
    '..khhhhhhk..',
    '.khhhhhhhhk.',
    'khhsssssshhk',
    'khskwsskwshk',
    'khsssssssshk',
    'khksskksskhk',
    '.khpppppphk.',
    '.kppwppwppk.',
    'ksppppppppsk',
    'kkPPPPPPPPkk',
  ],
  { p: 'o', P: 'O' },
);

const ENVELOPE = [
  'kkkkkkkkkkkk',
  'kwkwwwwwwkwk',
  'kwwkwwwwkwwk',
  'kwwwkwwkwwwk',
  'kwwwwkkwwwwk',
  'kwkkwwwwkkwk',
  'kwwwwkkwwwwk',
  'kkkkkkkkkkkk',
];

const POPUP = [
  'kkkkkkkkkkkk',
  'kbbbbbbbbrrk',
  'kkkkkkkkkkkk',
  'kwwwwwwwwwwk',
  'kwkkwwwwkkwk',
  'kwwwwwwwwwwk',
  'kwwkkkkkkwwk',
  'kwwwwwwwwwwk',
  'kwwggggggwwk',
  'kkkkkkkkkkkk',
];

const VIRUS = [
  'k.......k',
  '.k.kkk.k.',
  '..klllk..',
  '.klllllk.',
  'kklwlwlkk',
  '.klllllk.',
  'kklGlGlkk',
  '.kkkkkkk.',
  'k.k...k.k',
];

const GLITTER = [
  '....k....',
  '...kyk...',
  '..kkykk..',
  'kkyyyyykk',
  'kyykykyyk',
  'kkyyyyykk',
  '..kkykk..',
  '...kyk...',
  '....k....',
];

const FRIEND = [
  '...kkkk...',
  '..kcccck..',
  '.kckcckck.',
  '.kcccccck.',
  '..kcccck..',
  '...kkkk...',
  '.kkbbbbkk.',
  'kbbbwwbbbk',
  'kbbwwwwbbk',
  'kbbbwwbbbk',
  'kkkkkkkkkk',
];

const NOTE = [
  '....kkkkk',
  '....kmmmk',
  '....kmkkk',
  '....kmk..',
  '....kmk..',
  '..kkkmk..',
  '.kmmmmk..',
  'kmwmwmmk.',
  'kmmmmmmk.',
  '.kmmmmk..',
  '..kkkk...',
];

const BLOB_A = [
  '...kkkk...',
  '..kllllk..',
  '.kllllllk.',
  '.klkllklk.',
  '.kllllllk.',
  'kllclllllk',
  'kLLLLLLLLk',
  '.kkkkkkkk.',
];
const BLOB_B = [
  '..........',
  '..kkkkkk..',
  '.kllllllk.',
  '.klkllklk.',
  'kllllllllk',
  'kllclllllk',
  'kllllllllk',
  '.kkkkkkkk.',
];

const FLY = [
  'kk...kk',
  'kcckcck',
  '.kkkkk.',
  'kdwdwdk',
  '.kdddk.',
  '..kkk..',
];

const POOP_A = [
  '....k....',
  '...knk...',
  '..knnnk..',
  '.knnnnnk.',
  '.knwnwnk.',
  'knnnnnnnk',
  'knnkkknnk',
  '.kkkkkkk.',
];
const POOP_B = [...POOP_A.slice(0, 6), 'knnnnnnnk', '.kkkkkkk.'];

const MODEM = [
  '....k................k....',
  '....k................k....',
  '....k................k....',
  '.kkkkkkkkkkkkkkkkkkkkkkkk.',
  'kggggggggggggggggggggggggk',
  'kgwwwwwwwwwwwwwwwwwwwwwwgk',
  'kgglgglggyggyggrggrggggggk',
  'kggggggggggggggggggggggggk',
  'kggggkkkkggggggggkkkkggggk',
  'kgggkwwkkkggggggkkkwwkgggk',
  'kgggkwwwkkggggggkkwwwkgggk',
  'kggggkkkkggggggggkkkkggggk',
  'kggggggggggggggggggggggggk',
  'kggggggkkkkkkkkkkkkggggggk',
  'kggggggkwkwkwkwkwkkggggggk',
  'kggggggkkkkkkkkkkkkggggggk',
  'kddddddddddddddddddddddddk',
  '.kkkkkkkkkkkkkkkkkkkkkkkk.',
  '..kkk................kkk..',
];

const HEART = [
  '...kkkk........kkkk...',
  '..kmmmmk......kmmmmk..',
  '.kmmwmmmk....kmmmmmmk.',
  'kmmwmmmmmkkkkmmmmmmmmk',
  'kmmmmmmmmmmmmmmmmmmmmk',
  'kmkkkkkkkmmmmkkkkkkkmk',
  'kmkkwkkkkkkkkkkwkkkkmk',
  'kmmkkkkkmmmmmmkkkkkmmk',
  'kmmmmmmmmmmmmmmmmmmmmk',
  '.kmmmmmkkkkkkkkmmmmmk.',
  '.kmmmmmmkwwwwkmmmmmmk.',
  '..kmmmmmmkkkkmmmmmmk..',
  '...kmmmmmmmmmmmmmmk...',
  '....kmmmmmmmmmmmmk....',
  '.....kmmmmmmmmmmk.....',
  '......kmmmmmmmmk......',
  '.......kmmmmmmk.......',
  '........kmmmmk........',
  '.........kkkk.........',
];

const PET = [
  '..........kkkk..........',
  '.........kyyyyk.........',
  '..........kkkk..........',
  '...........kk...........',
  '.......kkkkkkkkkk.......',
  '.....kkllllllllllkk.....',
  '....kllllllllllllllk....',
  '...kllllllllllllllllk...',
  '..kllkkkkllllllkkkkllk..',
  '..klkwwwwkllllkwwwwklk..',
  '.kllkwkkwkllllkwkkwkllk.',
  '.kllkwkkwkllllkwkkwkllk.',
  '.kllkwwwwkllllkwwwwkllk.',
  '.kllckkkkllllllkkkkcllk.',
  '.kllcllllllllllllllcllk.',
  '.klllllllkkkkkklllllllk.',
  '.kllllllkrrrrrrkllllllk.',
  '.klllllllkkkkkklllllllk.',
  '..kllllllllllllllllllk..',
  '...kllllllllllllllllk...',
  '....kkGGkkkkkkkkGGkk....',
  '.....kkkk......kkkk.....',
];

const CHIP = [
  '....kkkk....',
  '....kggk....',
  '.kkkkkkkkkk.',
  '.kwwwwwwwwk.',
  '.kwllllllwk.',
  '.kwllllllwk.',
  '.kwlkllklwk.',
  '.kwllllllwk.',
  '.kwlkllklwk.',
  '.kwllkkllwk.',
  '.kwllllllwk.',
  '.kwllllllwk.',
  '.kwwwwwwwwk.',
  '.kkkkkkkkkk.',
];

const BULLET = ['.kkk.', 'kwwwk', 'kwwwk', 'kwwwk', '.kkk.'];

export const SPRITES = {
  player_female: {
    fps: 8,
    frames: [
      [...PLAYER_F_TOP, '..kBBkkBBk..', '..kkk..kkk..'],
      [...PLAYER_F_TOP, '.kBBk..kBBk.', '.kkk....kkk.'],
    ],
  },
  player_male: {
    fps: 8,
    frames: [
      [...PLAYER_TOP, '..kBBkkBBk..', '..kkk..kkk..'],
      [...PLAYER_TOP, '.kBBk..kBBk.', '.kkk....kkk.'],
    ],
  },
  spam: { fps: 4, frames: [ENVELOPE, ENVELOPE.map((r, i) => (i === 5 ? 'kwwkkwwkkwwk' : r))] },
  popup: {
    fps: 3,
    frames: [
      POPUP,
      POPUP.map((r, i) => (i === 6 ? 'kwwkrrrrkwwk' : i === 7 ? 'kwwwkkkkwwwk' : r)),
    ],
  },
  virus: {
    fps: 6,
    frames: [
      VIRUS,
      VIRUS.map((r, i) => (i === 0 ? '.k.....k.' : i === 6 ? '.klGlGlk.' : i === 8 ? '.k.k.k.k.' : r)),
    ],
  },
  glitter: { fps: 6, frames: [GLITTER, recolor(GLITTER, { y: 'm' })] },
  friend: { fps: 3, frames: [FRIEND, FRIEND.map((r, i) => (i === 10 ? 'k.kkkkkk.k' : r))] },
  friend_gold: { fps: 6, frames: [recolor(FRIEND, { c: 'y', b: 'o' }), recolor(FRIEND, { c: 'w', b: 'y' })] },
  note: { fps: 4, frames: [NOTE, recolor(NOTE, { m: 'p' })] },
  blob: { fps: 4, frames: [BLOB_A, BLOB_B] },
  fly: { fps: 10, frames: [FLY, recolor(FLY, { c: 'w' })] },
  poop: { fps: 3, frames: [POOP_A, POOP_B] },
  modem: { fps: 4, frames: [MODEM, recolor(MODEM, { l: 'r', r: 'l' })] },
  modem_angry: { fps: 8, frames: [recolor(MODEM, { g: 'o' }), recolor(MODEM, { g: 'o', l: 'r', r: 'l' })] },
  heart: { fps: 4, frames: [HEART, recolor(HEART, { m: 'p' })] },
  heart_angry: { fps: 8, frames: [recolor(HEART, { m: 'r' }), recolor(HEART, { m: 'p' })] },
  pet: { fps: 3, frames: [PET, recolor(PET, { c: 'w' })] },
  pet_angry: { fps: 8, frames: [recolor(PET, { l: 'o', G: 'r' }), recolor(PET, { l: 'r', G: 'o' })] },
  chip: { fps: 2, frames: [CHIP, CHIP.map((r, i) => (i === 6 ? '.kwllllllwk.' : r))] },
  chip_low: { frames: [recolor(CHIP, { l: 'r' })] },
  mom: {
    frames: [
      [
        '....kkkk....',
        '...kggggk...',
        '..kkkggkkk..',
        '.kggggggggk.',
        'kggssssssggk',
        'kgkwwkkwwkgk',
        'kgssssssssgk',
        '.kssmssmssk.',
        '..ksskkssk..',
        '...kssssk...',
        '..kmmmmmmk..',
        '.kmmmmmmmmk.',
      ],
    ],
  },
  gem: { fps: 4, frames: [['..k..', '.kck.', 'kcwck', '.kck.', '..k..'], ['..k..', '.kwk.', 'kwcwk', '.kwk.', '..k..']] },
  bolt: {
    fps: 4,
    frames: [
      ['....kk.', '...kyk.', '..kyk..', '.kyyykk', 'kkkyyk.', '..kyk..', '.kyk...', '.kk....'],
      ['....kk.', '...kwk.', '..kwk..', '.kwwwkk', 'kkkwwk.', '..kwk..', '.kwk...', '.kk....'],
    ],
  },
  shadow: { frames: [['..kkkkkk..', '.kkkkkkkk.', '..kkkkkk..']] },
  shadow_big: { frames: [['....kkkkkkkkkkkk....', '..kkkkkkkkkkkkkkkk..', 'kkkkkkkkkkkkkkkkkkkk', '..kkkkkkkkkkkkkkkk..', '....kkkkkkkkkkkk....']] },
  icon_snd: { frames: [recolor(['...k...', '..kk.k.', 'kkkk..k', 'kkkk..k', 'kkkk..k', '..kk.k.', '...k...'], { k: 'w' })] },
  icon_mute: { frames: [recolor(['...k...', '..kk...', 'kkkk..k', 'kkkk.k.', 'kkkk..k', '..kk...', '...k...'], { k: 'g' })] },
  icon_shots: { frames: [['..kk.....', '.kcck....', '.kcck.kk.', '..kk.kcck', '.kk..kcck', 'kcck..kk.', 'kcck.....', '.kk......', '.........']] },
  icon_damage: { frames: [['....k....', '...kyk...', 'k.kyyyk.k', '.kyoooyk.', 'kyoorooyk', '.kyoooyk.', 'k.kyyyk.k', '...kyk...', '....k....']] },
  icon_rate: { frames: [['..kkkkk..', '.kwwwwwk.', 'kwwwkwwwk', 'kwwwkwwwk', 'kwwwkkkwk', 'kwwwwwwwk', 'kwwwwwwwk', '.kwwwwwk.', '..kkkkk..']] },
  icon_shield: { frames: [['.kkkkkkk.', 'kbbbbbbbk', 'kbwbbbbbk', 'kbwbbbbbk', 'kbbbbbbbk', '.kbbbbbk.', '.kbbbbbk.', '..kbbbk..', '...kkk...']] },
  icon_range: { frames: [['......ll.', '......ll.', '......ll.', '...ll.ll.', '...ll.ll.', '...ll.ll.', 'll.ll.ll.', 'll.ll.ll.', 'll.ll.ll.']] },
  icon_speed: { frames: [['.........', 'c...c....', 'cc..cc...', '.cc..cc..', '..cc..cc.', '.cc..cc..', 'cc..cc...', 'c...c....', '.........']] },
  icon_pierce: { frames: [['.........', '.....c...', '.....cc..', 'cccccccc.', 'cccccccc.', '.....cc..', '.....c...', '.........', '.........']] },
  ping: { frames: [['.cc.', 'cwwc', 'cwwc', '.cc.']] },
  orbiter: { frames: [['.kkkk.', 'kllllk', 'klwwlk', 'klwwlk', 'kllllk', '.kkkk.']] },
  bullet_r: { frames: [recolor(BULLET, { w: 'r' }).map((r, i) => (i === 2 ? 'krwrk' : r))] },
  bullet_m: { frames: [recolor(BULLET, { w: 'm' }).map((r, i) => (i === 2 ? 'kmwmk' : r))] },
  bullet_c: { frames: [recolor(BULLET, { w: 'c' }).map((r, i) => (i === 2 ? 'kcwck' : r))] },
  bullet_o: { frames: [recolor(BULLET, { w: 'o' }).map((r, i) => (i === 2 ? 'kowok' : r))] },
} satisfies Record<string, SpriteDef>;

export type SpriteKey = keyof typeof SPRITES;
